# ☕ TEAFRIENDS - Professional Networking & Chat App

## Overview
TEAFRIENDS is a Slack-like mobile chat application built with Expo React Native that helps people find and connect with professionals based on their expertise, location, and what help they can offer or need.

## 🎯 Core Concept
Users create detailed profiles with their skills, profession, location, and what they can help with. When someone needs help, they can search for relevant professionals and start chatting instantly.

## ✅ Features Implemented

### Authentication
- Google OAuth via Emergent Auth
- Session-based authentication with JWT tokens
- Automatic redirect to profile setup for new users

### User Profiles (Enhanced)
- **Basic Info**: Name, Profession, Bio, Location, Industry, Years of Experience
- **Skills & Expertise**: Skills, Languages, Interests
- **Help System**: 
  - What help you can offer others
  - What help you're looking for
- Profile picture upload (base64)
- Edit profile anytime

### Search & Discovery
- Search by: profession, skills, location, languages, interests, help offered/needed, industry, name
- View all users in Search tab
- Real-time search filtering
- See online/offline status
- View detailed user profiles

### Messaging
- 1-on-1 direct chats
- Group chats with multiple members
- Text messages
- Image sharing (base64)
- Message history
- HTTP polling (2-second intervals) for real-time updates
- Correct timestamps

### UI/UX
- Tea-themed design (brown/cream colors)
- Mobile-first responsive design
- Custom bottom navigation
- Loading states and error handling

## 🏗️ Tech Stack

### Frontend
- **Framework**: Expo React Native
- **Routing**: Expo Router (file-based)
- **State Management**: React Context API
- **UI**: React Native components
- **Icons**: @expo/vector-icons (Ionicons)
- **Date Formatting**: date-fns
- **Image Picker**: expo-image-picker

### Backend
- **Framework**: FastAPI (Python)
- **Database**: MongoDB
- **Authentication**: Session-based with Emergent OAuth
- **Real-time**: HTTP Polling (Socket.io attempted but infrastructure limitations)

## 📁 Project Structure

```
/app/
├── backend/
│   ├── .env                    # Backend environment variables
│   ├── server.py              # Main FastAPI application
│   └── requirements.txt       # Python dependencies
│
├── frontend/
│   ├── .env                   # Frontend environment variables
│   ├── app/                   # Expo Router app directory
│   │   ├── _layout.tsx       # Root layout with providers
│   │   ├── index.tsx         # Entry point (redirects)
│   │   ├── auth/             # Authentication screens
│   │   │   ├── _layout.tsx
│   │   │   ├── login.tsx
│   │   │   └── profile-setup.tsx
│   │   └── app/              # Main app screens
│   │       ├── _layout.tsx
│   │       ├── (tabs)/       # Tab navigation
│   │       │   ├── _layout.tsx
│   │       │   ├── chats.tsx
│   │       │   ├── search.tsx
│   │       │   └── profile.tsx
│   │       ├── chat/
│   │       │   └── [id].tsx  # Chat screen
│   │       ├── user/
│   │       │   └── [id].tsx  # User profile view
│   │       └── create-group.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx   # Authentication context
│   │   └── SocketContext.tsx # Socket/messaging context
│   ├── components/
│   │   └── CustomTabBar.tsx  # Custom tab navigation
│   ├── app.json              # Expo configuration
│   └── package.json          # Dependencies
│
├── auth_testing.md           # Auth testing playbook
├── test_result.md           # Testing logs and results
├── README.md                # This file
└── PROJECT_SUMMARY.md       # Technical summary
```

## 🌐 Deployment

### URLs
- **App**: https://professio.preview.emergentagent.com
- **Backend API**: https://professio.preview.emergentagent.com/api

### Environment Variables

**Backend (.env)**
```
MONGO_URL=mongodb://localhost:27017/
DB_NAME=test_database
```

**Frontend (.env)**
```
EXPO_TUNNEL_SUBDOMAIN=prolink-messenger
EXPO_PACKAGER_HOSTNAME=https://professio.preview.emergentagent.com
EXPO_PUBLIC_BACKEND_URL=https://professio.preview.emergentagent.com
```

## 🚀 Running the App

### Backend
```bash
cd /app/backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend
```bash
cd /app/frontend
yarn install
expo start --tunnel
```

### Services (via Supervisor)
```bash
# Check status
sudo supervisorctl status

# Restart services
sudo supervisorctl restart backend
sudo supervisorctl restart expo

