/**
 * ==============================================================================
 * GIA ĐÌNH XANH — TỰ ĐỘNG HÓA XUẤT 34 MÀN HÌNH SANG FIGMA & PENPOT
 * ==============================================================================
 * Công cụ sử dụng Puppeteer Headless (Edge/Chrome) kết hợp với thuật toán
 * @builder.io/html-to-figma để quét toàn bộ DOM, Styles, Flexbox, Typography
 * và đóng gói thành:
 * 1. figma-project-all-screens.json: Bundle toàn bộ 34 màn hình được xếp lưới (Grid)
 *    theo từng Phân hệ, sẵn sàng nạp vào Figma chỉ với 1 cú click.
 * 2. output/screens/*.json: Từng file JSON riêng lẻ cho từng màn hình.
 * 3. output/screenshots/*.png: Ảnh chụp màn hình chất lượng cao (Full-Page).
 * 4. output/index.html: Trang trực quan để tra cứu và xuất dữ liệu.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

// Danh sách 34 màn hình chuẩn xác theo tài liệu đặc tả kiến trúc UI
const SCREENS = [
  // PHÂN HỆ 0: XÁC THỰC & ONBOARDING (5 màn hình)
  { id: '0.1', portal: 0, portalName: 'Phân hệ 0 · Xác thực', title: '0.1. Đăng nhập - Đăng ký - Khôi phục mật khẩu', type: 'page' },
  { id: '0.2', portal: 0, portalName: 'Phân hệ 0 · Xác thực', title: '0.2. Thiết lập hồ sơ Khách hàng (Customer Onboarding)', type: 'page' },
  { id: '0.3', portal: 0, portalName: 'Phân hệ 0 · Xác thực', title: '0.3. Đăng ký hành nghề Thợ (Provider Onboarding)', type: 'page' },
  { id: '0.4', portal: 0, portalName: 'Phân hệ 0 · Xác thực', title: '0.4. Trạng thái Hồ sơ Thợ (Chờ duyệt - Bị từ chối)', type: 'page' },
  { id: '0.5', portal: 0, portalName: 'Phân hệ 0 · Xác thực', title: '0.5. Thông báo Tài khoản bị khóa (Account Suspended)', type: 'page' },

  // PHÂN HỆ 1: KHÁCH HÀNG (11 màn hình)
  { id: '1.1', portal: 1, portalName: 'Phân hệ 1 · Khách hàng', title: '1.1. Trang chủ & Khám phá dịch vụ', type: 'page' },
  { id: '1.2', portal: 1, portalName: 'Phân hệ 1 · Khách hàng', title: '1.2. Cấu hình dịch vụ trước khi đặt (Booking Wizard)', type: 'page' },
  { id: '1.3', portal: 1, portalName: 'Phân hệ 1 · Khách hàng', title: '1.3. Theo dõi đơn hàng trực tiếp (Live Tracking)', type: 'page' },
  { id: '1.4', portal: 1, portalName: 'Phân hệ 1 · Khách hàng', title: '1.4. Quản lý lịch hẹn dịch vụ', type: 'page' },
  { id: '1.5', portal: 1, portalName: 'Phân hệ 1 · Khách hàng', title: '1.5. Hồ sơ cá nhân & Sổ địa chỉ', type: 'page' },
  { id: '1.6', portal: 1, portalName: 'Phân hệ 1 · Khách hàng', title: '1.6. Danh sách Dịch vụ yêu thích', type: 'page' },
  { id: '1.7', portal: 1, portalName: 'Phân hệ 1 · Khách hàng', title: '1.7. Hồ sơ công khai của Thợ (Drawer)', type: 'drawer' },
  { id: '1.8', portal: 1, portalName: 'Phân hệ 1 · Khách hàng', title: '1.8. Cổng Thanh toán QR Chuyển khoản (VietQR)', type: 'page' },
  { id: '1.9', portal: 1, portalName: 'Phân hệ 1 · Khách hàng', title: '1.9. Đánh giá & Chấm điểm Thợ (Modal)', type: 'modal' },
  { id: '1.10', portal: 1, portalName: 'Phân hệ 1 · Khách hàng', title: '1.10. Xác nhận Hủy lịch hẹn (Modal)', type: 'modal' },
  { id: '1.11', portal: 1, portalName: 'Phân hệ 1 · Khách hàng', title: '1.11. Trung tâm Hỗ trợ & Khiếu nại (Drawer)', type: 'drawer' },

  // PHÂN HỆ 2: ĐỐI TÁC THỢ (9 màn hình)
  { id: '2.1', portal: 2, portalName: 'Phân hệ 2 · Thợ', title: '2.1. Sàn nhận việc làm (Job Board)', type: 'page' },
  { id: '2.2', portal: 2, portalName: 'Phân hệ 2 · Thợ', title: '2.2. Ca làm việc hiện tại (Live Timer)', type: 'page' },
  { id: '2.3', portal: 2, portalName: 'Phân hệ 2 · Thợ', title: '2.3. Ví Thu Nhập & Lịch Ca', type: 'page' },
  { id: '2.4', portal: 2, portalName: 'Phân hệ 2 · Thợ', title: '2.4. Cấu hình Năng lực & Khu vực hoạt động', type: 'page' },
  { id: '2.6', portal: 2, portalName: 'Phân hệ 2 · Thợ', title: '2.6. Thiết lập Lịch cố định & Nghỉ phép (Modal)', type: 'modal' },
  { id: '2.7', portal: 2, portalName: 'Phân hệ 2 · Thợ', title: '2.7. Kê khai Chi phí vật tư phát sinh (Modal)', type: 'modal' },
  { id: '2.8', portal: 2, portalName: 'Phân hệ 2 · Thợ', title: '2.8. Từ chối đơn & Hủy ca làm việc (Modal)', type: 'modal' },
  { id: '2.9', portal: 2, portalName: 'Phân hệ 2 · Thợ', title: '2.9. Báo cáo Sự cố Đối tác (Drawer)', type: 'drawer' },

  // PHÂN HỆ 3: QUẢN TRỊ ADMIN (9 màn hình)
  { id: '3.1', portal: 3, portalName: 'Phân hệ 3 · Admin', title: '3.1. Dashboard Tổng quan & Điều phối', type: 'page' },
  { id: '3.2', portal: 3, portalName: 'Phân hệ 3 · Admin', title: '3.2. Quản lý Danh mục & Cấu hình Biểu giá', type: 'page' },
  { id: '3.3', portal: 3, portalName: 'Phân hệ 3 · Admin', title: '3.3. Xét duyệt Hồ sơ Đối tác (KYC)', type: 'page' },
  { id: '3.4', portal: 3, portalName: 'Phân hệ 3 · Admin', title: '3.4. Quản lý Người dùng & Giải quyết Khiếu nại', type: 'page' },
  { id: '3.5', portal: 3, portalName: 'Phân hệ 3 · Admin', title: '3.5. Tra cứu Chi tiết Đơn & Kiểm toán (Drawer)', type: 'drawer' },
  { id: '3.6', portal: 3, portalName: 'Phân hệ 3 · Admin', title: '3.6. Thêm Danh mục Dịch vụ mới (Modal)', type: 'modal' },
  { id: '3.7', portal: 3, portalName: 'Phân hệ 3 · Admin', title: '3.7. Thêm & Chỉnh sửa Dịch vụ (Modal)', type: 'modal' },
  { id: '3.8', portal: 3, portalName: 'Phân hệ 3 · Admin', title: '3.8. Chi tiết Đối tác Thợ & Xét duyệt (Modal)', type: 'modal' },
  { id: '3.9', portal: 3, portalName: 'Phân hệ 3 · Admin', title: '3.9. Xử lý & Cập nhật Phiếu hỗ trợ (Drawer)', type: 'drawer' }
];

// Tìm trình duyệt Microsoft Edge hoặc Google Chrome có sẵn trên Windows
function findBrowserExecutable() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Microsoft\\Edge SxS\\Application\\msedge.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Không tìm thấy trình duyệt Edge hoặc Chrome. Vui lòng đặt biến môi trường PUPPETEER_EXECUTABLE_PATH.');
}

// Kiểm tra máy chủ có đang phản hồi không
function pingServer(url) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = http.get({
      hostname: u.hostname,
      port: u.port || 80,
      path: '/',
      timeout: 1000
    }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// Tự động khởi động máy chủ Node.js nếu chưa bật
async function ensureServer(baseUrl) {
  const isUp = await pingServer(baseUrl);
  if (isUp) {
    console.log(`[Server] Máy chủ đang hoạt động tại ${baseUrl}`);
    return null;
  }

  console.log(`[Server] Chưa thấy máy chủ chạy tại ${baseUrl}. Đang tự động khởi động server.js...`);
  const serverScript = path.resolve(__dirname, '../../server.js');
  const serverProc = spawn('node', [serverScript], {
    stdio: 'ignore',
    detached: false
  });

  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 300));
    if (await pingServer(baseUrl)) {
      console.log(`[Server] Máy chủ đã sẵn sàng tại ${baseUrl}!`);
      return serverProc;
    }
  }

  throw new Error(`Không thể khởi động máy chủ tại ${baseUrl}. Vui lòng chạy "node server.js" trước.`);
}

// Phân tích tham số dòng lệnh
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: 'http://localhost:3000',
    viewport: 'desktop', // 'desktop' (1440x900) hoặc 'mobile' (390x844)
    screenshotsOnly: false,
    filterPortal: null,
    filterScreens: null
  };

  for (const arg of args) {
    if (arg.startsWith('--url=')) options.url = arg.split('=')[1];
    if (arg.startsWith('--viewport=')) options.viewport = arg.split('=')[1];
    if (arg.startsWith('--portal=')) options.filterPortal = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--screens=')) options.filterScreens = arg.split('=')[1].split(',');
    if (arg === '--screenshots-only') options.screenshotsOnly = true;
  }
  return options;
}

async function main() {
  const opts = parseArgs();
  console.log('='.repeat(70));
  console.log('🚀 GIA ĐÌNH XANH — FIGMA EXPORTER BATCH RUNNER');
  console.log(`URL: ${opts.url} | Viewport: ${opts.viewport}`);
  if (opts.filterPortal !== null) console.log(`Lọc Phân hệ: ${opts.filterPortal}`);
  if (opts.filterScreens) console.log(`Lọc Màn hình: ${opts.filterScreens.join(', ')}`);
  console.log('='.repeat(70));

  let serverProc = null;
  let browser = null;

  try {
    serverProc = await ensureServer(opts.url);

    const execPath = findBrowserExecutable();
    console.log(`[Browser] Sử dụng trình duyệt: ${execPath}`);

    browser = await puppeteer.launch({
      executablePath: execPath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });

    const page = await browser.newPage();
    const vpConfig = opts.viewport === 'mobile'
      ? { width: 390, height: 844, isMobile: true }
      : { width: 1440, height: 900, isMobile: false };

    await page.setViewport(vpConfig);

    console.log(`[Browser] Đang tải ứng dụng ${opts.url} ...`);
    await page.goto(opts.url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Inject file thư viện @builder.io/html-to-figma vào browser
    const htmlToFigmaPath = path.join(__dirname, 'node_modules/@builder.io/html-to-figma/dist/browser.js');
    const browserCode = fs.readFileSync(htmlToFigmaPath, 'utf8');
    await page.evaluate((code) => {
      window.eval(code + '\nwindow.htmlToFigmaFn = (typeof htmlToFigma === "function" ? htmlToFigma : htmlToFigma.htmlToFigma);');
    }, browserCode);

    // Chuẩn bị thư mục đầu ra
    const outDir = path.join(__dirname, 'output');
    const screensDir = path.join(outDir, 'screens');
    const screenshotsDir = path.join(outDir, 'screenshots');
    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(screensDir, { recursive: true });
    fs.mkdirSync(screenshotsDir, { recursive: true });

    // Lọc danh sách màn hình cần xuất
    let targetScreens = SCREENS;
    if (opts.filterPortal !== null) {
      targetScreens = targetScreens.filter(s => s.portal === opts.filterPortal);
    }
    if (opts.filterScreens && opts.filterScreens.length > 0) {
      targetScreens = targetScreens.filter(s => opts.filterScreens.includes(s.id));
    }

    console.log(`[Export] Bắt đầu xử lý ${targetScreens.length} màn hình...\n`);

    const allMasterFrames = [];
    const exportedMetaList = [];

    // Tính toán bố cục lưới Grid trong Figma:
    // Mỗi Portal là 1 hàng (Row). Các màn hình xếp ngang cạnh nhau cách nhau 250px.
    const GRID_GAP_X = 250;
    const GRID_GAP_Y = 600;
    const SCREEN_WIDTH = vpConfig.width;
    const SCREEN_HEIGHT = 1200; // Chiều cao ước tính của row

    const portalCounters = { 0: 0, 1: 0, 2: 0, 3: 0 };

    for (let i = 0; i < targetScreens.length; i++) {
      const screen = targetScreens[i];
      const seq = i + 1;
      const progress = `[${seq}/${targetScreens.length}]`;
      console.log(`${progress} Đang quét: [${screen.id}] ${screen.title} (${screen.type})...`);

      // 1. Chuyển đổi màn hình trong ứng dụng Single Page App
      await page.evaluate(async (s) => {
        // Đóng modal cũ nếu còn mở
        if (window.GDXApp && typeof window.GDXApp.closeModal === 'function') {
          window.GDXApp.closeModal();
        }

        if (s.type === 'page') {
          window.GDXApp.go(s.id);
        } else if (s.type === 'modal' || s.type === 'drawer') {
          // Đối với modal, mở portal liên quan trước rồi mở modal
          window.GDXApp.switchPortal(s.portal);
          window.GDXApp.openModal(s.id);
        }
      }, screen);

      // Chờ giao diện render và tải hình ảnh
      await new Promise(r => setTimeout(r, 450));

      // 2. Chụp ảnh màn hình độ phân giải cao
      const screenshotFilename = `screen-${screen.id.replace('.', '_')}.png`;
      const screenshotPath = path.join(screenshotsDir, screenshotFilename);
      await page.screenshot({
        path: screenshotPath,
        fullPage: screen.type === 'page'
      });

      let screenLayers = null;

      // 3. Trích xuất DOM sang Figma Layers
      if (!opts.screenshotsOnly) {
        screenLayers = await page.evaluate(async (s) => {
          const targetSelector = (s.type === 'modal' || s.type === 'drawer') ? '#appModal' : '#appRoot';
          const el = document.querySelector(targetSelector) || document.body;
          if (!window.htmlToFigmaFn) return null;
          return window.htmlToFigmaFn(el, true);
        }, screen);

        if (screenLayers && screenLayers.length > 0) {
          // Tìm root frame
          const rootFrame = screenLayers[0];
          
          // Đặt tên đẹp cho Frame trong Figma
          rootFrame.name = `[${screen.portalName}] ${screen.id} - ${screen.title}`;

          // Tọa độ trên Figma Canvas (Sắp xếp dạng Grid theo Portal)
          const colIndex = portalCounters[screen.portal] || 0;
          const rowIndex = screen.portal;

          const posX = colIndex * (SCREEN_WIDTH + GRID_GAP_X);
          const posY = rowIndex * (SCREEN_HEIGHT + GRID_GAP_Y);

          rootFrame.x = posX;
          rootFrame.y = posY;

          portalCounters[screen.portal] = colIndex + 1;

          // Lưu file lẻ cho từng màn hình
          const singleJsonPath = path.join(screensDir, `${screen.id}.json`);
          fs.writeFileSync(singleJsonPath, JSON.stringify({ layers: screenLayers }, null, 2));

          // Đưa vào master bundle
          allMasterFrames.push(rootFrame);
        }
      }

      exportedMetaList.push({
        ...screen,
        screenshot: `screenshots/${screenshotFilename}`,
        jsonFile: `screens/${screen.id}.json`,
        layersCount: screenLayers ? screenLayers.length : 0
      });
    }

    // 4. Lưu Master Bundle JSON (Hỗ trợ cả .json và chuẩn .builder.json)
    const bundleData = {
      version: '1.0',
      projectName: 'Gia Đình Xanh UI - 34 Screens Design System',
      exportedAt: new Date().toISOString(),
      viewport: vpConfig,
      layers: allMasterFrames,
      data: {
        layers: allMasterFrames
      }
    };

    const masterBundlePath = path.join(outDir, 'figma-project-all-screens.json');
    const builderJsonPath = path.join(outDir, 'project.builder.json');
    const pageBuilderJsonPath = path.join(outDir, 'page.builder.json');

    const jsonStr = JSON.stringify(bundleData, null, 2);
    fs.writeFileSync(masterBundlePath, jsonStr);
    fs.writeFileSync(builderJsonPath, jsonStr);
    fs.writeFileSync(pageBuilderJsonPath, jsonStr);

    // 5. Tạo trang HTML Catalog để xem và copy dữ liệu trực quan
    generateCatalogHtml(outDir, exportedMetaList, opts);

    console.log('\n' + '='.repeat(70));
    console.log('🎉 XUẤT TOÀN BỘ DỰ ÁN SANG FIGMA THÀNH CÔNG!');
    console.log(`📁 Thư mục kết quả: ${outDir}`);
    console.log(`⭐ Master File Figma: ${masterBundlePath}`);
    console.log(`🖼️ Ảnh chụp màn hình: ${screenshotsDir}`);
    console.log(`🌐 Trang Catalog: file://${path.join(outDir, 'index.html').replace(/\\/g, '/')}`);
    console.log('='.repeat(70));

  } catch (err) {
    console.error('\n❌ Có lỗi xảy ra trong quá trình xuất Figma:', err);
  } finally {
    if (browser) await browser.close();
    if (serverProc) {
      console.log('[Server] Đang tắt máy chủ...');
      serverProc.kill();
    }
  }
}

// Tạo trang HTML trực quan để quản lý các màn hình và tải JSON
function generateCatalogHtml(outDir, metaList, opts) {
  const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Gia Đình Xanh — Figma & Penpot Design System Catalog</title>
  <style>
    :root {
      --bg: #F8F9FA;
      --card-bg: #FFFFFF;
      --text: #1F2937;
      --primary: #1B4332;
      --accent: #E07A5F;
      --border: #E5E7EB;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 32px;
      background: var(--bg);
      color: var(--text);
    }
    .header {
      max-width: 1400px;
      margin: 0 auto 32px;
      background: var(--card-bg);
      padding: 24px 32px;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 {
      margin: 0 0 8px 0;
      font-size: 24px;
      color: var(--primary);
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      background: #E8F5E9;
      color: #2E7D32;
    }
    .actions {
      display: flex;
      gap: 12px;
    }
    .btn {
      padding: 10px 18px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--border);
      background: #FFF;
      color: var(--text);
    }
    .btn-primary {
      background: var(--primary);
      color: #FFF;
      border-color: var(--primary);
    }
    .grid {
      max-width: 1400px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
    }
    .card {
      background: var(--card-bg);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--border);
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex;
      flex-direction: column;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.06);
    }
    .card-img-wrapper {
      width: 100%;
      height: 200px;
      background: #F3F4F6;
      overflow: hidden;
      display: flex;
      align-items: flex-start;
      border-bottom: 1px solid var(--border);
    }
    .card-img-wrapper img {
      width: 100%;
      height: auto;
      object-fit: cover;
    }
    .card-body {
      padding: 16px;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .card-id {
      font-size: 12px;
      font-weight: 700;
      color: var(--accent);
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .card-title {
      font-size: 15px;
      font-weight: 600;
      margin: 0 0 12px 0;
      line-height: 1.4;
    }
    .card-footer {
      margin-top: auto;
      display: flex;
      gap: 8px;
    }
    .btn-sm {
      padding: 6px 12px;
      font-size: 13px;
      flex: 1;
      text-align: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Gia Đình Xanh — UI Design Catalog</h1>
      <p style="margin:0; color:#6B7280; font-size:14px;">
        Đã xuất tự động <strong>${metaList.length} màn hình</strong> sang định dạng Figma Layers và ảnh Full-Page.
      </p>
    </div>
    <div class="actions">
      <a href="figma-project-all-screens.json" download class="btn btn-primary">
        📥 Tải File Figma Master Bundle (.json)
      </a>
    </div>
  </div>

  <div class="grid">
    ${metaList.map(item => `
      <div class="card">
        <div class="card-img-wrapper">
          <img src="${item.screenshot}" alt="${item.title}" loading="lazy">
        </div>
        <div class="card-body">
          <div class="card-id">${item.portalName} · ${item.id} (${item.type})</div>
          <h3 class="card-title">${item.title}</h3>
          <div class="card-footer">
            <a href="${item.screenshot}" target="_blank" class="btn btn-sm">Xem ảnh</a>
            <a href="${item.jsonFile}" download class="btn btn-sm btn-primary">Tải Figma JSON</a>
          </div>
        </div>
      </div>
    `).join('')}
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(outDir, 'index.html'), htmlContent);
}

main();
