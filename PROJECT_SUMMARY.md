# TEAFRIENDS - Technical Project Summary

## Project History

### Original Request
Build an Android Slack-like chat app where:
- Users create detailed profiles with profession
- Search by profession (#singer, #developer, etc.)
- Real-time messaging
- 1-on-1 and group chats
- Image sharing
- Online/offline status
- Typing indicators

### Evolution
1. **Initial Build**: ProLink Messenger (original name)
2. **Rebranding**: Changed to TEAFRIENDS
3. **Profile Enhancement**: Added extensive profile fields for help-based networking

## Implementation Decisions

### Why HTTP Polling Instead of Socket.io?
**Problem**: Kubernetes ingress only routes `/api/*` paths to backend (port 8001). Socket.io uses `/socket.io/*` path which was routing to frontend (port 3000).

**Attempted Solutions**:
1. ❌ Custom Socket.io path (`/api/socket.io/`) - didn't work with ASGIApp wrapper
2. ❌ Changing socketio_path parameter - still caused routing issues

**Final Solution**: HTTP Polling
- Messages polled every 2 seconds
- POST /api/messages to send
- GET /api/conversations/{id}/messages to receive
- Works reliably with existing infrastructure
- Minimal delay (1-2 seconds)

### Authentication Flow
1. User clicks "Continue with Google" → Redirects to `https://auth.emergentagent.com`
2. Google OAuth → Returns with `session_id` in URL
3. Frontend exchanges `session_id` for user data via `/api/auth/callback`
4. Backend creates/gets user, generates session_token
5. Frontend stores token, uses for API authentication

### File Structure: Why Expo Router?
- File-based routing (like Next.js)
- `/app/auth/` → Auth screens
- `/app/app/` → Main app screens
- `/app/app/(tabs)/` → Tab navigation
- Clean separation of concerns

## Critical Code Patterns

### 1. MongoDB ObjectId Handling
**Problem**: MongoDB inserts `_id` (ObjectId) which isn't JSON serializable.

**Solution**: Always exclude `_id` in queries
```python
await db.users.find_one({"user_id": user_id}, {"_id": 0})
```

### 2. Datetime Serialization
**Problem**: Python datetime objects aren't JSON serializable.

**Solution**: Convert to ISO strings before returning
```python
message["timestamp"] = message["timestamp"].isoformat()
```

### 3. Custom IDs Instead of MongoDB _id
**Why**: 
- Predictable format
- Easier to work with
- No serialization issues

**Pattern**:
```python
user_id = f"user_{uuid.uuid4().hex[:12]}"
conversation_id = f"conv_{uuid.uuid4().hex[:12]}"
message_id = f"msg_{uuid.uuid4().hex[:12]}"
```

### 4. Base64 Images
**Why**: Simple to implement, no external storage needed for MVP.

**Format**: `data:image/jpeg;base64,{base64_string}`

**Considerations**:
- Increases database size
- For production: Use S3/Cloudinary + store URLs

## Navigation Structure

```
/ (index.tsx)
  ↓
/auth/login → Google OAuth
  ↓
/auth/profile-setup (if new user)
  ↓
/app/(tabs)/chats (main app)
  ├─ /app/(tabs)/search
  ├─ /app/(tabs)/profile
  ├─ /app/chat/[id]
  ├─ /app/user/[id]
  └─ /app/create-group
```

## Context Architecture

### AuthContext
- Manages user session
- Stores session_token
- Handles login/logout
- Provides user data to all screens

### SocketContext
- Originally for Socket.io
- Now simplified for HTTP polling
- Could be removed/simplified further

## Search Algorithm

Searches across all these fields:
```python
{"$or": [
  {"profession": {"$regex": query, "$options": "i"}},
  {"skills": {"$regex": query, "$options": "i"}},
  {"name": {"$regex": query, "$options": "i"}},
  {"location": {"$regex": query, "$options": "i"}},
  {"languages": {"$regex": query, "$options": "i"}},
  {"interests": {"$regex": query, "$options": "i"}},
  {"help_offered": {"$regex": query, "$options": "i"}},
  {"help_needed": {"$regex": query, "$options": "i"}},
  {"industry": {"$regex": query, "$options": "i"}}
]}
```

**Query Optimization**: 
- Removes `#` from search
- Case-insensitive matching
- Limit 50 results

## Message Polling Implementation

### Frontend
```javascript
// Poll every 2 seconds
pollingIntervalRef.current = setInterval(() => {
  loadMessages(true); // silent=true (no loading state)
}, 2000);

// Cleanup on unmount
return () => {
  if (pollingIntervalRef.current) {
    clearInterval(pollingIntervalRef.current);
  }
};
```

### Backend
```python
@api_router.post("/messages")
async def send_message_http(message_data: SendMessage, current_user: User):
    # Create message
    message_doc = {...}
    await db.messages.insert_one(message_doc.copy())
    
    # Update conversation last_message
    await db.conversations.update_one(...)
    
    # Return clean response (no _id, ISO timestamp)
    return clean_message_response
```

## Profile Enhancement Rationale

### Original Fields
- Profession, Bio, Skills, Picture

### Added Fields (for help-based networking)
- **Location**: Find local professionals
- **Languages**: Connect across language barriers
- **Interests**: Common ground for networking
- **Help Offered**: "I can help with..."
- **Help Needed**: "I'm looking for help with..."
- **Experience Years**: Filter by experience level
- **Industry**: Industry-specific networking

### Use Case
Someone needs help with "marketing" → Search "marketing" → Find users who offer "marketing" help → Start chat

## Error Handling Patterns

### Backend
```python
try:
    # Operation
except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
```

### Frontend
```javascript
try {
  const response = await fetch(...);
  if (response.ok) {
    // Success
  } else {
    console.error('Error:', response.status);
    Alert.alert('Error', `Failed: ${response.status}`);
  }
} catch (error) {
  console.error('Network error:', error);
  Alert.alert('Error', 'Network error');
}
```

## Debugging Tips

### Backend Logs
```bash
tail -f /var/log/supervisor/backend.out.log  # Request logs
tail -f /var/log/supervisor/backend.err.log  # Error logs
```

### Frontend Logs
```bash
tail -f /var/log/supervisor/expo.out.log
tail -f /var/log/supervisor/expo.err.log
```

### Browser Console
- All `console.log` statements appear in browser console (F12)
- Blue circle logs (🔵) indicate screen loads

### MongoDB Direct Access
```bash
mongosh test_database

# View users
db.users.find().pretty()

# View messages
db.messages.find().limit(10).pretty()

# View conversations
db.conversations.find().pretty()
```

## Performance Considerations

### Image Optimization
```javascript
quality: 0.5  // 50% quality for uploaded images
```

### Message Polling
- 2-second interval balances real-time feel vs. server load
- Silent polling (no loading state) for smooth UX

### Search Limits
```python
.to_list(50)  # Limit search results
```

## Security Considerations

### Session Tokens
- Stored in AuthContext (memory)
- Sent via Authorization header
- Expire after 7 days

### Profile Updates
- Requires authentication
- User can only update own profile

### Messages
- Requires authentication
- User must be conversation participant

## Mobile Considerations

### KeyboardAvoidingView
```javascript
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
>
```

### Image Permissions
```javascript
const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
```

### Platform-Specific Code
```javascript
if (Platform.OS === 'web') {
  // Web-specific
} else {
  // Mobile-specific
}
```

## Common Issues & Solutions

### Issue: "useEffect is not defined"
**Solution**: Import from React
```javascript
import React, { useState, useEffect } from 'react';
```

### Issue: "Route not found"
**Solution**: Check file-based routing path
- `/chat/[id]` → File at `/app/app/chat/[id].tsx`
- Navigation: `router.push('/app/chat/${id}')`

### Issue: 520 Server Error
**Cause**: Usually datetime serialization
**Solution**: Convert datetimes to ISO strings

### Issue: Messages not sending
**Check**:
1. Session token exists
2. Authorization header format: `Bearer {token}`
3. Backend logs for actual error
4. Browser console for frontend errors

## Testing Checklist

- [ ] Login with Google
- [ ] Complete profile (all fields)
- [ ] Search by profession
- [ ] Search by location
- [ ] Search by help offered
- [ ] View all users
- [ ] View user profile
- [ ] Start 1-on-1 chat
- [ ] Send text message
- [ ] Send image
- [ ] Receive messages (wait 2 seconds)
- [ ] Create group
- [ ] Send group message
- [ ] Edit profile
- [ ] Logout
- [ ] Test on mobile via Expo Go

## Deployment Notes

### Supervisor Services
Both services managed by supervisor:
- `backend`: FastAPI on port 8001
- `expo`: Expo Metro bundler on port 3000

### Restart Commands
```bash
sudo supervisorctl restart backend
sudo supervisorctl restart expo
sudo supervisorctl status  # Check status
```

### Environment Variables
**NEVER MODIFY**:
- `EXPO_PACKAGER_PROXY_URL`
- `EXPO_PACKAGER_HOSTNAME`
- `MONGO_URL`

These are infrastructure-managed.

## Code Quality Notes

### What's Good
- Clean separation of concerns
- Consistent naming conventions
- Type hints in backend
- Error handling in place
- Mobile-first responsive design

### What Could Be Improved
- Add TypeScript interfaces for all data models
- Unit tests
- Integration tests
- Error boundary components
- Loading state consistency
- Image optimization (use cloud storage)
- Socket.io real-time (if infrastructure allows)
- Message pagination
- Offline support

## Key Learnings

1. **Infrastructure Constraints**: Sometimes technical decisions are made based on infrastructure limitations (Socket.io → HTTP polling)

2. **MongoDB Considerations**: Custom IDs are cleaner than ObjectIds for APIs

3. **Mobile Development**: Always consider keyboard, safe areas, and platform differences

4. **File-based Routing**: Expo Router makes navigation intuitive but requires understanding the file structure

5. **Context API**: Good for auth and global state in smaller apps

## Next Developer Notes

When picking up this project:

1. **Read the logs first**: Understand what's working/broken
2. **Test the happy path**: Login → Profile → Search → Chat
3. **Check MongoDB**: See actual data structure
4. **Review API endpoints**: Understand the backend contracts
5. **Test on mobile**: Always test on actual mobile device via Expo Go

---

**Last Updated**: December 30, 2025
**Version**: 1.0
**Status**: Production Ready (with known limitations)