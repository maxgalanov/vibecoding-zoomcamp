from fastapi import APIRouter, HTTPException, Path, Depends
from sqlalchemy.orm import Session
from typing import List
import uuid
import time

from app.models import (
    Room, Participant, CreateRoomResponse, JoinRoomRequest, JoinRoomResponse,
    LeaveRoomRequest, LeaveRoomResponse, UpdateCodeRequest, UpdateCodeResponse,
    UpdateLanguageRequest, UpdateLanguageResponse, Language, ParticipantStatus
)
from app.database import get_db
from app.db_models import RoomModel, ParticipantModel

router = APIRouter(prefix="/rooms", tags=["rooms"])

def generate_short_id():
    return uuid.uuid4().hex[:6]

# Predefined cursor colors with proper rgba selection colors for transparency
CURSOR_COLORS = [
    {"cursor": "#e91e63", "selection": "rgba(233, 30, 99, 0.3)"},   # Pink
    {"cursor": "#2196f3", "selection": "rgba(33, 150, 243, 0.3)"},  # Blue
    {"cursor": "#4caf50", "selection": "rgba(76, 175, 80, 0.3)"},   # Green
    {"cursor": "#ff9800", "selection": "rgba(255, 152, 0, 0.3)"},   # Orange
    {"cursor": "#9c27b0", "selection": "rgba(156, 39, 176, 0.3)"},  # Purple
    {"cursor": "#00bcd4", "selection": "rgba(0, 188, 212, 0.3)"},   # Cyan
    {"cursor": "#f44336", "selection": "rgba(244, 67, 54, 0.3)"},   # Red
    {"cursor": "#ffeb3b", "selection": "rgba(255, 235, 59, 0.3)"},  # Yellow
]

def get_participant_color(participant_index: int) -> dict:
    """Get a color pair based on participant index for consistent assignment."""
    return CURSOR_COLORS[participant_index % len(CURSOR_COLORS)]

DEFAULT_TEMPLATES = {
    Language.JAVASCRIPT: """// Welcome to the coding interview!
// Write your JavaScript solution here

function solution(input) {
  // Your code here
  return input;
}

console.log(solution("Hello, World!"));""",
    Language.PYTHON: """# Welcome to the coding interview!
# Write your Python solution here

def solution(input):
    # Your code here
    return input

print(solution("Hello, World!"))""",
    Language.CPP: """// Welcome to the coding interview!
// Write your C++ solution here

#include <iostream>
using namespace std;

int main() {
    // Your code here
    cout << "Hello, World!" << endl;
    return 0;
}"""
}


def room_model_to_pydantic(room_db: RoomModel, current_username: str = None) -> Room:
    """Convert SQLAlchemy RoomModel to Pydantic Room, setting isCurrentUser flag."""
    participants = [
        Participant(
            id=p.id,
            username=p.username,
            status=p.status,
            isTyping=p.is_typing,
            isCurrentUser=(p.username == current_username) if current_username else False,
            cursorColor=p.cursor_color,
            selectionColor=p.selection_color
        )
        for p in room_db.participants
    ]
    return Room(
        id=room_db.id,
        code=room_db.code,
        language=room_db.language,
        participants=participants,
        createdAt=room_db.created_at
    )


@router.post("", response_model=CreateRoomResponse, status_code=201)
def create_room(db: Session = Depends(get_db)):
    room_id = generate_short_id()
    new_room = RoomModel(
        id=room_id,
        code=DEFAULT_TEMPLATES[Language.JAVASCRIPT],
        language=Language.JAVASCRIPT,
        created_at=int(time.time() * 1000)
    )
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    return CreateRoomResponse(roomId=room_id, room=room_model_to_pydantic(new_room))

@router.get("/{roomId}", response_model=Room)
def get_room(roomId: str = Path(...), db: Session = Depends(get_db)):
    room = db.query(RoomModel).filter(RoomModel.id == roomId).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room_model_to_pydantic(room)

@router.post("/{roomId}/join", response_model=JoinRoomResponse)
def join_room(body: JoinRoomRequest, roomId: str = Path(...), db: Session = Depends(get_db)):
    room = db.query(RoomModel).filter(RoomModel.id == roomId).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Check if user already in room
    for p in room.participants:
        if p.username == body.username:
            # Idempotency: if user already in room, return success
            return JoinRoomResponse(success=True, room=room_model_to_pydantic(room, body.username))

    # Get color based on participant count for consistent assignment
    color = get_participant_color(len(room.participants))
    
    new_participant = ParticipantModel(
        id=str(uuid.uuid4()),
        room_id=roomId,
        username=body.username,
        status=ParticipantStatus.ACTIVE,
        cursor_color=color["cursor"],
        selection_color=color["selection"]
    )
    db.add(new_participant)
    db.commit()
    db.refresh(room)
    
    return JoinRoomResponse(success=True, room=room_model_to_pydantic(room, body.username))

@router.post("/{roomId}/leave", response_model=LeaveRoomResponse)
def leave_room(body: LeaveRoomRequest, roomId: str = Path(...), db: Session = Depends(get_db)):
    room = db.query(RoomModel).filter(RoomModel.id == roomId).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    participant = db.query(ParticipantModel).filter(
        ParticipantModel.room_id == roomId,
        ParticipantModel.username == body.username
    ).first()
    
    if participant:
        db.delete(participant)
        db.commit()
    
    return LeaveRoomResponse(success=True)

@router.get("/{roomId}/participants", response_model=List[Participant])
def get_participants(roomId: str = Path(...), db: Session = Depends(get_db)):
    room = db.query(RoomModel).filter(RoomModel.id == roomId).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    return [
        Participant(
            id=p.id,
            username=p.username,
            status=p.status,
            isTyping=p.is_typing,
            cursorColor=p.cursor_color,
            selectionColor=p.selection_color
        )
        for p in room.participants
    ]

@router.patch("/{roomId}/code", response_model=UpdateCodeResponse)
def update_code(body: UpdateCodeRequest, roomId: str = Path(...), db: Session = Depends(get_db)):
    room = db.query(RoomModel).filter(RoomModel.id == roomId).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room.code = body.code
    db.commit()
    return UpdateCodeResponse(success=True)

@router.patch("/{roomId}/language", response_model=UpdateLanguageResponse)
def update_language(body: UpdateLanguageRequest, roomId: str = Path(...), db: Session = Depends(get_db)):
    room = db.query(RoomModel).filter(RoomModel.id == roomId).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room.language = body.language
    new_code = DEFAULT_TEMPLATES.get(body.language, "")
    room.code = new_code
    db.commit()
    
    return UpdateLanguageResponse(success=True, code=new_code)
