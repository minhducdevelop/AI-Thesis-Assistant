import os
import json
import time
import logging
from typing import List, Dict, Any, Tuple, Optional
from pathlib import Path

from langchain_core.documents import Document
from langchain_chroma import Chroma

# Imports for Gemini
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI

# Imports for OpenAI
from langchain_openai import OpenAIEmbeddings, ChatOpenAI

from app.config import settings
from app.pdf_loader import load_pdf, chunk_documents, extract_text_with_positions

logger = logging.getLogger(__name__)

# Ordered list of Gemini models to try (fallback chain for free-tier quota limits)
# Models are matched to the user's Google AI Studio account availability
GEMINI_MODEL_CHAIN = [
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
]

def get_keys(api_key_header: str = None) -> Tuple[str, str]:
    """
    Resolves Gemini and OpenAI API keys from request headers or environment variables.
    """
    gemini_key = api_key_header if api_key_header else settings.gemini_api_key
    if not gemini_key:
        gemini_key = os.environ.get("GEMINI_API_KEY", "")
        
    openai_key = api_key_header if api_key_header else settings.openai_api_key
    if not openai_key:
        openai_key = os.environ.get("OPENAI_API_KEY", "")
        
    return gemini_key, openai_key

def get_embeddings_and_llm(provider: str, api_key: str = None) -> Tuple[Any, Any]:
    """
    Initializes and returns the Embeddings and LLM models based on the selected provider.
    Uses the first model in GEMINI_MODEL_CHAIN as default; fallback happens at invoke time.
    """
    gemini_key, openai_key = get_keys(api_key)
    
    if provider.lower() == "gemini":
        if not gemini_key:
            raise ValueError("Gemini API key is not configured.")
        # Setup Gemini
        embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-2",
            google_api_key=gemini_key
        )
        llm = ChatGoogleGenerativeAI(
            model=GEMINI_MODEL_CHAIN[0],
            google_api_key=gemini_key,
            temperature=0.2
        )
        return embeddings, llm
        
    elif provider.lower() == "openai":
        if not openai_key:
            raise ValueError("OpenAI API key is not configured.")
        # Setup OpenAI
        embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=openai_key
        )
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            openai_api_key=openai_key,
            temperature=0.2
        )
        return embeddings, llm
    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")


def _invoke_llm_with_fallback(messages: list, provider: str, api_key: str = None):
    """
    Invokes the LLM with automatic model fallback when quota is exhausted (429).
    Tries each model in GEMINI_MODEL_CHAIN sequentially.
    For OpenAI, invokes directly without fallback.
    """
    if provider.lower() != "gemini":
        _, llm = get_embeddings_and_llm(provider, api_key)
        return llm.invoke(messages)

    gemini_key, _ = get_keys(api_key)
    last_error = None

    for model_name in GEMINI_MODEL_CHAIN:
        try:
            logger.info(f"[RAG] Trying model: {model_name}")
            llm = ChatGoogleGenerativeAI(
                model=model_name,
                google_api_key=gemini_key,
                temperature=0.2
            )
            response = llm.invoke(messages)
            logger.info(f"[RAG] Success with model: {model_name}")
            return response
        except Exception as e:
            error_str = str(e)
            is_rate_limit = (
                "429" in error_str
                or "RESOURCE_EXHAUSTED" in error_str
                or "quota" in error_str.lower()
                or "rate" in error_str.lower()
            )
            is_not_found = (
                "404" in error_str
                or "not found" in error_str.lower()
                or "not supported" in error_str.lower()
            )
            if is_rate_limit or is_not_found:
                logger.warning(f"[RAG] Model {model_name} failed ({error_str[:120]}), trying next...")
                last_error = e
                time.sleep(1)  # Brief pause before trying next model
                continue
            else:
                # Non-quota error, raise immediately
                raise

    # All models exhausted
    raise ValueError(
        f"Tất cả các mô hình Gemini đều đã hết quota miễn phí trong ngày. "
        f"Vui lòng đợi vài phút rồi thử lại, hoặc tạo API Key mới tại https://aistudio.google.com/apikey. "
        f"Lỗi cuối cùng: {str(last_error)}"
    )


