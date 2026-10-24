# Developer Onboarding & Local Setup Guide

Chào mừng bạn gia nhập đội ngũ phát triển dự án **Gia Đình Xanh (Home Service Booking Platform)**! Tài liệu này được biên soạn bởi DevOps & Onboarding Team nhằm giúp bạn thiết lập môi trường phát triển local hoàn chỉnh, nắm rõ kiến trúc dữ liệu và chạy thành công toàn bộ hệ thống cũng như bộ kiểm thử trong thời gian ngắn nhất mà không gặp trở ngại.

---

## 1. System Prerequisites

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt các công cụ sau với phiên bản tối thiểu tương ứng:

| Công cụ | Phiên bản yêu cầu | Mục đích sử dụng | Bắt buộc |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 22.0.0` | Runtime thực thi máy chủ Backend API và công cụ kiểm thử (yêu cầu native `--watch` và `node:test`) | **Có** |
| **npm** | `>= 10.0.0` | Quản lý gói phụ thuộc theo chuẩn `package-lock.json` (Lockfile v3) | **Có** |
| **Git** | `>= 2.30.0` | Quản lý mã nguồn dự án | **Có** |
| **Docker Engine & Docker Compose** | Engine `>= 24.0.0`, Compose `>= v2.0` | Vận hành toàn bộ ứng dụng dưới dạng Container và dịch vụ Mailpit phụ trợ | Tùy chọn |
| **GNU Make** | `>= 3.81` | Thực thi nhanh các lệnh tự động hóa qua `Makefile` | Tùy chọn |

### Gợi ý công cụ quản lý phiên bản Runtime (Version Managers):
Để tránh xung đột môi trường giữa các dự án, chúng tôi khuyến nghị sử dụng:
- **macOS / Linux:**
  - `nvm` (Node Version Manager):
    ```bash
    nvm install 22
    nvm use 22
    ```
  - Hoặc `asdf` / `fnm` / `volta`:
    ```bash
    asdf plugin add nodejs
    asdf install nodejs 22.10.0
    asdf local nodejs 22.10.0
    ```
- **Windows:**
  - `nvm-windows`: Tải bộ cài từ [coreybutler/nvm-windows](https://github.com/coreybutler/nvm-windows), sau đó chạy:
    ```powershell
    nvm install 22.10.0
    nvm use 22.10.0
    ```
  - Hoặc `fnm` (Fast Node Manager):
    ```powershell
    fnm install 22
    fnm use 22
    ```

---

## 2. Step-by-Step Environment Setup

Dự án hỗ trợ 2 chế độ cơ sở dữ liệu:
1. **Persistent Local SQL Store (`backend/data/local-db.json`):** Chế độ mặc định sẵn sàng hoạt động ngay (Zero External Dependencies) với 16 bảng dữ liệu PostgreSQL, 1 View `provider_public_profiles`, 4 hàm RPC và triggers đã được seed sẵn qua `db-mock.js`.
2. **Supabase PostgreSQL:** Kết nối trực tiếp cơ sở dữ liệu Supabase đám mây hoặc self-hosted qua `@supabase/supabase-js`.

Hãy làm theo các bước tuần tự dưới đây:

### 1. Clone & Environment Variables

Clone mã nguồn và khởi tạo tệp cấu hình biến môi trường local:

```bash
# 1. Clone kho lưu trữ về máy cá nhân
git clone <repository_url>
cd "demo giao dien-giadinhxanh 2"

# 2. Tạo tệp cấu hình môi trường local từ bản mẫu
cp .env.example .env.local
```

> **Ghi chú về file môi trường:** Máy chủ hỗ trợ nạp cấu hình từ cả hai tệp `.env` và `.env.local` (nếu tồn tại cả hai, cấu hình trong `.env.local` sẽ được ưu tiên).

#### Bảng chú thích các biến môi trường:

| Tên biến | Giá trị mẫu / Mặc định | Bắt buộc đổi ở Local? | Mô tả chi tiết |
| :--- | :--- | :--- | :--- |
| `PORT` | `3000` | **Không** (Đổi nếu trùng) | Cổng HTTP Server lắng nghe (phục vụ cả REST API và Static Frontend). |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project-id.supabase.co` | **Không** (Tùy chọn) | URL kết nối dự án Supabase. **Nếu để trống**, hệ thống tự động kích hoạt chế độ **Persistent Local SQL Store** giúp bạn chạy offline ngay lập tức. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-public-key` | **Không** (Tùy chọn) | Public Anonymous Key của Supabase để kiểm tra RLS. Để trống khi dùng Local Store. |
| `SUPABASE_SERVICE_ROLE_KEY` | `your-service-role-secret-key` | **Không** (Tùy chọn) | Secret Key đặc quyền Admin của Supabase (dùng cho Admin KYC, xóa dữ liệu). Để trống khi dùng Local Store. |

---

### 2. Infrastructure Initialization (Docker)

Nếu bạn muốn chạy ứng dụng trong môi trường Container cô lập kèm theo dịch vụ giả lập thư điện tử **Mailpit** (SMTP & Web Mailbox):

```bash
# Khởi động toàn bộ dịch vụ nền bằng Makefile
make docker-up

