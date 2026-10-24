# DESIGN.md — Gia Đình Xanh (Warm Minimalism Design System)

## 1. Triết lý Thiết kế (Warm Minimalism)
- **Tham chiếu thẩm mỹ:** Tân trang theo phong cách **Warm Minimalism** từ `demo giao dien-giadinhxanh`, tối ưu khoảng trắng hai bên lề (`.site-container` `max-width: 1200px; margin-inline: auto; padding-inline: 24px`) để toàn bộ 34 giao diện luôn thoáng đãng, hiện đại và truyền tải trọn vẹn thông điệp mà không gây ngợp mắt.
- **Tuân thủ 100% cơ sở dữ liệu PostgreSQL:** Mọi trường dữ liệu, bộ lọc, trạng thái và luồng thao tác trên 34 giao diện đều ánh xạ 1-1 với 16 bảng, 1 View (`provider_public_profiles`) và 4 RPC trong `4. home_service_booking_supabase.sql`. Tuyệt đối không đưa vào các cam kết vượt ngoài phạm vi cơ sở dữ liệu.

## 2. Bảng màu (Color Palette)
- **Deep Forest Green (`--color-primary: #1B4332`, hover `#143326`):** Màu chủ đạo cho thương hiệu, các nút hành động chính (`.primary-btn`), nhãn dịch vụ và điểm nhấn tin cậy.
- **Soft Sage Tint (`--color-primary-light: #EBF2EE`):** Nền nhẹ cho trạng thái đang chọn, lịch rảnh của thợ và hộp tổng tiền.
- **Warm Charcoal Ink (`--color-secondary: #1F2430`):** Màu chữ chính có độ tương phản cao trên nền sáng.
- **Warm Terracotta (`--color-accent-warm: #E07A5F`):** Điểm nhấn ấm áp cho điểm sao đánh giá (`average_rating`) và biểu tượng trái tim tổ ấm.
- **Airy Off-White (`--color-bg: #F8F9FA`, `--color-bg-subtle: #F1F3F5`, `--color-surface: #FFFFFF`):** Hệ thống nền đa lớp tạo chiều sâu nhẹ nhàng cho các thẻ dịch vụ và phân vùng nội dung.

## 3. Hệ thống Chữ viết (Typography)
- **Tiêu đề & Nút bấm (`--font-heading`):** `'Plus Jakarta Sans'` (weights 600, 700, 800) mang đường nét hình học bo tròn thân thiện, hiện đại.
- **Nội dung & Biểu mẫu (`--font-body`):** `'Inter'` (weights 400, 500, 600) dễ đọc, kết hợp `font-variant-numeric: tabular-nums` cho toàn bộ đơn giá, tọa độ, thời gian và mã đơn hàng.

## 4. Hệ thống Nút bấm & Thẻ (Buttons & Cards)
- **Nút bấm dáng viên thuốc (`--radius-pill: 9999px`):** Tất cả nút `.primary-btn`, `.ghost-btn`, `.btn`, `.filter-chip`, `.quick-chip` và thanh chuyển chế độ đều bo tròn mềm mại với chiều cao chuẩn thao tác chạm (`44px–56px`).
- **Thẻ nội dung (`--radius-card: 16px`):** Thẻ dịch vụ (`.service-card`), thẻ đối tác thợ (`.provider-card`), và các bảng cấu hình (`.panel`, `.wizard-main-content`) có bo góc `16px`, viền mảnh `#E5E9F0` và khoảng đệm rộng rãi (`24px–32px`).
