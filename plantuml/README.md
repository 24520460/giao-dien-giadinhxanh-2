# Tài Liệu Đặc Tả Sequence Diagram - Dự Án Gia Đình Xanh
## Hệ Thống Đặt Dịch Vụ Tại Nhà (Home Service Booking Platform)

---

### 1. Quy Ước Thiết Kế & Phạm Vi Đặc Tả (SRS Convention)

Theo quy chuẩn kỹ thuật của tài liệu Yêu cầu phần mềm (SRS):
1. **Chỉ đặc tả sâu (Sequence Diagram) cho các luồng nghiệp vụ trọng yếu:** Các luồng có tương tác đa thành phần (Multi-tier: Client - API - Auth Service - Database - Worker - AI/Map Provider), có ràng buộc kiểm tra điều kiện phức tạp, xử lý giao dịch đồng thời (Concurrency / Race Condition), đảm bảo tính toàn vẹn dữ liệu (ACID Transaction) hoặc ghi nhận nhật ký kiểm toán (Audit Trail).
2. **Lược bỏ sơ đồ cho các chức năng CRUD đơn giản:** Các chức năng thêm/sửa/xóa/đọc dữ liệu cơ bản dạng 1:1, không có logic nghiệp vụ phức tạp hay xử lý bất đồng bộ chỉ được định nghĩa trong danh mục yêu cầu chức năng (FR) mà không vẽ sơ đồ luồng.
3. **Quy chuẩn mã hóa yêu cầu:**
   - Định dạng 2 chữ số cho phần đầu: `FR-AUTH-01` đến `FR-BOOK-09`.
   - Định dạng 3 chữ số cho phần sau: `FR-FAV-001` đến `FR-ADMIN-010`.
4. **Quy tắc nghiệp vụ then chốt:**
   - **Trạng thái Booking:** Sau khi Provider chấp nhận yêu cầu, trạng thái chuyển sang **`confirmed`** (tuyệt đối không sử dụng `accepted`). Vòng đời chuẩn: `pending` $\rightarrow$ `confirmed` $\rightarrow$ `in_progress` $\rightarrow$ `completed` (hoặc `cancelled` / `rejected` / `auto_cancelled`).
   - **Định giá tập trung:** Quản trị viên (Admin) là bên duy nhất có quyền tạo dịch vụ và định giá (`fixed` theo gói hoặc `hourly` theo giờ) trong bảng `services`. Đối tác thợ (Provider) đăng ký cung cấp dịch vụ theo giá niêm yết của nền tảng, không tự định giá riêng.

---

### 2. Danh Mục 11 Sequence Diagram Trọng Yếu

