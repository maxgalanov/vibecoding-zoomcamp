"""
Integration test configuration using file-based SQLite.

Unlike unit tests that use in-memory SQLite, integration tests use a file-based
database to more closely simulate production behavior including:
- Persistence across connections
- File I/O overhead
- Transaction handling
"""
import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from app.database import Base, get_db


@pytest.fixture(scope="module")
def db_file():
    """Create a temporary SQLite database file for the test module."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield path
    # Cleanup after all tests in the module
    if os.path.exists(path):
        os.unlink(path)


@pytest.fixture(scope="module")
def engine(db_file):
    """Create SQLAlchemy engine for the test database."""
    database_url = f"sqlite:///{db_file}"
    return create_engine(
        database_url,
        connect_args={"check_same_thread": False},
    )


@pytest.fixture(scope="module")
def TestingSessionLocal(engine):
    """Create session factory bound to test engine."""
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session(engine, TestingSessionLocal):
    """
    Create tables before each test and drop after.
    Provides an isolated database state for each test.
    """
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session, TestingSessionLocal):
    """
    Provide a TestClient with database dependency overridden.
    """
    def override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
