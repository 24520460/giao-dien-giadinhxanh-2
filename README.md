# 🌿 Gia Đình Xanh — Nền Tảng Đặt Lịch Dịch Vụ Gia Đình

Hệ thống đặt lịch dịch vụ gia đình kết nối trực tiếp Khách hàng và Thợ kỹ thuật lành nghề tại các phường/xã (sửa điện tử, bảo dưỡng máy lạnh, thông tắc vệ sinh, sửa đường ống nước).

Ứng dụng được xây dựng theo kiến trúc **Full-stack Node.js + Persistent Local SQL Store / Supabase PostgreSQL + Giao diện Anti-slop / Warm Minimalism**, sẵn sàng chạy ngay lập tức mà không cần cài đặt thêm database bên ngoài.

---

## ⚡ Hướng dẫn Chạy Nhanh (Quick Start)

### 1. Yêu cầu tiên quyết
- **Node.js**: Phiên bản `>= 22.0.0` (yêu cầu native `--watch` và `node:test`).
- **npm**: `>= 10.0.0` (hoặc sử dụng `npm.cmd` trên Windows PowerShell).

---

### 2. Ba bước khởi động ứng dụng trong 1 phút

#### Bước 1: Chuẩn bị file cấu hình môi trường
*(Hệ thống đã cấu hình sẵn chạy Local Store offline, bạn chỉ cần sao chép file `.env.example` nếu chưa có `.env.local`)*
```bash
cp .env.example .env.local
```

#### Bước 2: Cài đặt gói phụ thuộc
```bash
# Cài đặt chính xác theo lockfile (Khuyên dùng)
npm ci
```
> **Lưu ý trên Windows PowerShell:** Nếu gặp lỗi `PSSecurityException` do chính sách bảo mật script, vui lòng chạy bằng `npm.cmd ci` hoặc dùng lệnh trực tiếp `node server.js`.

#### Bước 3: Khởi động Server
```bash
# Chế độ phát triển (Tự động tải lại khi sửa code - Hot Reload)
npm run dev

# Hoặc khởi chạy thông thường:
npm start
```