def get_vectorstore(provider: str, user_id: int, api_key: str = None) -> Chroma:
    """
    Retrieves the Chroma vector store for a specific provider and user.
    Uses separate collections per user to ensure data privacy and isolated search.
    """
    embeddings, _ = get_embeddings_and_llm(provider, api_key)
    collection_name = f"thesis_assistant_{provider.lower()}_user_{user_id}"
    
    return Chroma(
        collection_name=collection_name,
        embedding_function=embeddings,
        persist_directory=str(settings.chroma_path)
    )

def add_pdf_to_vectorstore(file_path: str, provider: str, user_id: int, api_key: str = None) -> Dict[str, Any]:
    """
    Loads PDF, chunks it, and adds it to the provider's vector store.
    Deletes any existing vectors for the same file before re-adding.
    """
    filename = os.path.basename(file_path)
    
    # 1. Parse PDF
    docs = load_pdf(file_path)
    if not docs:
        return {"status": "ignored", "message": "No text extracted from PDF"}
    
    logger.info(f"[Upload] Loaded {filename}: {len(docs)} pages extracted")
        
    # 2. Chunk documents with current settings (chunk_size=2000, overlap=400)
    chunks = chunk_documents(docs)
    logger.info(f"[Upload] Chunked {filename}: {len(chunks)} chunks created from {len(docs)} pages")
    
    # 3. Delete old vectors for the same file (in case of re-upload)
    try:
        vectorstore = get_vectorstore(provider, user_id, api_key)
        vectorstore.delete(where={"source": filename})
        logger.info(f"[Upload] Cleared old vectors for {filename}")
    except Exception as e:
        logger.warning(f"[Upload] Could not clear old vectors: {e}")
    
    # 4. Add new chunks to vectorstore
    vectorstore = get_vectorstore(provider, user_id, api_key)
    vectorstore.add_documents(chunks)
    logger.info(f"[Upload] Successfully added {len(chunks)} chunks for {filename}")
    
    # Return brief info
    return {
        "status": "success",
        "filename": filename,
        "pages": len(docs),
        "chunks": len(chunks)
    }

def delete_pdf_from_vectorstore(filename: str, provider: str, user_id: int, api_key: str = None):
    """
    Deletes all vectors and chunks matching the filename from the vector store.
    """
    vectorstore = get_vectorstore(provider, user_id, api_key)
    # Chroma handles delete by filtering metadatas
    vectorstore.delete(where={"source": filename})

def reindex_all_documents(provider: str, user_id: int, api_key: str = None) -> Dict[str, Any]:
    """
    Re-indexes all uploaded PDF files for a user.
    Deletes existing vector data and re-chunks all PDFs with current settings.
    This is needed when chunk_size or other indexing parameters change.
    """
    import shutil
    
    user_dir = settings.upload_path / f"user_{user_id}"
    if not user_dir.exists():
        return {"status": "no_documents", "message": "Không tìm thấy tài liệu nào."}
    
    # Get all PDF files in user's upload directory
    pdf_files = list(user_dir.glob("*.pdf")) + list(user_dir.glob("*.PDF"))
    if not pdf_files:
        return {"status": "no_documents", "message": "Không tìm thấy file PDF nào."}
    
    # Delete old vector store collection completely
    try:
        vectorstore = get_vectorstore(provider, user_id, api_key)
        collection = vectorstore._collection
        # Delete all documents in the collection
        all_ids = collection.get()["ids"]
        if all_ids:
            collection.delete(ids=all_ids)
            logger.info(f"[Reindex] Deleted {len(all_ids)} old vectors for user {user_id}")
    except Exception as e:
        logger.warning(f"[Reindex] Could not delete old vectors: {e}")
    
    # Re-process all PDF files
    results = []
    total_chunks = 0
    for pdf_path in pdf_files:
        try:
            docs = load_pdf(str(pdf_path))
            if not docs:
                results.append({"file": pdf_path.name, "status": "skipped", "reason": "no text"})
                continue
            
            chunks = chunk_documents(docs)
            vectorstore = get_vectorstore(provider, user_id, api_key)
            vectorstore.add_documents(chunks)
            total_chunks += len(chunks)
            
            results.append({
                "file": pdf_path.name,
                "status": "success",
                "pages": len(docs),
                "chunks": len(chunks)
            })
            logger.info(f"[Reindex] Re-indexed {pdf_path.name}: {len(docs)} pages, {len(chunks)} chunks")
        except Exception as e:
            results.append({"file": pdf_path.name, "status": "error", "reason": str(e)[:200]})
    
    return {
        "status": "success",
        "total_files": len(pdf_files),
        "total_chunks": total_chunks,
        "details": results
    }

