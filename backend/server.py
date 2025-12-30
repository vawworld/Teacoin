from fastapi import FastAPI, APIRouter, HTTPException, Header, Cookie, Response, Depends, UploadFile, File
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
import uuid
from datetime import datetime, timezone, timedelta
import socketio
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Default TeaCoins for new users
DEFAULT_TEACOINS = 100
TEA_ORDER_COST = 1  # Cost per tea order in TeaCoins

# Socket.IO setup - using /socket.io path (standard)
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25
)

# Create the main app
fastapi_app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Socket.IO app wrapping FastAPI - socket.io will be at /socket.io
socket_app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path='socket.io')

# ==================== MODELS ====================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    profession: Optional[str] = None
    bio: Optional[str] = None
    skills: List[str] = []
    location: Optional[str] = None
    languages: List[str] = []
    interests: List[str] = []
    help_offered: Optional[str] = None
    help_needed: Optional[str] = None
    experience_years: Optional[int] = None
    industry: Optional[str] = None
    online: bool = False
    last_seen: Optional[datetime] = None
    created_at: datetime
    # TeaCoins Wallet
    teacoins: int = DEFAULT_TEACOINS
    # Seller fields
    is_seller: bool = False
    seller_status: Optional[str] = None  # "pending", "approved", "rejected"
    seller_requested_at: Optional[datetime] = None
    # Admin field
    is_admin: bool = False

class UserProfile(BaseModel):
    profession: Optional[str] = None
    bio: Optional[str] = None
    skills: List[str] = []
    picture: Optional[str] = None
    location: Optional[str] = None
    languages: List[str] = []
    interests: List[str] = []
    help_offered: Optional[str] = None
    help_needed: Optional[str] = None
    experience_years: Optional[int] = None
    industry: Optional[str] = None

class SessionData(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: str

class Conversation(BaseModel):
    conversation_id: str
    type: str  # "direct" or "group"
    participants: List[str]  # user_ids
    name: Optional[str] = None  # For group chats
    created_by: str
    created_at: datetime
    last_message: Optional[Dict[str, Any]] = None

class Message(BaseModel):
    message_id: str
    conversation_id: str
    sender_id: str
    sender_name: str
    sender_picture: Optional[str] = None
    content: Optional[str] = None
    image: Optional[str] = None  # base64
    timestamp: datetime
    read_by: List[str] = []

class CreateConversation(BaseModel):
    type: str
    participant_ids: List[str]
    name: Optional[str] = None

class SendMessage(BaseModel):
    conversation_id: str
    content: Optional[str] = None
    image: Optional[str] = None

# ==================== TEACOINS MODELS ====================

class MenuItem(BaseModel):
    item_id: str
    seller_id: str
    seller_name: str
    name: str
    description: Optional[str] = None
    image: Optional[str] = None
    price: int = TEA_ORDER_COST  # Always 1 TeaCoin
    available: bool = True
    created_at: datetime

class CreateMenuItem(BaseModel):
    name: str
    description: Optional[str] = None
    image: Optional[str] = None
    price: int = 1  # Default price is 1 TeaCoin

class UpdateMenuItem(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    available: Optional[bool] = None

class Order(BaseModel):
    order_id: str
    buyer_id: str
    buyer_name: str
    seller_id: str
    seller_name: str
    item_id: str
    item_name: str
    status: str  # "pending", "preparing", "ready", "delivered", "confirmed", "cancelled"
    created_at: datetime
    updated_at: datetime
    delivered_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None

class CreateOrder(BaseModel):
    item_id: str

class UpdateOrderStatus(BaseModel):
    status: str  # "preparing", "ready", "delivered"

class Transaction(BaseModel):
    transaction_id: str
    from_user_id: Optional[str]  # None for signup bonus
    to_user_id: str
    amount: int
    transaction_type: str  # "signup_bonus", "order_payment", "order_received"
    order_id: Optional[str] = None
    description: str
    timestamp: datetime

class SellerRequest(BaseModel):
    apply: bool = True  # True to apply, False to withdraw

# ==================== AUTH HELPERS ====================

async def get_current_user(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None)
) -> Optional[User]:
    """Get current user from session token (cookie or header)"""
    # Extract token from header or cookie
    header_token = None
    if authorization and authorization.startswith("Bearer "):
        header_token = authorization[7:]  # Remove "Bearer " prefix
    
    token = session_token or header_token
    
    logging.info(f"Auth check - Cookie token: {bool(session_token)}, Header token: {bool(header_token)}, Final token: {token[:20] if token else 'None'}...")
    
    if not token:
        return None
    
    # Find session
    session = await db.user_sessions.find_one(
        {"session_token": token},
        {"_id": 0}
    )
    
    if not session:
        return None
    
    # Check expiry
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        return None
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0}
    )
    
    if user_doc:
        return User(**user_doc)
    
    return None