| STT | Mã SD | Tên Sequence Diagram | Các mã FR được gộp | Thành phần tham gia (Lifelines) | File mã nguồn |
| :---: | :---: | :--- | :--- | :--- | :--- |
| **01** | `SD-01` | Đăng ký Provider & Thiết lập khu vực hoạt động | `FR-AUTH-02`, `FR-PROV-03` | Visitor (Provider), Web UI, API / Backend, Supabase Auth, PostgreSQL | [SD-01-register-provider.puml](file:///plantuml/SD-01-register-provider.puml) |
| **02** | `SD-02` | Đăng nhập & Điều hướng phân quyền theo Role/Trạng thái | `FR-AUTH-03`, `FR-AUTH-06` | User, Web UI, API / Backend, Supabase Auth, PostgreSQL | [SD-02-login-rbac.puml](file:///plantuml/SD-02-login-rbac.puml) |
| **03** | `SD-03` | Tìm kiếm, Lọc dịch vụ & Hiển thị Bản đồ | `FR-SEARCH-01`, `FR-SEARCH-02`, `FR-SEARCH-03`, `FR-MAP-01` | Customer, Web UI, API / Backend, PostgreSQL, Map Provider API | [SD-03-search-filter-map.puml](file:///plantuml/SD-03-search-filter-map.puml) |
| **04** | `SD-04` | Cấu hình lịch rảnh, Ngoại lệ & Kiểm tra xung đột | `FR-AVAIL-01`, `FR-AVAIL-02`, `FR-AVAIL-04` | Provider, Web UI, API / Backend, PostgreSQL | [SD-04-availability-conflict.puml](file:///plantuml/SD-04-availability-conflict.puml) |
| **05** | `SD-05` | Tạo yêu cầu Booking (Kiểm tra, Chống trùng lịch & Snapshot) | `FR-CUST-03`, `FR-AVAIL-03`, `FR-AVAIL-04`, `FR-BOOK-01`, `FR-BOOK-02`, `FR-BOOK-07`, `FR-NOT-001` | Customer, Web UI, API / Backend, PostgreSQL, Notification Service | [SD-05-create-booking.puml](file:///plantuml/SD-05-create-booking.puml) |
| **06** | `SD-06` | Phản hồi Booking (Accept/Reject, Hủy & Hết hạn 24h) | `FR-BOOK-03`, `FR-BOOK-04`, `FR-BOOK-07`, `FR-NOT-001`, `FR-NOT-004` | Customer, Provider, Background Worker, API, PostgreSQL, Notification Service | [SD-06-respond-booking.puml](file:///plantuml/SD-06-respond-booking.puml) |
| **07** | `SD-07` | Thực hiện, Hoàn tất dịch vụ (Phụ phí) & Thanh toán | `FR-BOOK-05`, `FR-BOOK-06`, `FR-BOOK-07`, `FR-BOOK-09`, `FR-NOT-001` | Provider, Web UI, API / Backend, PostgreSQL, Notification Service | [SD-07-complete-service.puml](file:///plantuml/SD-07-complete-service.puml) |
| **08** | `SD-08` | Gửi Đánh giá & Tính lại điểm hiệu suất Provider | `FR-REV-001`, `FR-REV-002`, `FR-REV-006`, `FR-REV-007`, `FR-PROV-05` | Customer, Web UI, API / Backend, PostgreSQL | [SD-08-review-rating.puml](file:///plantuml/SD-08-review-rating.puml) |
| **09** | `SD-09` | Tạo và Xử lý Phiếu hỗ trợ (Support Ticket & Ghi chú nội bộ) | `FR-TKT-001`, `FR-TKT-003`, `FR-TKT-004`, `FR-TKT-005`, `FR-TKT-006`, `FR-TKT-007`, `FR-ADMIN-008` | User, Admin, Web UI, API / Backend, PostgreSQL, Notification Service | [SD-09-support-ticket.puml](file:///plantuml/SD-09-support-ticket.puml) |
| **10** | `SD-10` | Tư vấn & Đề xuất dịch vụ qua AI Chatbot (Grounding thực) | `FR-AI-001`, `FR-AI-003`, `FR-AI-004`, `FR-AI-005`, `FR-AI-006`, `FR-AI-007`, `FR-AI-008` | User, Web UI, API / Backend, PostgreSQL, External AI Provider | [SD-10-ai-chatbot.puml](file:///plantuml/SD-10-ai-chatbot.puml) |
| **11** | `SD-11` | Admin Phê duyệt Provider, Kiểm duyệt & Nhật ký kiểm toán | `FR-ADMIN-003`, `FR-ADMIN-004`, `FR-ADMIN-007`, `FR-ADMIN-009`, `FR-REV-005`, `FR-SVC-03` | Admin, Web UI, API / Backend, PostgreSQL, Notification Service | [SD-11-admin-approval-audit.puml](file:///plantuml/SD-11-admin-approval-audit.puml) |

---

### 3. Danh Mục Các Chức Năng CRUD Đơn Giản Lược Bỏ Sequence Diagram

Tuân thủ nguyên tắc tối ưu tài liệu thiết kế, các chức năng tương tác đơn lẻ (Client $\rightarrow$ Server $\rightarrow$ 1 bảng DB) dưới đây **chỉ mô tả bằng bảng Functional Requirements (FR) và Use Case**, không vẽ sơ đồ Sequence:

| Mã FR | Tên Chức Năng | Lý do lược bỏ sơ đồ Sequence |
| :--- | :--- | :--- |
| `FR-AUTH-01` | Đăng ký tài khoản Khách hàng (Customer) | Luồng CRUD cơ bản với Supabase Auth, không có xét duyệt KYC/chọn khu vực phức tạp như Provider (`SD-01`). |
| `FR-AUTH-04` | Đăng xuất tài khoản (Logout) | Thao tác xóa phiên cookie/token ở Client và gọi `auth.signOut()`, không có nghiệp vụ phức tạp. |
| `FR-AUTH-05` | Đổi mật khẩu tài khoản | Thao tác update mật khẩu trực tiếp qua Supabase Auth API. |
| `FR-CUST-01` | Xem & Cập nhật thông tin cá nhân Khách hàng | Thao tác form CRUD cơ bản (`SELECT` / `UPDATE customer_profiles`). |
| `FR-CUST-02` | Xem lịch sử đơn hàng của bản thân | Thao tác `SELECT` đơn thuần từ bảng `bookings` kèm phân trang. |
| `FR-CUST-04` | Quản lý sổ địa chỉ giao hàng (`customer_addresses`) | Thao tác thêm/sửa/xóa địa chỉ phụ trợ thông thường. |
| `FR-PROV-01` | Cập nhật thông tin giới thiệu, kinh nghiệm của Thợ | Thao tác `UPDATE provider_profiles` (bio, avatar). |
| `FR-PROV-02` | Bật/tắt trạng thái nhận việc trực tuyến (`is_available_online`)| Cập nhật trường cờ boolean trong bảng `provider_profiles`. |
| `FR-PROV-04` | Đăng ký danh mục dịch vụ cung cấp (`provider_services`) | Thêm/xóa liên kết n-n giữa provider và dịch vụ đã có sẵn. |
| `FR-CAT-01` | Admin tạo Danh mục dịch vụ | Thao tác `INSERT service_categories` chuẩn. |
| `FR-CAT-02` | Admin cập nhật Danh mục dịch vụ | Thao tác `UPDATE service_categories` chuẩn. |
| `FR-CAT-03` | Admin ẩn/hiện Danh mục dịch vụ | Cập nhật cờ `status = true/false` trong `service_categories`. |
| `FR-SVC-01` | Admin tạo mới Dịch vụ | Thao tác `INSERT services` chuẩn (thuộc quyền hạn Admin). |
| `FR-SVC-02` | Admin cập nhật thông tin Dịch vụ | Thao tác `UPDATE services` chuẩn (tên, mô tả). |
| `FR-FAV-001` | Thêm Thợ vào danh sách Yêu thích | Thao tác `INSERT favorites (customer_id, provider_id)`. |
| `FR-FAV-002` | Xóa Thợ khỏi danh sách Yêu thích | Thao tác `DELETE FROM favorites`. |
| `FR-FAV-003` | Xem danh sách Thợ yêu thích | Thao tác `SELECT` kết hợp `JOIN provider_profiles`. |
| `FR-FAV-004` | Kiểm tra trạng thái đã thích (Favorite toggle status) | Thao tác `SELECT COUNT(1) FROM favorites`. |
| `FR-NOT-002` | Xem danh sách thông báo của tài khoản | Thao tác `SELECT * FROM notifications WHERE recipient_id = :id`. |
| `FR-NOT-003` | Đánh dấu thông báo đã đọc | Cập nhật `is_read = true` trong bảng `notifications`. |
| `FR-NOT-005` | Xóa thông báo | Thao tác `DELETE FROM notifications`. |
| `FR-ADMIN-001`| Xem Dashboard tổng quan số liệu thống kê | Truy vấn `COUNT / SUM` tổng hợp dữ liệu báo cáo kinh doanh. |
| `FR-ADMIN-002`| Xem danh sách người dùng toàn hệ thống | Thao tác `SELECT users` kèm bộ lọc role và trạng thái. |
| `FR-ADMIN-005`| Xem danh sách tất cả Booking của nền tảng | Thao tác `SELECT bookings` dành cho cấp quản trị. |
| `FR-ADMIN-006`| Xem chi tiết một Booking | Thao tác `SELECT` đơn lẻ kèm `JOIN` dịch vụ và khách/thợ. |
| `FR-ADMIN-010`| Cấu hình tham số hệ thống chung | Thao tác đọc/ghi cấu hình tĩnh. |

---

### 4. Hướng Dẫn Xem Và Render Sơ Đồ

#### Cách 1: Xem trực tiếp trong Visual Studio Code (Khuyên dùng)
1. Cài đặt extension: **PlantUML** (của tác giả Jebbs) trong VS Code.
2. Mở bất kỳ file `.puml` nào trong thư mục `plantuml/`.
3. Nhấn tổ hợp phím `Alt + D` (hoặc `Option + D` trên macOS) để mở cửa sổ xem trước (Live Preview).

#### Cách 2: Kết xuất (Render) hàng loạt ra hình ảnh PNG / SVG bằng CLI
Nếu máy đã cài đặt Java và PlantUML:
```bash
# Render tất cả các file sang định dạng PNG
java -jar plantuml.jar -tpng plantuml/*.puml

# Render tất cả các file sang định dạng vector SVG
java -jar plantuml.jar -tsvg plantuml/*.puml
```

#### Cách 3: Xem trực tuyến (Online Viewer)
Copy toàn bộ nội dung file `.puml` và dán vào các trình render trực tuyến:
- [PlantText UML Editor](https://www.planttext.com/)
- [PlantUML Official Web Server](http://www.plantuml.com/plantuml/uml/)