def list_documents_in_vectorstore(provider: str, user_id: int, api_key: str = None) -> List[Dict[str, Any]]:
    """
    Lists all unique documents indexed in the vector store for the selected provider.
    Retrieves metadata directly from Chroma to avoid external databases.
    """
    try:
        vectorstore = get_vectorstore(provider, user_id, api_key)
        collection = vectorstore._collection
        
        # Get all metadatas (limit to prevent memory issues)
        results = collection.get(include=["metadatas"])
        metadatas = results.get("metadatas", [])
        
        # Group by source filename
        docs_dict = {}
        for meta in metadatas:
            if not meta or "source" not in meta:
                continue
            source = meta["source"]
            if source not in docs_dict:
                docs_dict[source] = {
                    "filename": source,
                    "title": meta.get("title", source),
                    "total_pages": meta.get("total_pages", 0)
                }
        return list(docs_dict.values())
    except Exception as e:
        # If collection doesn't exist yet, return empty list
        return []

# ─────────────────────────────────────────────────────────
# FEATURE 1: Auto-Hypothesis Mapping (Sơ đồ tư duy giả thuyết)
# ─────────────────────────────────────────────────────────

def _generate_hypothesis_map(
    query: str, answer: str, context_str: str,
    provider: str, api_key: str = None
) -> Optional[Dict[str, Any]]:
    """
    Uses Prompt Engineering to extract entities and relationships from the answer,
    returning a JSON structure for mindmap visualization.
    Returns None on failure (graceful degradation).
    """
    system_prompt = (
        "Bạn là một module trích xuất thực thể khoa học chuyên dụng.\n"
        "Từ câu trả lời nghiên cứu bên dưới, hãy trích xuất MỘT sơ đồ tư duy (mindmap) "
        "thể hiện các thực thể và mối quan hệ nhân quả/tương tác giữa chúng.\n\n"
        "QUY TẮC:\n"
        "1. Trả về ĐÚNG JSON format, KHÔNG giải thích hay markdown.\n"
        "2. Format JSON:\n"
        '{"center": "Chủ đề trung tâm",'
        ' "branches": ['
        '   {"label": "Nhánh 1", "type": "organism|chemical|process|organ|effect|condition|method|result",'
        '    "children": ['
        '      {"label": "Chi tiết 1.1", "type": "...", "relation": "mô tả mối quan hệ", "children": []}'
        '    ]}'
        ' ]}\n'
        "3. type gồm: organism (sinh vật), chemical (hóa chất), process (quá trình), "
        "organ (cơ quan/bộ phận), effect (tác động), condition (điều kiện), method (phương pháp), result (kết quả).\n"
        "4. Tối đa 4 nhánh chính, mỗi nhánh tối đa 3 children.\n"
        "5. Label ngắn gọn (dưới 30 ký tự), relation ngắn gọn (dưới 20 ký tự).\n"
        "6. CHỈ trả về JSON thuần túy, không có markdown code block."
    )
    
    user_prompt = f"CÂU HỎI: {query}\n\nCÂU TRẢ LỜI:\n{answer[:3000]}"
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    try:
        response = _invoke_llm_with_fallback(messages, provider, api_key)
        raw = response.content
        if isinstance(raw, list):
            text_parts = []
            for block in raw:
                if isinstance(block, dict) and "text" in block:
                    text_parts.append(block["text"])
                elif isinstance(block, str):
                    text_parts.append(block)
            raw = "\n".join(text_parts)
        
        # Clean potential markdown code fences
        raw = str(raw).strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]  # Remove first line (```json)
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()
        
        result = json.loads(raw)
        
        # Validate minimal structure
        if "center" in result and "branches" in result:
            return result
        else:
            logger.warning("[HypothesisMap] JSON missing required keys")
            return None
            
    except json.JSONDecodeError as e:
        logger.warning(f"[HypothesisMap] Failed to parse JSON: {e}")
        return None
    except Exception as e:
        logger.warning(f"[HypothesisMap] Generation failed: {e}")
        return None


