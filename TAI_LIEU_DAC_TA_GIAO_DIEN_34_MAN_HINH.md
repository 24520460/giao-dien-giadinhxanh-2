# TÀI LIỆU ĐẶC TẢ GIAO DIỆN HỆ THỐNG (PRODUCTION UI SPECIFICATION)
## DỰ ÁN: GIA ĐÌNH XANH - ĐẶT LỊCH DỊCH VỤ GIA ĐÌNH (HOME SERVICE BOOKING)
**Ánh xạ 1-1 với 16 bảng PostgreSQL & cơ chế phân quyền Row Level Security (RLS)**

---

### TỔNG QUAN QUY MÔ HỆ THỐNG
* **Tổng số lượng:** **34 màn hình & hộp thoại (19 Pages + 15 Modals / Drawers / Components)**.
* **Số phân hệ:** **4 phân hệ nghiệp vụ** độc lập, bảo mật phân quyền theo `users.role` (`customer`, `provider`, `admin`).
* **Database liên kết:** 16 bảng PostgreSQL, 7 kiểu ENUM, 1 View công khai `provider_public_profiles`, 4 hàm RPC Supabase kiểm toán giao dịch.
* **Phong cách thiết kế:** 
  - Khách hàng (Trang chủ & Đặt lịch): *The page is the object* (Stationery, Care Charter, Menu Pricing).
  - Khung ứng dụng & Vận hành (Thợ & Admin): *Framed sheet* (L-frame tinted, white inset sheet, typography chuẩn IBM Plex Sans & STIX Two Text, tabular-nums).

---

## PHÂN HỆ 0: DÙNG CHUNG & XÁC THỰC (AUTH & ONBOARDING)
* **Quy mô:** 5 Giao diện (5 Pages).
* **Mục đích:** Định danh người dùng, phân luồng theo `users.role`, chặn truy cập trái phép và hoàn tất các trường bắt buộc (`NOT NULL`) trước khi vào hệ thống.

### 0.1. Đăng nhập / Đăng ký / Khôi phục mật khẩu (Page)
* **Bảng dữ liệu:** `auth.users`, `public.users`.
* **Mục đích Production:** Cổng xác thực bắt buộc để lấy `auth.uid()` cho toàn bộ các hàm RLS (`is_admin()`, `current_customer_id()`, `current_provider_id()`) và gán vai trò ban đầu.
* **Thành phần UI:**
  - Tabs chuyển đổi: *Đăng nhập*, *Đăng ký*, *Quên mật khẩu*.
  - Khối Đăng nhập: Input Email/Phone, Input Password, Nút "Đăng nhập".
  - Khối Đăng ký: Input Họ và tên (`users.full_name`), Input SĐT (`users.phone_number` - UNIQUE), Input Email định danh, Radio chọn vai trò (`customer` hoặc `provider` theo RLS `users_insert_own`), Nút "Tạo tài khoản".
  - Khối Quên mật khẩu: Input Email, Nút "Gửi yêu cầu khôi phục".

### 0.2. Thiết lập hồ sơ Khách hàng (Customer Onboarding) (Page Step Form)
* **Bảng dữ liệu:** `users`, `customer_profiles`, `province`, `ward`.
* **Mục đích Production:** Ràng buộc `NOT NULL` ở `customer_profiles.ward_id` và `users.phone_number` đòi hỏi khách mới phải khai báo SĐT và Phường/Xã mặc định ngay lần đầu đăng nhập.
* **Thành phần UI:**
  - Input Họ và tên (`users.full_name`), SĐT (`users.phone_number`).
  - Dropdown Tỉnh/Thành phố (`province."provinceId"`).
  - Dropdown Phường/Xã (`customer_profiles.ward_id` - Bắt buộc).
  - Input Địa chỉ chi tiết (`customer_profiles.default_address`).
  - Bản đồ & Tọa độ GPS (`customer_profiles.latitude`, `longitude`).
  - Nút "Hoàn tất thiết lập & Vào trang chủ".