# Hoặc khởi động trực tiếp bằng Docker Compose CLI:
docker compose up -d
```

Để kiểm tra trạng thái và theo dõi nhật ký hoạt động (logs):
```bash
# Xem log container ứng dụng
make docker-logs
# Hoặc:
docker compose logs -f app
```

Để tắt toàn bộ container hạ tầng:
```bash
make docker-down
# Hoặc:
docker compose down
```

> **Mẹo dành cho Onboarding:** Nếu máy của bạn không cài Docker, bạn **hoàn toàn có thể bỏ qua bước này** và chuyển ngay sang Bước 3 để chạy trực tiếp trên Host.

---

### 3. Dependency Installation

Dự án khóa phiên bản thư viện chặt chẽ thông qua tệp `package-lock.json` (Lockfile v3). Tuyệt đối **không** dùng `npm install` tùy tiện để tránh làm sai lệch mã băm (integrity hashes) của lockfile.

Chạy lệnh cài đặt đồng bộ chuẩn xác:

```bash
# Cài đặt chính xác theo lockfile (Khuyên dùng trong CI/CD & Onboarding)
npm ci

# Hoặc chạy thông qua Makefile target:
make install
```

---

### 4. Database Migration & Seeding

Tùy theo chế độ bạn lựa chọn ở Bước 1:

#### Kịch bản A: Chạy với Persistent Local SQL Store (Nhanh nhất & Mặc định)
- Hệ thống tự động kiểm tra thư mục `backend/data/` và tự động sinh tệp `backend/data/local-db.json` với đầy đủ 16 bảng dữ liệu mẫu khi máy chủ khởi động lần đầu.
- Khi cần **khôi phục/làm mới toàn bộ dữ liệu mẫu** về trạng thái ban đầu:
  ```bash
  # Khôi phục dữ liệu mẫu qua Makefile:
  make db-reset

  # Hoặc gửi yêu cầu trực tiếp qua cURL:
  curl -s -X POST http://localhost:3000/api/supabase/reset-local
  ```

#### Kịch bản B: Chạy với Supabase PostgreSQL
Nếu bạn đã điền `NEXT_PUBLIC_SUPABASE_URL` và Keys vào `.env.local`:
1. Mở giao diện **Supabase Studio -> SQL Editor**.
2. Thực thi tệp DDL tạo bảng: `4. home_service_booking_supabase.sql` (tạo 16 bảng dữ liệu, triggers, RLS policies và dữ liệu vị trí địa lý).
3. Thực thi tiếp tệp RPC Workflow: `supabase_rpc_functions.sql` (tạo 4 hàm `rpc_transition_booking_status`, `rpc_provider_update_incidental`, `rpc_customer_confirm_payment`, `rpc_admin_adjust_booking` và thu hồi quyền sửa nhạy cảm trên bảng `bookings`).

---

### 5. Starting the Application

Khởi chạy ứng dụng ở chế độ phát triển có tính năng tự động tải lại (Hot-reload / Watch mode) khi có thay đổi mã nguồn:

```bash
# Khởi chạy chế độ Development (sử dụng native Node.js --watch)
npm run dev

