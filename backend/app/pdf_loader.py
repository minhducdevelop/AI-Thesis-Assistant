import os
import fitz  # PyMuPDF
from pathlib import Path
from typing import List
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

def load_pdf(file_path: str) -> List[Document]:
    """
    Loads a PDF file and extracts text page-by-page.
    Extracts metadata such as document title, source filename, and page number.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found at: {file_path}")
        
    doc = fitz.open(str(path))
    documents = []
    
    # Try to extract the title from PDF metadata, fallback to filename without extension
    metadata_title = doc.metadata.get("title")
    title = metadata_title if metadata_title and metadata_title.strip() else path.stem
    
    for page_idx in range(len(doc)):
        page = doc.load_page(page_idx)
        text = page.get_text()
        
        # Skip pages with little or no text
        if not text or len(text.strip()) < 10:
            continue
            
        # Standardize metadata format for citations
        metadata = {
            "source": path.name,
            "title": title,
            "page": page_idx + 1,  # 1-indexed for human readability
            "total_pages": len(doc)
        }
        
        documents.append(Document(page_content=text, metadata=metadata))
        
    doc.close()
    return documents

def extract_page_image(file_path: str, page_number: int, dpi: int = 150) -> bytes:
    """
    Renders a specific PDF page to a PNG image bytes for citation preview.
    Used by Deep Citation Traceback feature to show page screenshots in hover popups.
    
    Args:
        file_path: Path to the PDF file
        page_number: 1-indexed page number
        dpi: Resolution for rendering (default 150 for good quality/size balance)
    
    Returns:
        PNG image bytes of the rendered page
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found at: {file_path}")
    
    doc = fitz.open(str(path))
    
    if page_number < 1 or page_number > len(doc):
        doc.close()
        raise ValueError(f"Page {page_number} out of range (1-{len(doc)})")
    
    page = doc.load_page(page_number - 1)  # Convert to 0-indexed
    
    # Render page at specified DPI
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat)
    img_bytes = pix.tobytes("png")
    
    doc.close()
    return img_bytes


def extract_text_with_positions(file_path: str, page_number: int) -> List[dict]:
    """
    Extracts text blocks with bounding box coordinates for smart highlighting.
    Used by Deep Citation Traceback to locate and highlight cited text on the page.
    
    Args:
        file_path: Path to the PDF file
        page_number: 1-indexed page number
    
    Returns:
        List of dicts with 'text' and 'bbox' [x0, y0, x1, y1] keys
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found at: {file_path}")
    
    doc = fitz.open(str(path))
    
    if page_number < 1 or page_number > len(doc):
        doc.close()
        raise ValueError(f"Page {page_number} out of range (1-{len(doc)})")
    
    page = doc.load_page(page_number - 1)
    
    # Extract text blocks with positions using "dict" mode for fine-grained data
    page_dict = page.get_text("dict")
    text_blocks = []
    
    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:  # Only text blocks (type 0)
            continue
        for line in block.get("lines", []):
            line_text = ""
            for span in line.get("spans", []):
                line_text += span.get("text", "")
            if line_text.strip():
                text_blocks.append({
                    "text": line_text.strip(),
                    "bbox": list(line["bbox"])  # [x0, y0, x1, y1]
                })
    
    doc.close()
    return text_blocks


def chunk_documents(documents: List[Document], chunk_size: int = 2000, chunk_overlap: int = 400) -> List[Document]:
    """
    Splits documents into smaller chunks for vector embeddings.
    Keeps metadata intact for each chunk.
    Uses larger chunk size (2000) and overlap (400) to preserve context
    across all pages of thesis/research documents.
    """
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    return text_splitter.split_documents(documents)
