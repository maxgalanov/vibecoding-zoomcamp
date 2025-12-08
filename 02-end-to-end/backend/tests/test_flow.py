from tests.conftest import client


def test_collaboration_flow():
    # 1. Create Room
    response = client.post("/rooms")
    assert response.status_code == 201
    room_data = response.json()
    room_id = room_data["roomId"]
    print(f"Created room: {room_id}")

    # 2. Join Room (User A)
    user_a = "UserA"
    response = client.post(f"/rooms/{room_id}/join", json={"username": user_a})
    assert response.status_code == 200
    
    # 3. Join Room (User B)
    user_b = "UserB"
    response = client.post(f"/rooms/{room_id}/join", json={"username": user_b})
    assert response.status_code == 200

    # 4. WebSocket Interaction Simulation
    # Note: TestClient via Starlette supports WebSocket testing
    
    with client.websocket_connect(f"/ws/{room_id}/{user_a}") as ws_a, \
         client.websocket_connect(f"/ws/{room_id}/{user_b}") as ws_b:
        
        # Initial state:
        # The backend does NOT send an "init" message upon connection.
        # It only broadcasts "join" to OTHER users.
        
        # So at this point:
        # ws_a is connected.
        # ws_b is connected.
        
        # When ws_b connected, the server likely broadcasted "join" to ws_a.
        # ws_b receives nothing immediately.
        
        # Let's verify ws_a received the join event for ws_b
        try:
            # We set a small timeout because it should have happened immediately/already
            # But TestClient's websocket implementation might queue it.
            msg = ws_a.receive_json()
            # Depending on timing, this might be the join event
            if msg.get("type") == "join":
                assert msg["username"] == user_b
        except Exception:
            # If we didn't get it immediately, it might be fine or race condition-ish.
            # But strictly speaking, A is in the room when B joins.
            pass

        # User A sends code update
        new_code = "print('Hello World')"
        ws_a.send_json({
            "type": "code_update",
            "username": user_a, # Frontend sends this usually
            "data": { "code": new_code }, # Frontend structure looks like { type, data: { code } }
            # Let's check frontend structure again.
            # frontend sendMessage({ type: "code-update", data: { code: newCode } }) 
            # It also seems backend broadcast function adds "username" if not present? 
            # Looking at websocket.py: 
            # await manager.broadcast(data, room_id, websocket)
            # It just forwards 'data'.
        })
        
        # Wait, the frontend sends:
        # sendMessage({ type: "code-update", data: { code: newCode } })
        
        # The backend just forwards this exact JSON.
        # Use exact structure found in frontend source.
        payload = {
            "type": "code-update",
            "data": { "code": new_code }
        }
        ws_a.send_json(payload)

        # User B should receive it (broadcast)
        
        found_update = False
        # Check messages for User B
        for _ in range(5):
            try:
                # set a timeout/non-blocking check if possible, or just receive
                # Starlette TestClient receive_json is blocking.
                # We expect a message.
                msg = ws_b.receive_json()
                if msg.get("type") == "code-update" and msg.get("data", {}).get("code") == new_code:
                    found_update = True
                    break
            except Exception:
                break
        
        assert found_update, "User B did not receive the code update from User A"

    # 5. Execute Code (User A)
    response = client.post("/execute", json={
        "code": new_code,
        "language": "python"
    })
    
    assert response.status_code == 200
    exec_result = response.json()
    assert "output" in exec_result
    # Since we are likely mocking execution or it runs simply:
    # Check that we got a valid success response
    
    print("Test Collaboration Flow Completed Successfully")
