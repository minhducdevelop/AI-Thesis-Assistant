AI THESIS ASSISTANT - TRỢ LÝ LUẬN VĂN KHOA HỌC

Đây là dự án cá nhân mình xây dựng nhằm hỗ trợ sinh viên và nghiên cứu sinh tối ưu hóa quy trình đọc, hiểu và phân tích các bài báo khoa học (file PDF). 


---

1. Ý TƯỞNG VÀ TÍNH NĂNG CHÍNH

Tại sao mình làm dự án này?
Khi làm nghiên cứu khoa học hoặc viết luận văn, việc phải đọc hàng chục bài báo (đặc biệt là tài liệu tiếng Anh) cực kỳ mất thời gian. Các chatbot thông thường thường trả lời chung chung và dễ bị ảo tưởng do không có ngữ cảnh chính xác. Vì vậy, mình phát triển công cụ này với cơ chế RAG để:
- Đảm bảo câu trả lời của AI luôn đi kèm trích dẫn nguồn cụ thể (tên file, số trang gốc).
- Tổng hợp các luồng ý kiến tranh biện để tìm ra khoảng trống nghiên cứu (Research Gaps).

Các tính năng chính:
- Hỏi đáp trên tài liệu (RAG): Tải file PDF lên -> Hệ thống tự động cắt trang, đọc text (bằng PyMuPDF) -> Chia nhỏ đoạn, tạo vector nhúng (Embedding) -> Lưu trữ cục bộ vào cơ sở dữ liệu ChromaDB. Khi hỏi, hệ thống sẽ tìm các đoạn liên quan nhất và gửi sang Gemini API để trả lời.
- Trích dẫn nguồn trực quan (Deep Citation): Câu trả lời của AI đi kèm các thẻ số trang (ví dụ: [Tên_tài_liệu.pdf, Trang 5]). Mình có thể click hoặc hover để xem trực tiếp phần nguồn gốc.
- Vẽ sơ đồ giả thuyết (Hypothesis Mapping): AI tự động phân tích và xuất ra sơ đồ tư duy dạng cây thể hiện mối quan hệ giữa các thực thể hoặc biến số nghiên cứu trong bài viết để dễ hình dung cấu trúc nghiên cứu.
- Tranh biện đa chiều và Tìm khoảng trống nghiên cứu (Debate và Research Gaps): AI bóc tách các luận điểm Thuận / Phản biện / Bổ sung và tìm ra những vấn đề tài liệu chưa giải quyết triệt de.
- Quản lý tài liệu và Lịch sử chat: Giao diện sidebar của Streamlit giúp mình quản lý các file đã tải lên và chuyển đổi nhanh giữa các phiên chat cũ.

---

2. CÔNG NGHỆ SỬ DỤNG (TECH STACK)

Mình chọn các thư viện Python gọn nhẹ để dự án có thể chạy trực tiếp trên máy cá nhân:

- Giao diện người dùng: Streamlit (UI nhanh bằng Python)
- Điều phối RAG: LangChain (Để gọi Gemini API và truy xuất dữ liệu từ vector database)
- Cơ sở dữ liệu Vector: ChromaDB (Lưu dữ liệu vector cục bộ ngay trên máy)
- Đọc PDF: PyMuPDF (Trích xuất văn bản từ file PDF rất nhanh và chính xác)
- Mô hình ngôn ngữ: Google Gemini API (Mặc định dùng dòng mô hình Gemini Flash)

---

3. CẤU TRÚC THƯ MỤC DỰ ÁN

- app.py (File giao diện chính chạy bằng Streamlit)
- rag.py (Xử lý RAG, kết nối ChromaDB, tạo embeddings và gọi LLM)
- pdf_loader.py (Đọc văn bản từ file PDF tải lên bằng PyMuPDF)
- .env (Lưu khóa API cá nhân)
- .env.template (File cấu hình mẫu hướng dẫn điền API Key)
- requirements.txt (Danh sách các thư viện Python cần cài đặt)

---

4. HƯỚNG DẪN CÀI ĐẶT VÀ KHỞI CHẠY

Bước 1: Tạo môi trường ảo
Nên tạo môi trường ảo Python để tránh xung đột thư viện:
python -m venv venv

Kích hoạt môi trường ảo:
- Trên Windows:
  .\venv\Scripts\activate
- Trên macOS/Linux:
  source venv/bin/activate

Bước 2: Cài đặt thư viện
Chạy lệnh sau để cài đặt các gói cần thiết:
pip install -r requirements.txt

Bước 3: Cấu hình API Key
1. Copy file .env.template thành .env:
   copy .env.template .env
2. Mở file .env ra và dán mã API Key của Gemini vào:
   GEMINI_API_KEY=your_gemini_api_key_here

Bước 4: Chạy ứng dụng
Khởi động Streamlit bằng lệnh:
streamlit run app.py


---

5. HƯỚNG DẪN KIỂM THỬ VÀ LƯU Ý KHI CHẠY

1. Tải tài liệu: Tại sidebar, bấm chọn và tải file PDF nghiên cứu khoa học lên. Đợi một chút để hệ thống đọc file.
2. Hỏi đáp: Gõ câu hỏi của ở ô chat dưới màn hình. Kiểm tra xem AI trả lời có đúng trọng tâm bài viết không và các thẻ trích dẫn nguồn có hiển thị chính xác không.
3. Reset dữ liệu: Cả dữ liệu Vector database và lịch sử chat đều được lưu cục bộ trong thư mục dự án. Nếu muốn reset, chỉ cần xóa các thư mục data tạo ra khi chạy.