### 0.3. Đăng ký hành nghề Thợ (Provider Onboarding) (Page Step Form)
* **Bảng dữ liệu:** `users`, `provider_profiles`, `provider_services`, `provider_areas`.
* **Mục đích Production:** Bắt buộc thu thập CCCD (`id_card_number` UNIQUE NOT NULL), ảnh đại diện, chuyên môn và địa bàn hoạt động để khởi tạo hồ sơ ở trạng thái `pending` chờ Admin duyệt.
* **Thành phần UI:**
  - Bước 1: Số CCCD/CMND (`id_card_number`), Tải ảnh đại diện (`avatar_url`), Giới thiệu kinh nghiệm (`info`).
  - Bước 2: Danh sách dịch vụ đăng ký nhận làm (`provider_services` liên kết `services`).
  - Bước 3: Danh sách Phường/Xã hoạt động (`provider_areas` liên kết `ward`).
  - Nút "Gửi hồ sơ xét duyệt" (khởi tạo `verification_status = 'pending'`).

### 0.4. Trạng thái Hồ sơ Thợ (Chờ duyệt / Bị từ chối) (Page Status Screen)
* **Bảng dữ liệu:** `provider_profiles` (`verification_status`).
* **Mục đích Production:** RLS chặn thợ chưa đạt trạng thái `verified` xuất hiện trên View `provider_public_profiles`. Cần màn hình thông báo đang chờ duyệt hoặc cho phép nộp lại CCCD/hồ sơ nếu bị `rejected`.
* **Thành phần UI:**
  - Badge trạng thái: `pending` (Đang chờ duyệt) hoặc `rejected` (Bị từ chối).
  - Khối thông báo tiến độ thẩm định hồ sơ.
  - Form nộp lại hồ sơ khi bị từ chối: Tải lại ảnh CCCD, cập nhật mô tả kinh nghiệm, Nút "Nộp lại hồ sơ".

### 0.5. Thông báo Tài khoản bị khóa (Account Suspended) (Page Error Screen)
* **Bảng dữ liệu:** `users` (`is_active = FALSE`).
* **Mục đích Production:** Khi Admin khóa tài khoản (`is_active = FALSE`), người dùng không thể thao tác dữ liệu. Cần trang thông báo lý do và hướng dẫn gửi khiếu nại thay vì báo lỗi trắng trang.
* **Thành phần UI:**
  - Biểu tượng cảnh báo khóa tài khoản.
  - Thông điệp giải thích nguyên nhân tạm dừng dịch vụ.
  - Nút "Gửi phiếu khiếu nại (Support Ticket)" và nút "Đăng xuất".

---

## PHÂN HỆ 1: GIAO DIỆN KHÁCH HÀNG (CUSTOMER PORTAL)
* **Quy mô:** 11 Giao diện (6 Pages + 5 Modals/Drawers).
* **Mục đích:** Phục vụ trọn vẹn vòng đời dịch vụ: Tìm kiếm $\rightarrow$ Đặt lịch $\rightarrow$ Theo dõi $\rightarrow$ Thanh toán $\rightarrow$ Đánh giá & Hỗ trợ.

### 1.1. Trang chủ & Khám phá dịch vụ (Page)
* **Bảng dữ liệu:** `service_categories`, `services`, `favorites`.
* **Thành phần UI:**
  - Niên biểu dịch vụ chuẩn mực (Care Charter Sheet) phong cách stationery.
  - Máy tính biểu giá tức thì (Perforated Stub Calculator): Chọn dịch vụ, chọn Phường/Xã, hiển thị đơn giá tham chiếu, nút "Đặt lịch ngay".
  - Danh mục dịch vụ dạng thực đơn (Menu-Style Catalog): Phân nhóm theo `service_categories.parent_id`, liệt kê thẻ dịch vụ (`title`, `price`, `pricing_type`, `estimated_duration`), nút trái tim lưu yêu thích (bảng `favorites`).

### 1.2. Cấu hình dịch vụ trước khi đặt (Booking Wizard) (Page)
* **Bảng dữ liệu:** `services`, `provider_public_profiles`, `provider_services`, `provider_areas`, `availability_schedules`, `bookings`.
* **Thành phần UI:**
  - Cột cấu hình: Chọn dịch vụ, điều chỉnh số giờ (đối với dịch vụ `hourly`), chọn ngày giờ hẹn (`bookings.scheduled_time`), chọn Phường/Xã và địa chỉ chi tiết, nhập ghi chú cho thợ (`bookings.notes`).
  - Danh sách thợ phù hợp: Chỉ lọc các thợ có lịch rảnh, khớp khu vực và khớp kỹ năng, hiển thị avatar, tên, số sao, số đánh giá, nút xem hồ sơ (Modal 1.7).
  - Hóa đơn tạm tính dạng phiếu biên nhận (Receipt Slip): Tóm tắt chi phí, thời gian, nút "Xác nhận đặt lịch" (tạo đơn `status = 'pending'`, `payment_status = 'unpaid'`).