def require_auth(user: Optional[User] = Depends(get_current_user)) -> User:
    """Dependency that requires authentication"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# ==================== MESSAGE ROUTES ====================

@api_router.post("/messages")
async def send_message_http(
    message_data: SendMessage,
    current_user: User = Depends(require_auth)
):
    """Send a message via HTTP (polling alternative to Socket.io)"""
    try:
        # Create message
        message_id = f"msg_{uuid.uuid4().hex[:12]}"
        message_doc = {
            "message_id": message_id,
            "conversation_id": message_data.conversation_id,
            "sender_id": current_user.user_id,
            "sender_name": current_user.name,
            "sender_picture": current_user.picture,
            "content": message_data.content,
            "image": message_data.image,
            "timestamp": datetime.now(timezone.utc),
            "read_by": [current_user.user_id]
        }
        
        # Save message to database
        await db.messages.insert_one(message_doc.copy())
        
        # Update conversation
        await db.conversations.update_one(
            {"conversation_id": message_data.conversation_id},
            {
                "$set": {
                    "last_message": {
                        "content": message_data.content,
                        "sender_name": current_user.name,
                        "timestamp": datetime.now(timezone.utc)
                    }
                }
            }
        )
        
        # Return the message without _id and with ISO timestamp
        message_response = {
            "message_id": message_id,
            "conversation_id": message_data.conversation_id,
            "sender_id": current_user.user_id,
            "sender_name": current_user.name,
            "sender_picture": current_user.picture,
            "content": message_data.content,
            "image": message_data.image,
            "timestamp": message_doc["timestamp"].isoformat(),
            "read_by": [current_user.user_id]
        }
        
        return message_response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== AUTH ROUTES ====================

@api_router.get("/auth/callback")
async def auth_callback(session_id: str, response: Response):
    """Handle auth callback from Emergent Auth"""
    try:
        # Exchange session_id for user data
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid session")
            
            user_data = resp.json()
        
        # Create or get user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        existing_user = await db.users.find_one(
            {"email": user_data["email"]},
            {"_id": 0}
        )
        
        is_new_user = existing_user is None
        
        if not existing_user:
            # Create new user with 100 TeaCoins
            await db.users.insert_one({
                "user_id": user_id,
                "email": user_data["email"],
                "name": user_data["name"],
                "picture": user_data.get("picture"),
                "profession": None,
                "bio": None,
                "skills": [],
                "online": False,
                "last_seen": None,
                "created_at": datetime.now(timezone.utc),
                # TeaCoins wallet
                "teacoins": DEFAULT_TEACOINS,
                "is_seller": False,
                "seller_status": None,
                "seller_requested_at": None
            })
            
            # Create signup bonus transaction
            await db.transactions.insert_one({
                "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
                "from_user_id": None,  # System bonus
                "to_user_id": user_id,
                "amount": DEFAULT_TEACOINS,
                "transaction_type": "signup_bonus",
                "order_id": None,
                "description": "Welcome bonus - 100 TeaCoins!",
                "timestamp": datetime.now(timezone.utc)
            })
        else:
            user_id = existing_user["user_id"]
        
        # Create session
        session_token = user_data["session_token"]
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc)
        })
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7*24*60*60,
            path="/"
        )
        
        return {"session_token": session_token, "user_id": user_id, "is_new_user": is_new_user}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(require_auth)):
    """Get current user info"""
    return current_user

@api_router.post("/auth/logout")
async def logout(response: Response, current_user: User = Depends(require_auth)):
    """Logout user"""
    # Delete all sessions for this user
    await db.user_sessions.delete_many({"user_id": current_user.user_id})
    
    # Clear cookie
    response.delete_cookie(key="session_token", path="/")
    
    return {"message": "Logged out"}

# ==================== PROFILE ROUTES ====================

@api_router.put("/profile")
async def update_profile(
    profile: UserProfile,
    current_user: User = Depends(require_auth)
):
    """Update user profile"""
    update_data = {}
    if profile.profession is not None:
        update_data["profession"] = profile.profession.lower()
    if profile.bio is not None:
        update_data["bio"] = profile.bio
    if profile.skills:
        update_data["skills"] = [s.lower() for s in profile.skills]
    if profile.picture is not None:
        update_data["picture"] = profile.picture
    if profile.location is not None:
        update_data["location"] = profile.location
    if profile.languages:
        update_data["languages"] = [lang.lower() for lang in profile.languages]
    if profile.interests:
        update_data["interests"] = [i.lower() for i in profile.interests]
    if profile.help_offered is not None:
        update_data["help_offered"] = profile.help_offered
    if profile.help_needed is not None:
        update_data["help_needed"] = profile.help_needed
    if profile.experience_years is not None:
        update_data["experience_years"] = profile.experience_years
    if profile.industry is not None:
        update_data["industry"] = profile.industry.lower()
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": update_data}
    )
    
    return {"message": "Profile updated"}

@api_router.get("/users/search")
async def search_users(
    q: str,
    current_user: User = Depends(require_auth)
):
    """Search users by profession, skills, name, location, languages, interests, help offered/needed, or industry"""
    query_lower = q.lower().replace("#", "")
    
    users = await db.users.find(
        {
            "$or": [
                {"profession": {"$regex": query_lower, "$options": "i"}},
                {"skills": {"$regex": query_lower, "$options": "i"}},
                {"name": {"$regex": query_lower, "$options": "i"}},
                {"location": {"$regex": query_lower, "$options": "i"}},
                {"languages": {"$regex": query_lower, "$options": "i"}},
                {"interests": {"$regex": query_lower, "$options": "i"}},
                {"help_offered": {"$regex": query_lower, "$options": "i"}},
                {"help_needed": {"$regex": query_lower, "$options": "i"}},
                {"industry": {"$regex": query_lower, "$options": "i"}}
            ],
            "user_id": {"$ne": current_user.user_id}
        },
        {"_id": 0}
    ).to_list(50)
    
    return users

@api_router.get("/users/all")
async def get_all_users(
    current_user: User = Depends(require_auth)
):
    """Get all users except current user"""
    users = await db.users.find(
        {"user_id": {"$ne": current_user.user_id}},
        {"_id": 0}
    ).to_list(100)
    
    return users

@api_router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    current_user: User = Depends(require_auth)
):
    """Get user by ID"""
    user = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

# ==================== WALLET ROUTES ====================

@api_router.get("/wallet")
async def get_wallet(current_user: User = Depends(require_auth)):
    """Get current user's wallet info"""
    user = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "teacoins": 1, "is_seller": 1, "seller_status": 1, "is_admin": 1}
    )
    
    # Get pending orders count (for sellers)
    pending_orders = 0
    if user.get("is_seller") and user.get("seller_status") == "approved":
        pending_orders = await db.orders.count_documents({
            "seller_id": current_user.user_id,
            "status": {"$in": ["pending", "preparing", "ready"]}
        })
    
    # Get user's active orders count (as buyer)
    active_orders = await db.orders.count_documents({
        "buyer_id": current_user.user_id,
        "status": {"$in": ["pending", "preparing", "ready", "delivered"]}
    })
    
    # Get pending seller requests count (for admin)
    pending_seller_requests = 0
    if user.get("is_admin"):
        pending_seller_requests = await db.users.count_documents({
            "seller_status": "pending"
        })
    
    return {
        "teacoins": user.get("teacoins", DEFAULT_TEACOINS),
        "is_seller": user.get("is_seller", False),
        "seller_status": user.get("seller_status"),
        "is_admin": user.get("is_admin", False),
        "pending_orders": pending_orders,
        "active_orders": active_orders,
        "pending_seller_requests": pending_seller_requests
    }

