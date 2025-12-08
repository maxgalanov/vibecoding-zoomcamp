import os

# Database configuration
# Use DATABASE_URL for production (PostgreSQL), fallback to SQLite for dev/testing
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./coding_interview.db"
)

# Check if using SQLite (for connect_args configuration)
IS_SQLITE = DATABASE_URL.startswith("sqlite")

# Server configuration
BACKEND_HOST = os.getenv("BACKEND_HOST", "0.0.0.0")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "3001"))

# CORS configuration
# Parse comma-separated list of origins
CORS_ORIGINS_RAW = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000"
).split(",")

CORS_ORIGINS = []
for origin in CORS_ORIGINS_RAW:
    origin = origin.strip()
    if not origin:
        continue
    
    # Heuristic for Render internal hostnames: no protocol, no dots, not localhost
    if "://" not in origin and "." not in origin and origin != "localhost":
        origin = f"https://{origin}.onrender.com"
    elif not origin.startswith("http"):
        origin = f"https://{origin}"
        
    CORS_ORIGINS.append(origin)

# Security
JWT_SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY",
    "dev-secret-key-change-in-production"
)

# WebSocket configuration
WS_HEARTBEAT_INTERVAL = int(os.getenv("WS_HEARTBEAT_INTERVAL", "30"))
