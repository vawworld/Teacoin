from fastapi import FastAPI, APIRouter, HTTPException, Header, Cookie, Response, Depends, UploadFile, File
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
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

# Socket.IO setup
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Socket.IO app
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

# ==================== MODELS ====================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    profession: Optional[str] = None
    bio: Optional[str] = None
    skills: List[str] = []
    online: bool = False
    last_seen: Optional[datetime] = None
    created_at: datetime

class UserProfile(BaseModel):
    profession: Optional[str] = None
    bio: Optional[str] = None
    skills: List[str] = []
    picture: Optional[str] = None

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

# ==================== AUTH HELPERS ====================

async def get_current_user(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None)
) -> Optional[User]:
    """Get current user from session token (cookie or header)"""
    token = session_token or (authorization.replace("Bearer ", "") if authorization else None)
    
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
        
        if not existing_user:
            # Create new user
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
                "created_at": datetime.now(timezone.utc)
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
        
        return {"session_token": session_token, "user_id": user_id}
        
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
    """Search users by profession or skills"""
    query_lower = q.lower().replace("#", "")
    
    users = await db.users.find(
        {
            "$or": [
                {"profession": {"$regex": query_lower, "$options": "i"}},
                {"skills": {"$regex": query_lower, "$options": "i"}}
            ],
            "user_id": {"$ne": current_user.user_id}
        },
        {"_id": 0}
    ).to_list(50)
    
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
    
    await db.conversations.insert_one(conversation)
    
    return conversation

@api_router.get("/conversations")
async def get_conversations(current_user: User = Depends(require_auth)):
    """Get all conversations for current user"""
    conversations = await db.conversations.find(
        {"participants": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with participant info
    for conv in conversations:
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
app.include_router(api_router)

app.add_middleware(
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Create the final app with Socket.IO
app = socket_app
