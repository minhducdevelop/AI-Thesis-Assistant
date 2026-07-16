# AI Thesis Assistant - Trợ lý Luận văn Khoa học

Dự án này là hệ thống hỗ trợ phân tích và hỏi đáp tài liệu nghiên cứu khoa học (PDF) dựa trên kiến trúc RAG (Retrieval-Augmented Generation). Hệ thống cho phép trích xuất tài liệu, lập chỉ mục vector ngữ nghĩa, hỏi đáp kèm trích dẫn nguồn trực quan (ảnh chụp trang gốc) và hỗ trợ tự động vẽ sơ đồ tư duy giả thuyết cũng như phân tích tranh biện đa chiều từ dữ liệu đầu vào.

---

## 1. Ý tưởng & Chức năng chính

### Ý tưởng cốt lõi
Hỗ trợ các nghiên cứu sinh, sinh viên tối ưu hóa thời gian đọc hiểu hàng chục bài báo khoa học dài. Thay vì chỉ hỏi đáp đơn giản như các chatbot thông thường, dự án tập trung vào tính chính xác của dữ liệu khoa học thông qua cơ chế trích dẫn nguồn sâu (Deep Citation) và tổng hợp góc nhìn tranh biện.

### Các tính năng chính (Dành cho Tester & Developer)
*   **Hệ thống RAG PDF (Hỏi đáp ngữ cảnh):** Người dùng tải lên các tệp PDF. Backend phân tách trang, trích xuất text chất lượng cao bằng PyMuPDF, chunking (chia nhỏ văn bản), sinh Vector Embedding (Google/OpenAI) và lưu trữ vào ChromaDB. Khi hỏi đáp, hệ thống sẽ truy xuất các đoạn văn bản có độ tương đồng cao nhất để LLM trả lời.
*   **Trích dẫn nguồn trực quan (Deep Citation):** Câu trả lời của AI đi kèm các thẻ số trang (ví dụ: `[Tên_tài_liệu.pdf, Trang 5]`). Khi di chuột vào thẻ trích dẫn, một popup sẽ hiển thị văn bản gốc kèm ảnh chụp thực tế của trang PDF đó (kết xuất động dưới dạng PNG từ backend bằng PyMuPDF).
*   **Sơ đồ tư duy giả thuyết (Auto-Hypothesis Mapping):** AI tự động phân tích và trực quan hóa mối quan hệ giữa các thực thể nghiên cứu khoa học dưới dạng cây sơ đồ (Mindmap) giúp người đọc hình dung nhanh nội dung tài liệu.
*   **Tranh biện đa chiều (Multi-Perspective Debate):** Tổng hợp các luồng ý kiến Thuận/Phản biện/Bổ sung và phát hiện các khoảng trống nghiên cứu (Research Gaps) dựa trên dữ liệu văn bản đã tải lên.
*   **Quản lý phiên chat & Tài liệu:** Người dùng đăng nhập qua cơ chế nhận mã OTP bảo mật. Thông tin người dùng, các luồng chat (Threads), lịch sử tin nhắn và danh mục tài liệu được quản lý và lưu trữ trực tiếp trong cơ sở dữ liệu SQLite.

---

## 2. Công nghệ sử dụng (Tech Stack)

*   **Backend:** FastAPI (Python), PyMuPDF (xử lý tệp PDF và render ảnh trang), LangChain (điều phối luồng RAG), ChromaDB (Vector Database lưu trữ embeddings).
*   **Database:** SQLite3 (lưu trữ thông tin người dùng, OTP, các thread chat, tin nhắn).
*   **Frontend:** ReactJS (Vite + TypeScript), Vanilla CSS (thiết kế giao diện Dark/Light mode tối giản, hiệu ứng Glassmorphism mượt mà), Lucide React (Icons), Axios (giao tiếp HTTP).
*   **AI Models:** Tích hợp API của Google Gemini (Gemini 2.5/3.5 Flash làm mặc định) và OpenAI GPT-4o Mini.

---

## 3. Cấu trúc thư mục dự án

```
d:\AI Thesis Assistant
├── backend
│   ├── app
│   │   ├── config.py       # Cấu hình Pydantic Settings & Đọc file .env
│   │   ├── database.py     # Khởi tạo SQLite, quản lý OTP, luồng chat, tin nhắn (CRUD)
│   │   ├── main.py         # Router FastAPI, API endpoints xử lý file & nghiệp vụ
│   │   ├── pdf_loader.py   # Trích xuất văn bản PDF & kết xuất ảnh trang (PyMuPDF)
│   │   └── rag.py          # Xử lý Embeddings, kết nối ChromaDB & luồng LLM
│   ├── .env.template       # File mẫu chứa API key môi trường
│   ├── .env                # File cấu hình thực tế (chứa API keys & cổng chạy)
│   └── requirements.txt    # Các thư viện Python phụ thuộc
└── frontend
    ├── src
    │   ├── assets
    │   │   └── vju_logo_red.png   # Logo trường/dự án dùng trong ChatArea
    │   ├── components
    │   │   ├── AuthScreen.tsx       # Giao diện đăng nhập OTP
    │   │   ├── ChatArea.tsx         # Khung chat chính, trích dẫn inline & preview
    │   │   ├── DebateView.tsx       # Khung hiển thị tranh biện đa chiều
    │   │   ├── DeepCitationPopup.tsx# Popup hiển thị ảnh chụp trang tài liệu trích dẫn
    │   │   ├── MindmapView.tsx      # Khung vẽ sơ đồ tư duy giả thuyết
    │   │   ├── SettingsModal.tsx    # Giao diện cấu hình API Keys cá nhân
    │   │   ├── Sidebar.tsx          # Cột trái quản lý tài liệu & lịch sử chat
    │   │   └── UploadZone.tsx       # Khu vực kéo thả tải file PDF lên server
    │   ├── App.tsx         # Luồng chính và quản lý trạng thái ứng dụng
    │   ├── index.css       # Toàn bộ CSS giao diện (hỗ trợ Light/Dark mode)
    │   ├── types.ts        # Định nghĩa kiểu dữ liệu TypeScript
    │   └── main.tsx        # Điểm khởi chạy React app
    ├── package.json        # Node dependencies & scripts
    ├── vite.config.ts      # Proxy config điều hướng /api về localhost:8000
    └── index.html          # Khung HTML gốc của web app
```