# Hoặc qua Makefile:
make dev
```

Nếu muốn khởi chạy chế độ chuẩn (Production mode):
```bash
npm start
# Hoặc:
make start
```

#### Bảng điều hướng các địa chỉ URL & Cổng mặc định:

| Phân hệ / Cổng thông tin | Địa chỉ URL truy cập | Mục đích |
| :--- | :--- | :--- |
| **Giao diện Người dùng (User Flow)** | [http://localhost:3000/?mode=user](http://localhost:3000/?mode=user) | Trải nghiệm trực quan tinh gọn dành cho Khách hàng và Thợ, ẩn toàn bộ thuật ngữ kỹ thuật |
| **Phân hệ Khách hàng (Customer Portal)** | [http://localhost:3000/?mode=user#customer](http://localhost:3000/?mode=user#customer) | Khám phá dịch vụ, đặt lịch hẹn (Booking Wizard) và theo dõi trạng thái đơn hàng trực tiếp |
| **Phân hệ Đối tác Thợ (Provider Portal)** | [http://localhost:3000/?mode=user#provider](http://localhost:3000/?mode=user#provider) | Sàn nhận việc (Job Board), ca làm việc bấm giờ (Live Timer), cập nhật chi phí phát sinh và ví thu nhập |
| **Phân hệ Quản trị (Admin Portal)** | [http://localhost:3000/?mode=user#admin](http://localhost:3000/?mode=user#admin) | Xét duyệt hồ sơ thợ (KYC CCCD), biểu giá dịch vụ, quản lý tài khoản và hỗ trợ xử lý khiếu nại |
| **Đặc tả 34 Màn hình (Dev Spec Flow)** | [http://localhost:3000/?mode=dev](http://localhost:3000/?mode=dev) | Chế độ dành cho Developer xem chi tiết 34 màn hình UI, ánh xạ bảng SQL và các hàm RPC |
| **Kiểm tra trạng thái hệ thống (API Health Check)** | [http://localhost:3000/api/status](http://localhost:3000/api/status) | Trả về JSON trạng thái kết nối DB (Local Store hoặc Supabase) và số lượng bản ghi 16 bảng |
| **Tải cấu trúc dữ liệu khởi tạo (Bootstrap API)** | [http://localhost:3000/api/bootstrap](http://localhost:3000/api/bootstrap) | API cung cấp 16 bảng dữ liệu và View `provider_public_profiles` cho Frontend |
| **Hộp thư thử nghiệm Mailpit (Nếu chạy Docker)** | [http://localhost:8025](http://localhost:8025) | Giao diện Web xem email thông báo đặt lịch, xác nhận đơn hàng |

---

## 3. Testing & Code Quality Verification

Mọi kiểm thử và công cụ đo lường chất lượng mã nguồn được tích hợp sẵn thông qua package manager scripts và test runner nội vi của Node.js:

### 1. Bộ kiểm thử tự động (Unit & Integration Tests)
Kiểm tra tính toàn vẹn của mô hình 16 bảng dữ liệu, quan hệ khóa ngoại (foreign key referential integrity), quy tắc trạng thái đơn hàng và các endpoint REST/RPC:

```bash
# Chạy bộ test tự động tích hợp
npm test

# Hoặc qua Makefile:
make test
```
*(Lệnh thực tế thực thi: `node --test test/api.test.js`)*

### 2. Kiểm thử luồng giao diện End-to-End (E2E Flow Verification)
Kiểm tra điều hướng giữa 4 cổng thông tin (Customer, Provider, Admin, Auth) và chụp ảnh màn hình kiểm toán:

```bash
# Chạy script xác thực luồng giao diện tự động
node scratch/verify-all-flows.mjs

# Chạy công cụ kiểm toán thiết kế giao diện (Taste-Skill Inspector):
npm run inspect
```

### 3. Kiểm tra cú pháp & Chất lượng mã nguồn (Linting & Syntax Checking)
Kiểm tra lỗi cú pháp JavaScript và tính hợp lệ của toàn bộ mã nguồn máy chủ, mô hình dữ liệu và mã kiểm thử:

```bash
# Kiểm tra tĩnh toàn bộ mã nguồn JavaScript
npm run lint

