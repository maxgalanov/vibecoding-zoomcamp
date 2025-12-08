from fastapi import APIRouter
from app.models import ExecuteCodeRequest, ExecuteCodeResponse, Language

router = APIRouter(prefix="/execute", tags=["execute"])

@router.post("", response_model=ExecuteCodeResponse)
def execute_code(body: ExecuteCodeRequest):
    if body.language == Language.JAVASCRIPT:
        # Client-side execution for JS
        return ExecuteCodeResponse(
            output="",
            error="",
            executeLocally=True
        )
    elif body.language == Language.PYTHON:
        return ExecuteCodeResponse(
            output="[Mock execution] Python output:\nHello World\n(Real execution pending integration)",
            error="",
            executeLocally=False
        )
    elif body.language == Language.CPP:
        return ExecuteCodeResponse(
            output="[Mock execution] C++ output:\nHello World\n(Real execution pending integration)",
            error="",
            executeLocally=False
        )
    else:
        return ExecuteCodeResponse(
            output="",
            error="Unsupported language",
            executeLocally=False
        )
