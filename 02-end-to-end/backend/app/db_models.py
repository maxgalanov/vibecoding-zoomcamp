from sqlalchemy import Column, String, Text, Enum, Boolean, BigInteger, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models import Language, ParticipantStatus


class RoomModel(Base):
    """SQLAlchemy model for rooms."""
    __tablename__ = "rooms"

    id = Column(String(10), primary_key=True, index=True)
    code = Column(Text, nullable=False)
    language = Column(Enum(Language), nullable=False, default=Language.JAVASCRIPT)
    created_at = Column(BigInteger, nullable=False)  # Unix timestamp in milliseconds

    participants = relationship(
        "ParticipantModel",
        back_populates="room",
        cascade="all, delete-orphan"
    )


class ParticipantModel(Base):
    """SQLAlchemy model for room participants."""
    __tablename__ = "participants"

    id = Column(String(36), primary_key=True)  # UUID
    room_id = Column(String(10), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    username = Column(String(100), nullable=False)
    status = Column(Enum(ParticipantStatus), nullable=False, default=ParticipantStatus.ACTIVE)
    is_typing = Column(Boolean, default=False)
    cursor_color = Column(String(20), nullable=True)
    selection_color = Column(String(50), nullable=True)

    room = relationship("RoomModel", back_populates="participants")