# Hoặc qua Makefile:
make lint
```
*(Lệnh thực tế thực thi: `node --check server.js db-mock.js app.js test/api.test.js`)*

---

## 4. Common Pitfalls & Troubleshooting

Dưới đây là các sự cố thường gặp nhất trong quá trình thiết lập môi trường và giải pháp xử lý triệt để:

### 1. Lỗi PowerShell chặn thực thi lệnh trên Windows (`PSSecurityException`)
- **Triệu chứng:** Khi chạy `npm` hoặc script trên Windows PowerShell, xuất hiện lỗi:
  ```text
  npm : File D:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.
  + FullyQualifiedErrorId : PSSecurityException
  ```
- **Nguyên nhân:** Chính sách `ExecutionPolicy` mặc định của Windows PowerShell chặn thực thi các file script `.ps1`.
- **Cách khắc phục:**
  - *Cách nhanh nhất:* Sử dụng lệnh `npm.cmd` thay vì `npm` (ví dụ: `npm.cmd test`, `npm.cmd run dev`, `npm.cmd ci`).
  - *Cách triệt để:* Mở PowerShell và cấp quyền cho User hiện tại:
    ```powershell
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
    ```

### 2. Lỗi không tương thích phiên bản Node.js (Runtime Version Mismatch)
- **Triệu chứng:** Khi chạy `npm run dev`, xuất hiện lỗi không nhận diện cờ `--watch` hoặc lỗi syntax feature mới:
  ```text
  node: bad option: --watch
  ```
- **Nguyên nhân:** Máy tính của bạn đang sử dụng Node.js phiên bản thấp hơn yêu cầu `node >= 22.0.0` được chỉ định trong `package.json`.
- **Cách khắc phục:**
  - Kiểm tra phiên bản hiện tại:
    ```bash
    node -v
    ```
  - Nâng cấp lên Node.js 22 bằng công cụ quản lý phiên bản:
    ```bash
    # Đối với nvm (macOS/Linux):
    nvm install 22 && nvm use 22

    # Đối với nvm-windows:
    nvm install 22.10.0 && nvm use 22.10.0
    ```

### 3. Lỗi xung đột cổng mạng (`EADDRINUSE: address already in use :::3000`)
- **Triệu chứng:** Khởi động máy chủ thất bại kèm thông báo lỗi:
  ```text
  Error: listen EADDRINUSE: address already in use 0.0.0.0:3000
  ```
- **Nguyên nhân:** Cổng 3000 đang bị chiếm giữ bởi một tiến trình khác đang chạy ngầm trên máy.
- **Cách khắc phục:**
  - *Phương án A (Đổi cổng):* Mở tệp `.env.local` (hoặc `.env`), sửa dòng `PORT=3000` thành `PORT=3001` (hoặc cổng bất kỳ còn trống), sau đó chạy lại `npm run dev`.
  - *Phương án B (Dừng tiến trình chiếm cổng):*
    - **Trên Windows (PowerShell):**
      ```powershell
      Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
      ```
    - **Trên macOS / Linux:**
      ```bash
      npx kill-port 3000
      # Hoặc: lsof -ti:3000 | xargs kill -9
      ```

### 4. Lỗi kết nối Supabase hoặc thiếu bảng dữ liệu (`supabase_unseeded_fallback`)
- **Triệu chứng:** Bạn đã cấu hình `NEXT_PUBLIC_SUPABASE_URL` nhưng khi kiểm tra tại `http://localhost:3000/api/status`, trường `supabaseMessage` hiển thị:
  ```text
  Đã nhận khóa từ .env.local nhưng truy vấn bảng 'province' trả về: relation "province" does not exist
  ```
- **Nguyên nhân:** Dự án Supabase của bạn mới được tạo và chưa được nạp schema cơ sở dữ liệu.
- **Cách khắc phục:**
  - Mở giao diện Supabase Dashboard -> **SQL Editor** và lần lượt chạy tệp `4. home_service_booking_supabase.sql` sau đó là `supabase_rpc_functions.sql`.
  - Hoặc tạm thời xóa giá trị biến `NEXT_PUBLIC_SUPABASE_URL` trong `.env.local`, máy chủ sẽ tự động chuyển sang vận hành trên **Persistent Local SQL Store** giúp bạn tiếp tục làm việc mà không bị gián đoạn.

### 5. Lỗi phân quyền ghi tệp Local Store trong Docker / Linux (`EACCES: permission denied`)
- **Triệu chứng:** Máy chủ trong Docker hoặc trên hệ điều hành Linux báo lỗi khi cố gắng lưu file `backend/data/local-db.json`.
- **Nguyên nhân:** Docker Volume Mount kế thừa quyền truy cập của hệ điều hành máy chủ và thư mục `backend/data` bị giới hạn quyền ghi.
- **Cách khắc phục:**
  - Cấp toàn quyền ghi cho thư mục dữ liệu trên máy Host:
    ```bash
    chmod -R 777 backend/data
    ```
  - Sau đó đặt lại dữ liệu mẫu bằng lệnh:
    ```bash
    make db-reset
    ```

---

> [!TIP]
> **Hỗ trợ thêm từ Onboarding Mentor:** Nếu bạn gặp bất kỳ trở ngại nào khác ngoài các mục liệt kê trên, hãy kiểm tra endpoint `http://localhost:3000/api/status` trước tiên để xem chẩn đoán trực tiếp về môi trường và dữ liệu của ứng dụng. Chúc bạn có trải nghiệm lập trình hiệu quả cùng Gia Đình Xanh!
