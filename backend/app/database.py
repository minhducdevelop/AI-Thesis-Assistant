import os
import sqlite3
import secrets
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional

DB_PATH = Path(__file__).parent.parent / "data" / "db.sqlite3"

def get_db():
    # Ensure directory exists
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn
def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if table users has the phone column
    try:
        cursor.execute("SELECT phone FROM users LIMIT 1")
    except sqlite3.OperationalError:
        # Table doesn't exist, or it has old columns (missing phone)
        print("[init_db] Dropping old tables to apply OTP schema...")
        cursor.execute("DROP TABLE IF EXISTS chat_messages")
        cursor.execute("DROP TABLE IF EXISTS chat_threads")
        cursor.execute("DROP TABLE IF EXISTS sessions")
        cursor.execute("DROP TABLE IF EXISTS otps")
        cursor.execute("DROP TABLE IF EXISTS users")
        conn.commit()
    
    # Create tables

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS otps (
        phone TEXT PRIMARY KEY,
        otp TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        citations TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(thread_id) REFERENCES chat_threads(id)
    )
    """)
    
    conn.commit()
    conn.close()

# OTP operations
def save_otp(phone: str, otp: str):
    phone = phone.strip()
    conn = get_db()
    cursor = conn.cursor()
    expires_at = (datetime.utcnow() + timedelta(minutes=5)).isoformat()
    try:
        cursor.execute(
            "INSERT OR REPLACE INTO otps (phone, otp, expires_at) VALUES (?, ?, ?)",
            (phone, otp, expires_at)
        )
        conn.commit()
    finally:
        conn.close()

def verify_otp_code(phone: str, otp: str) -> bool:
    phone = phone.strip()
    otp = otp.strip()
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT * FROM otps WHERE phone = ? AND otp = ? AND expires_at > ?",
            (phone, otp, datetime.utcnow().isoformat())
        )
        row = cursor.fetchone()
        if row:
            # Delete used OTP
            cursor.execute("DELETE FROM otps WHERE phone = ?", (phone,))
            conn.commit()
            return True
        return False
    finally:
        conn.close()

# User Auth operations with OTP
def register_user_otp(phone: str, full_name: str) -> Dict[str, Any]:
    phone = phone.strip()
    full_name = full_name.strip()
    if not phone or not full_name:
        raise ValueError("Số điện thoại và họ tên không được để trống.")
        
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Check if user already exists
        cursor.execute("SELECT id FROM users WHERE phone = ?", (phone,))
        if cursor.fetchone():
            raise ValueError("Số điện thoại này đã được đăng ký.")
            
        cursor.execute(
            "INSERT INTO users (phone, full_name) VALUES (?, ?)",
            (phone, full_name)
        )
        conn.commit()
        user_id = cursor.lastrowid
        return {"id": user_id, "phone": phone, "full_name": full_name}
    finally:
        conn.close()

def check_user_exists(phone: str) -> bool:
    phone = phone.strip()
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM users WHERE phone = ?", (phone,))
        return cursor.fetchone() is not None
    finally:
        conn.close()

def login_user_otp(phone: str) -> Dict[str, Any]:
    phone = phone.strip()
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM users WHERE phone = ?", (phone,))
        user = cursor.fetchone()
        if not user:
            raise ValueError("Số điện thoại này chưa được đăng ký thành viên.")
            
        # Generate session token
        token = secrets.token_hex(32)
        expires_at = (datetime.utcnow() + timedelta(days=7)).isoformat()
        
        cursor.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user["id"], expires_at)
        )
        conn.commit()
        return {
            "token": token,
            "phone": user["phone"],
            "full_name": user["full_name"]
        }
    finally:
        conn.close()

def get_user_by_token(token: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT users.id, users.phone, users.full_name FROM sessions 
            JOIN users ON sessions.user_id = users.id 
            WHERE sessions.token = ? AND sessions.expires_at > ?
            """,
            (token, datetime.utcnow().isoformat())
        )
        user = cursor.fetchone()
        if user:
            return {"id": user["id"], "phone": user["phone"], "full_name": user["full_name"]}
        return None
    finally:
        conn.close()

def logout_user(token: str):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
    finally:
        conn.close()

# Chat Thread functions
def list_threads(user_id: int) -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT * FROM chat_threads WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        )
        rows = cursor.fetchall()
        return [{"id": row["id"], "title": row["title"], "created_at": row["created_at"]} for row in rows]
    finally:
        conn.close()

def create_thread(user_id: int, title: str) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO chat_threads (user_id, title) VALUES (?, ?)",
            (user_id, title)
        )
        conn.commit()
        thread_id = cursor.lastrowid
        return {"id": thread_id, "title": title}
    finally:
        conn.close()

def delete_thread(user_id: int, thread_id: int) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Verify ownership
        cursor.execute("SELECT id FROM chat_threads WHERE id = ? AND user_id = ?", (thread_id, user_id))
        if not cursor.fetchone():
            return False
            
        # Delete messages and thread
        cursor.execute("DELETE FROM chat_messages WHERE thread_id = ?", (thread_id,))
        cursor.execute("DELETE FROM chat_threads WHERE id = ?", (thread_id,))
        conn.commit()
        return True
    finally:
        conn.close()

def get_thread_messages(user_id: int, thread_id: int) -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Verify ownership
        cursor.execute("SELECT id FROM chat_threads WHERE id = ? AND user_id = ?", (thread_id, user_id))
        if not cursor.fetchone():
            raise ValueError("Thread not found or access denied")
            
        cursor.execute(
            "SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at ASC",
            (thread_id,)
        )
        rows = cursor.fetchall()
        
        messages = []
        for row in rows:
            citations_list = []
            if row["citations"]:
                try:
                    citations_list = json.loads(row["citations"])
                except Exception:
                    pass
            messages.append({
                "id": row["id"],
                "role": row["role"],
                "content": row["content"],
                "citations": citations_list,
                "created_at": row["created_at"]
            })
        return messages
    finally:
        conn.close()

def add_message(user_id: int, thread_id: int, role: str, content: str, citations: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Verify ownership of thread
        cursor.execute("SELECT id FROM chat_threads WHERE id = ? AND user_id = ?", (thread_id, user_id))
        if not cursor.fetchone():
            raise ValueError("Thread not found or access denied")
            
        citations_str = json.dumps(citations) if citations is not None else None
        
        cursor.execute(
            "INSERT INTO chat_messages (thread_id, role, content, citations) VALUES (?, ?, ?, ?)",
            (thread_id, role, content, citations_str)
        )
        conn.commit()
        msg_id = cursor.lastrowid
        return {
            "id": msg_id,
            "thread_id": thread_id,
            "role": role,
            "content": content,
            "citations": citations or []
        }
    finally:
        conn.close()
