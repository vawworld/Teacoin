#!/usr/bin/env python3
"""
Check database for existing sessions and users
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone

async def check_database():
    # Connect to MongoDB
    mongo_url = "mongodb://localhost:27017"
    client = AsyncIOMotorClient(mongo_url)
    db = client["test_database"]
    
    print("🔍 Checking database for existing data...")
    print()
    
    # Check users
    users_count = await db.users.count_documents({})
    print(f"👥 Users in database: {users_count}")
    
    if users_count > 0:
        users = await db.users.find({}, {"_id": 0, "user_id": 1, "name": 1, "email": 1}).limit(3).to_list(3)
        print("   Sample users:")
        for user in users:
            print(f"   - {user.get('name', 'Unknown')} ({user.get('email', 'No email')}) - ID: {user.get('user_id')}")
    
    print()
    
    # Check sessions
    sessions_count = await db.user_sessions.count_documents({})
    print(f"🔑 Sessions in database: {sessions_count}")
    
    if sessions_count > 0:
        # Check for valid (non-expired) sessions
        now = datetime.now(timezone.utc)
        valid_sessions = await db.user_sessions.find(
            {"expires_at": {"$gt": now}},
            {"_id": 0, "user_id": 1, "session_token": 1, "expires_at": 1}
        ).limit(3).to_list(3)
        
        print(f"   Valid sessions: {len(valid_sessions)}")
        if valid_sessions:
            print("   Sample valid sessions:")
            for session in valid_sessions:
                token_preview = session.get('session_token', '')[:20] + "..."
                print(f"   - User: {session.get('user_id')} Token: {token_preview}")
                print(f"     Expires: {session.get('expires_at')}")
                
                # Test this token
                return session.get('session_token')
    
    print()
    
    # Check conversations
    conv_count = await db.conversations.count_documents({})
    print(f"💬 Conversations: {conv_count}")
    
    # Check follows
    follows_count = await db.follows.count_documents({})
    print(f"👥 Follow relationships: {follows_count}")
    
    # Check message requests
    msg_req_count = await db.message_requests.count_documents({})
    print(f"📨 Message requests: {msg_req_count}")
    
    # Check global messages
    global_msg_count = await db.global_messages.count_documents({})
    print(f"🌍 Global messages: {global_msg_count}")
    
    client.close()
    return None

if __name__ == "__main__":
    token = asyncio.run(check_database())
    if token:
        print(f"\n✅ Found valid session token: {token[:20]}...")
        print("You can use this for testing!")
    else:
        print("\n⚠️  No valid session tokens found")
        print("Need to authenticate via frontend to get a valid token")