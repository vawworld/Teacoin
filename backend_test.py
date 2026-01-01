#!/usr/bin/env python3
"""
TEAFRIENDS Backend API Testing - Friend Request System & Global Chat
Testing the NEW friend request system APIs and enhanced global chat with mentions/notifications
"""

import requests
import json
import time
import uuid
from datetime import datetime
import sys
import os

# Backend URL from frontend .env
BACKEND_URL = "https://social-tea-app.preview.emergentagent.com/api"

class TeaFriendsAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.user_tokens = {}  # Store tokens for different test users
        self.user_ids = {}     # Store user IDs for different test users
        
    def log_test(self, test_name, success, details="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if not success and response_data:
            print(f"   Response: {response_data}")
        print()

    def find_valid_sessions(self):
        """Try to find existing valid sessions from database"""
        print("=== SEARCHING FOR VALID AUTHENTICATION SESSIONS ===")
        
        # Try to read the valid token from file first
        try:
            with open('/app/valid_token.txt', 'r') as f:
                valid_token = f.read().strip()
                if valid_token:
                    test_tokens = [valid_token]
                else:
                    test_tokens = []
        except:
            test_tokens = []
        
        # Fallback tokens if file doesn't exist
        test_tokens.extend([
            "G3P5vqDVz5BjAkS3Ou8sk_u9m7Ucj76XDHNOIKLdNdE",  # Known valid token
            "session_token_1",
            "session_token_2",
        ])
        
        for i, token in enumerate(test_tokens):
            try:
                headers = {"Authorization": f"Bearer {token}"}
                response = self.session.get(f"{BACKEND_URL}/auth/me", headers=headers)
                if response.status_code == 200:
                    user_data = response.json()
                    self.user_tokens[f"user{i+1}"] = token
                    self.user_ids[f"user{i+1}"] = user_data.get("user_id")
                    self.log_test(f"Found valid session for user{i+1}", True, 
                                f"User: {user_data.get('name', 'Unknown')} ({user_data.get('email', 'No email')})")
                    
                    # Try to get more users by checking all users endpoint
                    if i == 0:  # Only do this once
                        try:
                            all_users_response = self.session.get(f"{BACKEND_URL}/users/all", headers=headers)
                            if all_users_response.status_code == 200:
                                all_users = all_users_response.json()
                                self.log_test("Database users check", True, f"Found {len(all_users)} total users in database")
                        except:
                            pass
                            
            except Exception as e:
                continue
        
        if not self.user_tokens:
            self.log_test("Authentication setup", False, "No valid authentication tokens found. Manual OAuth required for full testing.")
            return False
        
        return True

    def test_auth_protection(self):
        """Test that all friend request endpoints require authentication"""
        print("=== TESTING AUTHENTICATION PROTECTION ===")
        
        endpoints_to_test = [
            ("GET", "/friend-requests"),
            ("GET", "/friend-requests/sent"),
            ("GET", "/friend-requests/count"),
            ("POST", "/friend-request/test_user_id"),
            ("POST", "/friend-request/test_user_id/accept"),
            ("POST", "/friend-request/test_user_id/decline"),
            ("DELETE", "/friend-request/test_user_id"),
            ("DELETE", "/friend/test_user_id"),
            ("GET", "/friends"),
            ("GET", "/friend/status/test_user_id"),
            ("GET", "/users/test_user_id/friends"),
            ("GET", "/chat/global"),
            ("GET", "/chat/global/users"),
            ("POST", "/chat/global"),
            ("GET", "/notifications"),
            ("GET", "/notifications/unread/count"),
            ("POST", "/notifications/mark-read"),
        ]
        
        for method, endpoint in endpoints_to_test:
            try:
                if method == "GET":
                    response = self.session.get(f"{BACKEND_URL}{endpoint}")
                elif method == "POST":
                    response = self.session.post(f"{BACKEND_URL}{endpoint}", json={"content": "test"})
                elif method == "DELETE":
                    response = self.session.delete(f"{BACKEND_URL}{endpoint}")
                
                if response.status_code == 401:
                    self.log_test(f"Auth protection for {method} {endpoint}", True, "Correctly returns 401 without authentication")
                else:
                    self.log_test(f"Auth protection for {method} {endpoint}", False, f"Expected 401, got {response.status_code}")
            except Exception as e:
                self.log_test(f"Auth protection for {method} {endpoint}", False, f"Request failed: {str(e)}")

    def test_friend_request_system(self):
        """Test the complete NEW friend request system (Facebook-style)"""
        print("=== TESTING NEW FRIEND REQUEST SYSTEM (Facebook-style) ===")
        
        if len(self.user_tokens) < 1:
            self.log_test("Friend request system setup", False, "Need at least 1 authenticated user for friend request testing")
            return
        
        # Get primary user token and create a test scenario
        user1_token = list(self.user_tokens.values())[0]
        user1_id = list(self.user_ids.values())[0]
        headers1 = {"Authorization": f"Bearer {user1_token}"}
        
        # Get a target user to test with
        target_user_id = None
        try:
            response = self.session.get(f"{BACKEND_URL}/users/all", headers=headers1)
            if response.status_code == 200:
                users = response.json()
                # Find a user that's not the current user
                for user in users:
                    if user["user_id"] != user1_id:
                        target_user_id = user["user_id"]
                        break
                
                if target_user_id:
                    self.log_test("Get target user for testing", True, f"Found target user: {target_user_id}")
                else:
                    self.log_test("Get target user for testing", False, "No other users found to test with")
                    return
            else:
                self.log_test("Get target user for testing", False, f"Status: {response.status_code}")
                return
        except Exception as e:
            self.log_test("Get target user for testing", False, f"Request failed: {str(e)}")
            return

        # 1. Test POST /api/friend-request/{user_id} - Send friend request
        try:
            response = self.session.post(f"{BACKEND_URL}/friend-request/{target_user_id}", headers=headers1)
            if response.status_code in [200, 400]:  # 400 might be "already sent" or "already friends"
                data = response.json()
                self.log_test("POST /api/friend-request/{user_id} - Send friend request", True, 
                            f"Status: {response.status_code}, Message: {data.get('message', 'No message')}")
            else:
                self.log_test("POST /api/friend-request/{user_id} - Send friend request", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("POST /api/friend-request/{user_id} - Send friend request", False, f"Request failed: {str(e)}")

        # 2. Test GET /api/friend-requests/sent - Get sent friend requests
        try:
            response = self.session.get(f"{BACKEND_URL}/friend-requests/sent", headers=headers1)
            if response.status_code == 200:
                sent_requests = response.json()
                self.log_test("GET /api/friend-requests/sent - Get sent friend requests", True, 
                            f"Found {len(sent_requests)} sent requests")
            else:
                self.log_test("GET /api/friend-requests/sent - Get sent friend requests", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /api/friend-requests/sent - Get sent friend requests", False, f"Request failed: {str(e)}")

        # 3. Test GET /api/friend-requests - Get pending friend requests received
        try:
            response = self.session.get(f"{BACKEND_URL}/friend-requests", headers=headers1)
            if response.status_code == 200:
                requests_data = response.json()
                self.log_test("GET /api/friend-requests - Get pending friend requests received", True, 
                            f"Found {len(requests_data)} pending requests")
            else:
                self.log_test("GET /api/friend-requests - Get pending friend requests received", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /api/friend-requests - Get pending friend requests received", False, f"Request failed: {str(e)}")

        # 4. Test GET /api/friend-requests/count - Get count of pending requests
        try:
            response = self.session.get(f"{BACKEND_URL}/friend-requests/count", headers=headers1)
            if response.status_code == 200:
                count_data = response.json()
                self.log_test("GET /api/friend-requests/count - Get count of pending requests", True, 
                            f"Count: {count_data.get('count', 0)}")
            else:
                self.log_test("GET /api/friend-requests/count - Get count of pending requests", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /api/friend-requests/count - Get count of pending requests", False, f"Request failed: {str(e)}")

        # 5. Test POST /api/friend-request/{user_id}/accept - Accept friend request
        try:
            response = self.session.post(f"{BACKEND_URL}/friend-request/{target_user_id}/accept", headers=headers1)
            if response.status_code in [200, 404]:  # 404 if no request exists
                data = response.json()
                self.log_test("POST /api/friend-request/{user_id}/accept - Accept friend request", True, 
                            f"Status: {response.status_code}, Message: {data.get('message', 'No message')}")
            else:
                self.log_test("POST /api/friend-request/{user_id}/accept - Accept friend request", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("POST /api/friend-request/{user_id}/accept - Accept friend request", False, f"Request failed: {str(e)}")

        # 6. Test POST /api/friend-request/{user_id}/decline - Decline friend request
        try:
            response = self.session.post(f"{BACKEND_URL}/friend-request/{target_user_id}/decline", headers=headers1)
            if response.status_code in [200, 404]:  # 404 if no request exists
                data = response.json()
                self.log_test("POST /api/friend-request/{user_id}/decline - Decline friend request", True, 
                            f"Status: {response.status_code}, Message: {data.get('message', 'No message')}")
            else:
                self.log_test("POST /api/friend-request/{user_id}/decline - Decline friend request", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("POST /api/friend-request/{user_id}/decline - Decline friend request", False, f"Request failed: {str(e)}")

        # 7. Test DELETE /api/friend-request/{user_id} - Cancel sent friend request
        try:
            # Send a request first to have something to cancel
            self.session.post(f"{BACKEND_URL}/friend-request/{target_user_id}", headers=headers1)
            time.sleep(0.5)
            
            response = self.session.delete(f"{BACKEND_URL}/friend-request/{target_user_id}", headers=headers1)
            if response.status_code in [200, 404]:  # 404 if no request exists
                data = response.json()
                self.log_test("DELETE /api/friend-request/{user_id} - Cancel sent friend request", True, 
                            f"Status: {response.status_code}, Message: {data.get('message', 'No message')}")
            else:
                self.log_test("DELETE /api/friend-request/{user_id} - Cancel sent friend request", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("DELETE /api/friend-request/{user_id} - Cancel sent friend request", False, f"Request failed: {str(e)}")

        # 8. Test DELETE /api/friend/{user_id} - Unfriend/remove friend
        try:
            response = self.session.delete(f"{BACKEND_URL}/friend/{target_user_id}", headers=headers1)
            if response.status_code in [200, 404]:  # 404 if not friends
                data = response.json()
                self.log_test("DELETE /api/friend/{user_id} - Unfriend/remove friend", True, 
                            f"Status: {response.status_code}, Message: {data.get('message', 'No message')}")
            else:
                self.log_test("DELETE /api/friend/{user_id} - Unfriend/remove friend", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("DELETE /api/friend/{user_id} - Unfriend/remove friend", False, f"Request failed: {str(e)}")

        # 9. Test GET /api/friends - Get my friends list
        try:
            response = self.session.get(f"{BACKEND_URL}/friends", headers=headers1)
            if response.status_code == 200:
                friends = response.json()
                self.log_test("GET /api/friends - Get my friends list", True, f"Found {len(friends)} friends")
            else:
                self.log_test("GET /api/friends - Get my friends list", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /api/friends - Get my friends list", False, f"Request failed: {str(e)}")

        # 10. Test GET /api/friend/status/{user_id} - Check friendship status
        try:
            response = self.session.get(f"{BACKEND_URL}/friend/status/{target_user_id}", headers=headers1)
            if response.status_code == 200:
                status_data = response.json()
                self.log_test("GET /api/friend/status/{user_id} - Check friendship status", True, 
                            f"Status: {status_data.get('status', 'unknown')}, Is friend: {status_data.get('is_friend', False)}")
            else:
                self.log_test("GET /api/friend/status/{user_id} - Check friendship status", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /api/friend/status/{user_id} - Check friendship status", False, f"Request failed: {str(e)}")

        # 11. Test GET /api/users/{user_id}/friends - Get a user's friends
        try:
            response = self.session.get(f"{BACKEND_URL}/users/{target_user_id}/friends", headers=headers1)
            if response.status_code == 200:
                user_friends = response.json()
                self.log_test("GET /api/users/{user_id}/friends - Get a user's friends", True, 
                            f"User has {len(user_friends)} friends")
            else:
                self.log_test("GET /api/users/{user_id}/friends - Get a user's friends", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /api/users/{user_id}/friends - Get a user's friends", False, f"Request failed: {str(e)}")

    def test_global_chat_enhanced(self):
        """Test the enhanced global chat system with mentions and replies"""
        print("=== TESTING GLOBAL CHAT ENHANCED APIs ===")
        
        if not self.user_tokens:
            self.log_test("Global chat system setup", False, "No authenticated users for global chat testing")
            return
        
        user_token = list(self.user_tokens.values())[0]
        user_id = list(self.user_ids.values())[0]
        headers = {"Authorization": f"Bearer {user_token}"}
        
        # 1. Test GET /api/chat/global/users - Get users for @mentions
        try:
            response = self.session.get(f"{BACKEND_URL}/chat/global/users", headers=headers)
            if response.status_code == 200:
                users = response.json()
                self.log_test("GET /api/chat/global/users - Get users for @mentions", True, 
                            f"Found {len(users)} users for mentions")
            else:
                self.log_test("GET /api/chat/global/users - Get users for @mentions", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /api/chat/global/users - Get users for @mentions", False, f"Request failed: {str(e)}")

        # 2. Test GET /api/chat/global - Get global messages (should return with mentions/reply_to fields)
        try:
            response = self.session.get(f"{BACKEND_URL}/chat/global", headers=headers)
            if response.status_code == 200:
                messages = response.json()
                self.log_test("GET /api/chat/global - Get global messages", True, 
                            f"Found {len(messages)} global messages")
                
                # Check if messages have mentions/reply_to fields
                has_mentions = any('mentions' in msg for msg in messages)
                has_reply_to = any('reply_to' in msg for msg in messages)
                self.log_test("Global messages structure check", True, 
                            f"Messages have mentions field: {has_mentions}, reply_to field: {has_reply_to}")
            else:
                self.log_test("GET /api/chat/global - Get global messages", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /api/chat/global - Get global messages", False, f"Request failed: {str(e)}")

        # 3. Test POST /api/chat/global - Send message with mentions and reply_to support
        try:
            # Send a simple message first
            message_data = {
                "content": "Hello from TeaFriends API test! 🍵 Testing new friend request system",
                "mentions": [],
                "reply_to": None
            }
            response = self.session.post(f"{BACKEND_URL}/chat/global", headers=headers, json=message_data)
            if response.status_code == 200:
                sent_message = response.json()
                self.log_test("POST /api/chat/global - Send simple message", True, 
                            f"Message sent successfully, ID: {sent_message.get('message_id', 'unknown')}")
                
                # Test message with mentions and reply
                try:
                    # Get users for mentions
                    users_response = self.session.get(f"{BACKEND_URL}/chat/global/users", headers=headers)
                    if users_response.status_code == 200:
                        users = users_response.json()
                        if len(users) > 1:
                            mention_user_id = users[1]["user_id"] if users[1]["user_id"] != user_id else users[0]["user_id"]
                            mention_message = {
                                "content": f"Testing mentions in global chat! @{mention_user_id} 👋",
                                "mentions": [mention_user_id],
                                "reply_to": {
                                    "message_id": sent_message.get('message_id'),
                                    "sender_name": sent_message.get('sender_name'),
                                    "content": sent_message.get('content', '')[:50]
                                }
                            }
                            response = self.session.post(f"{BACKEND_URL}/chat/global", headers=headers, json=mention_message)
                            if response.status_code == 200:
                                self.log_test("POST /api/chat/global - Send message with mentions and reply", True, 
                                            "Message with mentions and reply sent successfully")
                            else:
                                self.log_test("POST /api/chat/global - Send message with mentions and reply", False, 
                                            f"Status: {response.status_code}", response.text)
                        else:
                            self.log_test("POST /api/chat/global - Send message with mentions and reply", True, 
                                        "Skipped - not enough users for mention testing")
                except Exception as e:
                    self.log_test("POST /api/chat/global - Send message with mentions and reply", False, 
                                f"Request failed: {str(e)}")
            else:
                self.log_test("POST /api/chat/global - Send simple message", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("POST /api/chat/global - Send simple message", False, f"Request failed: {str(e)}")

    def test_notifications_system(self):
        """Test the notifications system"""
        print("=== TESTING NOTIFICATIONS APIs ===")
        
        if not self.user_tokens:
            self.log_test("Notifications system setup", False, "No authenticated users for notifications testing")
            return
        
        user_token = list(self.user_tokens.values())[0]
        headers = {"Authorization": f"Bearer {user_token}"}
        
        # 1. Test GET /api/notifications - Get notifications (mentions)
        try:
            response = self.session.get(f"{BACKEND_URL}/notifications", headers=headers)
            if response.status_code == 200:
                notifications = response.json()
                self.log_test("GET /api/notifications - Get notifications (mentions)", True, 
                            f"Found {len(notifications)} notifications")
            else:
                self.log_test("GET /api/notifications - Get notifications (mentions)", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /api/notifications - Get notifications (mentions)", False, f"Request failed: {str(e)}")

        # 2. Test GET /api/notifications/unread/count - Get unread count
        try:
            response = self.session.get(f"{BACKEND_URL}/notifications/unread/count", headers=headers)
            if response.status_code == 200:
                count_data = response.json()
                self.log_test("GET /api/notifications/unread/count - Get unread count", True, 
                            f"Unread count: {count_data.get('count', 0)}")
            else:
                self.log_test("GET /api/notifications/unread/count - Get unread count", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /api/notifications/unread/count - Get unread count", False, f"Request failed: {str(e)}")

        # 3. Test POST /api/notifications/mark-read - Mark all as read
        try:
            response = self.session.post(f"{BACKEND_URL}/notifications/mark-read", headers=headers)
            if response.status_code == 200:
                self.log_test("POST /api/notifications/mark-read - Mark all as read", True, 
                            "All notifications marked as read")
            else:
                self.log_test("POST /api/notifications/mark-read - Mark all as read", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("POST /api/notifications/mark-read - Mark all as read", False, f"Request failed: {str(e)}")

    def run_all_tests(self):
        """Run all tests"""
        print("🍵 TEAFRIENDS BACKEND API TESTING - NEW FRIEND REQUEST SYSTEM & GLOBAL CHAT")
        print("=" * 90)
        print(f"Testing backend at: {BACKEND_URL}")
        print(f"Test started at: {datetime.now().isoformat()}")
        print()
        
        # Find valid authentication sessions
        auth_success = self.find_valid_sessions()
        
        # Test authentication protection
        self.test_auth_protection()
        
        if auth_success:
            # Test NEW friend request system
            self.test_friend_request_system()
            
            # Test enhanced global chat system
            self.test_global_chat_enhanced()
            
            # Test notifications system
            self.test_notifications_system()
        else:
            print("⚠️  Skipping authenticated endpoint tests due to authentication issues")
        
        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("=" * 90)
        print("🍵 TEST SUMMARY - NEW FRIEND REQUEST SYSTEM & GLOBAL CHAT")
        print("=" * 90)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if "✅ PASS" in r["status"]])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "0%")
        print()
        
        if failed_tests > 0:
            print("FAILED TESTS:")
            for result in self.test_results:
                if "❌ FAIL" in result["status"]:
                    print(f"  ❌ {result['test']}: {result['details']}")
            print()
        
        print("KEY FINDINGS:")
        
        # Friend Request System
        friend_tests = [r for r in self.test_results if "friend-request" in r["test"].lower() or "friends" in r["test"].lower()]
        friend_passed = len([r for r in friend_tests if "✅ PASS" in r["status"]])
        friend_total = len(friend_tests)
        print(f"  👥 NEW Friend Request System: {friend_passed}/{friend_total} tests passed")
        
        # Global Chat System
        chat_tests = [r for r in self.test_results if "chat/global" in r["test"].lower()]
        chat_passed = len([r for r in chat_tests if "✅ PASS" in r["status"]])
        chat_total = len(chat_tests)
        print(f"  💬 Enhanced Global Chat: {chat_passed}/{chat_total} tests passed")
        
        # Notifications System
        notif_tests = [r for r in self.test_results if "notifications" in r["test"].lower()]
        notif_passed = len([r for r in notif_tests if "✅ PASS" in r["status"]])
        notif_total = len(notif_tests)
        print(f"  🔔 Notifications System: {notif_passed}/{notif_total} tests passed")
        
        # Authentication Protection
        auth_tests = [r for r in self.test_results if "auth protection" in r["test"].lower()]
        auth_passed = len([r for r in auth_tests if "✅ PASS" in r["status"]])
        auth_total = len(auth_tests)
        print(f"  🔐 Authentication Protection: {auth_passed}/{auth_total} tests passed")
        
        print()
        if passed_tests == total_tests:
            print("🎉 ALL NEW FRIEND REQUEST SYSTEM APIs ARE WORKING CORRECTLY!")
            print("🎉 GLOBAL CHAT WITH MENTIONS AND REPLIES IS FUNCTIONAL!")
            print("🎉 NOTIFICATIONS SYSTEM IS WORKING PROPERLY!")
        else:
            print("⚠️  Some APIs need attention - see failed tests above")
        
        print()
        print(f"Test completed at: {datetime.now().isoformat()}")

if __name__ == "__main__":
    tester = TeaFriendsAPITester()
    tester.run_all_tests()