### 1.3. Theo dõi đơn hàng trực tiếp (Live Tracking) (Page)
* **Bảng dữ liệu:** `bookings`, `booking_status_history`, `provider_public_profiles`.
* **Thành phần UI:**
  - Thanh tiến trình trạng thái (Stepper): `pending` $\rightarrow$ `confirmed` $\rightarrow$ `in_progress` $\rightarrow$ `completed`.
  - Bản đồ GPS trực tiếp: Vị trí khách (`latitude`, `longitude`) và vị trí thợ (`lattitude`, `longtitude`).
  - Bảng quyết toán chi phí: Giá gốc, chi phí phát sinh (`total_incidental`), tổng thanh toán (`total_amount`), trạng thái thanh toán (`payment_status`).
  - Cụm nút tác vụ: Nút "Thanh toán ngay" (Modal 1.8), nút "Hủy lịch hẹn" (Modal 1.10), nút "Khiếu nại / Hỗ trợ" (Modal 1.11).
  - Lịch sử kiểm toán trạng thái: Trích xuất trực tiếp từ bảng `booking_status_history`.

### 1.4. Quản lý lịch hẹn dịch vụ (Page)
* **Bảng dữ liệu:** `bookings`, `services`, `reviews`.
* **Thành phần UI:**
  - Tabs bộ lọc: Tất cả | Chờ xác nhận | Đang làm | Hoàn thành | Đã hủy.
  - Thẻ đơn hàng: Mã đơn `#booking_id`, tên dịch vụ, thời gian hẹn, địa chỉ, tổng tiền, chi phí phát sinh.
  - Nút thao tác: "Xem chi tiết" (chuyển sang 1.3), "Đánh giá thợ" (chỉ hiện khi `completed` và chưa đánh giá, mở Modal 1.9), "Đặt lại" (chuyển sang 1.2).

### 1.5. Hồ sơ cá nhân & Sổ địa chỉ (Page)
* **Bảng dữ liệu:** `users`, `customer_profiles`, `province`, `ward`.
* **Thành phần UI:**
  - Form thông tin định danh: Họ tên (`users.full_name`), SĐT (`users.phone_number`).
  - Form sổ địa chỉ: Phường/Xã (`customer_profiles.ward_id`), Địa chỉ chi tiết (`default_address`), Tọa độ GPS (`latitude`, `longitude`).
  - Nút "Lưu thay đổi".

### 1.6. Danh sách Dịch vụ yêu thích (Page)
* **Bảng dữ liệu:** `favorites` join `services`.
* **Thành phần UI:**
  - Lưới thẻ dịch vụ đã lưu trong bảng `favorites` (RLS `fav_own`).
  - Nút "Xóa khỏi mục lưu", nút "Đặt lịch ngay &rarr;".

### 1.7. Hồ sơ công khai của Thợ (Modal)
* **Bảng dữ liệu:** View `provider_public_profiles`, `reviews`, `provider_services`.
* **Thành phần UI:**
  - Header: Avatar, họ tên, điểm đánh giá trung bình (`average_rating`), tổng lượt đánh giá (`total_reviews`), trạng thái trực tuyến.
  - Giới thiệu năng lực (`info`), danh sách dịch vụ nhận làm (`provider_services`).
  - Danh sách nhận xét và số sao từ các khách hàng trước (`reviews`).

### 1.8. Cổng Thanh toán hóa đơn (Checkout) (Modal)
* **Bảng dữ liệu:** `bookings` (`total_amount`, `total_incidental`, `payment_status`).
* **Thành phần UI:**
  - Tóm tắt hóa đơn: Phí dịch vụ gốc, chi phí phát sinh, tổng số tiền cần thanh toán.
  - Hộp quét mã QR VietQR / SePay tự động sinh nội dung chuyển khoản `GDX [booking_id]`.
  - Nút "Xác nhận đã thanh toán xong" (gọi RPC `rpc_confirm_booking_payment` chuyển `payment_status = 'paid'`).