@api_router.get("/wallet/transactions")
async def get_transactions(
    limit: int = 50,
    current_user: User = Depends(require_auth)
):
    """Get user's transaction history"""
    transactions = await db.transactions.find(
        {
            "$or": [
                {"from_user_id": current_user.user_id},
                {"to_user_id": current_user.user_id}
            ]
        },
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    # Convert timestamps to ISO strings
    for txn in transactions:
        if "timestamp" in txn and txn["timestamp"]:
            txn["timestamp"] = txn["timestamp"].isoformat()
    
    return transactions

# ==================== SELLER ROUTES ====================

@api_router.post("/seller/apply")
async def apply_seller(
    request: SellerRequest,
    current_user: User = Depends(require_auth)
):
    """Apply to become a seller or withdraw application"""
    if request.apply:
        # Check if already a seller or has pending request
        user = await db.users.find_one(
            {"user_id": current_user.user_id},
            {"_id": 0, "is_seller": 1, "seller_status": 1}
        )
        
        if user.get("is_seller") and user.get("seller_status") == "approved":
            raise HTTPException(status_code=400, detail="You are already an approved seller")
        
        if user.get("seller_status") == "pending":
            raise HTTPException(status_code=400, detail="You already have a pending seller request")
        
        # Submit seller application
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {
                "$set": {
                    "seller_status": "pending",
                    "seller_requested_at": datetime.now(timezone.utc)
                }
            }
        )
        
        return {"message": "Seller application submitted. Please wait for admin approval."}
    else:
        # Withdraw application
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {
                "$set": {
                    "seller_status": None,
                    "seller_requested_at": None
                }
            }
        )
        return {"message": "Seller application withdrawn."}