🎉 **Mở trình duyệt và truy cập ngay:** [http://localhost:3000](http://localhost:3000)

---

## 👥 Danh Sách Tài Khoản Dùng Thử (Demo Accounts)

Hệ thống đã nạp sẵn dữ liệu mẫu cho 16 bảng PostgreSQL. Tại giao diện web, bạn có thể **chuyển nhanh góc nhìn** bằng thanh chọn tài khoản ở góc trên bên phải, hoặc đăng nhập trực tiếp:

| Vai trò | Họ tên | Email | Số điện thoại | Mật khẩu |
| :--- | :--- | :--- | :--- | :--- |
| **Khách hàng (Customer)** | Nguyễn Minh Thảo | `minhthao.q7@gmail.com` | `0908341289` | *Bất kỳ (ở Local Mode)* |
| **Khách hàng (Customer)** | Trần Quốc Bảo | `quocbao.thuduc@gmail.com` | `0912883401` | *Bất kỳ (ở Local Mode)* |
| **Thợ điện lạnh (Provider)** | Lê Hoàng Tuấn | `hoangtuan.kythuat@giadinhxanh.vn` | `0974115902` | *Bất kỳ (ở Local Mode)* |
| **Thợ vệ sinh (Provider)** | Đặng Thị Mai Lan | `mailan.ve-sinh@giadinhxanh.vn` | `0938772190` | *Bất kỳ (ở Local Mode)* |
| **Quản trị viên (Admin)** | Nguyễn Quang Hào | `admin@giadinhxanh.vn` | `0901999888` | *Bất kỳ (ở Local Mode)* |

---

## 🧭 Các Phân Hệ & Đường Dẫn Truy Cập Chính

| Phân hệ / Tính năng | Đường dẫn URL | Mô tả |
| :--- | :--- | :--- |
| **Luồng Người dùng (User Flow)** | [http://localhost:3000/?mode=user](http://localhost:3000/?mode=user) | Trải nghiệm trực quan, tinh gọn cho Khách hàng & Thợ |
| **Cổng Khách hàng (Customer Portal)** | [http://localhost:3000/?mode=user#customer](http://localhost:3000/?mode=user#customer) | Tìm dịch vụ, đặt lịch hẹn, xem đơn hàng, chat AI, thanh toán VietQR |
| **Cổng Đối tác Thợ (Provider Portal)** | [http://localhost:3000/?mode=user#provider](http://localhost:3000/?mode=user#provider) | Nhận việc từ sàn (Job Board), bấm giờ làm việc, cập nhật phụ phí |
| **Cổng Quản trị (Admin Portal)** | [http://localhost:3000/?mode=user#admin](http://localhost:3000/?mode=user#admin) | Duyệt hồ sơ thợ (KYC CCCD), giá dịch vụ, xử lý khiếu nại |
| **Đặc tả 34 Màn hình (Dev Spec)** | [http://localhost:3000/?mode=dev](http://localhost:3000/?mode=dev) | Xem chi tiết 34 màn hình UI, ánh xạ bảng SQL & các hàm RPC |
| **Kiểm tra trạng thái (API Status)** | [http://localhost:3000/api/status](http://localhost:3000/api/status) | JSON trả về tình trạng kết nối DB & số lượng bản ghi 16 bảng |

---

## 🛠️ Các Lệnh Phát Triển & Kiểm Thử Thường Dùng

Dự án hỗ trợ cả lệnh qua `npm` và `Makefile`:

```bash
# 1. Chạy kiểm thử tự động toàn diện (24 Unit & Integration Tests)
npm test
# hoặc: node --test test/api.test.js

# 2. Kiểm tra cú pháp và chất lượng mã nguồn (Linting)
npm run lint
# hoặc: node --check server.js db-mock.js app.js test/api.test.js

# 3. Khôi phục dữ liệu mẫu gốc (Reset Local Database)
make db-reset
# hoặc gửi request: curl -X POST http://localhost:3000/api/supabase/reset-local

# 4. Chạy hệ thống bằng Docker Compose (Tùy chọn)
docker compose up -d     # Khởi động (kèm Webmail Mailpit tại port 8025)
docker compose down      # Dừng container
```

---

## ⚙️ Cấu Hình Môi Trường (`.env.local`)

Mặc định máy chủ sẽ tự khởi tạo và lưu trữ dữ liệu tại `backend/data/local-db.json`. Nếu muốn kết nối với **Supabase Cloud**, bạn cấu hình trong `.env.local`:

```env
# Cổng chạy ứng dụng (Mặc định: 3000)
PORT=3000

# Cấu hình Supabase (Tùy chọn - để trống nếu chạy Local Store)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
```

---

## 📁 Cấu Trúc Thư Mục Dự Án

```text
├── server.js               # Node.js HTTP Backend (REST API + Static Server + RPC Logic)
├── db-mock.js              # Khởi tạo mô hình 16 bảng PostgreSQL & Seed dữ liệu ban đầu
├── app.js                  # Frontend Controller (Quản lý 34 màn hình, 4 phân hệ)
├── index.html              # HTML Shell với thiết kế Warm Minimalism
├── styles.css              # Hệ thống CSS Design Tokens & Layout Responsive
├── backend/
│   └── data/               # Nơi lưu trữ persistent local database (local-db.json)
├── docs/
│   ├── ARCHITECTURE.md     # Tài liệu kiến trúc toàn diện
│   ├── ONBOARDING.md       # Hướng dẫn chi tiết dành cho Developer mới
│   └── SERVICES.md         # Danh mục dịch vụ và phân loại kỹ thuật
├── test/
│   └── api.test.js         # 24 bài kiểm thử tích hợp (Node.js native test runner)
├── Makefile                # Phím tắt các lệnh tự động hóa dev/ops
├── docker-compose.yml      # Cấu hình Docker & Mailpit
├── package.json            # Cấu hình dự án và dependencies
└── README.md               # Tài liệu hướng dẫn sử dụng nhanh này
```

---

## ❓ Xử Lý Sự Cố Thường Gặp (Troubleshooting)

1. **Lỗi PowerShell trên Windows (`PSSecurityException`)**:
   - Dùng `npm.cmd <lệnh>` (ví dụ: `npm.cmd run dev`, `npm.cmd test`).
   - Hoặc mở PowerShell với quyền Administrator và chạy:
     ```powershell
     Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
     ```

2. **Lỗi cổng 3000 bị chiếm (`EADDRINUSE: address already in use :::3000`)**:
   - Mở `.env.local` và đổi cổng: `PORT=3001`.
   - Hoặc giải phóng cổng 3000 trên PowerShell:
     ```powershell
     Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
     ```

3. **Node.js phiên bản thấp**:
   - Dự án yêu cầu `node >= 22.0.0` để hỗ trợ native `--watch` và `node:test`. Kiểm tra phiên bản bằng `node -v`.