### 1.9. Đánh giá & Chấm điểm Thợ (Modal)
* **Bảng dữ liệu:** `reviews`, `bookings`.
* **Thành phần UI:**
  - Thông tin đơn hàng `#booking_id` và tên thợ phụ trách.
  - Chọn số sao (`reviews.rating` từ 1 đến 5).
  - Nhập nhận xét chi tiết (`reviews.comment`).
  - Nút "Gửi đánh giá" (INSERT vào `reviews` và kích hoạt trigger tự động tính lại `average_rating` của thợ).

### 1.10. Xác nhận Hủy lịch hẹn (Modal)
* **Bảng dữ liệu:** `bookings`, `booking_status_history`.
* **Thành phần UI:**
  - Cảnh báo quy định hủy ca sát giờ.
  - Lý do hủy đơn (`booking_status_history.reason` - Bắt buộc).
  - Nút "Xác nhận hủy đơn" (gọi RPC `rpc_transition_booking_status` chuyển trạng thái sang `cancelled`).

### 1.11. Trung tâm Hỗ trợ & Gửi khiếu nại (Drawer)
* **Bảng dữ liệu:** `support_tickets`, `bookings`.
* **Thành phần UI:**
  - Form tạo phiếu hỗ trợ: Mã đơn hàng liên quan (`booking_id`), Tiêu đề khiếu nại (`subject`), Mức độ ưu tiên (`priority`: `low`, `medium`, `high`, `urgent`).
  - Lịch sử các phiếu hỗ trợ đã gửi kèm trạng thái xử lý (`open`, `in_progress`, `resolved`, `closed`).

---

## PHÂN HỆ 2: GIAO DIỆN ĐỐI TÁC / THỢ (PROVIDER PORTAL)
* **Quy mô:** 9 Giao diện (4 Pages + 5 Modals/Components).
* **Mục đích:** Sàn nhận việc, bấm giờ ca làm, quyết toán chi phí phát sinh và quản lý lịch biểu.

### 2.1. Sàn nhận việc làm (Job Board) (Page)
* **Bảng dữ liệu:** `bookings` (`status = 'pending'`), `services`, `ward`.
* **Thành phần UI:**
  - Danh sách đơn hàng mới phù hợp với kỹ năng và khu vực của thợ.
  - Chi tiết từng ca: Mã đơn, tên dịch vụ, thời gian hẹn, địa chỉ, ghi chú của khách, thu nhập dự kiến.
  - Nút "Nhận việc ngay" (gọi RPC `rpc_transition_booking_status` chuyển sang `confirmed`).
  - Nút "Từ chối" (mở Modal 2.8).

### 2.2. Ca làm việc hiện tại (Live Timer) (Page)
* **Bảng dữ liệu:** `bookings`, `services`, `booking_status_history`.
* **Thành phần UI:**
  - Đồng hồ đếm thời gian làm việc thực tế dạng lớn (`timer-digits` font IBM Plex Mono).
  - Nút điều khiển: "Bắt đầu tính giờ", "Tạm dừng", "Hoàn thành ca làm" (chuyển `in_progress` $\rightarrow$ `completed`).
  - Cụm tác vụ hiện trường: "+ Kê khai chi phí phát sinh" (Modal 2.7), "Hủy ca bất khả kháng" (Modal 2.8), "Báo cáo sự cố khẩn cấp" (Modal 2.9).
  - Bản đồ định vị và tọa độ check-in hiện trường.

### 2.3. Ví Thu Nhập & Lịch Ca (Page)
* **Bảng dữ liệu:** `bookings`, `availability_schedules`, `availability_exceptions`, `reviews`.
* **Thành phần UI:**
  - Khối KPI: Tổng thu nhập đã quyết toán (`completed` & `paid`), Điểm đánh giá uy tín, Số ca hoàn thành.
  - Biểu đồ cột doanh thu 7 ngày gần nhất (vẽ bằng SVG `Charts.bars` từ thư viện taste-skill).
  - Bảng lịch làm việc cố định theo thứ trong tuần.
  - Nút "Cài đặt Lịch cố định & Nghỉ phép" (mở Modal 2.6).

### 2.4. Cấu hình Năng lực & Khu vực hoạt động (Page)
* **Bảng dữ liệu:** `provider_profiles`, `provider_services`, `provider_areas`, `ward`.
* **Thành phần UI:**
  - Thông tin cá nhân: Họ tên, SĐT, Số CCCD (Readonly đối với thợ đã verified), Mô tả kinh nghiệm (`info`).
  - Lưới chọn dịch vụ tiếp nhận (`provider_services`).
  - Lưới chọn Phường/Xã nhận việc (`provider_areas`).
  - Nút "Lưu thay đổi năng lực".