@api_router.get("/seller/status")
async def get_seller_status(current_user: User = Depends(require_auth)):
    """Get seller application status"""
    user = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "is_seller": 1, "seller_status": 1, "seller_requested_at": 1}
    )
    
    return {
        "is_seller": user.get("is_seller", False),
        "seller_status": user.get("seller_status"),
        "seller_requested_at": user.get("seller_requested_at").isoformat() if user.get("seller_requested_at") else None
    }

# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/seller-requests")
async def get_seller_requests(current_user: User = Depends(require_auth)):
    """Get pending seller requests (admin only - for MVP any user can access)"""
    requests = await db.users.find(
        {"seller_status": "pending"},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "picture": 1, "profession": 1, "seller_requested_at": 1}
    ).to_list(100)
    
    for req in requests:
        if "seller_requested_at" in req and req["seller_requested_at"]:
            req["seller_requested_at"] = req["seller_requested_at"].isoformat()
    
    return requests

@api_router.post("/admin/seller-approve/{user_id}")
async def approve_seller(
    user_id: str,
    approve: bool = True,
    current_user: User = Depends(require_auth)
):
    """Approve or reject a seller request (admin only)"""
    logging.info(f"Seller approval request: user_id={user_id}, approve={approve}, by={current_user.email}")
    
    # Check if current user is admin
    admin_user = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "is_admin": 1, "email": 1}
    )
    
    logging.info(f"Admin check: user={admin_user}")
    
    if not admin_user.get("is_admin"):
        logging.warning(f"Non-admin user {current_user.email} tried to approve seller")
        raise HTTPException(status_code=403, detail="Only admins can approve sellers")
    
    user = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    logging.info(f"User to approve: {user.get('name')}, current_status={user.get('seller_status')}")
    
    if user.get("seller_status") != "pending":
        raise HTTPException(status_code=400, detail="No pending seller request for this user")
    
    if approve:
        result = await db.users.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "is_seller": True,
                    "seller_status": "approved"
                }
            }
        )
        logging.info(f"Approval result: matched={result.matched_count}, modified={result.modified_count}")
        return {"message": f"Seller request approved for {user['name']}"}
    else:
        await db.users.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "seller_status": "rejected"
                }
            }
        )
        return {"message": f"Seller request rejected for {user['name']}"}

