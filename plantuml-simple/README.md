# Bộ Sequence Diagram Đơn Giản Hóa - Dự Án Gia Đình Xanh
## Phiên Bản Tinh Gọn Cho Báo Cáo SRS & Thuyết Trình

---

### 1. Mục Đích & Nguyên Tắc Tinh Gọn (Design Philosophy)

Thư mục **`plantuml-simple/`** được tạo ra nhằm phục vụ việc đưa vào **tài liệu SRS chính thức, báo cáo đồ án Word/PDF và slide thuyết trình** mà vẫn đảm bảo tính chuẩn xác và đầy đủ:

1. **Đơn giản hóa nhưng vẫn trọn vẹn nghiệp vụ:**
   - Thay thế các đoạn code SQL dài dòng (`SELECT ... JOIN ... WHERE ...`) bằng các thông điệp nghiệp vụ rõ ràng, súc tích (Domain Language).
   - Loại bỏ các ghi chú rườm rà không cần thiết, giúp sơ đồ vừa vặn trong 1 trang A4 hoặc 1 slide trình chiếu mà không bị vỡ bố cục hay chữ quá nhỏ.
2. **Bảo toàn 100% logic kỹ thuật cốt lõi:**
   - Giữ nguyên toàn bộ **11 luồng trọng yếu** và ánh xạ mã yêu cầu chức năng (FR 2 số và 3 số).
   - Giữ nguyên các **Lifelines** tương tác đa thành phần: Client $\leftrightarrow$ Web UI $\leftrightarrow$ API Backend $\leftrightarrow$ Database $\leftrightarrow$ Auth/Worker/AI/Map.
   - Giữ nguyên các khối điều kiện rẽ nhánh (`alt / else`), xử lý lỗi, phân quyền và các khối giao dịch toàn vẹn dữ liệu (`group Transaction`).
3. **Tuân thủ tuyệt đối các quy tắc hệ thống:**
   - Trạng thái Booking sau khi thợ nhận là **`confirmed`** (không dùng `accepted`).
   - Admin định giá tập trung (`services.base_price`), thợ không tự đặt giá riêng.
   - Chống trùng lịch (Double-booking) trong phạm vi $\pm 2$ giờ.
   - Worker tự động hủy đơn sau 24h (`auto_cancelled`).
   - AI Chatbot có Grounding dữ liệu DB thực tế và cơ chế Fallback an toàn.
   - Mọi thao tác quản trị viên bắt buộc ghi `audit_logs`.

---

### 2. Danh Mục 11 Sequence Diagram Tinh Gọn