### 2.5. Thanh trạng thái Nhận việc & GPS (Header Component)
* **Bảng dữ liệu:** `provider_profiles` (`is_available_online`, `lattitude`, `longtitude`).
* **Thành phần UI:**
  - Nút gạt chuyển trạng thái: *Đang nhận việc* (xanh lá) $\leftrightarrow$ *Tạm dừng nhận đơn*.
  - Nút cập nhật tọa độ GPS thời gian thực kèm hiển thị kinh độ, vĩ độ.

### 2.6. Thiết lập Lịch cố định & Xin nghỉ phép (Modal)
* **Bảng dữ liệu:** `availability_schedules`, `availability_exceptions`.
* **Thành phần UI:**
  - Tab 1 - Lịch cố định tuần: Chọn thứ (0..6), chọn giờ bắt đầu và giờ kết thúc (`end_time > start_time`), nút thêm/xóa khung giờ.
  - Tab 2 - Đăng ký nghỉ đột xuất: Chọn ngày nghỉ (`exception_date`), khung giờ nghỉ, nhập lý do nghỉ phép.

### 2.7. Kê khai Chi phí phát sinh (Incidental Cost) (Modal)
* **Bảng dữ liệu:** `bookings` (`total_incidental`, `total_amount`, `notes`).
* **Thành phần UI:**
  - Nhập số tiền phát sinh mua vật tư (VND, ràng buộc `>= 0`).
  - Nhập lý do và chi tiết hóa đơn đính kèm.
  - Nút "Lưu chi phí & Ghi Audit Log" (gọi RPC `rpc_update_incidental_cost`).

### 2.8. Từ chối đơn / Hủy ca làm việc (Modal)
* **Bảng dữ liệu:** `bookings`, `booking_status_history`.
* **Thành phần UI:**
  - Nhập lý do từ chối hoặc hủy ca (Bắt buộc).
  - Nút xác nhận (gọi RPC `rpc_transition_booking_status` chuyển trạng thái sang `rejected` hoặc `cancelled`).

### 2.9. Báo cáo Sự cố / Hỗ trợ Đối tác (Drawer)
* **Bảng dữ liệu:** `support_tickets` (`priority = 'urgent'`), `bookings`.
* **Thành phần UI:**
  - Form gửi báo cáo khẩn cấp tới Ban điều phối trực ban 24/7 khi gặp sự cố tại hiện trường (khách vắng mặt, tranh chấp, địa chỉ ảo).

---

## PHÂN HỆ 3: GIAO DIỆN QUẢN TRỊ VIÊN (ADMIN PORTAL)
* **Quy mô:** 9 Giao diện (4 Pages + 5 Modals/Drawers).
* **Mục đích:** Giám sát doanh thu, điều phối đơn kẹt, kiểm duyệt KYC thợ, quản trị biểu giá và giải quyết khiếu nại.

### 3.1. Dashboard Tổng quan & Điều phối Trung tâm (Page)
* **Bảng dữ liệu:** `bookings`, `provider_profiles`, `users`, `support_tickets`.
* **Thành phần UI:**
  - Khối KPI: Doanh thu thực nhận, số đơn đang chạy / chờ điều phối, hồ sơ thợ chờ duyệt KYC, phiếu hỗ trợ đang mở.
  - Biểu đồ đường doanh thu 6 tháng gần nhất (vẽ bằng SVG `Charts.line`).
  - Bản đồ nhiệt điều phối vị trí thợ trực tuyến và đơn hàng đang chờ.
  - Bảng đơn hàng cần điều phối: Xem chi tiết log (Modal 3.5), hoàn tiền/điều chỉnh tài chính (Modal 3.6).

### 3.2. Quản lý Danh mục & Cấu hình Biểu giá (Page)
* **Bảng dữ liệu:** `service_categories`, `services`.
* **Thành phần UI:**
  - Bảng quản lý cây danh mục (`category_name`, `slug`, `parent_id`, nút bật/tắt hiển thị `status`).
  - Bảng quản lý dịch vụ (`title`, `price`, `pricing_type`, `estimated_duration`, nút bật/tắt kích hoạt `is_active`).
  - Nút "+ Thêm Danh mục / Dịch vụ" (mở Modal 3.8).

