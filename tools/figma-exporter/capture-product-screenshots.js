/**
 * ==============================================================================
 * GIA ĐÌNH XANH — CHỤP ẢNH GIAO DIỆN CHUẨN PRODUCT (RETINA 2X)
 * ==============================================================================
 * Chạy ứng dụng ở chế độ Product/User Flow thực tế (ẩn toàn bộ thanh công cụ dev,
 * nhãn debug, schema SQL), chụp ảnh độ nét cao (2x DPI) của tất cả các màn hình
 * và lưu gọn gàng vào thư mục:
 * "anh-giao-dien-du-an" tại thư mục gốc của dự án.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const SCREENS = [
  // PHÂN HỆ 0: XÁC THỰC & ONBOARDING (5 màn hình)
  { num: '01', id: '0.1', portal: 0, portalName: 'Xác thực', name: '01_0.1_Dang_Nhap_Dang_Ky', title: '0.1. Đăng nhập / Đăng ký / Khôi phục mật khẩu', type: 'page' },
  { num: '02', id: '0.2', portal: 0, portalName: 'Xác thực', name: '02_0.2_Thiet_Lap_Ho_So_Khach_Hang', title: '0.2. Thiết lập hồ sơ Khách hàng (Customer Onboarding)', type: 'page' },
  { num: '03', id: '0.3', portal: 0, portalName: 'Xác thực', name: '03_0.3_Dang_Ky_Hanh_Nghe_Tho', title: '0.3. Đăng ký hành nghề Thợ (Provider Onboarding)', type: 'page' },
  { num: '04', id: '0.4', portal: 0, portalName: 'Xác thực', name: '04_0.4_Trang_Thai_Ho_So_Tho', title: '0.4. Trạng thái Hồ sơ Thợ (Chờ duyệt / Bị từ chối)', type: 'page' },
  { num: '05', id: '0.5', portal: 0, portalName: 'Xác thực', name: '05_0.5_Thong_Bao_Tai_Khoan_Bi_Khoa', title: '0.5. Thông báo Tài khoản bị khóa (Account Suspended)', type: 'page' },

  // PHÂN HỆ 1: KHÁCH HÀNG (11 màn hình)
  { num: '06', id: '1.1', portal: 1, portalName: 'Khách hàng', name: '06_1.1_Trang_Chu_Kham_Pha_Dich_Vu', title: '1.1. Trang chủ & Khám phá dịch vụ', type: 'page' },
  { num: '07', id: '1.2', portal: 1, portalName: 'Khách hàng', name: '07_1.2_Cau_Hinh_Dat_Lich_Booking_Wizard', title: '1.2. Cấu hình dịch vụ trước khi đặt (Booking Wizard)', type: 'page' },
  { num: '08', id: '1.3', portal: 1, portalName: 'Khách hàng', name: '08_1.3_Theo_Doi_Don_Hang_Live_Tracking', title: '1.3. Theo dõi đơn hàng trực tiếp (Live Tracking)', type: 'page' },
  { num: '09', id: '1.4', portal: 1, portalName: 'Khách hàng', name: '09_1.4_Quan_Ly_Lich_Hen_Dich_Vu', title: '1.4. Quản lý lịch hẹn dịch vụ', type: 'page' },
  { num: '10', id: '1.5', portal: 1, portalName: 'Khách hàng', name: '10_1.5_Ho_So_Ca_Nhan_Va_So_Dia_Chi', title: '1.5. Hồ sơ cá nhân & Sổ địa chỉ', type: 'page' },
  { num: '11', id: '1.6', portal: 1, portalName: 'Khách hàng', name: '11_1.6_Danh_Sach_Dich_Vu_Yeu_Thich', title: '1.6. Danh sách Dịch vụ yêu thích', type: 'page' },
  { num: '12', id: '1.7', portal: 1, portalName: 'Khách hàng', name: '12_1.7_Ho_So_Cong_Khai_Cua_Tho', title: '1.7. Hồ sơ công khai của Thợ (Drawer)', type: 'drawer' },
  { num: '13', id: '1.8', portal: 1, portalName: 'Khách hàng', name: '13_1.8_Cong_Thanh_Toan_VietQR', title: '1.8. Cổng Thanh toán QR Chuyển khoản (VietQR)', type: 'page' },
  { num: '14', id: '1.9', portal: 1, portalName: 'Khách hàng', name: '14_1.9_Danh_Gia_Va_Cham_Diem_Tho', title: '1.9. Đánh giá & Chấm điểm Thợ (Modal)', type: 'modal' },
  { num: '15', id: '1.10', portal: 1, portalName: 'Khách hàng', name: '15_1.10_Xac_Nhan_Huy_Lich_Hen', title: '1.10. Xác nhận Hủy lịch hẹn (Modal)', type: 'modal' },
  { num: '16', id: '1.11', portal: 1, portalName: 'Khách hàng', name: '16_1.11_Trung_Tam_Ho_Tro_Khach_Hang', title: '1.11. Trung tâm Hỗ trợ & Khiếu nại (Drawer)', type: 'drawer' },

  // PHÂN HỆ 2: ĐỐI TÁC THỢ (8 màn hình)
  { num: '17', id: '2.1', portal: 2, portalName: 'Đối tác Thợ', name: '17_2.1_San_Nhan_Viec_Lam_Job_Board', title: '2.1. Sàn nhận việc làm (Job Board)', type: 'page' },
  { num: '18', id: '2.2', portal: 2, portalName: 'Đối tác Thợ', name: '18_2.2_Ca_Lam_Viec_Hien_Tai_Live_Timer', title: '2.2. Ca làm việc hiện tại (Live Timer)', type: 'page' },
  { num: '19', id: '2.3', portal: 2, portalName: 'Đối tác Thợ', name: '19_2.3_Vi_Thu_Nhap_Va_Lich_Ca', title: '2.3. Ví Thu Nhập & Lịch Ca', type: 'page' },
  { num: '20', id: '2.4', portal: 2, portalName: 'Đối tác Thợ', name: '20_2.4_Cau_Hinh_Nang_Luc_Va_Khu_Vuc', title: '2.4. Cấu hình Năng lực & Khu vực hoạt động', type: 'page' },
  { num: '21', id: '2.6', portal: 2, portalName: 'Đối tác Thợ', name: '21_2.6_Thiet_Lap_Lich_Co_Dinh_Xin_Nghi', title: '2.6. Thiết lập Lịch cố định & Xin nghỉ phép (Modal)', type: 'modal' },
  { num: '22', id: '2.7', portal: 2, portalName: 'Đối tác Thợ', name: '22_2.7_Ke_Khai_Chi_Phi_Vat_Tu_Phat_Sinh', title: '2.7. Kê khai Chi phí vật tư phát sinh (Modal)', type: 'modal' },
  { num: '23', id: '2.8', portal: 2, portalName: 'Đối tác Thợ', name: '23_2.8_Tu_Choi_Don_Va_Huy_Ca', title: '2.8. Từ chối đơn & Hủy ca làm việc (Modal)', type: 'modal' },
  { num: '24', id: '2.9', portal: 2, portalName: 'Đối tác Thợ', name: '24_2.9_Bao_Cao_Su_Co_Doi_Tac', title: '2.9. Báo cáo Sự cố Đối tác (Drawer)', type: 'drawer' },

  // PHÂN HỆ 3: QUẢN TRỊ ADMIN (9 màn hình)
  { num: '25', id: '3.1', portal: 3, portalName: 'Quản trị Admin', name: '25_3.1_Admin_Dashboard_Tong_Quan', title: '3.1. Dashboard Tổng quan & Điều phối', type: 'page' },
  { num: '26', id: '3.2', portal: 3, portalName: 'Quản trị Admin', name: '26_3.2_Admin_Quan_Ly_Danh_Muc_Bieu_Gia', title: '3.2. Quản lý Danh mục & Cấu hình Biểu giá', type: 'page' },
  { num: '27', id: '3.3', portal: 3, portalName: 'Quản trị Admin', name: '27_3.3_Admin_Xet_Duyet_Ho_So_Tho_KYC', title: '3.3. Xét duyệt Hồ sơ Đối tác (KYC)', type: 'page' },
  { num: '28', id: '3.4', portal: 3, portalName: 'Quản trị Admin', name: '28_3.4_Admin_Quan_Ly_Nguoi_Dung_Khieu_Nai', title: '3.4. Quản lý Người dùng & Giải quyết Khiếu nại', type: 'page' },
  { num: '29', id: '3.5', portal: 3, portalName: 'Quản trị Admin', name: '29_3.5_Admin_Chi_Tiet_Don_Hang_Kiem_Toan', title: '3.5. Tra cứu Chi tiết Đơn & Kiểm toán (Drawer)', type: 'drawer' },
  { num: '30', id: '3.6', portal: 3, portalName: 'Quản trị Admin', name: '30_3.6_Admin_Them_Danh_Muc_Moi', title: '3.6. Thêm Danh mục Dịch vụ mới (Modal)', type: 'modal' },
  { num: '31', id: '3.7', portal: 3, portalName: 'Quản trị Admin', name: '31_3.7_Admin_Them_Sua_Dich_Vu', title: '3.7. Thêm & Chỉnh sửa Dịch vụ (Modal)', type: 'modal' },
  { num: '32', id: '3.8', portal: 3, portalName: 'Quản trị Admin', name: '32_3.8_Admin_Chi_Tiet_Tho_Xet_Duyet', title: '3.8. Chi tiết Đối tác Thợ & Xét duyệt (Modal)', type: 'modal' },
  { num: '33', id: '3.9', portal: 3, portalName: 'Quản trị Admin', name: '33_3.9_Admin_Xu_Ly_Phieu_Ho_Tro', title: '3.9. Xử lý & Cập nhật Phiếu hỗ trợ (Drawer)', type: 'drawer' },

  // GIAO DIỆN PHỤ TRỢ (2 màn hình)
  { num: '34', id: 'CATALOG', portal: 1, portalName: 'Dùng chung', name: '34_Bieu_Gia_Niem_Yet_Dich_Vu', title: 'Biểu giá niêm yết Dịch vụ Gia Đình Xanh', type: 'modal' },
  { num: '35', id: 'SUPABASE_STATUS', portal: 3, portalName: 'Dùng chung', name: '35_Trang_Thai_Backend_Supabase', title: 'Bảng trạng thái kết nối Backend & Database', type: 'modal' }
];

function findBrowser() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Không tìm thấy trình duyệt Edge hoặc Chrome trên máy.');
}

function ping(url) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = http.get({
      hostname: u.hostname,
      port: u.port || 80,
      path: '/',
      timeout: 1000
    }, (res) => resolve(res.statusCode >= 200 && res.statusCode < 500));
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function ensureServer(baseUrl) {
  if (await ping(baseUrl)) return null;
  console.log(`[Server] Khởi động máy chủ Node.js cục bộ...`);
  const serverPath = path.resolve(__dirname, '../../server.js');
  const proc = spawn('node', [serverPath], { stdio: 'ignore', detached: false });
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 300));
    if (await ping(baseUrl)) {
      console.log(`[Server] Máy chủ đã sẵn sàng tại ${baseUrl}`);
      return proc;
    }
  }
  throw new Error(`Không thể khởi động server tại ${baseUrl}`);
}

async function main() {
  const BASE_URL = 'http://localhost:3000';
  const PROJECT_ROOT = path.resolve(__dirname, '../../');
  const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, 'anh-giao-dien-du-an');

  console.log('='.repeat(70));
  console.log('📸 GIA ĐÌNH XANH — CHỤP ẢNH TOÀN BỘ DỰ ÁN (PRODUCT FLOW)');
  console.log(`📂 Thư mục lưu ảnh: ${SCREENSHOTS_DIR}`);
  console.log('='.repeat(70));

  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  let serverProc = null;
  let browser = null;

  try {
    serverProc = await ensureServer(BASE_URL);

    const execPath = findBrowser();
    console.log(`[Browser] Khởi động trình duyệt: ${execPath}`);

    browser = await puppeteer.launch({
      executablePath: execPath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();

    // Thiết lập độ phân giải Retina sắc nét (2x DPI)
    await page.setViewport({
      width: 1440,
      height: 900,
      deviceScaleFactor: 2 // Chuẩn Retina siêu nét
    });

    // Mở trang ở chế độ mode=user (Chế độ Người dùng Product)
    console.log(`[Browser] Tải ứng dụng ở Chế độ Người dùng (Product Flow)...`);
    await page.goto(`${BASE_URL}?mode=user`, { waitUntil: 'networkidle0', timeout: 30000 });

    // Đảm bảo ẩn triệt để các badge dev và toast
    await page.evaluate(() => {
      if (window.GDXApp && typeof window.GDXApp.setViewMode === 'function') {
        window.GDXApp.setViewMode('user', true);
      }
      // Ẩn thanh toast banner để ảnh chụp sạch sẽ
      const toast = document.getElementById('toastBanner');
      if (toast) toast.style.display = 'none';
    });

    const capturedList = [];

    for (let i = 0; i < SCREENS.length; i++) {
      const s = SCREENS[i];
      const filename = `${s.name}.png`;
      const savePath = path.join(SCREENSHOTS_DIR, filename);

      process.stdout.write(`[${i + 1}/${SCREENS.length}] Đang chụp: ${s.title}... `);

      // Điều hướng màn hình
      await page.evaluate(async (screen) => {
        if (window.GDXApp && typeof window.GDXApp.closeModal === 'function') {
          window.GDXApp.closeModal();
        }

        if (screen.type === 'page') {
          window.GDXApp.go(screen.id);
        } else if (screen.type === 'modal' || screen.type === 'drawer') {
          window.GDXApp.switchPortal(screen.portal);
          window.GDXApp.openModal(screen.id);
        }

        // Ẩn toast nếu có
        const toast = document.getElementById('toastBanner');
        if (toast) toast.style.display = 'none';
      }, s);

      // Chờ animation hoàn tất và render ổn định
      await new Promise(r => setTimeout(r, 500));

      // Chụp ảnh: Full page cho trang dài, viewport cho modal
      await page.screenshot({
        path: savePath,
        fullPage: s.type === 'page'
      });

      console.log(`✅ Đã lưu (${filename})`);

      capturedList.push({
        ...s,
        filename
      });
    }

    // Tạo trang HTML Gallery trực quan trong thư mục lưu ảnh
    generateGalleryHtml(SCREENSHOTS_DIR, capturedList);

    console.log('\n' + '='.repeat(70));
    console.log(`🎉 HOÀN TẤT! Đã chụp thành công ${capturedList.length} ảnh giao diện.`);
    console.log(`📁 Đường dẫn thư mục: ${SCREENSHOTS_DIR}`);
    console.log(`🌐 Xem nhanh thư viện ảnh: file://${path.join(SCREENSHOTS_DIR, 'index.html').replace(/\\/g, '/')}`);
    console.log('='.repeat(70));

  } catch (err) {
    console.error('❌ Lỗi khi chụp ảnh:', err);
  } finally {
    if (browser) await browser.close();
    if (serverProc) serverProc.kill();
  }
}

function generateGalleryHtml(dir, items) {
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Bộ Sưu Tập Giao Diện Dự Án Gia Đình Xanh (35 Màn Hình)</title>
  <style>
    :root {
      --bg: #F4F6F8;
      --card: #FFFFFF;
      --primary: #1B4332;
      --accent: #E07A5F;
      --text: #1F2937;
      --muted: #6B7280;
      --border: #E5E7EB;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 32px 24px;
    }
    .header {
      max-width: 1400px;
      margin: 0 auto 32px;
      background: var(--card);
      padding: 24px 32px;
      border-radius: 12px;
      border: 1px solid var(--border);
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }
    h1 {
      margin: 0 0 8px 0;
      font-size: 24px;
      color: var(--primary);
    }
    p {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
    }
    .grid {
      max-width: 1400px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 24px;
    }
    .item {
      background: var(--card);
      border-radius: 12px;
      border: 1px solid var(--border);
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex;
      flex-direction: column;
    }
    .item:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px rgba(0,0,0,0.08);
    }
    .preview-box {
      width: 100%;
      height: 230px;
      overflow: hidden;
      background: #E5E7EB;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: flex-start;
    }
    .preview-box img {
      width: 100%;
      height: auto;
      display: block;
      transition: transform 0.3s;
    }
    .item:hover .preview-box img {
      transform: scale(1.02);
    }
    .info {
      padding: 16px;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .meta {
      font-size: 12px;
      font-weight: 700;
      color: var(--accent);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .title {
      font-size: 15px;
      font-weight: 600;
      line-height: 1.4;
      margin: 0 0 12px 0;
    }
    .btn-view {
      margin-top: auto;
      display: inline-block;
      text-align: center;
      padding: 8px 14px;
      background: var(--primary);
      color: #FFF;
      text-decoration: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
    }
    .btn-view:hover {
      background: #143527;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Bộ Sưu Tập Giao Diện Dự Án Gia Đình Xanh</h1>
    <p>Chế độ Product/User Flow thực tế · Độ phân giải Retina 2x sắc nét · Tổng cộng ${items.length} màn hình &amp; modal</p>
  </div>
  <div class="grid">
    ${items.map(it => `
      <div class="item">
        <a href="${it.filename}" target="_blank" class="preview-box">
          <img src="${it.filename}" alt="${it.title}" loading="lazy">
        </a>
        <div class="info">
          <div class="meta">${it.portalName} · Màn hình ${it.id} (${it.type})</div>
          <div class="title">${it.title}</div>
          <a href="${it.filename}" target="_blank" class="btn-view">🔍 Xem ảnh gốc (Retina 2x)</a>
        </div>
      </div>
    `).join('')}
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

main();
