import os
import shutil
import random
import traceback
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Header, Query, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import BaseModel

from app.config import settings
from app.rag import (
    add_pdf_to_vectorstore,
    delete_pdf_from_vectorstore,
    list_documents_in_vectorstore,
    reindex_all_documents,
    query_rag
)
from app.pdf_loader import extract_page_image
from app.database import (
    init_db,
    save_otp,
    verify_otp_code,
    register_user_otp,
    check_user_exists,
    login_user_otp,
    get_user_by_token,
    logout_user,
    list_threads,
    create_thread,
    delete_thread,
    get_thread_messages,
    add_message
)

app = FastAPI(
    title="ThesisAI API",
    description="Backend API for ThesisAI",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Database immediately
init_db()


# Dependency to check authorization token optionally
async def get_optional_user(
    authorization: Optional[str] = Header(default=None),
    token: Optional[str] = None
):
    actual_token = None
    if authorization and authorization.startswith("Bearer "):
        actual_token = authorization.split("Bearer ", 1)[1].strip()
    elif token:
        actual_token = token.strip()
        
    if not actual_token:
        return None
    return get_user_by_token(actual_token)

# Dependency to require active authenticated user
async def get_current_user(current_user: Optional[dict] = Depends(get_optional_user)):
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token xác thực không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại."
        )
    return current_user

# Pydantic Schemas for OTP authentication
class SendOtpRequest(BaseModel):
    phone: str
    is_register: bool

class VerifyRegisterRequest(BaseModel):
    phone: str
    full_name: str
    otp: str

class VerifyLoginRequest(BaseModel):
    phone: str
    otp: str

class TokenResponse(BaseModel):
    token: str
    full_name: str
    phone: str

class UserMeResponse(BaseModel):
    id: int
    phone: str
    full_name: str

class ThreadCreateRequest(BaseModel):
    title: str

class ThreadResponse(BaseModel):
    id: int
    title: str
    created_at: str

class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    citations: List[dict]
    created_at: str

class QueryRequest(BaseModel):
    query: str
    thread_id: Optional[int] = None

class QueryResponse(BaseModel):
    answer: str
    citations: List[dict]
    hypothesis_map: Optional[dict] = None
    debate: Optional[dict] = None

class DocumentInfo(BaseModel):
    filename: str
    title: str
    total_pages: int

