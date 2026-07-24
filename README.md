AI THESIS ASSISTANT - TRỢ LÝ ĐỌC VÀ PHÂN TÍCH TÀI LIỆU KHOA HỌC

Chào mọi người, đây là một chiếc app nhỏ mình tự code nhằm hỗ trợ các bạn sinh viên và nghiên cứu sinh tối ưu hóa quy trình đọc, hiểu và bóc tách nội dung từ các bài báo khoa học (file PDF). 

Hệ thống được viết hoàn toàn bằng Python và chạy giao diện web qua Streamlit cực kỳ trực quan, dễ cài đặt và sử dụng ngay trên máy cá nhân.

---

1. Ý TƯỞNG VÀ TÍNH NĂNG CHÍNH

Tại sao mình làm ứng dụng này?
Đợt vừa rồi làm nghiên cứu khoa học và viết luận văn, mình phải đọc cả đống tài liệu tiếng Anh lẫn tiếng Việt, thực sự rất mất thời gian. Các chatbot thông thường thường trả lời chung chung và rất dễ bị "ảo tưởng" (hallucination) thông tin do không có ngữ cảnh chính xác. Vì thế, mình quyết định tự xây dựng app này để:
- Trả lời luôn đi kèm trích dẫn cụ thể: AI chỉ ra rõ câu trả lời lấy từ trang nào, file nào để mình click đối chiếu ngay lập tức.
- Phát hiện khoảng trống nghiên cứu: AI bóc tách các luồng tranh luận trong tài liệu để giúp mình tìm hướng đi mới cho đề tài.

Các tính năng mình đã hoàn thiện:
- Hỏi đáp trực tiếp trên tài liệu (RAG): Tải file PDF lên -> App tự động cắt trang, đọc text (bằng PyMuPDF) -> Chia nhỏ đoạn, tạo vector nhúng (Embedding) -> Lưu trữ cục bộ vào cơ sở dữ liệu ChromaDB. Khi hỏi, app sẽ tìm các đoạn liên quan nhất để Gemini API trả lời.
- Trích dẫn nguồn tại chỗ (Deep Citation): Câu trả lời của AI đi kèm các thẻ số trang (ví dụ: [Ten_tai_lieu.pdf, Trang 5]). Mình chỉ cần click hoặc hover chuột là xem được ngay đoạn văn gốc.
- Tự động vẽ sơ đồ giả thuyết (Hypothesis Mapping): AI phân tích và xuất ra sơ đồ tư duy dạng cây thể hiện mối quan hệ giữa các thực thể, biến số nghiên cứu để dễ hình dung cấu trúc bài viết.
- Phân tích tranh biện và tìm Research Gaps: Bóc tách các luận điểm Thuận / Phản biện / Bổ sung và gợi ý những điểm mà các tài liệu hiện tại chưa giải quyết được.
- Quản lý tài liệu và Lịch sử chat: Giao diện sidebar của Streamlit giúp quản lý danh sách tài liệu đã tải lên và chuyển qua lại giữa các đoạn hội thoại cũ.

---

2. CÔNG NGHỆ MÌNH SỬ DỤNG

Để tối giản và gọn nhẹ nhất, mình chọn các công nghệ chạy hoàn toàn bằng Python:

- Giao diện người dùng: Streamlit (Dựng UI nhanh bằng Python)
- Xử lý RAG & Kết nối: LangChain (Làm cầu nối để gọi Gemini API và truy xuất dữ liệu từ database)
- Cơ sở dữ liệu Vector: ChromaDB (Lưu dữ liệu vector cục bộ ngay trên thư mục dự án)
- Trích xuất PDF: PyMuPDF (Đọc chữ từ file PDF cực nhanh và chuẩn)
- Mô hình ngôn ngữ: Google Gemini API (Mặc định dùng dòng mô hình Gemini Flash chạy rất nhanh)

---

3. CẤU TRÚC THƯ MỤC DỰ ÁN

- app.py (File giao diện chính chạy bằng Streamlit)
- rag.py (Xử lý kết nối ChromaDB, tạo embeddings và gọi LLM)
- pdf_loader.py (Đọc và xử lý văn bản từ file PDF tải lên)
- .env (Lưu khóa API cá nhân của bạn, không đẩy lên github)
- .env.template (File mẫu hướng dẫn cấu hình môi trường)
- requirements.txt (Danh sách các thư viện Python cần cài đặt)

---

4. HƯỚNG DẪN CÀI ĐẶT VÀ CHẠY APP

Để chạy ứng dụng nhanh nhất trên Windows, mọi người có thể dùng các file script .bat mình đã viết sẵn ở thư mục gốc:

 Sử dụng Script chạy nhanh (nên dùng cho Windows)
1. Kích đúp chuột vào file start_all.bat ở thư mục gốc.
2. Script sẽ tự động:
   - Mở cửa sổ Backend, kích hoạt môi trường ảo (venv), cài đặt thư viện và chạy máy chủ FastAPI tại cổng 8000.
   - Mở cửa sổ Frontend, chạy npm install và khởi động React dev server tại cổng 3000.
3. Sau đó, app sẽ tự động mở hoặc bạn truy cập địa chỉ đường dẫn

(Nếu muốn chạy riêng lẻ từng phần, có thể chạy file start_backend.bat hoặc start_frontend.bat)

---

5. MỘT SỐ LƯU Ý KHI DÙNG VÀ KIỂM THỬ

- Khi tải tài liệu PDF lên, hãy đợi một chút để app đọc file và nạp dữ liệu vector (sẽ có thanh progress bar thông báo trên màn hình).
- Do mọi dữ liệu Vector và lịch sử chat đều được lưu cục bộ dưới dạng file trong thư mục dự án, nếu muốn reset trắng hoàn toàn app để dùng từ đầu, bạn chỉ cần xóa các thư mục data tự động sinh ra trong project là xong.
