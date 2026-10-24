# Product Context — Gia Đình Xanh

## Purpose & Value Proposition
Gia Đình Xanh là nền tảng kết nối trực tiếp giữa Khách hàng hộ gia đình và Đội ngũ Thợ kỹ thuật lành nghề tại các phường/xã thuộc Việt Nam (sửa chữa điện tử, bảo dưỡng điều hòa, thông tắc vệ sinh, sửa đường ống nước).

## Core User Roles
1. **Khách hàng (Customer):** Tìm kiếm dịch vụ theo phân loại, cấu hình lịch hẹn theo phường/xã, theo dõi trạng thái đơn hàng thời gian thực, duyệt chi phí phát sinh minh bạch, thanh toán và chấm điểm thợ.
2. **Thợ kỹ thuật / Đối tác (Provider):** Đăng ký hồ sơ xác thực CCCD, cài đặt năng lực dịch vụ và phường/xã nhận việc, nhận việc từ sàn, bấm giờ tính phí ca làm việc, cập nhật phụ phí phát sinh và theo dõi doanh thu ví.
3. **Quản trị viên (Admin):** Kiểm duyệt hồ sơ thợ (CCCD, chuyên môn), quản lý danh mục và dịch vụ, giám sát và điều phối đơn hàng, giải quyết khiếu nại (support tickets) và kích hoạt/vô hiệu hóa tài khoản.

## Data & Database Alignment
- Hệ thống tuân thủ 100% cơ sở dữ liệu PostgreSQL gồm 16 bảng dữ liệu và các quy tắc RLS (Row-Level Security) từ `home_service_booking_supabase.sql`.
- Hỗ trợ lưu trữ bền vững tại chỗ (`backend/data/local-db.json`) và sẵn sàng kết nối trực tiếp với Supabase qua SDK `@supabase/supabase-js` và `.env.local`.

## Experience Philosophy
- **Anti-slop & Trung thực:** Không sử dụng các cam kết viển vông (không quảng cáo bảo hiểm 10 tỷ nếu DB không có bảng bảo hiểm; không dùng radar quét vệ tinh GPS giả; không tích hợp webhook ngân hàng tự động ảo).
- **Trải nghiệm 2 chế độ:**
  - **Chế độ Người dùng (User Flow):** Trực quan, tinh giản, thân thiện, ẩn hoàn toàn thuật ngữ kỹ thuật/schema.
  - **Chế độ Dev (34 UI Spec):** Đầy đủ 34 màn hình/hộp thoại, hiển thị mapping bảng SQL, trường dữ liệu và kết nối RPC/Supabase.