@api_router.get("/admin/stats")
async def get_admin_stats(current_user: User = Depends(require_auth)):
    """Get admin dashboard statistics"""
    # Check if current user is admin
    admin_user = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "is_admin": 1}
    )
    
    if not admin_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Only admins can view stats")
    
    total_users = await db.users.count_documents({})
    total_sellers = await db.users.count_documents({"is_seller": True, "seller_status": "approved"})
    pending_requests = await db.users.count_documents({"seller_status": "pending"})
    total_orders = await db.orders.count_documents({})
    
    return {
        "total_users": total_users,
        "total_sellers": total_sellers,
        "pending_requests": pending_requests,
        "total_orders": total_orders
    }

# ==================== MENU ROUTES ====================

@api_router.post("/menu")
async def create_menu_item(
    item: CreateMenuItem,
    current_user: User = Depends(require_auth)
):
    """Create a new menu item (sellers only)"""
    # Check if user is approved seller
    user = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "is_seller": 1, "seller_status": 1}
    )
    
    if not user.get("is_seller") or user.get("seller_status") != "approved":
        raise HTTPException(status_code=403, detail="Only approved sellers can create menu items")
    
    # Validate price (1-100 TeaCoins)
    price = max(1, min(100, item.price))
    
    item_id = f"item_{uuid.uuid4().hex[:12]}"
    menu_item = {
        "item_id": item_id,
        "seller_id": current_user.user_id,
        "seller_name": current_user.name,
        "name": item.name,
        "description": item.description,
        "image": item.image,
        "price": price,
        "available": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.menu_items.insert_one(menu_item.copy())
    
    menu_item["created_at"] = menu_item["created_at"].isoformat()
    return menu_item

@api_router.get("/menu")
async def get_all_menu_items(current_user: User = Depends(require_auth)):
    """Get all available menu items from all sellers"""
    items = await db.menu_items.find(
        {"available": True},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for item in items:
        if "created_at" in item and item["created_at"]:
            item["created_at"] = item["created_at"].isoformat()
    
    return items

@api_router.get("/menu/my")
async def get_my_menu_items(current_user: User = Depends(require_auth)):
    """Get current user's menu items (sellers only)"""
    items = await db.menu_items.find(
        {"seller_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for item in items:
        if "created_at" in item and item["created_at"]:
            item["created_at"] = item["created_at"].isoformat()
    
    return items

@api_router.put("/menu/{item_id}")
async def update_menu_item(
    item_id: str,
    update: UpdateMenuItem,
    current_user: User = Depends(require_auth)
):
    """Update a menu item (owner only)"""
    item = await db.menu_items.find_one(
        {"item_id": item_id, "seller_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found or you don't have permission")
    
    update_data = {}
    if update.name is not None:
        update_data["name"] = update.name
    if update.description is not None:
        update_data["description"] = update.description
    if update.image is not None:
        update_data["image"] = update.image
    if update.available is not None:
        update_data["available"] = update.available
    
    if update_data:
        await db.menu_items.update_one(
            {"item_id": item_id},
            {"$set": update_data}
        )
    
    return {"message": "Menu item updated"}

@api_router.delete("/menu/{item_id}")
async def delete_menu_item(
    item_id: str,
    current_user: User = Depends(require_auth)
):
    """Delete a menu item (owner only)"""
    result = await db.menu_items.delete_one(
        {"item_id": item_id, "seller_id": current_user.user_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found or you don't have permission")
    
    return {"message": "Menu item deleted"}

# ==================== ORDER ROUTES ====================

@api_router.post("/orders")
async def create_order(
    order_data: CreateOrder,
    current_user: User = Depends(require_auth)
):
    """Create a new tea order"""
    # Get the menu item
    item = await db.menu_items.find_one(
        {"item_id": order_data.item_id, "available": True},
        {"_id": 0}
    )
    
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found or not available")
    
    # Get the item price (default to 1 if not set)
    item_price = item.get("price", 1)
    
    # Check if buyer has enough TeaCoins
    buyer = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "teacoins": 1}
    )
    
    if buyer.get("teacoins", 0) < item_price:
        raise HTTPException(status_code=400, detail=f"Not enough TeaCoins. You need {item_price} TeaCoins.")
    
    # Can't order from yourself
    if item["seller_id"] == current_user.user_id:
        raise HTTPException(status_code=400, detail="You cannot order from yourself")
    
    # Create order
    order_id = f"order_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    order = {
        "order_id": order_id,
        "buyer_id": current_user.user_id,
        "buyer_name": current_user.name,
        "seller_id": item["seller_id"],
        "seller_name": item["seller_name"],
        "item_id": item["item_id"],
        "item_name": item["name"],
        "price": item_price,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
        "delivered_at": None,
        "confirmed_at": None
    }
    
    await db.orders.insert_one(order.copy())
    
    # Deduct TeaCoins from buyer (held in escrow until confirmed)
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$inc": {"teacoins": -item_price}}
    )
    
    order["created_at"] = order["created_at"].isoformat()
    order["updated_at"] = order["updated_at"].isoformat()
    
    return order

@api_router.get("/orders")
async def get_my_orders(current_user: User = Depends(require_auth)):
    """Get current user's orders (as buyer)"""
    orders = await db.orders.find(
        {"buyer_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for order in orders:
        for field in ["created_at", "updated_at", "delivered_at", "confirmed_at"]:
            if field in order and order[field]:
                order[field] = order[field].isoformat()
    
    return orders

@api_router.get("/orders/seller")
async def get_seller_orders(current_user: User = Depends(require_auth)):
    """Get orders for seller to fulfill"""
    # Check if user is approved seller
    user = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "is_seller": 1, "seller_status": 1}
    )
    
    if not user.get("is_seller") or user.get("seller_status") != "approved":
        raise HTTPException(status_code=403, detail="Only approved sellers can view seller orders")
    
    orders = await db.orders.find(
        {"seller_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for order in orders:
        for field in ["created_at", "updated_at", "delivered_at", "confirmed_at"]:
            if field in order and order[field]:
                order[field] = order[field].isoformat()
    
    return orders

@api_router.put("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    update: UpdateOrderStatus,
    current_user: User = Depends(require_auth)
):
    """Update order status (seller updates: preparing, ready, delivered)"""
    order = await db.orders.find_one(
        {"order_id": order_id},
        {"_id": 0}
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Only seller can update to preparing/ready/delivered
    if update.status in ["preparing", "ready", "delivered"]:
        if order["seller_id"] != current_user.user_id:
            raise HTTPException(status_code=403, detail="Only the seller can update this status")
    
    valid_transitions = {
        "pending": ["preparing", "cancelled"],
        "preparing": ["ready", "cancelled"],
        "ready": ["delivered"],
        "delivered": ["confirmed"],
        "confirmed": [],
        "cancelled": []
    }
    
    if update.status not in valid_transitions.get(order["status"], []):
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot change status from {order['status']} to {update.status}"
        )
    
    update_data = {
        "status": update.status,
        "updated_at": datetime.now(timezone.utc)
    }
    
    if update.status == "delivered":
        update_data["delivered_at"] = datetime.now(timezone.utc)
    
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": update_data}
    )
    
    return {"message": f"Order status updated to {update.status}"}

@api_router.post("/orders/{order_id}/confirm")
async def confirm_delivery(
    order_id: str,
    current_user: User = Depends(require_auth)
):
    """Confirm delivery and transfer TeaCoin to seller (buyer only)"""
    order = await db.orders.find_one(
        {"order_id": order_id},
        {"_id": 0}
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["buyer_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the buyer can confirm delivery")
    
    if order["status"] != "delivered":
        raise HTTPException(status_code=400, detail="Order must be in 'delivered' status to confirm")
    
    # Get the price from the order (default to 1 for old orders)
    order_price = order.get("price", 1)
    
    now = datetime.now(timezone.utc)
    
    # Update order status
    await db.orders.update_one(
        {"order_id": order_id},
        {
            "$set": {
                "status": "confirmed",
                "confirmed_at": now,
                "updated_at": now
            }
        }
    )
    
    # Transfer TeaCoin to seller
    await db.users.update_one(
        {"user_id": order["seller_id"]},
        {"$inc": {"teacoins": order_price}}
    )
    
    # Create transaction records
    transaction_id = f"txn_{uuid.uuid4().hex[:12]}"
    await db.transactions.insert_one({
        "transaction_id": transaction_id,
        "from_user_id": current_user.user_id,
        "to_user_id": order["seller_id"],
        "amount": order_price,
        "transaction_type": "order_payment",
        "order_id": order_id,
        "description": f"Payment for {order['item_name']} ({order_price} TeaCoin{'s' if order_price > 1 else ''})",
        "timestamp": now
    })
    
    return {"message": f"Delivery confirmed. {order_price} TeaCoin{'s' if order_price > 1 else ''} transferred to seller."}

@api_router.post("/orders/{order_id}/cancel")
async def cancel_order(
    order_id: str,
    current_user: User = Depends(require_auth)
):
    """Cancel an order and refund TeaCoin (buyer or seller, before delivered)"""
    order = await db.orders.find_one(
        {"order_id": order_id},
        {"_id": 0}
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Only buyer or seller can cancel
    if order["buyer_id"] != current_user.user_id and order["seller_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only buyer or seller can cancel the order")
    
    if order["status"] in ["delivered", "confirmed", "cancelled"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel order in '{order['status']}' status")
    
    now = datetime.now(timezone.utc)
    
    # Update order status
    await db.orders.update_one(
        {"order_id": order_id},
        {
            "$set": {
                "status": "cancelled",
                "updated_at": now
            }
        }
    )
    
    # Refund TeaCoin to buyer
    await db.users.update_one(
        {"user_id": order["buyer_id"]},
        {"$inc": {"teacoins": TEA_ORDER_COST}}
    )
    
    # Create refund transaction
    transaction_id = f"txn_{uuid.uuid4().hex[:12]}"
    await db.transactions.insert_one({
        "transaction_id": transaction_id,
        "from_user_id": None,  # System refund
        "to_user_id": order["buyer_id"],
        "amount": TEA_ORDER_COST,
        "transaction_type": "refund",
        "order_id": order_id,
        "description": f"Refund for cancelled order: {order['item_name']}",
        "timestamp": now
    })
    
    return {"message": "Order cancelled. TeaCoin refunded."}

# ==================== CONVERSATION ROUTES ====================

@api_router.post("/conversations")
async def create_conversation(
    conv: CreateConversation,
    current_user: User = Depends(require_auth)
):
    """Create a new conversation"""
    # Check if direct conversation already exists
    if conv.type == "direct":
        participants = sorted([current_user.user_id] + conv.participant_ids)
        existing = await db.conversations.find_one(
            {
                "type": "direct",
                "participants": {"$all": participants, "$size": len(participants)}
            },
            {"_id": 0}
        )
        
        if existing:
            return existing
    
    # Create new conversation
    conversation_id = f"conv_{uuid.uuid4().hex[:12]}"
    participants = [current_user.user_id] + conv.participant_ids
    
    conversation = {
        "conversation_id": conversation_id,
        "type": conv.type,
        "participants": participants,
        "name": conv.name if conv.type == "group" else None,
        "created_by": current_user.user_id,
        "created_at": datetime.now(timezone.utc),
        "last_message": None
    }
    
    await db.conversations.insert_one(conversation.copy())
    
    # Return without _id
    conversation["created_at"] = conversation["created_at"].isoformat()
    return conversation

@api_router.get("/conversations")
async def get_conversations(current_user: User = Depends(require_auth)):
    """Get all conversations for current user"""
    conversations = await db.conversations.find(
        {"participants": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with participant info and convert dates
    for conv in conversations:
        # Convert datetime to ISO string
        if "created_at" in conv and conv["created_at"]:
            conv["created_at"] = conv["created_at"].isoformat()
        
        if "last_message" in conv and conv["last_message"] and "timestamp" in conv["last_message"]:
            conv["last_message"]["timestamp"] = conv["last_message"]["timestamp"].isoformat()
        
        if conv["type"] == "direct":
            other_user_id = [uid for uid in conv["participants"] if uid != current_user.user_id][0]
            other_user = await db.users.find_one(
                {"user_id": other_user_id},
                {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "online": 1, "profession": 1}
            )
            conv["other_user"] = other_user
    
    return conversations

@api_router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    limit: int = 50,
    current_user: User = Depends(require_auth)
):
    """Get messages for a conversation"""
    # Verify user is participant
    conv = await db.conversations.find_one(
        {
            "conversation_id": conversation_id,
            "participants": current_user.user_id
        },
        {"_id": 0}
    )
    
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = await db.messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    # Convert timestamps to ISO strings
    for msg in messages:
        if "timestamp" in msg and msg["timestamp"]:
            msg["timestamp"] = msg["timestamp"].isoformat()
    
    return list(reversed(messages))

# ==================== SOCKET.IO EVENTS ====================

# Store user socket connections
user_sockets = {}  # {user_id: socket_id}
socket_users = {}  # {socket_id: user_id}

@sio.event
async def connect(sid, environ):
    """Handle socket connection"""
    print(f"Socket connected: {sid}")

@sio.event
async def disconnect(sid):
    """Handle socket disconnection"""
    print(f"Socket disconnected: {sid}")
    
    if sid in socket_users:
        user_id = socket_users[sid]
        
        # Update user status
        await db.users.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "online": False,
                    "last_seen": datetime.now(timezone.utc)
                }
            }
        )
        
        # Broadcast status
        await sio.emit("user_status", {
            "user_id": user_id,
            "online": False,
            "last_seen": datetime.now(timezone.utc).isoformat()
        })
        
        # Cleanup
        del socket_users[sid]
        if user_id in user_sockets:
            del user_sockets[user_id]

@sio.event
async def authenticate(sid, data):
    """Authenticate socket connection"""
    token = data.get("token")
    
    if not token:
        return {"error": "No token provided"}
    
    # Find session
    session = await db.user_sessions.find_one(
        {"session_token": token},
        {"_id": 0}
    )
    
    if not session:
        return {"error": "Invalid token"}
    
    user_id = session["user_id"]
    
    # Store connection
    user_sockets[user_id] = sid
    socket_users[sid] = user_id
    
    # Update user status
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"online": True}}
    )
    
    # Broadcast status
    await sio.emit("user_status", {
        "user_id": user_id,
        "online": True
    })
    
    return {"success": True, "user_id": user_id}

@sio.event
async def send_message(sid, data):
    """Send a message"""
    if sid not in socket_users:
        return {"error": "Not authenticated"}
    
    user_id = socket_users[sid]
    
    # Get sender info
    user = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    # Create message
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    message = {
        "message_id": message_id,
        "conversation_id": data["conversation_id"],
        "sender_id": user_id,
        "sender_name": user["name"],
        "sender_picture": user.get("picture"),
        "content": data.get("content"),
        "image": data.get("image"),
        "timestamp": datetime.now(timezone.utc),
        "read_by": [user_id]
    }
    
    # Save message
    await db.messages.insert_one(message)
    
    # Update conversation
    await db.conversations.update_one(
        {"conversation_id": data["conversation_id"]},
        {
            "$set": {
                "last_message": {
                    "content": data.get("content"),
                    "sender_name": user["name"],
                    "timestamp": datetime.now(timezone.utc)
                }
            }
        }
    )
    
    # Get conversation participants
    conv = await db.conversations.find_one(
        {"conversation_id": data["conversation_id"]},
        {"_id": 0}
    )
    
    # Emit to all participants
    message["timestamp"] = message["timestamp"].isoformat()
    
    for participant_id in conv["participants"]:
        if participant_id in user_sockets:
            await sio.emit("new_message", message, room=user_sockets[participant_id])
    
    return {"success": True, "message": message}

@sio.event
async def typing(sid, data):
    """Handle typing indicator"""
    if sid not in socket_users:
        return
    
    user_id = socket_users[sid]
    conversation_id = data.get("conversation_id")
    is_typing = data.get("is_typing", False)
    
    # Get conversation
    conv = await db.conversations.find_one(
        {"conversation_id": conversation_id},
        {"_id": 0}
    )
    
    if not conv:
        return
    
    # Get user info
    user = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "name": 1}
    )
    
    # Emit to other participants
    for participant_id in conv["participants"]:
        if participant_id != user_id and participant_id in user_sockets:
            await sio.emit("user_typing", {
                "conversation_id": conversation_id,
                "user_id": user_id,
                "user_name": user["name"],
                "is_typing": is_typing
            }, room=user_sockets[participant_id])

# ==================== MOUNT SOCKET.IO ====================

# Include the router in the main app
fastapi_app.include_router(api_router)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@fastapi_app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Create the final app with Socket.IO
app = socket_app