# OTP & Auth Routes
@app.post("/api/auth/send-otp")
async def api_send_otp(req: SendOtpRequest):
    phone = req.phone.strip()
    if not phone:
        raise HTTPException(status_code=400, detail="Vui lòng điền số điện thoại.")
    
    # Validation constraints
    exists = check_user_exists(phone)
    if req.is_register and exists:
        raise HTTPException(status_code=400, detail="Số điện thoại này đã được đăng ký thành viên.")
    if not req.is_register and not exists:
        raise HTTPException(status_code=404, detail="Số điện thoại chưa được đăng ký thành viên.")
        
    # Generate 6-digit mock OTP
    otp_code = str(random.randint(100000, 999999))
    try:
        save_otp(phone, otp_code)
        # We print the mock code to terminal and return it in JSON response for simulation
        print(f"\n[SMS MOCK GATEWAY] Gửi OTP '{otp_code}' tới số: {phone}\n")
        return {
            "status": "success", 
            "message": f"Mã OTP (giả lập) đã gửi tới số {phone}", 
            "otp": otp_code
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi gửi OTP: {str(e)}")

@app.post("/api/auth/verify-otp-register", response_model=TokenResponse)
async def api_verify_otp_register(req: VerifyRegisterRequest):
    phone = req.phone.strip()
    full_name = req.full_name.strip()
    otp = req.otp.strip()
    
    if not phone or not full_name or not otp:
        raise HTTPException(status_code=400, detail="Vui lòng điền đầy đủ thông tin xác thực.")
        
    # 1. Verify OTP
    if not verify_otp_code(phone, otp):
        raise HTTPException(status_code=400, detail="Mã OTP không chính xác hoặc đã hết hạn.")
        
    # 2. Register user
    try:
        register_user_otp(phone, full_name)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    # 3. Auto login user to return session token
    try:
        session_data = login_user_otp(phone)
        return session_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/verify-otp-login", response_model=TokenResponse)
async def api_verify_otp_login(req: VerifyLoginRequest):
    phone = req.phone.strip()
    otp = req.otp.strip()
    
    if not phone or not otp:
        raise HTTPException(status_code=400, detail="Vui lòng nhập số điện thoại và mã OTP.")
        
    # 1. Verify OTP
    if not verify_otp_code(phone, otp):
        raise HTTPException(status_code=400, detail="Mã OTP không chính xác hoặc đã hết hạn.")
        
    # 2. Login user
    try:
        session_data = login_user_otp(phone)
        return session_data
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
        logout_user(token)
    return {"status": "success", "message": "Logged out successfully"}

@app.get("/api/auth/me", response_model=UserMeResponse)
async def auth_me(current_user: dict = Depends(get_current_user)):
    return current_user

# Chat History / Threads Routes
@app.get("/api/chat/threads", response_model=List[ThreadResponse])
async def get_threads(current_user: dict = Depends(get_current_user)):
    try:
        return list_threads(current_user["id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat/threads", response_model=ThreadResponse)
async def post_thread(req: ThreadCreateRequest, current_user: dict = Depends(get_current_user)):
    try:
        return create_thread(current_user["id"], req.title)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/chat/threads/{thread_id}")
async def remove_thread(thread_id: int, current_user: dict = Depends(get_current_user)):
    try:
        success = delete_thread(current_user["id"], thread_id)
        if not success:
            raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện hoặc quyền truy cập bị từ chối.")
        return {"status": "success", "message": "Thread deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/threads/{thread_id}/messages", response_model=List[MessageResponse])
async def get_thread_messages_route(thread_id: int, current_user: dict = Depends(get_current_user)):
    try:
        return get_thread_messages(current_user["id"], thread_id)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Document Management Routes (User-Isolated / Anonymous = 0)
@app.get("/api/documents", response_model=List[DocumentInfo])
async def get_documents(
    x_provider: str = Header(default="gemini"),
    x_api_key: str = Header(default=""),
    x_thread_id: Optional[str] = Header(default=None),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    try:
        uid = current_user["id"] if current_user else 0
        if x_thread_id and x_thread_id.strip() and x_thread_id != "null":
            try:
                thread_id = int(x_thread_id)
                uid = uid * 1000000 + thread_id
            except ValueError:
                pass
        docs = list_documents_in_vectorstore(provider=x_provider, user_id=uid, api_key=x_api_key)
        return docs
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get("/api/documents/view/{filename}")
async def view_document(
    filename: str,
    token: Optional[str] = None,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    try:
        uid = current_user["id"] if current_user else 0
        user_dir = settings.upload_path / f"user_{uid}"
        file_path = user_dir / filename
        
        if not file_path.exists():
            # Support fallback for guest uploaded files
            if uid != 0:
                fallback_path = settings.upload_path / "user_0" / filename
                if fallback_path.exists():
                    file_path = fallback_path
            
            if not file_path.exists():
                raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu này.")
                
        return FileResponse(
            path=str(file_path),
            media_type="application/pdf",
            filename=filename,
            headers={
                "Content-Disposition": f"inline; filename=\"{filename}\""
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents/page-image/{filename}/{page}")
async def get_page_image(
    filename: str,
    page: int,
    token: Optional[str] = None,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """
    Renders a specific PDF page as a PNG image for Deep Citation Traceback.
    Returns the page as an image that can be displayed in citation hover popups.
    """
    try:
        uid = current_user["id"] if current_user else 0
        user_dir = settings.upload_path / f"user_{uid}"
        file_path = user_dir / filename
        
        if not file_path.exists():
            # Support fallback for guest uploaded files
            if uid != 0:
                fallback_path = settings.upload_path / "user_0" / filename
                if fallback_path.exists():
                    file_path = fallback_path
            
            if not file_path.exists():
                raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu này.")
        
        img_bytes = extract_page_image(str(file_path), page, dpi=150)
        
        return Response(
            content=img_bytes,
            media_type="image/png",
            headers={
                "Cache-Control": "public, max-age=86400",  # Cache for 24h
                "Content-Disposition": f"inline; filename=\"{filename}_page_{page}.png\""
            }
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu này.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/documents/reindex")
async def reindex_documents(
    x_provider: str = Header(default="gemini"),
    x_api_key: str = Header(default=""),
    x_thread_id: Optional[str] = Header(default=None),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Re-indexes all uploaded PDFs with current chunk settings."""
    try:
        uid = current_user["id"] if current_user else 0
        if x_thread_id and x_thread_id.strip() and x_thread_id != "null":
            try:
                thread_id = int(x_thread_id)
                uid = uid * 1000000 + thread_id
            except ValueError:
                pass
        result = reindex_all_documents(provider=x_provider, user_id=uid, api_key=x_api_key)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.post("/api/documents")
async def upload_document(
    file: UploadFile = File(...),
    x_provider: str = Header(default="gemini"),
    x_api_key: str = Header(default=""),
    x_thread_id: Optional[str] = Header(default=None),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Only PDF files are supported."
        )

    uid = current_user["id"] if current_user else 0
    # Physically save to same folder (user folder), but index in Chroma under isolated user_id
    user_dir = settings.upload_path / f"user_{uid}"
    user_dir.mkdir(parents=True, exist_ok=True)
    file_path = user_dir / file.filename
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        vector_uid = uid
        if x_thread_id and x_thread_id.strip() and x_thread_id != "null":
            try:
                thread_id = int(x_thread_id)
                vector_uid = uid * 1000000 + thread_id
            except ValueError:
                pass
                
        result = add_pdf_to_vectorstore(
            file_path=str(file_path),
            provider=x_provider,
            user_id=vector_uid,
            api_key=x_api_key
        )
        return result
    except ValueError as ve:
        if file_path.exists():
            os.remove(file_path)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        if file_path.exists():
            os.remove(file_path)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.delete("/api/documents/{filename}")
async def delete_document(
    filename: str,
    x_provider: str = Header(default="gemini"),
    x_api_key: str = Header(default=""),
    x_thread_id: Optional[str] = Header(default=None),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    uid = current_user["id"] if current_user else 0
    user_dir = settings.upload_path / f"user_{uid}"
    file_path = user_dir / filename
    
    try:
        vector_uid = uid
        if x_thread_id and x_thread_id.strip() and x_thread_id != "null":
            try:
                thread_id = int(x_thread_id)
                vector_uid = uid * 1000000 + thread_id
            except ValueError:
                pass
                
        delete_pdf_from_vectorstore(
            filename=filename,
            provider=x_provider,
            user_id=vector_uid,
            api_key=x_api_key
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    if file_path.exists():
        try:
            os.remove(file_path)
        except Exception as e:
            return {"status": "deleted_from_db", "warning": f"Could not delete physical file: {str(e)}"}
            
    return {"status": "success", "message": f"Successfully deleted {filename}"}

# Query / Chat RAG Route (User-Isolated/Saved, or Anonymous/Unsaved)
@app.post("/api/query", response_model=QueryResponse)
async def query_documents(
    req: QueryRequest,
    x_provider: str = Header(default="gemini"),
    x_api_key: str = Header(default=""),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    try:
        uid = current_user["id"] if current_user else 0
        
        # 1. Save user question to database if logged in
        if current_user and req.thread_id is not None:
            add_message(
                user_id=uid,
                thread_id=req.thread_id,
                role="user",
                content=req.query
            )

        # 2. Query RAG pipeline - isolate by thread if thread_id is present
        rag_uid = uid
        if req.thread_id is not None:
            rag_uid = uid * 1000000 + req.thread_id
            
        result = query_rag(
            query_text=req.query,
            provider=x_provider,
            user_id=rag_uid,
            api_key=x_api_key
        )

        # 3. Save assistant response to database if logged in
        if current_user and req.thread_id is not None:
            add_message(
                user_id=uid,
                thread_id=req.thread_id,
                role="assistant",
                content=result["answer"],
                citations=result["citations"]
            )

        return result
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# StarletteHTTPException imported at top of file

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    if isinstance(exc, StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )
    tbl = traceback.format_exception(type(exc), exc, exc.__traceback__)
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Server Error: {str(exc)}",
            "traceback": "".join(tbl)
        }
    )

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}
