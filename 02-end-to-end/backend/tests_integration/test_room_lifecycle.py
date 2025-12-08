"""
Integration tests for room lifecycle operations.

Tests the full flow of room creation, participant management,
code updates, and language changes.
"""
import pytest


pytestmark = pytest.mark.integration


class TestRoomCreation:
    """Tests for room creation."""

    def test_create_room_returns_valid_id(self, client):
        """Creating a room should return a valid room ID."""
        response = client.post("/rooms")
        assert response.status_code == 201
        data = response.json()
        
        assert "roomId" in data
        assert len(data["roomId"]) == 6
        assert "room" in data
        assert data["room"]["language"] == "javascript"
        assert data["room"]["participants"] == []

    def test_create_multiple_rooms_have_unique_ids(self, client):
        """Each room should have a unique ID."""
        room_ids = set()
        for _ in range(5):
            response = client.post("/rooms")
            assert response.status_code == 201
            room_ids.add(response.json()["roomId"])
        
        assert len(room_ids) == 5

    def test_created_room_is_retrievable(self, client):
        """A created room should be retrievable by ID."""
        create_response = client.post("/rooms")
        room_id = create_response.json()["roomId"]
        
        get_response = client.get(f"/rooms/{room_id}")
        assert get_response.status_code == 200
        assert get_response.json()["id"] == room_id


class TestRoomNotFound:
    """Tests for handling non-existent rooms."""

    def test_get_nonexistent_room_returns_404(self, client):
        """Getting a non-existent room should return 404."""
        response = client.get("/rooms/notexist")
        assert response.status_code == 404

    def test_join_nonexistent_room_returns_404(self, client):
        """Joining a non-existent room should return 404."""
        response = client.post("/rooms/notexist/join", json={"username": "user"})
        assert response.status_code == 404


class TestParticipantManagement:
    """Tests for joining and leaving rooms."""

    def test_join_room_adds_participant(self, client):
        """Joining a room should add the user to participants."""
        # Create room
        room_id = client.post("/rooms").json()["roomId"]
        
        # Join room
        response = client.post(f"/rooms/{room_id}/join", json={"username": "Alice"})
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert len(data["room"]["participants"]) == 1
        assert data["room"]["participants"][0]["username"] == "Alice"

    def test_join_room_assigns_cursor_color(self, client):
        """Joining a room should assign a cursor color."""
        room_id = client.post("/rooms").json()["roomId"]
        
        response = client.post(f"/rooms/{room_id}/join", json={"username": "Alice"})
        participant = response.json()["room"]["participants"][0]
        
        assert participant["cursorColor"] is not None
        assert participant["cursorColor"].startswith("#")

    def test_multiple_participants_get_different_colors(self, client):
        """Multiple participants should get different cursor colors."""
        room_id = client.post("/rooms").json()["roomId"]
        
        client.post(f"/rooms/{room_id}/join", json={"username": "Alice"})
        response = client.post(f"/rooms/{room_id}/join", json={"username": "Bob"})
        
        participants = response.json()["room"]["participants"]
        colors = [p["cursorColor"] for p in participants]
        
        assert len(set(colors)) == 2  # All unique colors

    def test_join_room_is_idempotent(self, client):
        """Joining a room twice with same user should not duplicate."""
        room_id = client.post("/rooms").json()["roomId"]
        
        client.post(f"/rooms/{room_id}/join", json={"username": "Alice"})
        response = client.post(f"/rooms/{room_id}/join", json={"username": "Alice"})
        
        participants = response.json()["room"]["participants"]
        assert len(participants) == 1

    def test_leave_room_removes_participant(self, client):
        """Leaving a room should remove the user from participants."""
        room_id = client.post("/rooms").json()["roomId"]
        
        # Join then leave
        client.post(f"/rooms/{room_id}/join", json={"username": "Alice"})
        leave_response = client.post(f"/rooms/{room_id}/leave", json={"username": "Alice"})
        
        assert leave_response.status_code == 200
        assert leave_response.json()["success"] is True
        
        # Verify participant removed
        room_response = client.get(f"/rooms/{room_id}")
        assert len(room_response.json()["participants"]) == 0

    def test_get_participants_endpoint(self, client):
        """Get participants endpoint should return room participants."""
        room_id = client.post("/rooms").json()["roomId"]
        
        client.post(f"/rooms/{room_id}/join", json={"username": "Alice"})
        client.post(f"/rooms/{room_id}/join", json={"username": "Bob"})
        
        response = client.get(f"/rooms/{room_id}/participants")
        assert response.status_code == 200
        
        participants = response.json()
        assert len(participants) == 2
        usernames = {p["username"] for p in participants}
        assert usernames == {"Alice", "Bob"}


class TestCodeUpdates:
    """Tests for code update operations."""

    def test_update_code_persists(self, client):
        """Updated code should be persisted."""
        room_id = client.post("/rooms").json()["roomId"]
        
        new_code = "console.log('Hello, Integration Test!');"
        response = client.patch(f"/rooms/{room_id}/code", json={"code": new_code})
        
        assert response.status_code == 200
        assert response.json()["success"] is True
        
        # Verify persistence
        room = client.get(f"/rooms/{room_id}").json()
        assert room["code"] == new_code

    def test_update_code_multiple_times(self, client):
        """Code can be updated multiple times."""
        room_id = client.post("/rooms").json()["roomId"]
        
        for i in range(3):
            code = f"// Version {i}"
            client.patch(f"/rooms/{room_id}/code", json={"code": code})
        
        room = client.get(f"/rooms/{room_id}").json()
        assert room["code"] == "// Version 2"


class TestLanguageUpdates:
    """Tests for language change operations."""

    def test_update_language_changes_template(self, client):
        """Changing language should update the code template."""
        room_id = client.post("/rooms").json()["roomId"]
        
        response = client.patch(f"/rooms/{room_id}/language", json={"language": "python"})
        
        assert response.status_code == 200
        assert response.json()["success"] is True
        assert "def solution" in response.json()["code"]
        
        # Verify persistence
        room = client.get(f"/rooms/{room_id}").json()
        assert room["language"] == "python"
        assert "def solution" in room["code"]

    def test_update_language_to_cpp(self, client):
        """Changing to C++ should provide C++ template."""
        room_id = client.post("/rooms").json()["roomId"]
        
        response = client.patch(f"/rooms/{room_id}/language", json={"language": "cpp"})
        
        assert "#include" in response.json()["code"]
        room = client.get(f"/rooms/{room_id}").json()
        assert room["language"] == "cpp"


class TestExecuteEndpoint:
    """Tests for code execution endpoint."""

    def test_execute_javascript_returns_local_flag(self, client):
        """JavaScript execution should indicate local execution."""
        response = client.post("/execute", json={
            "code": "console.log('test')",
            "language": "javascript"
        })
        
        assert response.status_code == 200
        assert response.json()["executeLocally"] is True

    def test_execute_python_returns_mock_output(self, client):
        """Python execution should return mock output."""
        response = client.post("/execute", json={
            "code": "print('test')",
            "language": "python"
        })
        
        assert response.status_code == 200
        assert response.json()["executeLocally"] is False
        assert "output" in response.json()
