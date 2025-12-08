"""
Integration tests for WebSocket collaboration features.

Tests real-time collaboration between multiple users in a room.
"""
import pytest


pytestmark = pytest.mark.integration


class TestWebSocketConnection:
    """Tests for WebSocket connection handling."""

    def test_websocket_connect_to_existing_room(self, client):
        """Should be able to connect to an existing room."""
        # Create and join room
        room_id = client.post("/rooms").json()["roomId"]
        client.post(f"/rooms/{room_id}/join", json={"username": "Alice"})
        
        # Connect via WebSocket
        with client.websocket_connect(f"/ws/{room_id}/Alice") as ws:
            # Connection should succeed
            assert ws is not None


class TestCodeBroadcast:
    """Tests for code update broadcasting."""

    def test_code_update_broadcasts_to_other_users(self, client):
        """Code updates should be broadcast to other connected users."""
        # Setup room with two users
        room_id = client.post("/rooms").json()["roomId"]
        client.post(f"/rooms/{room_id}/join", json={"username": "Alice"})
        client.post(f"/rooms/{room_id}/join", json={"username": "Bob"})
        
        with client.websocket_connect(f"/ws/{room_id}/Alice") as ws_alice, \
             client.websocket_connect(f"/ws/{room_id}/Bob") as ws_bob:
            
            # Alice sends code update
            code_message = {
                "type": "code-update",
                "data": {"code": "// Alice's code"}
            }
            ws_alice.send_json(code_message)
            
            # Bob should receive the broadcast
            received = False
            for _ in range(5):  # Try a few times
                try:
                    msg = ws_bob.receive_json()
                    if msg.get("type") == "code-update":
                        assert msg["data"]["code"] == "// Alice's code"
                        received = True
                        break
                except Exception:
                    break
            
            assert received, "Bob did not receive Alice's code update"


class TestCursorBroadcast:
    """Tests for cursor position broadcasting."""

    def test_cursor_position_broadcasts(self, client):
        """Cursor position should be broadcast to other users."""
        room_id = client.post("/rooms").json()["roomId"]
        client.post(f"/rooms/{room_id}/join", json={"username": "Alice"})
        client.post(f"/rooms/{room_id}/join", json={"username": "Bob"})
        
        with client.websocket_connect(f"/ws/{room_id}/Alice") as ws_alice, \
             client.websocket_connect(f"/ws/{room_id}/Bob") as ws_bob:
            
            # Alice sends cursor position
            cursor_message = {
                "type": "cursor",
                "username": "Alice",
                "data": {"line": 5, "column": 10}
            }
            ws_alice.send_json(cursor_message)
            
            # Bob should receive cursor update
            received = False
            for _ in range(5):
                try:
                    msg = ws_bob.receive_json()
                    if msg.get("type") == "cursor" and msg.get("username") == "Alice":
                        received = True
                        break
                except Exception:
                    break
            
            assert received, "Bob did not receive Alice's cursor position"


class TestTypingIndicator:
    """Tests for typing indicator functionality."""

    def test_typing_indicator_broadcasts(self, client):
        """Typing indicator should be broadcast to other users."""
        room_id = client.post("/rooms").json()["roomId"]
        client.post(f"/rooms/{room_id}/join", json={"username": "Alice"})
        client.post(f"/rooms/{room_id}/join", json={"username": "Bob"})
        
        with client.websocket_connect(f"/ws/{room_id}/Alice") as ws_alice, \
             client.websocket_connect(f"/ws/{room_id}/Bob") as ws_bob:
            
            # Alice starts typing
            typing_message = {
                "type": "typing",
                "username": "Alice",
                "data": {"isTyping": True}
            }
            ws_alice.send_json(typing_message)
            
            # Bob should receive typing indicator
            received = False
            for _ in range(5):
                try:
                    msg = ws_bob.receive_json()
                    if msg.get("type") == "typing" and msg.get("username") == "Alice":
                        received = True
                        break
                except Exception:
                    break
            
            assert received, "Bob did not receive Alice's typing indicator"


class TestMultiUserCollaboration:
    """Tests for multi-user collaboration scenarios."""

    def test_three_users_collaboration(self, client):
        """Three users should all receive updates from each other."""
        room_id = client.post("/rooms").json()["roomId"]
        
        for name in ["Alice", "Bob", "Charlie"]:
            client.post(f"/rooms/{room_id}/join", json={"username": name})
        
        with client.websocket_connect(f"/ws/{room_id}/Alice") as ws_alice, \
             client.websocket_connect(f"/ws/{room_id}/Bob") as ws_bob, \
             client.websocket_connect(f"/ws/{room_id}/Charlie") as ws_charlie:
            
            # Bob sends a message
            ws_bob.send_json({
                "type": "code-update",
                "data": {"code": "// Bob's code"}
            })
            
            # Alice should receive it
            alice_received = False
            for _ in range(5):
                try:
                    msg = ws_alice.receive_json()
                    if msg.get("type") == "code-update" and msg.get("data", {}).get("code") == "// Bob's code":
                        alice_received = True
                        break
                except Exception:
                    break
            
            # Charlie should receive it too
            charlie_received = False
            for _ in range(5):
                try:
                    msg = ws_charlie.receive_json()
                    if msg.get("type") == "code-update" and msg.get("data", {}).get("code") == "// Bob's code":
                        charlie_received = True
                        break
                except Exception:
                    break
            
            assert alice_received, "Alice did not receive Bob's update"
            assert charlie_received, "Charlie did not receive Bob's update"


class TestFullCollaborationFlow:
    """End-to-end collaboration flow test."""

    def test_complete_interview_session_flow(self, client):
        """Test a complete coding interview session flow."""
        # 1. Create room
        create_response = client.post("/rooms")
        assert create_response.status_code == 201
        room_id = create_response.json()["roomId"]
        
        # 2. Interviewer joins
        interviewer_join = client.post(f"/rooms/{room_id}/join", json={"username": "Interviewer"})
        assert interviewer_join.status_code == 200
        
        # 3. Candidate joins
        candidate_join = client.post(f"/rooms/{room_id}/join", json={"username": "Candidate"})
        assert candidate_join.status_code == 200
        assert len(candidate_join.json()["room"]["participants"]) == 2
        
        # 4. Change language to Python
        lang_response = client.patch(f"/rooms/{room_id}/language", json={"language": "python"})
        assert lang_response.status_code == 200
        
        # 5. WebSocket collaboration
        with client.websocket_connect(f"/ws/{room_id}/Interviewer") as ws_interviewer, \
             client.websocket_connect(f"/ws/{room_id}/Candidate") as ws_candidate:
            
            # Candidate writes code
            solution_code = """
def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
"""
            ws_candidate.send_json({
                "type": "code-update",
                "data": {"code": solution_code}
            })
            
            # Interviewer should see the code
            received = False
            for _ in range(5):
                try:
                    msg = ws_interviewer.receive_json()
                    if msg.get("type") == "code-update":
                        assert "two_sum" in msg["data"]["code"]
                        received = True
                        break
                except Exception:
                    break
            
            assert received, "Interviewer did not see candidate's code"
        
        # 6. Update code via HTTP (persistence)
        client.patch(f"/rooms/{room_id}/code", json={"code": solution_code})
        
        # 7. Execute the code
        exec_response = client.post("/execute", json={
            "code": solution_code,
            "language": "python"
        })
        assert exec_response.status_code == 200
        
        # 8. Verify final room state
        final_room = client.get(f"/rooms/{room_id}").json()
        assert final_room["language"] == "python"
        assert "two_sum" in final_room["code"]
        assert len(final_room["participants"]) == 2