# ─────────────────────────────────────────────────────────
# FEATURE 2: Multi-Perspective Debate (Tranh biện đa chiều)
# ─────────────────────────────────────────────────────────

def _generate_debate(
    query: str, context_str: str,
    provider: str, api_key: str = None
) -> Optional[Dict[str, Any]]:
    """
    Analyzes retrieved chunks for contradicting/complementary viewpoints across papers.
    Returns structured debate JSON for multi-perspective visualization.
    Returns None on failure (graceful degradation).
    """
    system_prompt = (
        "Bạn là một module phân tích tranh biện học thuật chuyên dụng.\n"
        "Nhiệm vụ: Phân tích các tài liệu nghiên cứu bên dưới để tìm ra các GÓC NHÌN KHÁC NHAU, "
        "mâu thuẫn, hoặc bổ sung lẫn nhau giữa các tác giả/bài báo.\n\n"
        "QUY TẮC:\n"
        "1. Trả về ĐÚNG JSON format, KHÔNG giải thích hay markdown.\n"
        "2. Format JSON:\n"
        '{"perspectives": ['
        '  {"stance": "thuận|phản biện|bổ sung|hạn chế",'
        '   "source": "tên_file.pdf",'
        '   "page": số_trang,'
        '   "claim": "Luận điểm chính...",'
        '   "evidence": "Bằng chứng cụ thể...",'
        '   "strength": "mạnh|trung bình|yếu"'
        '  }'
        '],'
        ' "synthesis": "Tổng hợp và nhận xét chung về sự đồng thuận/mâu thuẫn giữa các nghiên cứu...",'
        ' "research_gaps": "Các khoảng trống nghiên cứu cần được lấp đầy..."}\n'
        "3. Cố gắng tìm ÍT NHẤT 2 góc nhìn khác nhau. Nếu các tài liệu đồng thuận, "
        "hãy nêu góc nhìn 'thuận' và 'bổ sung' với các chi tiết khác nhau.\n"
        "4. source và page PHẢI khớp chính xác với tài liệu được cung cấp.\n"
        "5. CHỈ trả về JSON thuần túy, không có markdown code block.\n"
        "6. Viết claim và evidence bằng tiếng Việt."
    )
    
    user_prompt = f"CÂU HỎI NGHIÊN CỨU: {query}\n\nTÀI LIỆU:\n{context_str[:6000]}"
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    try:
        response = _invoke_llm_with_fallback(messages, provider, api_key)
        raw = response.content
        if isinstance(raw, list):
            text_parts = []
            for block in raw:
                if isinstance(block, dict) and "text" in block:
                    text_parts.append(block["text"])
                elif isinstance(block, str):
                    text_parts.append(block)
            raw = "\n".join(text_parts)
        
        # Clean potential markdown code fences
        raw = str(raw).strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()
        
        result = json.loads(raw)
        
        # Validate minimal structure
        if "perspectives" in result and len(result["perspectives"]) > 0:
            return result
        else:
            logger.warning("[Debate] JSON missing perspectives")
            return None
            
    except json.JSONDecodeError as e:
        logger.warning(f"[Debate] Failed to parse JSON: {e}")
        return None
    except Exception as e:
        logger.warning(f"[Debate] Generation failed: {e}")
        return None


# ─────────────────────────────────────────────────────────
# FEATURE 3 helper: Build deep citations with content preview
# ─────────────────────────────────────────────────────────

def _build_deep_citations(
    retrieved_docs: List[Document], user_id: int
) -> List[Dict[str, Any]]:
    """
    Builds enriched citation data including content previews for Deep Citation Traceback.
    """
    from app.config import settings
    
    citations = []
    seen_citations = set()
    
    for doc in retrieved_docs:
        source = doc.metadata.get("source", "")
        page = doc.metadata.get("page", 0)
        title = doc.metadata.get("title", source)
        
        citation_key = f"{source}:{page}"
        if citation_key not in seen_citations:
            seen_citations.add(citation_key)
            
            # Check if the physical PDF file exists for page image support
            # Resolve actual user_id from vector_uid encoding
            actual_uid = user_id
            if user_id >= 1000000:
                actual_uid = user_id // 1000000
            
            has_file = False
            user_dir = settings.upload_path / f"user_{actual_uid}"
            file_path = user_dir / source
            if file_path.exists():
                has_file = True
            elif actual_uid != 0:
                fallback = settings.upload_path / f"user_0" / source
                if fallback.exists():
                    has_file = True
            
            citations.append({
                "source": source,
                "title": title,
                "page": page,
                "content_preview": doc.page_content[:500] + ("..." if len(doc.page_content) > 500 else ""),
                "has_page_image": has_file
            })
            
    return citations


