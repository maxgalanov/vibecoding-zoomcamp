from tests.conftest import client
import pytest


def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.fixture
def created_room_id():
    response = client.post("/rooms")
    assert response.status_code == 201
    return response.json()["roomId"]


def test_create_room():
    response = client.post("/rooms")
    assert response.status_code == 201
    data = response.json()
    assert "roomId" in data
    assert "room" in data
    assert data["room"]["language"] == "javascript"


def test_get_room(created_room_id):
    response = client.get(f"/rooms/{created_room_id}")
    assert response.status_code == 200
    assert response.json()["id"] == created_room_id


def test_join_room(created_room_id):
    response = client.post(f"/rooms/{created_room_id}/join", json={"username": "testuser"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["room"]["participants"]) == 1
    assert data["room"]["participants"][0]["username"] == "testuser"


def test_update_code(created_room_id):
    new_code = "console.log('Updated');"
    response = client.patch(f"/rooms/{created_room_id}/code", json={"code": new_code})
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Verify update
    response = client.get(f"/rooms/{created_room_id}")
    assert response.json()["code"] == new_code


def test_update_language(created_room_id):
    response = client.patch(f"/rooms/{created_room_id}/language", json={"language": "python"})
    assert response.status_code == 200
    assert response.json()["success"] is True
    
    # Verify language and template code update
    response = client.get(f"/rooms/{created_room_id}")
    assert response.json()["language"] == "python"
    assert "print" in response.json()["code"]


def test_execute_js():
    response = client.post("/execute", json={"code": "x=1", "language": "javascript"})
    assert response.status_code == 200
    assert response.json()["executeLocally"] is True


def test_execute_python():
    response = client.post("/execute", json={"code": "print(1)", "language": "python"})
    assert response.status_code == 200
    assert response.json()["executeLocally"] is False
    assert "Mock execution" in response.json()["output"]
