#!/usr/bin/env python3
"""
Simple Socket.io connection test
"""

import asyncio
import socketio

async def test_socket():
    print("Testing Socket.io connection...")
    
    try:
        sio = socketio.AsyncClient(logger=False, engineio_logger=False)
        
        @sio.event
        async def connect():
            print("✅ Socket.io connected successfully!")
            await sio.disconnect()
        
        @sio.event
        async def connect_error(data):
            print(f"❌ Socket.io connection error: {data}")
        
        @sio.event
        async def disconnect():
            print("🔌 Socket.io disconnected")
        
        # Try to connect
        await sio.connect("https://social-tea-app.preview.emergentagent.com", wait_timeout=10)
        await asyncio.sleep(2)
        
    except Exception as e:
        print(f"❌ Socket.io test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_socket())