# ─────────────────────────────────────────────────────────
# Main RAG Query Pipeline (Enhanced with 3 features)
# ─────────────────────────────────────────────────────────

def query_rag(query_text: str, provider: str, user_id: int, api_key: str = None, top_k: int = 25) -> Dict[str, Any]:
    """
    Enhanced RAG pipeline with 3 breakthrough features:
    1. Retrieves relevant text chunks from the vector store using MMR for diverse results.
    2. Builds a context-aware prompt for the LLM.
    3. LLM synthesizes an answer with direct filename & page citations in the text.
    4. [NEW] Generates hypothesis map (entity-relationship mindmap) from the answer.
    5. [NEW] Generates multi-perspective debate analysis from retrieved context.
    6. [NEW] Builds deep citations with page image support.
    7. Returns enriched response with all features.
    """
    vectorstore = get_vectorstore(provider, user_id, api_key)

    
    # 1. Retrieve chunks using MMR (Maximal Marginal Relevance) for diverse results
    # fetch_k retrieves more candidates, then MMR selects top_k diverse ones
    retriever = vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": top_k,
            "fetch_k": top_k * 3,  # Fetch 3x more candidates for MMR diversity
            "lambda_mult": 0.6,    # Balance between relevance (1.0) and diversity (0.0)
        }
    )
    retrieved_docs = retriever.invoke(query_text)
    
    if not retrieved_docs:
        return {
            "answer": "Không tìm thấy tài liệu nào trong thư viện để trả lời câu hỏi của bạn. Vui lòng tải tài liệu lên trước.",
            "citations": [],
            "hypothesis_map": None,
            "debate": None
        }
        
    # 2. Format Context
    context_str = ""
    for idx, doc in enumerate(retrieved_docs):
        # Format the block for LLM prompt
        context_str += f"--- [TÀI LIỆU KHẢO SÁT {idx+1}] ---\n"
        context_str += f"Tệp tin: {doc.metadata.get('source', 'Unknown')}\n"
        context_str += f"Tiêu đề: {doc.metadata.get('title', 'Unknown')}\n"
        context_str += f"Trang: {doc.metadata.get('page', 'Unknown')}\n"
        context_str += f"Nội dung:\n{doc.page_content}\n\n"

    # 3. Create System & User Prompts - Enhanced for maximum citations
    system_prompt = (
        "Bạn là một Trợ lý AI hỗ trợ viết luận văn chuyên nghiệp (AI Thesis Assistant).\n"
        "Nhiệm vụ của bạn là trả lời câu hỏi của người dùng một cách chính xác, chi tiết, và học thuật, "
        "dựa TRÊN các tài liệu được cung cấp dưới đây.\n\n"
        "QUY TẮC ĐỊNH DẠNG CÂU TRẢ LỜI:\n"
        "1. TUYỆT ĐỐI KHÔNG dùng dấu # ở đầu dòng. Không dùng #, ##, ###, #### hay bất kỳ dạng markdown header nào.\n"
        "2. Với tiêu đề mục chính (ví dụ: '1. Vai trò của bảng friends'), hãy bọc toàn bộ dòng tiêu đề "
        "trong cặp dấu ** để in đậm. Ví dụ: **1. Vai trò của bảng 'friends' trong cấu trúc hệ thống**\n"
        "3. Với tiêu đề mục phụ, cũng bọc trong ** để in đậm. Ví dụ: **a. Quản lý tương tác xã hội cơ bản**\n"
        "4. Dùng dấu - (gạch ngang) cho các bullet point liệt kê.\n"
        "5. Cấu trúc bài trả lời theo dạng phân cấp rõ ràng, dễ đọc:\n"
        "   **1. Mục chính đầu tiên**\n"
        "   Nội dung giải thích...\n"
        "   - Điểm liệt kê 1\n"
        "   - Điểm liệt kê 2\n"
        "   **2. Mục chính thứ hai**\n"
        "   Nội dung giải thích...\n\n"
        "QUY TẮC TRÍCH DẪN BẮT BUỘC:\n"
        "1. Trả lời bằng ngôn ngữ của câu hỏi (thường là tiếng Việt hoặc tiếng Anh).\n"
        "2. Chỉ sử dụng thông tin từ các tài liệu được cung cấp. Nếu thông tin không có trong tài liệu, hãy nói rõ.\n"
        "3. **TRÍCH DẪN TỐI ĐA**: Bạn PHẢI trích dẫn tất cả các trang tài liệu có liên quan đến câu trả lời. "
        "Mỗi ý, mỗi câu phát biểu, mỗi thông tin được lấy từ tài liệu ĐỀU PHẢI có thẻ trích dẫn đi kèm.\n"
        "4. Chèn thẻ trích dẫn ở cuối mỗi câu hoặc ý phát biểu có sử dụng tài liệu.\n"
        "   - Định dạng thẻ trích dẫn bắt buộc: `[Tên_tập_tin.pdf:Trang]`\n"
        "   - Ví dụ: 'Burkholderia kích thích tăng trưởng cây lúa nhờ tiết hormone IAA [Burkholderia_Rice.pdf:5].'\n"
        "   - Nếu một ý có nhiều trang hoặc nhiều tài liệu, trích dẫn TẤT CẢ: "
        "'...tiết hormone IAA [Burkholderia_Rice.pdf:5] [Burkholderia_Research.pdf:12].'\n"
        "5. Hãy cố gắng trích dẫn đúng trang thực tế chứa thông tin đó.\n"
        "6. **CÂU TRẢ LỜI CHI TIẾT**: Hãy trả lời thật chi tiết, phân tích sâu, liệt kê nhiều điểm để bao phủ nhiều trang trích dẫn nhất có thể. "
        "Không tóm tắt quá ngắn gọn. Hãy khai thác và trích dẫn từ MỌI tài liệu có liên quan được cung cấp.\n"
        "7. Không tự bịa đặt ra tên tệp tin hay số trang nếu tài liệu không ghi."
    )
    
    user_prompt = f"TÀI LIỆU CUNG CẤP:\n{context_str}\n\nCÂU HỎI:\n{query_text}"
    
    # 4. Invoke LLM with automatic fallback on quota errors
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    response = _invoke_llm_with_fallback(messages, provider, api_key)
    
    # Extract answer text - newer Gemini models (3.5+) may return structured content
    # blocks like [{'type': 'text', 'text': '...'}] instead of a plain string
    raw_content = response.content
    if isinstance(raw_content, str):
        answer = raw_content
    elif isinstance(raw_content, list):
        # Extract text from structured content blocks
        text_parts = []
        for block in raw_content:
            if isinstance(block, dict) and "text" in block:
                text_parts.append(block["text"])
            elif isinstance(block, str):
                text_parts.append(block)
        answer = "\n".join(text_parts) if text_parts else str(raw_content)
    else:
        answer = str(raw_content)
    
    # 5. Build deep citations with page image support
    citations = _build_deep_citations(retrieved_docs, user_id)
    
    # 6. [FEATURE 1] Generate Hypothesis Map (entity-relationship mindmap)
    hypothesis_map = None
    try:
        hypothesis_map = _generate_hypothesis_map(
            query=query_text, answer=answer, context_str=context_str,
            provider=provider, api_key=api_key
        )
        if hypothesis_map:
            logger.info(f"[RAG] Hypothesis map generated: {len(hypothesis_map.get('branches', []))} branches")
    except Exception as e:
        logger.warning(f"[RAG] Hypothesis map generation failed (non-blocking): {e}")
    
    # 7. [FEATURE 2] Generate Multi-Perspective Debate
    debate = None
    try:
        debate = _generate_debate(
            query=query_text, context_str=context_str,
            provider=provider, api_key=api_key
        )
        if debate:
            logger.info(f"[RAG] Debate generated: {len(debate.get('perspectives', []))} perspectives")
    except Exception as e:
        logger.warning(f"[RAG] Debate generation failed (non-blocking): {e}")
            
    return {
        "answer": answer,
        "citations": citations,
        "hypothesis_map": hypothesis_map,
        "debate": debate
    }

