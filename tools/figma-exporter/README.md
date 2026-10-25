# 🎨 Gia Đình Xanh — Công cụ tự động xuất toàn bộ 34 màn hình sang Figma & Penpot

Thư mục này chứa giải pháp tự động hóa bằng Node.js kết hợp Puppeteer Headless (Edge/Chrome) và thuật toán `@builder.io/html-to-figma`. Công cụ này cho phép bạn xuất **toàn bộ 34 màn hình & modal của dự án một lần duy nhất**, sắp xếp gọn gàng theo lưới (Grid) trên Figma Canvas mà không cần phải chụp hay nhập thủ công từng trang.

---

## 🚀 1. Cách chạy công cụ (1 Lệnh duy nhất)

Mở terminal tại thư mục này (`tools/figma-exporter`) và chạy:

```bash
# Xuất toàn bộ 34 màn hình của dự án
npm run export
```

Script sẽ tự động:
1. Nhận diện máy chủ `server.js` (nếu chưa chạy, script sẽ tự khởi động ngầm).
2. Tự động tìm trình duyệt Microsoft Edge hoặc Google Chrome có sẵn trên máy Windows.
3. Lần lượt chuyển qua từng màn hình (từ Phân hệ 0 đến Phân hệ 3).
4. Phân tích DOM, CSS Flexbox, màu sắc, Typography, khoảng cách và vector SVG.
5. Sắp xếp các màn hình thành **4 hàng tương ứng với 4 Phân hệ** trên canvas Figma.
6. Chụp ảnh màn hình Full-Page độ phân giải cao cho từng giao diện.
7. Đóng gói tất cả vào file: `output/figma-project-all-screens.json`.

---

## ⚡ 2. Cách đưa file vào Figma (Chỉ 30 giây)

Sau khi script chạy xong, bạn sẽ có các file trong thư mục `output/`:

### Cách 1: Tải file lên Plugin Builder.io (Khuyên dùng)
1. Mở ứng dụng **Figma** -> Tạo một file thiết kế mới.
2. Vào menu **Plugins** -> Tìm và mở plugin: **`HTML to Figma (Builder.io)`** (hoặc *Visual Copilot*).
3. Trong giao diện của plugin, tại mục **Import / Paste from Chrome**, bấm **Upload a builder.json file**:
   - Chọn file: **`tools/figma-exporter/output/project.builder.json`** (hoặc `page.builder.json`).
   - *(Lưu ý: Plugin Builder.io bắt buộc tên file phải có đuôi `.builder.json`)*.
4. Bấm **Import**: Toàn bộ 33 màn hình sẽ được dựng lên canvas!

### Cách 2: Dán trực tiếp qua Clipboard (Ctrl + V)
1. Mở file `tools/figma-exporter/output/project.builder.json` bằng VS Code / Notepad.
2. Nhấn `Ctrl + A` rồi `Ctrl + C` để sao chép toàn bộ nội dung.
3. Trong Figma, mở plugin Builder.io, click vào vùng **Paste from Chrome** và nhấn **`Ctrl + V`**. Plugin sẽ tự động render các layers.

### Cách 3: Dùng Plugin `html.to.design` (Auto Layout đẹp nhất)
Nếu bạn muốn Auto Layout và Typography được convert chuẩn chỉnh nhất, có thể dùng plugin **`html.to.design`** trên Figma:
1. Mở plugin `html.to.design`.
2. Dán danh sách các URL của dự án (hoặc tải file capture) để import hàng loạt.

---

## 🖋️ 3. Cách đưa vào Penpot

- **Cách 1 (Khuyên dùng):** Sau khi import vào Figma ở bước 2, bạn dùng plugin **Penpot Exporter** trên Figma Community để xuất toàn bộ sang file `.penpot` và import vào Penpot.
- **Cách 2 (Sử dụng ảnh & Vector):** Script cũng xuất toàn bộ ảnh chụp full-page chất lượng cao tại thư mục `output/screenshots/`. Bạn có thể kéo thả trực tiếp vào các Board của Penpot để thiết kế và đồ lại nhanh chóng.

---

## ⚙️ 4. Các lệnh tùy chọn nâng cao

Bạn có thể chạy các chế độ xuất tùy chỉnh:

```bash
# Xuất giao diện theo kích thước Mobile (390 x 844)
npm run export:mobile

# Chỉ xuất riêng một phân hệ (ví dụ: chỉ xuất Phân hệ 1 - Khách hàng)
node export-all.js --portal=1

# Chỉ xuất các màn hình cụ thể
node export-all.js --screens=0.1,1.1,1.2

# Chỉ chụp ảnh màn hình (không phân tích DOM, chạy cực nhanh)
npm run export:screenshots
```

---

## 📂 5. Cấu trúc thư mục đầu ra (`output/`)

- `output/figma-project-all-screens.json`: File Master Bundle chứa tất cả 34 màn hình để import 1 lần vào Figma.
- `output/screens/*.json`: File JSON của từng màn hình riêng lẻ nếu bạn muốn import lẻ từng trang.
- `output/screenshots/*.png`: Ảnh chụp màn hình full-page độ sắc nét cao.
- `output/index.html`: Dashboard tra cứu trực quan giao diện trên trình duyệt.
