from enum import Enum
from typing import List, Optional
from pydantic import BaseModel

class Language(str, Enum):
    JAVASCRIPT = "javascript"
    PYTHON = "python"
    CPP = "cpp"

class ParticipantStatus(str, Enum):
    ACTIVE = "active"
    IDLE = "idle"

class Participant(BaseModel):
    id: str
    username: str
    status: ParticipantStatus = ParticipantStatus.ACTIVE
    isTyping: bool = False
    isCurrentUser: bool = False
    cursorColor: Optional[str] = None
    selectionColor: Optional[str] = None

class Room(BaseModel):
    id: str
    code: str
    language: Language
    participants: List[Participant] = []
    createdAt: int  # timestamp

class CreateRoomResponse(BaseModel):
    roomId: str
    room: Room

class JoinRoomRequest(BaseModel):
    username: str

class JoinRoomResponse(BaseModel):
    success: bool
    room: Optional[Room] = None
    error: Optional[str] = None

class LeaveRoomRequest(BaseModel):
    username: str

class LeaveRoomResponse(BaseModel):
    success: bool

class UpdateCodeRequest(BaseModel):
    code: str

class UpdateCodeResponse(BaseModel):
    success: bool

class UpdateLanguageRequest(BaseModel):
    language: Language

class UpdateLanguageResponse(BaseModel):
    success: bool
    code: str  # default template code

class ExecuteCodeRequest(BaseModel):
    code: str
    language: Language

class ExecuteCodeResponse(BaseModel):
    output: Optional[str] = ""
    error: Optional[str] = ""
    executeLocally: bool = False