---

## 4. Hướng dẫn cài đặt & Chạy ứng dụng

Để chạy hệ thống nhanh nhất trên Windows, bạn có thể sử dụng các file script `.bat` đã được viết sẵn ở thư mục gốc:

### Cách 1: Sử dụng Script chạy nhanh (Khuyên dùng cho Windows)
1.  Kích đúp vào file **`start_all.bat`** ở thư mục gốc. 
2.  Script sẽ tự động:
    *   Mở cửa sổ Backend, kích hoạt môi trường ảo (`venv`), cài đặt dependencies và chạy FastAPI tại cổng `8000`.
    *   Mở cửa sổ Frontend, chạy `npm install` và khởi động React dev server tại cổng `3000`.
3.  Truy cập ứng dụng tại địa chỉ: `http://localhost:3000`.

*Lưu ý: Nếu muốn chạy riêng lẻ từng phần, bạn có thể chạy riêng `start_backend.bat` hoặc `start_frontend.bat`.*

---

### Cách 2: Khởi chạy thủ công bằng dòng lệnh (Terminal)

#### 1. Chạy Backend (FastAPI)
1.  Mở terminal và di chuyển vào thư mục `backend`:
    ```bash
    cd backend
    ```
2.  Tạo và kích hoạt môi trường ảo Python:
    ```bash
    python -m venv venv
    # Kích hoạt trên Windows:
    .\venv\Scripts\activate
    ```
3.  Cài đặt các thư viện cần thiết:
    ```bash
    pip install -r requirements.txt
    ```
4.  Copy file `.env.template` thành `.env` và cấu hình các API Key (Gemini/OpenAI) nếu có:
    ```bash
    copy .env.template .env
    ```
5.  Chạy máy chủ FastAPI:
    ```bash
    python -m uvicorn app.main:app --reload --port 8000
    ```
    *API Swagger Docs sẽ khả dụng tại: `http://localhost:8000/docs`*

#### 2. Chạy Frontend (React Vite)
1.  Mở một cửa sổ terminal mới và di chuyển vào thư mục `frontend`:
    ```bash
    cd frontend
    ```
2.  Cài đặt các thư viện Node.js:
    ```bash
    npm install
    ```
3.  Khởi động server phát triển:
    ```bash
    npm run dev
    ```
4.  Mở trình duyệt và truy cập: `http://localhost:3000`

---

## 5. Hướng dẫn kiểm thử & Xác minh tính năng (Dành cho Tester)

### Đăng nhập hệ thống (Bypass OTP để test)
1.  Giao diện yêu cầu nhập số điện thoại để nhận OTP. 
2.  Bạn có thể nhập số điện thoại bất kỳ (ví dụ: `0987654321`).
3.  Sau khi bấm gửi, backend sẽ tự động tạo một mã OTP ngẫu nhiên hiển thị trực tiếp trong logs của cửa sổ terminal Backend.
4.  Mở cửa sổ terminal Backend để lấy mã OTP này nhập vào giao diện web để đăng nhập thành công.

### Kiểm tra RAG & Tài liệu PDF
1.  Đăng nhập thành công, tạo một đoạn hội thoại mới (Thread) ở Sidebar trái.
2.  Bấm vào nút **Tải tài liệu lên** ở sidebar và chọn 1 hoặc nhiều file PDF khoa học.
3.  Khi tài liệu được tải lên thành công:
    *   Hệ thống sẽ thực hiện trích xuất và lưu vector tự động.
    *   Bạn có thể đặt câu hỏi trong khung chat liên quan đến nội dung tài liệu.
    *   Kiểm tra xem câu trả lời của AI có đi kèm thẻ trích dẫn (ví dụ: `[Tên_tài_liệu.pdf, Trang X]`) hay không.
    *   Rê chuột vào thẻ trích dẫn đó để kiểm tra xem popup ảnh chụp trang PDF có hiển thị chính xác hay không.

### Kiểm tra Cấu trúc Dữ liệu
*   **SQLite Database:** Toàn bộ dữ liệu người dùng, cuộc hội thoại và tin nhắn được lưu trữ tại `backend/data/db.sqlite3`. Bạn có thể sử dụng các phần mềm như *DB Browser for SQLite* để mở file này và đối chiếu dữ liệu thô.
*   **Vector DB (ChromaDB):** Dữ liệu vector nhúng lưu tại `backend/data/chroma`.
