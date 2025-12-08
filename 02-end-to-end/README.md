# Coding Interview Platform

A real-time collaborative coding interview platform with code execution capabilities, built with **Next.js**, **FastAPI**, and **WebSockets**.

## Features

-   **Real-time Collaboration**: Live code editing with multiple users (WebSockets).
-   **Presence**: See who is currently in the room and what they are selecting/typing.
-   **Code Execution**: Run Python and JavaScript code securely (Backend/WASM).
-   **Modern UI**: Built with Shadcn UI, Tailwind CSS, and Framer Motion.
-   **Dark Mode**: Fully supported code editor (CodeMirror) and UI.

## Tech Stack

### Frontend
-   **Framework**: Next.js 15+ (App Router)
-   **Styling**: Tailwind CSS, Shadcn UI
-   **Editor**: CodeMirror 6 with custom collaborative extensions
-   **State/Network**: React Hooks, WebSockets

### Backend
-   **Framework**: FastAPI (Python 3.12+)
-   **Database**: SQLite (Dev) / PostgreSQL (Prod)
-   **Task/Package Manager**: uv
-   **Infrastructure**: Docker, Nginx (for local containerized setup)

## Prerequisites

-   **Node.js**: v18+
-   **Python**: 3.12+
-   **uv**: Python package and project manager (install via `curl -LsSf https://astral.sh/uv/install.sh | sh`)

---

## 🚀 Getting Started (Local Development)

### 1. Install Dependencies
This command installs Node modules for the frontend and syncs Python dependencies for the backend using `uv`.

```bash
npm run install:all
```

### 2. Run Application
Run both Frontend and Backend concurrently with hot-reloading:

```bash
npm run dev
```

-   **Frontend**: [http://localhost:3000](http://localhost:3000)
-   **Backend**: [http://localhost:3001](http://localhost:3001)

---

## 🐳 Running with Docker

To run the entire stack (Frontend, Backend, Postgres, Nginx) in containers:

```bash
docker-compose up --build
```

The application will be available at [http://localhost](http://localhost) (via Nginx proxy).

---

## 🧪 Testing

### Frontend Tests
Run unit and integration tests for React components and hooks:

```bash
# Run all frontend tests
cd frontend
npm test

# Run a specific test file
npm test -- hooks/use-websocket.test.ts
```

### Backend Tests
Run Unit, API, and Integration tests for FastAPI:

```bash
cd backend
uv run pytest
```

### Run All Tests
Execute both frontend and backend tests in sequence:

```bash
npm test
```

---

## ☁️ Deployment (Render)

This project is configured for one-click deployment on **Render** using a Blueprint (`render.yaml`).

1.  **Push** your code to a GitHub/GitLab repository.
2.  Log in to the [Render Dashboard](https://dashboard.render.com/).
3.  Click **New +** -> **Blueprint**.
4.  Connect your repository.
5.  Render will automatically detect `render.yaml` and provision:
    -   **PostgreSQL Database** (Free Tier)
    -   **Backend Service** (Python/FastAPI)
    -   **Frontend Service** (Node.js/Next.js)

The `render.yaml` configuration automatically handles environment variable linking (Database URL, API URLs) between your services.

---

## Project Structure

-   `frontend/`: Next.js source code.
-   `backend/`: FastAPI source code and tests.
-   `tests_integration/`: End-to-end integration tests (if applicable).
-   `docker-compose.yml`: Local container orchestration.
-   `render.yaml`: Production deployment Blueprint.
-   `package.json`: Root scripts for managing the monorepo.
