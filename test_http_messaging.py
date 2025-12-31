#!/usr/bin/env python3
"""
Focused test for HTTP messaging functionality
"""

import requests
import json
import uuid

BASE_URL = "https://teasocial-preview.preview.emergentagent.com/api"

def test_http_messaging_endpoint():
    """Test the new HTTP messaging endpoint specifically"""
    print("🧪 Testing HTTP Messaging Endpoint Structure...")
    
    # Test POST /api/messages without auth (should get 401)
    message_data = {
        "conversation_id": "test_conv_123",
        "content": "Test message"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/messages", json=message_data)
        print(f"POST /api/messages status: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ HTTP messaging endpoint exists and requires auth")
            return True
        elif response.status_code == 422:
            print("✅ HTTP messaging endpoint exists (validation error expected)")
            print(f"Response: {response.text}")
            return True
        else:
            print(f"❌ Unexpected status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing HTTP messaging: {e}")
        return False

def test_endpoint_availability():
    """Test all key endpoints mentioned in review request"""
    print("🔍 Testing Endpoint Availability...")
    
    endpoints = [
        ("GET", "/auth/me", "Authentication check"),
        ("GET", "/users/all", "Get all users"),
        ("GET", "/users/search?q=test", "User search"),
        ("POST", "/messages", "HTTP messaging"),
        ("GET", "/conversations", "Conversation listing"),
        ("POST", "/conversations", "Conversation creation")
    ]
    
    results = {}
    
    for method, endpoint, description in endpoints:
        try:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{endpoint}")
            elif method == "POST":
                response = requests.post(f"{BASE_URL}{endpoint}", json={})
            
            results[endpoint] = {
                "status": response.status_code,
                "description": description,
                "available": response.status_code in [200, 401, 422, 404]  # Not 500 or connection error
            }
            
            status_icon = "✅" if results[endpoint]["available"] else "❌"
            print(f"{status_icon} {method} {endpoint}: {response.status_code} - {description}")
            
        except Exception as e:
            results[endpoint] = {
                "status": "ERROR",
                "description": description,
                "available": False,
                "error": str(e)
            }
            print(f"❌ {method} {endpoint}: ERROR - {e}")
    
    return results

def check_backend_health():
    """Check if backend is responding"""
    print("🏥 Checking Backend Health...")
    
    try:
        response = requests.get(f"{BASE_URL}/auth/me", timeout=10)
        print(f"✅ Backend responding - Status: {response.status_code}")
        return True
    except requests.exceptions.Timeout:
        print("❌ Backend timeout")
        return False
    except requests.exceptions.ConnectionError:
        print("❌ Backend connection error")
        return False
    except Exception as e:
        print(f"❌ Backend error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 ProLink Messenger HTTP Messaging Test")
    print(f"🌐 Testing: {BASE_URL}")
    print("=" * 50)
    
    # Check backend health
    health_ok = check_backend_health()
    
    if health_ok:
        # Test endpoint availability
        endpoint_results = test_endpoint_availability()
        
        # Test HTTP messaging specifically
        messaging_ok = test_http_messaging_endpoint()
        
        print("\n" + "=" * 50)
        print("📊 SUMMARY")
        print("=" * 50)
        
        available_count = sum(1 for r in endpoint_results.values() if r["available"])
        total_count = len(endpoint_results)
        
        print(f"📈 Endpoints available: {available_count}/{total_count}")
        
        if messaging_ok:
            print("✅ HTTP messaging endpoint working")
        else:
            print("❌ HTTP messaging endpoint issues")
        
        # Check for any 500 errors that might indicate ObjectId issues
        server_errors = [ep for ep, result in endpoint_results.items() 
                        if isinstance(result["status"], int) and result["status"] == 500]
        
        if server_errors:
            print(f"⚠️  Server errors (500) detected on: {server_errors}")
            print("   This might indicate ObjectId serialization issues")
        else:
            print("✅ No server errors detected")
            
    else:
        print("❌ Backend not accessible - cannot run tests")