from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List, Any
import json
import time

router = APIRouter(tags=["websocket"])

class ConnectionManager:
    def __init__(self):
        # Map roomId to list of WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast(self, message: dict, room_id: str, sender: WebSocket):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                if connection != sender:
                    await connection.send_json(message)

manager = ConnectionManager()

@router.websocket("/ws/{room_id}/{username}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, username: str):
    await manager.connect(websocket, room_id)
    try:
        # Broadcast join event
        await manager.broadcast({
            "type": "join",
            "username": username,
            "timestamp": time.time()
        }, room_id, websocket)

        while True:
            data = await websocket.receive_json()
            
            # Handle typing events specially
            if data.get("type") in ["typing-start", "typing-stop"]:
                is_typing = data["type"] == "typing-start"
                await manager.broadcast({
                    "type": "participant-typing",
                    "data": {
                        "username": username,
                        "isTyping": is_typing
                    }
                }, room_id, websocket)
            else:
                # Forward other messages to others in the room
                await manager.broadcast(data, room_id, websocket)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
        await manager.broadcast({
            "type": "leave",
            "username": username,
            "timestamp": time.time()
        }, room_id, websocket)
    except Exception as e:
        print(f"Error in websocket: {e}")
        manager.disconnect(websocket, room_id)
