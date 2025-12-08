from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.routers import rooms, execute, websocket
from app.database import init_db
from app.config import CORS_ORIGINS, BACKEND_HOST, BACKEND_PORT


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize database on startup."""
    init_db()
    yield


app = FastAPI(
    title="Coding Interview Platform API",
    description="Backend for real-time coding interview platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms.router)
app.include_router(execute.router)
app.include_router(websocket.router)

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Backend is running"}

def main():
    uvicorn.run("main:app", host=BACKEND_HOST, port=BACKEND_PORT, reload=True)

if __name__ == "__main__":
    main()