# View logs
tail -f /var/log/supervisor/backend.out.log
tail -f /var/log/supervisor/expo.out.log
```

## 📊 Database Schema

### Users Collection
```json
{
  "user_id": "user_abc123",
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "data:image/jpeg;base64,...",
  "profession": "developer",
  "bio": "Full-stack developer...",
  "skills": ["react", "python", "mongodb"],
  "location": "New York, USA",
  "languages": ["english", "spanish"],
  "interests": ["photography", "travel"],
  "help_offered": "I can help with web development...",
  "help_needed": "Looking for design feedback...",
  "experience_years": 5,
  "industry": "technology",
  "online": false,
  "last_seen": "2025-12-30T10:30:00Z",
  "created_at": "2025-12-30T08:00:00Z"
}
```

### Conversations Collection
```json
{
  "conversation_id": "conv_abc123",
  "type": "direct" | "group",
  "participants": ["user_id1", "user_id2"],
  "name": "Group Name" (for groups only),
  "created_by": "user_id1",
  "created_at": "2025-12-30T09:00:00Z",
  "last_message": {
    "content": "Hello!",
    "sender_name": "John",
    "timestamp": "2025-12-30T10:00:00Z"
  }
}
```

### Messages Collection
```json
{
  "message_id": "msg_abc123",
  "conversation_id": "conv_abc123",
  "sender_id": "user_id1",
  "sender_name": "John Doe",
  "sender_picture": "data:image/jpeg;base64,...",
  "content": "Hello! How are you?",
  "image": "data:image/jpeg;base64,..." (optional),
  "timestamp": "2025-12-30T10:15:00Z",
  "read_by": ["user_id1"]
}
```

## 🔍 API Endpoints

### Authentication
- `GET /api/auth/callback?session_id={id}` - OAuth callback
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Profile
- `PUT /api/profile` - Update profile
- `GET /api/users/search?q={query}` - Search users
- `GET /api/users/all` - Get all users
- `GET /api/users/{user_id}` - Get user by ID

### Conversations
- `POST /api/conversations` - Create conversation
- `GET /api/conversations` - List user's conversations
- `GET /api/conversations/{id}/messages` - Get messages

### Messages
- `POST /api/messages` - Send message (HTTP polling)

## 🎨 Design System

### Colors
- **Primary**: #8B4513 (Brown)
- **Background**: #FFF8DC (Cream/Cornsilk)
- **Secondary**: #A0522D (Sienna)
- **Accent**: #F5DEB3 (Wheat)
- **Border**: #DEB887 (Burlywood)

### Typography
- **Title**: 36px, Bold, Brown
- **Heading**: 24-28px, Bold, Brown
- **Body**: 14-16px, Regular, Sienna
- **Caption**: 12-14px, Regular, Rosy Brown

## ⚠️ Known Issues & Limitations

1. **Auth Page Branding**: The Emergent auth page (auth.emergentagent.com) shows "Prolink Messenger" instead of "TEAFRIENDS" because it reads from the subdomain which is infrastructure-managed.

2. **Socket.io Not Used**: Originally planned for real-time messaging, but Kubernetes ingress only routes `/api/*` to backend. Socket.io uses `/socket.io/*` path. Solved with HTTP polling (2-second intervals).

3. **Subdomain**: Cannot easily change from "prolink-messenger" to "teafriends" without platform admin access.

4. **Image Storage**: Images stored as base64 in MongoDB. For production, consider using cloud storage (S3, Cloudinary) and storing URLs instead.

## 🔄 Future Enhancements

- [ ] Push notifications for new messages
- [ ] Message read receipts
- [ ] User blocking/reporting
- [ ] Message search within conversations
- [ ] File attachments (PDFs, documents)
- [ ] Voice messages
- [ ] Video calls
- [ ] User ratings/reviews
- [ ] Advanced search filters (location radius, experience level)
- [ ] Bookmarked users
- [ ] Message reactions (emoji)

## 👥 Active Users (Test Data)
- Kummar Sambhav (film maker)
- Khojendra Parmar (cg artist)
- Anuj Nagar (cg artist)
- Arpit Prajapati (cg artist)
- Yogesh Sahu (teafriends)

## 📝 Testing

### Manual Testing
1. Login with Google
2. Complete profile with all fields
3. Search for users by different criteria
4. Start 1-on-1 chat
5. Send text message
6. Share image
7. Create group chat
8. Test on mobile device via Expo Go

### Backend Testing
```bash
# Test auth
curl https://professio.preview.emergentagent.com/api/auth/me \
  -H "Authorization: Bearer {token}"

# Test search
curl https://professio.preview.emergentagent.com/api/users/search?q=developer \
  -H "Authorization: Bearer {token}"

# Test send message
curl -X POST https://professio.preview.emergentagent.com/api/messages \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"conversation_id":"conv_123","content":"Hello"}'
```

## 🤝 Contributing
This is a private project. For questions or issues, contact the development team.

## 📄 License
Proprietary - All rights reserved

---

**Built with ☕ by the TEAFRIENDS team**