### 3.3. Xét duyệt Hồ sơ Đối tác (KYC Review) (Page)
* **Bảng dữ liệu:** `provider_profiles`, `users`, `provider_services`, `provider_areas`.
* **Thành phần UI:**
  - Tabs bộ lọc: Chờ duyệt (`pending`) | Đã phê duyệt (`verified`) | Đã từ chối (`rejected`).
  - Thẻ duyệt hồ sơ: Avatar, họ tên, SĐT, số CCCD, lý lịch kinh nghiệm, dịch vụ đăng ký, khu vực đăng ký.
  - Nút "Phê duyệt (Verified)" và nút "Từ chối (Reject)".

### 3.4. Quản lý Người dùng, Phiếu Hỗ trợ & Kiểm duyệt (Page Split Tabs)
* **Bảng dữ liệu:** `users`, `support_tickets`, `reviews`.
* **Thành phần UI:**
  - Tab 1 - Người dùng: Bảng danh sách tài khoản, vai trò (`role`), công tắc khóa/mở khóa tài khoản (`users.is_active`).
  - Tab 2 - Phiếu hỗ trợ: Bảng khiếu nại, mức độ ưu tiên, nút "Xử lý" (mở Drawer 3.7).
  - Tab 3 - Kiểm duyệt đánh giá: Bảng danh sách reviews từ khách, nút "Xóa vi phạm" (kích hoạt trigger tự động tính lại điểm sao thợ).

### 3.5. Tra cứu Chi tiết Đơn & Lịch sử Kiểm toán (Audit Log) (Drawer)
* **Bảng dữ liệu:** `bookings`, `booking_status_history`, `users`.
* **Thành phần UI:**
  - Tóm tắt đầy đủ thông tin đơn hàng `#booking_id`.
  - Dòng thời gian kiểm toán: Trạng thái trước $\rightarrow$ Trạng thái sau, Người thực hiện (kèm vai trò), Thời gian và Lý do thay đổi.

### 3.6. Xử lý Hoàn tiền & Điều chỉnh Thanh toán (Modal)
* **Bảng dữ liệu:** `bookings`, `booking_status_history`.
* **Thành phần UI:**
  - Form điều chỉnh chi phí phát sinh, tổng tiền, trạng thái thanh toán (`refunded`, `paid`, `unpaid`), trạng thái đơn hàng.
  - Nhập lý do điều chỉnh bắt buộc để ghi log kiểm toán.

### 3.7. Xử lý & Cập nhật Phiếu hỗ trợ (Ticket Detail) (Drawer)
* **Bảng dữ liệu:** `support_tickets`, `users`, `bookings`.
* **Thành phần UI:**
  - Thông tin người gửi khiếu nại và đơn hàng liên quan.
  - Cập nhật mức độ ưu tiên (`low`, `medium`, `high`, `urgent`) và trạng thái (`open`, `in_progress`, `resolved`, `closed`).

### 3.8. Thêm / Chỉnh sửa Danh mục & Dịch vụ (Modal)
* **Bảng dữ liệu:** `service_categories`, `services`.
* **Thành phần UI:**
  - Form nhập liệu dịch vụ mới với các ràng buộc kiểm tra: `price >= 0`, `estimated_duration > 0`, chọn danh mục cha.

### 3.9. Quản lý Địa giới hành chính (Tỉnh/Thành & Phường/Xã) (Modal)
* **Bảng dữ liệu:** `province`, `ward`.
* **Thành phần UI:**
  - Bảng danh sách mã Phường và Tỉnh hiện có trong hệ thống.
  - Form thêm Phường/Xã mới (mã tối đa 8 ký tự, tên phường, liên kết `provinceId`).

---

### HƯỚNG DẪN IMPORT VÀO GOOGLE DOCS / GOOGLE DRIVE
1. Mở file HTML `tai_lieu_dac_ta_giao_dien_google_docs.html` bằng trình duyệt web.
2. Nhấn tổ hợp phím **Ctrl + A** (chọn toàn bộ) và **Ctrl + C** (sao chép).
3. Mở một tài liệu mới trên Google Docs ([docs.new](https://docs.new)) và nhấn **Ctrl + V** (dán). Toàn bộ định dạng bảng, màu sắc, font chữ và tiêu đề sẽ được giữ nguyên 100%.