| STT | Mã SD | Tên Sơ Đồ | Mã FR Liên Quan | File Tinh Gọn (.puml) | File Chi Tiết Gốc |
| :---: | :---: | :--- | :--- | :--- | :--- |
| **01** | `SD-01` | Đăng ký Provider & Thiết lập khu vực hoạt động | `FR-AUTH-02`, `FR-PROV-03` | [SD-01-register-provider.puml](file:///plantuml-simple/SD-01-register-provider.puml) | [SD-01 gốc](file:///plantuml/SD-01-register-provider.puml) |
| **02** | `SD-02` | Đăng nhập & Điều hướng phân quyền Role/Status | `FR-AUTH-03`, `FR-AUTH-06` | [SD-02-login-rbac.puml](file:///plantuml-simple/SD-02-login-rbac.puml) | [SD-02 gốc](file:///plantuml/SD-02-login-rbac.puml) |
| **03** | `SD-03` | Tìm kiếm, Lọc dịch vụ & Hiển thị Bản đồ | `FR-SEARCH-01, 02, 03`, `FR-MAP-01` | [SD-03-search-filter-map.puml](file:///plantuml-simple/SD-03-search-filter-map.puml) | [SD-03 gốc](file:///plantuml/SD-03-search-filter-map.puml) |
| **04** | `SD-04` | Cấu hình lịch rảnh, Ngoại lệ & Kiểm tra xung đột | `FR-AVAIL-01, 02, 04` | [SD-04-availability-conflict.puml](file:///plantuml-simple/SD-04-availability-conflict.puml) | [SD-04 gốc](file:///plantuml/SD-04-availability-conflict.puml) |
| **05** | `SD-05` | Tạo yêu cầu Booking (Kiểm tra, Chống trùng & Snapshot) | `FR-CUST-03`, `FR-AVAIL-03, 04`, `FR-BOOK-01, 02, 07`, `FR-NOT-001` | [SD-05-create-booking.puml](file:///plantuml-simple/SD-05-create-booking.puml) | [SD-05 gốc](file:///plantuml/SD-05-create-booking.puml) |
| **06** | `SD-06` | Phản hồi Booking (Accept -> confirmed, Reject/Cancel, Cron 24h) | `FR-BOOK-03, 04, 07`, `FR-NOT-001, 004` | [SD-06-respond-booking.puml](file:///plantuml-simple/SD-06-respond-booking.puml) | [SD-06 gốc](file:///plantuml/SD-06-respond-booking.puml) |
| **07** | `SD-07` | Thực hiện, Hoàn tất dịch vụ (Phụ phí) & Quyết toán | `FR-BOOK-05, 06, 07, 09`, `FR-NOT-001` | [SD-07-complete-service.puml](file:///plantuml-simple/SD-07-complete-service.puml) | [SD-07 gốc](file:///plantuml/SD-07-complete-service.puml) |
| **08** | `SD-08` | Gửi Đánh giá & Tính lại điểm hiệu suất Provider | `FR-REV-001, 002, 006, 007`, `FR-PROV-05` | [SD-08-review-rating.puml](file:///plantuml-simple/SD-08-review-rating.puml) | [SD-08 gốc](file:///plantuml/SD-08-review-rating.puml) |
| **09** | `SD-09` | Tạo & Xử lý Ticket hỗ trợ (Ghi chú nội bộ) | `FR-TKT-001, 003..007`, `FR-ADMIN-008` | [SD-09-support-ticket.puml](file:///plantuml-simple/SD-09-support-ticket.puml) | [SD-09 gốc](file:///plantuml/SD-09-support-ticket.puml) |
| **10** | `SD-10` | Tư vấn dịch vụ qua AI Chatbot (Grounding thực tế) | `FR-AI-001, 003..008` | [SD-10-ai-chatbot.puml](file:///plantuml-simple/SD-10-ai-chatbot.puml) | [SD-10 gốc](file:///plantuml/SD-10-ai-chatbot.puml) |
| **11** | `SD-11` | Admin Phê duyệt Provider, Kiểm duyệt & Ghi Audit Log | `FR-ADMIN-003, 004, 007, 009`, `FR-REV-005`, `FR-SVC-03` | [SD-11-admin-approval-audit.puml](file:///plantuml-simple/SD-11-admin-approval-audit.puml) | [SD-11 gốc](file:///plantuml/SD-11-admin-approval-audit.puml) |

---

### 3. So Sánh Hai Bộ Sơ Đồ

| Tiêu Chí | Thư Mục `plantuml/` (Chi tiết kỹ thuật) | Thư Mục `plantuml-simple/` (Tinh gọn) |
| :--- | :--- | :--- |
| **Đối tượng sử dụng** | Developer triển khai code backend, DBA, kiểm thử chi tiết SQL queries. | Thầy cô chấm đồ án, hội đồng nghiệm thu, tài liệu SRS nộp nhà trường, slide trình bày. |
| **Mức độ chi tiết** | Rất sâu (gồm câu lệnh SQL chi tiết `SELECT ... JOIN`, status codes, query payload). | Tập trung vào luồng nghiệp vụ (Business Workflow), điều kiện kiểm tra và kết quả logic. |
| **Chiều cao sơ đồ** | Dài (thường từ 80 - 150 dòng lệnh), khó đưa vừa vặn vào 1 trang tài liệu. | Gọn gàng (khoảng 40 - 65 dòng lệnh), cân đối, hiển thị đẹp trên mọi khung nhìn. |
| **Tính đầy đủ** | Đầy đủ mọi bước thực thi database. | Đầy đủ mọi bước nghiệp vụ, rẽ nhánh và quy tắc hệ thống. |

---

### 4. Hướng Dẫn Xem & Xuất Hình Ảnh Cho Báo Cáo

#### Cách 1: Xem trực tiếp trong Visual Studio Code
- Mở bất kỳ file `.puml` nào trong thư mục `plantuml-simple/`.
- Nhấn tổ hợp phím **`Alt + D`** (với extension *PlantUML* của Jebbs) để mở Live Preview.

#### Cách 2: Xuất toàn bộ sơ đồ sang PNG để chèn vào Word/PowerPoint
```powershell
# Chạy lệnh xuất hàng loạt ảnh PNG với độ phân giải cao:
java -jar plantuml.jar -tpng plantuml-simple/*.puml

# Hoặc xuất sang định dạng vector SVG:
java -jar plantuml.jar -tsvg plantuml-simple/*.puml
```

#### Cách 3: Xem trực tuyến
Truy cập [PlantText UML Editor](https://www.planttext.com/) hoặc [PlantUML Web Server](http://www.plantuml.com/plantuml/uml/), copy toàn bộ nội dung file `.puml` vào để kết xuất tức thì.
