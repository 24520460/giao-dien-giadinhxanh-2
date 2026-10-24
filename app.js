/**
 * =====================================================================
 * GIA ĐÌNH XANH - PRODUCTION PROTOTYPE LOGIC (34 UI FULL IMPLEMENTATION)
 * Ánh xạ 1-1 với 16 bảng PostgreSQL & 4 RPCs trong:
 *   - 4. home_service_booking_supabase.sql
 *   - supabase_rpc_functions.sql
 * 
 * Tuân thủ nghiêm ngặt nguyên tắc Craft Floor của taste-skill & impeccable:
 *   - Không dùng gradient, không dùng bóng lơ lửng, không eyebrow label
 *   - Typography chuẩn xác, số hiển thị tabular-nums
 *   - Toàn bộ 19 Pages + 15 Modals/Drawers tương tác hai chiều với db-mock.js
 * =====================================================================
 */

window.GDXApp = (() => {
  // --- APPLICATION STATE ---
  const state = {
    currentPortal: 1, // 0: Auth, 1: Customer, 2: Provider, 3: Admin
    currentScreen: '1.1',
    activeModal: null,
    activeBookingId: 1042,
    activeProviderId: 201,
    activeCustomerId: 101,
    activeUserId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // Nguyễn Minh Thảo
    userRole: 'customer',
    timerInterval: null,
    timerSeconds: 1 * 3600 + 45 * 60 + 22, // 01:45:22 ca làm #1042
    isTimerRunning: true,
    wizardDraft: {
      service_id: 301,
      scheduled_time: '2026-10-25T08:30',
      provinceId: '79',
      ward_id: '27403',
      address: 'Biệt thự B14, Khu Cảnh Đồi, Phú Mỹ Hưng',
      latitude: 10.728912,
      longitude: 106.712405,
      provider_id: 201,
      notes: 'Bác trai cần đo huyết áp và hỗ trợ tập vật lý trị liệu nhẹ nhàng.',
      hours: 4,
    },
  };

  // Format currency VND
  function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' đ';
  }

  // Format date time
  function formatDateTime(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  // --- MOCK SUPABASE RPC EXECUTION (Mirrors supabase_rpc_functions.sql) ---
  const RPC = {
    transitionBookingStatus(bookingId, newStatus, reason) {
      const db = window.GDX_DB;
      const b = db.bookings.find((item) => item.booking_id === Number(bookingId));
      if (!b) return { success: false, message: `Không tìm thấy đơn hàng #${bookingId}` };
      const prevStatus = b.status;
      b.status = newStatus;
      b.updated_at = new Date().toISOString();

      // Log into booking_status_history
      db.booking_status_history.unshift({
        history_id: Date.now(),
        booking_id: b.booking_id,
        previous_status: prevStatus,
        new_status: newStatus,
        changed_by: state.activeUserId,
        reason: reason || 'Chuyển trạng thái theo quy trình tác nghiệp',
        created_at: new Date().toISOString(),
      });

      return { success: true, booking: b, prevStatus, newStatus };
    },

    updateIncidentalCost(bookingId, incidentalCost, note) {
      const db = window.GDX_DB;
      const b = db.bookings.find((item) => item.booking_id === Number(bookingId));
      if (!b) return { success: false, message: `Không tìm thấy đơn hàng #${bookingId}` };

      const cost = Number(incidentalCost) || 0;
      const basePrice = Math.max(0, b.total_amount - b.total_incidental);
      const newTotal = basePrice + cost;

      b.total_incidental = cost;
      b.total_amount = newTotal;
      b.updated_at = new Date().toISOString();
      if (note) {
        b.notes = (b.notes ? b.notes + '\n' : '') + `[Phát sinh: ${formatMoney(cost)}] ${note}`;
      }

      db.booking_status_history.unshift({
        history_id: Date.now(),
        booking_id: b.booking_id,
        previous_status: b.status,
        new_status: b.status,
        changed_by: state.activeUserId,
        reason: `Cập nhật chi phí phát sinh: ${formatMoney(cost)} -> Tổng mới: ${formatMoney(newTotal)}. Lý do: ${note || 'Vật tư bổ sung'}`,
        created_at: new Date().toISOString(),
      });

      return { success: true, total_incidental: cost, total_amount: newTotal };
    },

    confirmPayment(bookingId, method = 'QR_SEPAY') {
      const db = window.GDX_DB;
      const b = db.bookings.find((item) => item.booking_id === Number(bookingId));
      if (!b) return { success: false, message: `Không tìm thấy đơn hàng #${bookingId}` };

      b.payment_status = 'paid';
      b.updated_at = new Date().toISOString();

      db.booking_status_history.unshift({
        history_id: Date.now(),
        booking_id: b.booking_id,
        previous_status: b.status,
        new_status: b.status,
        changed_by: state.activeUserId,
        reason: `Thanh toán thành công ${formatMoney(b.total_amount)} qua phương thức ${method}`,
        created_at: new Date().toISOString(),
      });

      return { success: true, booking: b };
    },

    adminAdjustPaymentAndRefund(bookingId, incidental, total, paymentStatus, bookingStatus, reason, newProviderId) {
      const db = window.GDX_DB;
      const b = db.bookings.find((item) => item.booking_id === Number(bookingId));
      if (!b) return { success: false, message: `Không tìm thấy đơn hàng #${bookingId}` };

      const prevStatus = b.status;
      const prevPay = b.payment_status;

      if (incidental !== undefined && incidental !== '') b.total_incidental = Number(incidental);
      if (total !== undefined && total !== '') b.total_amount = Number(total);
      if (paymentStatus) b.payment_status = paymentStatus;
      if (bookingStatus) b.status = bookingStatus;
      if (newProviderId) b.provider_id = Number(newProviderId);
      b.updated_at = new Date().toISOString();

      db.booking_status_history.unshift({
        history_id: Date.now(),
        booking_id: b.booking_id,
        previous_status: prevStatus,
        new_status: b.status,
        changed_by: state.activeUserId,
        reason: `[ADMIN ADJUSTMENT] TT Thanh toán: ${prevPay} -> ${b.payment_status} | Tổng tiền: ${formatMoney(b.total_amount)} | Lý do: ${reason}`,
        created_at: new Date().toISOString(),
      });

      return { success: true, booking: b };
    },
  };

  // --- SCREEN METADATA CATALOG (All 34 UI Elements) ---
  const SCREENS = {
    // Phân hệ 0: Auth & Onboarding
    '0.1': { id: '0.1', portal: 0, title: '0.1. Đăng nhập / Đăng ký / Khôi phục mật khẩu', type: 'page', table: 'auth.users, users' },
    '0.2': { id: '0.2', portal: 0, title: '0.2. Thiết lập hồ sơ Khách hàng (Customer Onboarding)', type: 'page', table: 'users, customer_profiles, ward' },
    '0.3': { id: '0.3', portal: 0, title: '0.3. Đăng ký hành nghề Thợ (Provider Onboarding)', type: 'page', table: 'provider_profiles, provider_services, provider_areas' },
    '0.4': { id: '0.4', portal: 0, title: '0.4. Trạng thái Hồ sơ Thợ (Chờ duyệt / Bị từ chối)', type: 'page', table: 'provider_profiles (verification_status)' },
    '0.5': { id: '0.5', portal: 0, title: '0.5. Thông báo Tài khoản bị khóa (Account Suspended)', type: 'page', table: 'users (is_active = FALSE)' },

    // Phân hệ 1: Customer Portal
    '1.1': { id: '1.1', portal: 1, title: '1.1. Trang chủ & Khám phá dịch vụ', type: 'page', table: 'service_categories, services, favorites' },
    '1.2': { id: '1.2', portal: 1, title: '1.2. Cấu hình dịch vụ trước khi đặt (Booking Wizard)', type: 'page', table: 'services, provider_public_profiles, bookings' },
    '1.3': { id: '1.3', portal: 1, title: '1.3. Theo dõi đơn hàng trực tiếp (Live Tracking)', type: 'page', table: 'bookings, booking_status_history, provider_public_profiles' },
    '1.4': { id: '1.4', portal: 1, title: '1.4. Quản lý lịch hẹn dịch vụ', type: 'page', table: 'bookings, services, reviews' },
    '1.5': { id: '1.5', portal: 1, title: '1.5. Hồ sơ cá nhân & Sổ địa chỉ', type: 'page', table: 'users, customer_profiles, ward' },
    '1.6': { id: '1.6', portal: 1, title: '1.6. Danh sách Dịch vụ yêu thích', type: 'page', table: 'favorites, services' },
    '1.7': { id: '1.7', portal: 1, title: '1.7. Hồ sơ công khai của Thợ', type: 'modal', table: 'provider_public_profiles, reviews, provider_services' },
    '1.8': { id: '1.8', portal: 1, title: '1.8. Cổng Thanh toán hóa đơn (Checkout)', type: 'modal', table: 'bookings (total_amount, payment_status)' },
    '1.9': { id: '1.9', portal: 1, title: '1.9. Đánh giá & Chấm điểm Thợ', type: 'modal', table: 'reviews, bookings' },
    '1.10': { id: '1.10', portal: 1, title: '1.10. Xác nhận Hủy lịch hẹn', type: 'modal', table: 'bookings, booking_status_history' },
    '1.11': { id: '1.11', portal: 1, title: '1.11. Trung tâm Hỗ trợ & Gửi khiếu nại', type: 'drawer', table: 'support_tickets, bookings' },

    // Phân hệ 2: Provider Portal
    '2.1': { id: '2.1', portal: 2, title: '2.1. Sàn nhận việc làm (Job Board)', type: 'page', table: 'bookings (pending), services, ward' },
    '2.2': { id: '2.2', portal: 2, title: '2.2. Ca làm việc hiện tại (Live Timer)', type: 'page', table: 'bookings, services, booking_status_history' },
    '2.3': { id: '2.3', portal: 2, title: '2.3. Ví Thu Nhập & Lịch Ca', type: 'page', table: 'bookings, availability_schedules, reviews' },
    '2.4': { id: '2.4', portal: 2, title: '2.4. Cấu hình Năng lực & Khu vực hoạt động', type: 'page', table: 'provider_profiles, provider_services, provider_areas' },
    '2.5': { id: '2.5', portal: 2, title: '2.5. Thanh trạng thái Nhận việc & GPS', type: 'component', table: 'provider_profiles (is_available_online, GPS)' },
    '2.6': { id: '2.6', portal: 2, title: '2.6. Thiết lập Lịch cố định & Xin nghỉ phép', type: 'modal', table: 'availability_schedules, availability_exceptions' },
    '2.7': { id: '2.7', portal: 2, title: '2.7. Kê khai Chi phí phát sinh (Incidental Cost)', type: 'modal', table: 'bookings (total_incidental, notes)' },
    '2.8': { id: '2.8', portal: 2, title: '2.8. Từ chối đơn / Hủy ca làm việc', type: 'modal', table: 'bookings, booking_status_history' },
    '2.9': { id: '2.9', portal: 2, title: '2.9. Báo cáo Sự cố / Hỗ trợ Đối tác', type: 'drawer', table: 'support_tickets, bookings' },

    // Phân hệ 3: Admin Portal
    '3.1': { id: '3.1', portal: 3, title: '3.1. Dashboard Tổng quan & Điều phối', type: 'page', table: 'bookings, provider_profiles, users, support_tickets' },
    '3.2': { id: '3.2', portal: 3, title: '3.2. Quản lý Danh mục & Cấu hình Biểu giá', type: 'page', table: 'service_categories, services' },
    '3.3': { id: '3.3', portal: 3, title: '3.3. Xét duyệt Hồ sơ Đối tác (KYC)', type: 'page', table: 'provider_profiles, users, provider_services' },
    '3.4': { id: '3.4', portal: 3, title: '3.4. Quản lý Người dùng & Giải quyết Khiếu nại', type: 'page', table: 'users, support_tickets, reviews' },
    '3.5': { id: '3.5', portal: 3, title: '3.5. Tra cứu Chi tiết Đơn & Lịch sử Kiểm toán (Audit Log)', type: 'drawer', table: 'bookings, booking_status_history, users' },
    '3.6': { id: '3.6', portal: 3, title: '3.6. Xử lý Hoàn tiền & Điều chỉnh Thanh toán', type: 'modal', table: 'bookings, booking_status_history' },
    '3.7': { id: '3.7', portal: 3, title: '3.7. Xử lý & Cập nhật Phiếu hỗ trợ (Ticket Detail)', type: 'drawer', table: 'support_tickets, users, bookings' },
    '3.8': { id: '3.8', portal: 3, title: '3.8. Thêm / Chỉnh sửa Danh mục & Dịch vụ', type: 'modal', table: 'service_categories, services' },
    '3.9': { id: '3.9', portal: 3, title: '3.9. Quản lý Địa giới hành chính (Tỉnh/Thành & Phường/Xã)', type: 'modal', table: 'province, ward' },
  };

  // --- TOAST NOTIFICATION ---
  function showToast(message, type = 'info') {
    const el = document.getElementById('toastBanner');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    setTimeout(() => {
      el.hidden = true;
    }, 3800);
  }

  // --- TIMER HANDLER FOR SCREEN 2.2 ---
  function formatSeconds(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function startLiveTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      if (state.isTimerRunning) {
        state.timerSeconds++;
        const timerEl = document.getElementById('liveTimerDigits');
        if (timerEl) timerEl.textContent = formatSeconds(state.timerSeconds);
      }
    }, 1000);
  }

  // --- PORTAL & SIDEBAR SWITCHER ---
  function switchPortal(portalId) {
    state.currentPortal = Number(portalId);
    document.querySelectorAll('.portal-tab').forEach((tab) => {
      tab.setAttribute('aria-selected', tab.getAttribute('data-portal') === String(portalId));
    });

    // Update active role and default screen
    const captionEl = document.getElementById('activeRoleCaption');
    const identityEl = document.getElementById('sidebarCurrentIdentity');
    const provWidget = document.getElementById('providerHeaderWidget');

    if (portalId === 0) {
      if (captionEl) captionEl.textContent = 'Phân hệ 0 · Dùng chung & Xác thực';
      if (identityEl) identityEl.textContent = 'Trạng thái: Khách vãng lai / Đăng nhập';
      state.userRole = 'anon';
      state.activeUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      if (provWidget) provWidget.style.display = 'none';
      renderSidebar('0.1');
      go('0.1');
    } else if (portalId === 1) {
      if (captionEl) captionEl.textContent = 'Phân hệ 1 · Khách hàng (Customer)';
      if (identityEl) identityEl.textContent = 'auth.uid(): Nguyễn Minh Thảo (customer_id #101)';
      state.userRole = 'customer';
      state.activeUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      state.activeCustomerId = 101;
      if (provWidget) provWidget.style.display = 'none';
      renderSidebar('1.1');
      go('1.1');
    } else if (portalId === 2) {
      if (captionEl) captionEl.textContent = 'Phân hệ 2 · Thợ / Đối tác (Provider)';
      if (identityEl) identityEl.textContent = 'auth.uid(): Đặng Thị Mai Lan (provider_id #201)';
      state.userRole = 'provider';
      state.activeUserId = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b21';
      state.activeProviderId = 201;
      if (provWidget) provWidget.style.display = 'flex';
      renderSidebar('2.1');
      go('2.1');
    } else if (portalId === 3) {
      if (captionEl) captionEl.textContent = 'Phân hệ 3 · Quản trị viên (Admin)';
      if (identityEl) identityEl.textContent = 'auth.uid(): Nguyễn Quang Hào (role: admin)';
      state.userRole = 'admin';
      state.activeUserId = 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c99';
      if (provWidget) provWidget.style.display = 'none';
      renderSidebar('3.1');
      go('3.1');
    }
  }

  function renderSidebar(activeScreenId) {
    const pageListEl = document.getElementById('sidebarPageList');
    const modalListEl = document.getElementById('sidebarModalList');
    if (!pageListEl || !modalListEl) return;

    const portalScreens = Object.values(SCREENS).filter((s) => s.portal === state.currentPortal);
    const pages = portalScreens.filter((s) => s.type === 'page');
    const modals = portalScreens.filter((s) => s.type !== 'page');

    pageListEl.innerHTML = pages
      .map(
        (p) => `
      <button type="button" class="sidebar-nav-btn" data-screen="${p.id}" aria-current="${p.id === activeScreenId ? 'page' : 'false'}" onclick="GDXApp.go('${p.id}')">
        <span>${p.title.split('. ')[1] || p.title}</span>
        <span class="sidebar-code">${p.id}</span>
      </button>`
      )
      .join('');

    modalListEl.innerHTML = modals
      .map(
        (m) => `
      <button type="button" class="sidebar-nav-btn" data-screen="${m.id}" onclick="GDXApp.openModal('${m.id}')">
        <span>${m.title.split('. ')[1] || m.title}</span>
        <span class="badge badge-neutral" style="font-size:11px;">${m.type}</span>
      </button>`
      )
      .join('');
  }

  // --- ROUTER NAVIGATION ---
  function go(screenId, params = {}) {
    state.currentScreen = screenId;
    const meta = SCREENS[screenId];
    if (meta && meta.portal !== state.currentPortal) {
      switchPortal(meta.portal);
      return;
    }

    renderSidebar(screenId);

    const viewport = document.getElementById('mainViewport');
    if (!viewport) return;

    // Reset surface mode
    if (screenId === '1.1') {
      viewport.setAttribute('data-surface-mode', 'stationery');
    } else {
      viewport.removeAttribute('data-surface-mode');
    }

    // Scroll to top of viewport
    viewport.scrollTop = 0;

    // Dispatch rendering
    switch (screenId) {
      // Phân hệ 0
      case '0.1': renderScreen_0_1(viewport, params); break;
      case '0.2': renderScreen_0_2(viewport, params); break;
      case '0.3': renderScreen_0_3(viewport, params); break;
      case '0.4': renderScreen_0_4(viewport, params); break;
      case '0.5': renderScreen_0_5(viewport, params); break;

      // Phân hệ 1
      case '1.1': renderScreen_1_1(viewport, params); break;
      case '1.2': renderScreen_1_2(viewport, params); break;
      case '1.3': renderScreen_1_3(viewport, params); break;
      case '1.4': renderScreen_1_4(viewport, params); break;
      case '1.5': renderScreen_1_5(viewport, params); break;
      case '1.6': renderScreen_1_6(viewport, params); break;

      // Phân hệ 2
      case '2.1': renderScreen_2_1(viewport, params); break;
      case '2.2': renderScreen_2_2(viewport, params); break;
      case '2.3': renderScreen_2_3(viewport, params); break;
      case '2.4': renderScreen_2_4(viewport, params); break;

      // Phân hệ 3
      case '3.1': renderScreen_3_1(viewport, params); break;
      case '3.2': renderScreen_3_2(viewport, params); break;
      case '3.3': renderScreen_3_3(viewport, params); break;
      case '3.4': renderScreen_3_4(viewport, params); break;

      default:
        viewport.innerHTML = `<div class="panel"><h2>Màn hình đang hoàn thiện: ${screenId}</h2></div>`;
    }
  }

  // --- COMPONENT 2.5: PROVIDER STATUS & GPS TOGGLE ---
  function toggleProviderOnline() {
    const prov = window.GDX_DB.provider_profiles.find((p) => p.provider_id === state.activeProviderId);
    if (!prov) return;
    prov.is_available_online = !prov.is_available_online;

    const dot = document.getElementById('providerOnlineDot');
    const label = document.getElementById('providerOnlineLabel');
    if (dot && label) {
      if (prov.is_available_online) {
        dot.className = 'status-dot is-online';
        label.textContent = 'Đang nhận việc';
      } else {
        dot.className = 'status-dot';
        label.textContent = 'Tạm dừng nhận đơn';
      }
    }
    showToast(`Trạng thái thợ: ${prov.is_available_online ? 'Sẵn sàng trực tuyến' : 'Tạm nghỉ'}`);
  }

  function refreshProviderGPS() {
    const prov = window.GDX_DB.provider_profiles.find((p) => p.provider_id === state.activeProviderId);
    if (!prov) return;
    // Simulate slight movement
    prov.lattitude = Number((prov.lattitude + (Math.random() - 0.5) * 0.002).toFixed(6));
    prov.longtitude = Number((prov.longtitude + (Math.random() - 0.5) * 0.002).toFixed(6));

    const gpsEl = document.getElementById('providerGpsText');
    if (gpsEl) gpsEl.textContent = `${prov.lattitude}, ${prov.longtitude}`;
    showToast(`GPS đã đồng bộ: ${prov.lattitude}, ${prov.longtitude}`);
  }

  // =====================================================================
  // SCREEN RENDERERS: PHÂN HỆ 0 (AUTH & ONBOARDING)
  // =====================================================================

  // 0.1: Đăng nhập / Đăng ký / Khôi phục mật khẩu
  function renderScreen_0_1(container) {
    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">0.1. Cổng xác thực tài khoản &amp; Phân luồng vai trò</h1>
          <p class="screen-finding">Bảng liên quan: auth.users, public.users. Cấp auth.uid() phục vụ toàn bộ các hàm RLS.</p>
        </div>
      </div>

      <div style="max-width: 520px; margin: 30px auto;" class="panel">
        <div class="underline-tabs" id="authTabs">
          <button type="button" class="u-tab" aria-selected="true" onclick="GDXApp.setAuthTab('login')">Đăng nhập</button>
          <button type="button" class="u-tab" aria-selected="false" onclick="GDXApp.setAuthTab('register')">Đăng ký mới</button>
          <button type="button" class="u-tab" aria-selected="false" onclick="GDXApp.setAuthTab('forgot')">Quên mật khẩu</button>
        </div>

        <div id="authTabContent">
          <!-- Login Form by default -->
          <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.handleLogin(this);">
            <div class="field-group">
              <label class="field-label">Email hoặc Số điện thoại (users.phone_number)</label>
              <input type="text" name="identifier" class="input" value="0908341289" required placeholder="0908xxxxxx hoặc email">
            </div>
            <div class="field-group">
              <label class="field-label">Mật khẩu (auth.users.encrypted_password)</label>
              <input type="password" name="password" class="input" value="••••••••" required>
            </div>
            <div class="field-group">
              <label class="field-label">Chọn vai trò đăng nhập thử nghiệm:</label>
              <select name="mockRole" class="select" onchange="GDXApp.setMockLoginRole(this.value)">
                <option value="customer" selected>Khách hàng: Nguyễn Minh Thảo (Q.7)</option>
                <option value="provider">Thợ điều dưỡng: Đặng Thị Mai Lan (Đã duyệt)</option>
                <option value="provider_pending">Thợ mới: Võ Văn Khải (Chờ duyệt KYC)</option>
                <option value="provider_rejected">Thợ: Ngô Minh Đức (Bị khóa / Từ chối)</option>
                <option value="admin">Quản trị viên: Nguyễn Quang Hào (Admin)</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 8px;">Đăng nhập hệ thống &rarr;</button>
          </form>
        </div>
      </div>
    `;
  }

  function setAuthTab(tab) {
    const content = document.getElementById('authTabContent');
    if (!content) return;
    const tabs = document.querySelectorAll('#authTabs .u-tab');
    tabs.forEach((t, i) => {
      t.setAttribute('aria-selected', (tab === 'login' && i === 0) || (tab === 'register' && i === 1) || (tab === 'forgot' && i === 2));
    });

    if (tab === 'login') {
      content.innerHTML = `
        <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.handleLogin(this);">
          <div class="field-group">
            <label class="field-label">Số điện thoại hoặc Email</label>
            <input type="text" name="identifier" class="input" value="0908341289" required>
          </div>
          <div class="field-group">
            <label class="field-label">Mật khẩu</label>
            <input type="password" name="password" class="input" value="••••••••" required>
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%;">Đăng nhập</button>
        </form>
      `;
    } else if (tab === 'register') {
      content.innerHTML = `
        <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.handleRegister(this);">
          <div class="field-group">
            <label class="field-label">Họ và tên (users.full_name)</label>
            <input type="text" name="full_name" class="input" required placeholder="Nguyễn Văn A">
          </div>
          <div class="field-group">
            <label class="field-label">Số điện thoại (users.phone_number - UNIQUE)</label>
            <input type="tel" name="phone_number" class="input" required placeholder="09xxxxxxxx">
          </div>
          <div class="field-group">
            <label class="field-label">Email định danh (auth.users)</label>
            <input type="email" name="email" class="input" required placeholder="email@domain.com">
          </div>
          <div class="field-group">
            <label class="field-label">Vai trò đăng ký (users_insert_own check)</label>
            <div style="display:flex; gap:16px; margin-top:4px;">
              <label style="display:flex; align-items:center; gap:6px;">
                <input type="radio" name="role" value="customer" checked> Khách hàng gia đình
              </label>
              <label style="display:flex; align-items:center; gap:6px;">
                <input type="radio" name="role" value="provider"> Đối tác hành nghề Thợ
              </label>
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;">Tạo tài khoản &amp; Tiếp tục &rarr;</button>
        </form>
      `;
    } else {
      content.innerHTML = `
        <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.showToast('Đã gửi email khôi phục mật khẩu'); GDXApp.setAuthTab('login');">
          <div class="field-group">
            <label class="field-label">Nhập Email đã đăng ký</label>
            <input type="email" class="input" required placeholder="email@domain.com">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;">Gửi hướng dẫn đặt lại mật khẩu</button>
        </form>
      `;
    }
  }

  function handleLogin(form) {
    const role = form.mockRole ? form.mockRole.value : 'customer';
    if (role === 'customer') {
      showToast('Đăng nhập thành công với vai trò Khách hàng');
      switchPortal(1);
    } else if (role === 'provider') {
      showToast('Đăng nhập thành công với vai trò Thợ điều dưỡng');
      switchPortal(2);
    } else if (role === 'provider_pending') {
      showToast('Tài khoản thợ đang ở trạng thái chờ duyệt');
      switchPortal(0);
      go('0.4', { status: 'pending' });
    } else if (role === 'provider_rejected') {
      showToast('Tài khoản bị khóa');
      switchPortal(0);
      go('0.5');
    } else if (role === 'admin') {
      showToast('Đăng nhập thành công với vai trò Quản trị viên');
      switchPortal(3);
    }
  }

  function handleRegister(form) {
    const role = form.role.value;
    showToast(`Tạo tài khoản ${role} thành công! Chuyển tiếp cấu hình...`);
    if (role === 'customer') {
      go('0.2');
    } else {
      go('0.3');
    }
  }

  // 0.2: Customer Onboarding
  function renderScreen_0_2(container) {
    const wards = window.GDX_DB.ward.filter((w) => w.provinceId === '79');
    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">0.2. Thiết lập hồ sơ Khách hàng mới</h1>
          <p class="screen-finding">Bắt buộc theo ràng buộc NOT NULL customer_profiles.ward_id và users.phone_number.</p>
        </div>
      </div>

      <div style="max-width: 680px; margin: 20px auto;" class="panel">
        <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.showToast('Hồ sơ khách hàng đã hoàn tất!'); GDXApp.switchPortal(1);">
          <div class="field-group">
            <label class="field-label">Họ và tên</label>
            <input type="text" class="input" value="Trần Thị Lan Anh" required>
          </div>
          <div class="field-group">
            <label class="field-label">Số điện thoại liên hệ</label>
            <input type="tel" class="input" value="0918776655" required>
          </div>
          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label">Tỉnh / Thành phố (province)</label>
              <select class="select" disabled>
                <option selected>Thành phố Hồ Chí Minh (79)</option>
              </select>
            </div>
            <div class="field-group">
              <label class="field-label">Phường / Xã (customer_profiles.ward_id - Bắt buộc)</label>
              <select class="select" required>
                ${wards.map((w) => `<option value="${w.ward_id}">${w.name}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="field-group">
            <label class="field-label">Địa chỉ nhà chi tiết (default_address)</label>
            <input type="text" class="input" placeholder="Số nhà, tên đường, số căn hộ chung cư..." value="Căn hộ A-1204, Sunrise City, Quận 7">
          </div>
          <div class="geo-map-canvas">
            <div class="geo-pin-row">
              <span class="status-dot is-online"></span>
              <span>Tọa độ tự động: 10.741205, 106.702110 (customer_profiles.latitude, longitude)</span>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" style="align-self: flex-start; margin-top: 10px;" onclick="GDXApp.showToast('Đã lấy vị trí GPS hiện tại')">
              Lấy vị trí hiện tại của tôi
            </button>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:16px;">
            <button type="submit" class="btn btn-primary">Hoàn tất thiết lập &amp; Vào trang chủ &rarr;</button>
          </div>
        </form>
      </div>
    `;
  }

  // 0.3: Provider Onboarding
  function renderScreen_0_3(container) {
    const svcs = window.GDX_DB.services.filter((s) => s.is_active);
    const wards = window.GDX_DB.ward.filter((w) => w.provinceId === '79');
    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">0.3. Đăng ký hồ sơ hành nghề Thợ (KYC Step Form)</h1>
          <p class="screen-finding">Bắt buộc CCCD (id_card_number UNIQUE), ảnh đại diện, kỹ năng chuyên môn và khu vực phục vụ.</p>
        </div>
      </div>

      <div style="max-width: 760px; margin: 20px auto;" class="panel">
        <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.showToast('Hồ sơ đã gửi thành công! Đang chờ Admin duyệt.'); GDXApp.go('0.4', {status:'pending'});">
          <div style="border-bottom: 1px solid var(--app-rule); padding-bottom: 14px;">
            <h2 class="panel-title">Bước 1: Thông tin định danh &amp; Lý lịch tư pháp</h2>
            <p class="field-hint">Ánh xạ bảng provider_profiles (id_card_number, avatar_url, info)</p>
          </div>

          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label">Số CCCD / CMND (UNIQUE)</label>
              <input type="text" class="input" placeholder="079xxxxxxxxxx" value="079095023419" required maxlength="20">
            </div>
            <div class="field-group">
              <label class="field-label">Ảnh chân dung / Avatar</label>
              <input type="file" class="input" accept="image/*">
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Giới thiệu kinh nghiệm &amp; Bằng cấp y tế / kỹ thuật</label>
            <textarea class="textarea" rows="3" required placeholder="Mô tả số năm kinh nghiệm, trường đào tạo, chứng chỉ hành nghề...">Cử nhân Điều dưỡng ĐH Y Khoa Phạm Ngọc Thạch, 5 năm kinh nghiệm phục hồi chức năng.</textarea>
          </div>

          <div style="border-bottom: 1px solid var(--app-rule); padding: 14px 0 6px;">
            <h2 class="panel-title">Bước 2: Dịch vụ đăng ký cung cấp (provider_services)</h2>
          </div>
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            ${svcs
              .map(
                (s) => `
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; background:var(--app-raised); padding:8px 12px; border-radius:6px;">
                <input type="checkbox" name="services" value="${s.service_id}" checked>
                <span>${s.title}</span>
              </label>`
              )
              .join('')}
          </div>

          <div style="border-bottom: 1px solid var(--app-rule); padding: 14px 0 6px;">
            <h2 class="panel-title">Bước 3: Khu vực nhận việc (provider_areas)</h2>
          </div>
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            ${wards
              .slice(0, 6)
              .map(
                (w) => `
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; background:var(--app-raised); padding:8px 12px; border-radius:6px;">
                <input type="checkbox" name="wards" value="${w.ward_id}" checked>
                <span>${w.name}</span>
              </label>`
              )
              .join('')}
          </div>

          <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:20px;">
            <button type="submit" class="btn btn-primary">Gửi hồ sơ xét duyệt (pending) &rarr;</button>
          </div>
        </form>
      </div>
    `;
  }

  // 0.4: Provider Verification Status
  function renderScreen_0_4(container, params = {}) {
    const isPending = (params.status || 'pending') === 'pending';
    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">0.4. Trạng thái xét duyệt Hồ sơ Đối tác Thợ</h1>
          <p class="screen-finding">RLS Policy: Chỉ thợ verified mới xuất hiện trên view provider_public_profiles.</p>
        </div>
      </div>

      <div style="max-width: 600px; margin: 40px auto; text-align: center;" class="panel">
        <div style="margin-bottom: 20px;">
          ${
            isPending
              ? `<span class="badge badge-warning" style="font-size: 16px; padding: 6px 16px;">verification_status: PENDING (Chờ duyệt)</span>`
              : `<span class="badge badge-negative" style="font-size: 16px; padding: 6px 16px;">verification_status: REJECTED (Bị từ chối)</span>`
          }
        </div>
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 10px;">
          ${isPending ? 'Hồ sơ đang trong quá trình thẩm định lý lịch' : 'Hồ sơ chưa đạt yêu cầu xác minh'}
        </h2>
        <p style="color: var(--app-muted); line-height: 1.6; margin-bottom: 24px;">
          ${
            isPending
              ? 'Hội đồng chuyên môn của Gia Đình Xanh đang đối soát số CCCD 079095023419 và chứng chỉ y tế của bạn. Thời gian thẩm định từ 2–4 giờ làm việc.'
              : 'Lý do: Ảnh chụp mặt sau thẻ CCCD bị mờ số và chưa tải kèm chứng chỉ điều dưỡng gốc. Vui lòng cập nhật lại hồ sơ.'
          }
        </p>

        ${
          !isPending
            ? `
          <div style="text-align: left; background: var(--app-raised); padding: 18px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">Cập nhật lại thông tin (provider_profiles_update_own):</h3>
            <div class="field-group">
              <label class="field-label">Tải lại ảnh CCCD 2 mặt rõ nét</label>
              <input type="file" class="input">
            </div>
            <button type="button" class="btn btn-primary btn-sm" style="margin-top: 12px;" onclick="GDXApp.showToast('Đã nộp lại hồ sơ! Chuyển trạng thái sang pending.'); GDXApp.go('0.4', {status:'pending'})">
              Nộp lại hồ sơ thẩm định
            </button>
          </div>`
            : ''
        }

        <div style="display:flex; justify-content:center; gap:12px;">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.go('0.4', {status: isPending ? 'rejected' : 'pending'})">
            Mô phỏng đổi trạng thái (${isPending ? 'Xem màn Rejected' : 'Xem màn Pending'})
          </button>
          <button type="button" class="btn btn-primary" onclick="GDXApp.switchPortal(1)">Về trang chủ</button>
        </div>
      </div>
    `;
  }

  // 0.5: Account Suspended
  function renderScreen_0_5(container) {
    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">0.5. Thông báo Tài khoản bị khóa (Account Suspended)</h1>
          <p class="screen-finding">Bảng users: is_active = FALSE. Hệ thống chặn toàn bộ thao tác RLS dữ liệu.</p>
        </div>
      </div>

      <div style="max-width: 580px; margin: 40px auto; text-align: center;" class="panel">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; background: var(--pill-negative-bg); color: var(--negative); border-radius: 50%; margin-bottom: 20px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 12px; color: var(--negative);">
          Tài khoản đã bị tạm khóa bởi Quản trị viên
        </h2>
        <p style="color: var(--app-muted); line-height: 1.6; margin-bottom: 24px;">
          Tài khoản ID <code>b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b25</code> (Ngô Minh Đức) hiện đang bị tạm dừng dịch vụ do vi phạm quy chuẩn an toàn dịch vụ hoặc tranh chấp chưa hoàn tất xử lý.
        </p>

        <div style="display:flex; justify-content:center; gap:12px;">
          <button type="button" class="btn btn-warning" onclick="GDXApp.openModal('1.11')">
            Gửi phiếu hỗ trợ (Support Ticket)
          </button>
          <button type="button" class="btn btn-secondary" onclick="GDXApp.switchPortal(0)">
            Đăng xuất / Quay lại
          </button>
        </div>
      </div>
    `;
  }

  // =====================================================================
  // SCREEN RENDERERS: PHÂN HỆ 1 (CUSTOMER PORTAL)
  // =====================================================================

  // 1.1: Trang chủ & Khám phá dịch vụ (Stationery Paper Style)
  function renderScreen_1_1(container) {
    const cats = window.GDX_DB.service_categories.filter((c) => c.status && c.parent_id === null);
    const svcs = window.GDX_DB.services.filter((s) => s.is_active);
    const favs = window.GDX_DB.favorites.filter((f) => f.customer_id === state.activeCustomerId);

    container.innerHTML = `
      <div class="stationery-stage">
        <!-- Notched Paper Care Charter Sheet -->
        <article class="charter-sheet" aria-labelledby="charterTitle">
          <div class="charter-top-meta">
            <div><strong>GIA ĐÌNH XANH · NIÊN BIỂU DỊCH VỤ 2026</strong></div>
            <div>TP. HỒ CHÍ MINH · 100% NHÂN SỰ XÁC MINH LÝ LỊCH TƯ PHÁP</div>
          </div>

          <h1 id="charterTitle" class="charter-h1">Thảnh thơi việc nhà, an lòng chăm sóc</h1>
          <p class="charter-lead">
            Nền tảng đặt dịch vụ điều dưỡng và hỗ trợ tổ ấm tại gia với đội ngũ chuyên nghiệp, minh bạch biểu giá từng giờ và bảo chứng an toàn tuyệt đối.
          </p>

          <!-- Perforated Live Calculator Stub -->
          <div class="perforated-stub">
            <div style="grid-column: span 4;">
              <label class="field-label" style="font-size:13px;">Dịch vụ cần chăm sóc</label>
              <select id="quickSvcSelect" class="select" onchange="GDXApp.updateQuickStubPrice()">
                ${svcs.map((s) => `<option value="${s.service_id}" data-price="${s.price}" data-type="${s.pricing_type}">${s.title}</option>`).join('')}
              </select>
            </div>
            <div style="grid-column: span 3;">
              <label class="field-label" style="font-size:13px;">Khu vực (ward_id)</label>
              <select class="select">
                <option>Phường Tân Phong, Q.7</option>
                <option>Phường Thảo Điền, TP. Thủ Đức</option>
                <option>Phường Bến Nghé, Quận 1</option>
              </select>
            </div>
            <div style="grid-column: span 3;">
              <label class="field-label" style="font-size:13px;">Đơn giá tham chiếu</label>
              <div id="quickStubPrice" class="price-val" style="font-size: 20px; font-weight: 600; color: var(--accent); padding: 6px 0;">
                140,000 đ / giờ
              </div>
            </div>
            <div style="grid-column: span 2;">
              <button type="button" class="btn btn-primary" style="width:100%; height:40px;" onclick="GDXApp.startBookingFromCatalog(document.getElementById('quickSvcSelect').value)">
                Đặt lịch &rarr;
              </button>
            </div>
          </div>
        </article>

        <!-- Menu-Style Service Catalog (Blueprint 4: Prices like a menu) -->
        <section class="menu-catalog-section">
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:24px; border-bottom:1px solid var(--app-border); padding-bottom:16px;">
            <div>
              <h2 class="catalog-heading">
                Biểu phí &amp; Dịch vụ tiêu chuẩn
              </h2>
              <p style="color: var(--muted); font-size: 14px; margin-top: 4px;">Tất cả dịch vụ đều có hợp đồng bảo hiểm trách nhiệm dân sự 1 tỷ đồng.</p>
            </div>
            <div class="screen-actions">
              <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.go('1.6')">
                Đã lưu (${favs.length})
              </button>
            </div>
          </div>

          ${cats
            .map((cat) => {
              const catSvcs = svcs.filter((s) => {
                const subCat = window.GDX_DB.service_categories.find((c) => c.category_id === s.category_id);
                return s.category_id === cat.category_id || (subCat && subCat.parent_id === cat.category_id);
              });
              return `
              <div style="margin-bottom: 36px;">
                <h3 class="menu-group-heading">${cat.category_name}</h3>
                <div class="menu-service-grid">
                  ${catSvcs
                    .map((s) => {
                      const isFav = favs.some((f) => f.service_id === s.service_id);
                      return `
                    <div class="menu-service-item">
                      <div>
                        <div class="menu-item-top">
                          <span class="menu-item-title">${s.title}</span>
                          <span class="menu-item-price">${formatMoney(s.price)}${s.pricing_type === 'hourly' ? ' / giờ' : ' / ca'}</span>
                        </div>
                        <p class="menu-item-desc" style="margin-top: 8px;">${s.description}</p>
                        <div style="font-size: 13px; color: var(--muted); margin-top: 10px;">
                          Thời lượng dự kiến: <strong>${s.estimated_duration} phút</strong>
                        </div>
                      </div>
                      <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px dotted var(--app-border); padding-top: 12px; margin-top: 8px; flex-wrap: wrap; gap: 8px;">
                        <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.toggleFavorite(${s.service_id})">
                          ${isFav ? 'Đã lưu trong mục yêu thích' : 'Lưu vào yêu thích'}
                        </button>
                        <button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.startBookingFromCatalog(${s.service_id})">
                          Cấu hình đặt lịch &rarr;
                        </button>
                      </div>
                    </div>`;
                    })
                    .join('')}
                </div>
              </div>`;
            })
            .join('')}
        </section>
      </div>
    `;
  }

  function updateQuickStubPrice() {
    const sel = document.getElementById('quickSvcSelect');
    const display = document.getElementById('quickStubPrice');
    if (!sel || !display) return;
    const opt = sel.selectedOptions[0];
    const price = opt.getAttribute('data-price');
    const type = opt.getAttribute('data-type');
    display.textContent = `${formatMoney(price)} / ${type === 'hourly' ? 'giờ' : 'ca'}`;
  }

  function startBookingFromCatalog(serviceId) {
    state.wizardDraft.service_id = Number(serviceId);
    go('1.2');
  }

  function toggleFavorite(serviceId) {
    const db = window.GDX_DB;
    const sid = Number(serviceId);
    const idx = db.favorites.findIndex((f) => f.customer_id === state.activeCustomerId && f.service_id === sid);
    if (idx >= 0) {
      db.favorites.splice(idx, 1);
      showToast('Đã bỏ dịch vụ khỏi danh sách yêu thích');
    } else {
      db.favorites.push({
        favorite_id: Date.now(),
        customer_id: state.activeCustomerId,
        service_id: sid,
        created_at: new Date().toISOString(),
      });
      showToast('Đã lưu dịch vụ vào mục Yêu thích');
    }
    renderScreen_1_1(document.getElementById('mainViewport'));
  }

  // 1.2: Booking Wizard (Cấu hình dịch vụ trước khi đặt)
  function renderScreen_1_2(container) {
    const db = window.GDX_DB;
    const curService = db.services.find((s) => s.service_id === state.wizardDraft.service_id) || db.services[0];
    const provProfiles = db.getProviderPublicProfiles();
    const wards = db.ward.filter((w) => w.provinceId === '79');

    const totalEst = curService.pricing_type === 'hourly' ? curService.price * state.wizardDraft.hours : curService.price;

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">1.2. Cấu hình dịch vụ &amp; Chọn thợ phụ trách</h1>
          <p class="screen-finding">Kiểm tra lịch rảnh (availability_schedules), khu vực (provider_areas) và khởi tạo đơn (pending + unpaid).</p>
        </div>
      </div>

      <div class="grid-12">
        <!-- Left: Wizard Configuration Form -->
        <div class="col-7">
          <div class="panel form-stack">
            <div style="border-bottom: 1px solid var(--app-rule); padding-bottom: 12px;">
              <h2 class="panel-title">1. Dịch vụ đã chọn</h2>
            </div>
            <div class="field-group">
              <label class="field-label">Gói dịch vụ</label>
              <select class="select" onchange="GDXApp.wizardChangeService(this.value)">
                ${db.services
                  .filter((s) => s.is_active)
                  .map((s) => `<option value="${s.service_id}" ${s.service_id === curService.service_id ? 'selected' : ''}>${s.title} — ${formatMoney(s.price)}${s.pricing_type === 'hourly' ? '/h' : ''}</option>`)
                  .join('')}
              </select>
            </div>

            ${
              curService.pricing_type === 'hourly'
                ? `
              <div class="field-group">
                <label class="field-label">Thời lượng dự kiến (pricing_type: hourly)</label>
                <div style="display:flex; gap:10px; align-items:center;">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.wizardChangeHours(-1)">− 1 giờ</button>
                  <span style="font-size:16px; font-weight:600; min-width:60px; text-align:center;">${state.wizardDraft.hours} giờ</span>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.wizardChangeHours(1)">+ 1 giờ</button>
                </div>
              </div>`
                : ''
            }

            <div style="border-bottom: 1px solid var(--app-rule); padding-bottom: 12px; margin-top: 14px;">
              <h2 class="panel-title">2. Thời gian &amp; Địa chỉ thực thi</h2>
            </div>

            <div class="form-row-2">
              <div class="field-group">
                <label class="field-label">Thời gian hẹn (bookings.scheduled_time)</label>
                <input type="datetime-local" class="input" value="${state.wizardDraft.scheduled_time}" onchange="state.wizardDraft.scheduled_time = this.value">
              </div>
              <div class="field-group">
                <label class="field-label">Phường / Xã (bookings.ward_id)</label>
                <select class="select" onchange="state.wizardDraft.ward_id = this.value">
                  ${wards.map((w) => `<option value="${w.ward_id}" ${w.ward_id === state.wizardDraft.ward_id ? 'selected' : ''}>${w.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">Địa chỉ chi tiết (bookings.address)</label>
              <input type="text" class="input" value="${state.wizardDraft.address}" oninput="state.wizardDraft.address = this.value">
            </div>

            <div class="field-group">
              <label class="field-label">Ghi chú cho thợ (bookings.notes)</label>
              <textarea class="textarea" rows="2" oninput="state.wizardDraft.notes = this.value">${state.wizardDraft.notes}</textarea>
            </div>

            <div style="border-bottom: 1px solid var(--app-rule); padding-bottom: 12px; margin-top: 14px;">
              <h2 class="panel-title">3. Chọn thợ phù hợp (provider_public_profiles)</h2>
            </div>

            <div style="display:flex; flex-direction:column; gap:10px;">
              ${provProfiles
                .map(
                  (p) => `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; border:1px solid ${p.provider_id === state.wizardDraft.provider_id ? 'var(--accent)' : 'var(--app-border)'}; border-radius:8px; background:${p.provider_id === state.wizardDraft.provider_id ? 'var(--app-raised)' : 'var(--app-surface)'};">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <input type="radio" name="wizardProvider" value="${p.provider_id}" ${p.provider_id === state.wizardDraft.provider_id ? 'checked' : ''} onchange="GDXApp.wizardSelectProvider(${p.provider_id})">
                    <img src="${p.avatar_url}" alt="${p.full_name}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                    <div>
                      <div style="font-weight:600; font-size:14px;">${p.full_name}</div>
                      <div style="font-size:12px; color:var(--app-muted);">
                        ⭐ ${p.average_rating} (${p.total_reviews} đánh giá) · ${p.is_available_online ? '<span class="delta-pos">Trực tuyến</span>' : 'Ngoại tuyến'}
                      </div>
                    </div>
                  </div>
                  <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.openModal('1.7', {provider_id: ${p.provider_id}})">Xem hồ sơ</button>
                </div>`
                )
                .join('')}
            </div>
          </div>
        </div>

        <!-- Right: Receipt Slip Summary & Confirmation -->
        <div class="col-5">
          <div class="receipt-slip">
            <div style="text-align:center; padding-bottom:12px; border-bottom:1px dashed var(--app-border);">
              <div style="font-weight:600; font-size:16px;">HÓA ĐƠN TẠM TÍNH (ESTIMATE)</div>
              <div style="font-size:12px; color:var(--muted);">GIA ĐÌNH XANH · HOME BOOKING</div>
            </div>

            <div style="margin: 18px 0;">
              <div class="slip-row">
                <span>Dịch vụ</span>
                <span class="slip-dots"></span>
                <span><strong>${curService.title}</strong></span>
              </div>
              <div class="slip-row">
                <span>Cách tính giá</span>
                <span class="slip-dots"></span>
                <span>${curService.pricing_type === 'hourly' ? `${state.wizardDraft.hours} giờ x ${formatMoney(curService.price)}` : 'Trọn gói theo ca'}</span>
              </div>
              <div class="slip-row">
                <span>Phí phát sinh dự phòng</span>
                <span class="slip-dots"></span>
                <span>0 đ</span>
              </div>
            </div>

            <div class="slip-total-bar">
              <span>TỔNG THANH TOÁN TẠM TÍNH</span>
              <span style="font-size: 18px;">${formatMoney(totalEst)}</span>
            </div>

            <div style="font-size:12px; color:var(--muted); margin-top:14px; line-height:1.5;">
              Đơn hàng sẽ được tạo ở trạng thái <code>status = 'pending'</code> và <code>payment_status = 'unpaid'</code> theo đúng RLS <code>bk_insert</code>.
            </div>

            <button type="button" class="btn btn-primary" style="width:100%; margin-top:18px; height:44px;" onclick="GDXApp.confirmBookingCreation()">
              Xác nhận Đặt lịch ngay &rarr;
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function wizardChangeService(serviceId) {
    state.wizardDraft.service_id = Number(serviceId);
    renderScreen_1_2(document.getElementById('mainViewport'));
  }

  function wizardChangeHours(delta) {
    state.wizardDraft.hours = Math.max(1, state.wizardDraft.hours + delta);
    renderScreen_1_2(document.getElementById('mainViewport'));
  }

  function wizardSelectProvider(providerId) {
    state.wizardDraft.provider_id = Number(providerId);
    renderScreen_1_2(document.getElementById('mainViewport'));
  }

  function confirmBookingCreation() {
    const db = window.GDX_DB;
    const curService = db.services.find((s) => s.service_id === state.wizardDraft.service_id);
    const totalEst = curService.pricing_type === 'hourly' ? curService.price * state.wizardDraft.hours : curService.price;

    const newBooking = {
      booking_id: 1000 + db.bookings.length + 1,
      customer_id: state.activeCustomerId,
      provider_id: state.wizardDraft.provider_id,
      service_id: curService.service_id,
      scheduled_time: new Date(state.wizardDraft.scheduled_time).toISOString(),
      address: state.wizardDraft.address,
      ward_id: state.wizardDraft.ward_id,
      latitude: state.wizardDraft.latitude,
      longitude: state.wizardDraft.longitude,
      total_incidental: 0,
      total_amount: totalEst,
      status: 'pending',
      payment_status: 'unpaid',
      notes: state.wizardDraft.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.bookings.unshift(newBooking);

    db.booking_status_history.unshift({
      history_id: Date.now(),
      booking_id: newBooking.booking_id,
      previous_status: null,
      new_status: 'pending',
      changed_by: state.activeUserId,
      reason: 'Khách hàng tạo đơn đặt lịch qua Booking Wizard 1.2',
      created_at: new Date().toISOString(),
    });

    state.activeBookingId = newBooking.booking_id;
    showToast(`Đã tạo thành công đơn hàng #${newBooking.booking_id}!`);
    go('1.3', { booking_id: newBooking.booking_id });
  }

  // 1.3: Live Tracking
  function renderScreen_1_3(container, params = {}) {
    const db = window.GDX_DB;
    const bId = Number(params.booking_id || state.activeBookingId);
    const b = db.bookings.find((item) => item.booking_id === bId) || db.bookings[0];
    const s = db.services.find((item) => item.service_id === b.service_id);
    const prov = db.getProviderPublicProfiles().find((item) => item.provider_id === b.provider_id);
    const logs = db.booking_status_history.filter((l) => l.booking_id === b.booking_id);

    const steps = ['pending', 'confirmed', 'in_progress', 'completed'];
    const currentStepIdx = steps.indexOf(b.status);

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">1.3. Theo dõi đơn hàng trực tiếp · #${b.booking_id}</h1>
          <p class="screen-finding">${s ? s.title : 'Dịch vụ'} — Thời gian hẹn: ${formatDateTime(b.scheduled_time)}</p>
        </div>
        <div class="screen-actions">
          ${
            b.payment_status === 'unpaid'
              ? `<button type="button" class="btn btn-primary" onclick="GDXApp.openModal('1.8', {booking_id: ${b.booking_id}})">Thanh toán hóa đơn</button>`
              : `<span class="badge badge-positive">Đã thanh toán (paid)</span>`
          }
          ${
            b.status === 'pending' || b.status === 'confirmed'
              ? `<button type="button" class="btn btn-danger" onclick="GDXApp.openModal('1.10', {booking_id: ${b.booking_id}})">Hủy lịch hẹn</button>`
              : ''
          }
          <button type="button" class="btn btn-warning" onclick="GDXApp.openModal('1.11', {booking_id: ${b.booking_id}})">Khiếu nại / Hỗ trợ</button>
        </div>
      </div>

      <!-- Stepper Progress Timeline -->
      <div class="panel" style="margin-bottom: 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; position:relative;">
          ${steps
            .map((st, idx) => {
              const isPast = currentStepIdx >= idx;
              const isCurrent = currentStepIdx === idx;
              const labelMap = { pending: 'Chờ nhận việc', confirmed: 'Đã nhận đơn', in_progress: 'Đang làm việc', completed: 'Hoàn thành' };
              return `
              <div style="text-align:center; flex:1;">
                <div style="width:28px; height:28px; border-radius:50%; margin:0 auto 6px; display:grid; place-items:center; font-size:12px; font-weight:600; background:${isPast ? 'var(--accent)' : 'var(--app-raised)'}; color:${isPast ? '#fff' : 'var(--app-muted)'};">
                  ${idx + 1}
                </div>
                <div style="font-size:13px; font-weight:${isCurrent ? '600' : '400'}; color:${isPast ? 'var(--app-text)' : 'var(--app-muted)'};">
                  ${labelMap[st]}
                </div>
              </div>`;
            })
            .join('')}
        </div>
      </div>

      <div class="grid-12">
        <!-- Live GPS Map & Provider Info -->
        <div class="col-7">
          <div class="panel form-stack">
            <h2 class="panel-title">Vị trí &amp; Thông tin Thợ phụ trách</h2>
            <div class="geo-map-canvas">
              <div class="geo-pin-row">
                <span class="status-dot is-online"></span>
                <span><strong>Khách:</strong> ${b.address} (${b.latitude}, ${b.longitude})</span>
              </div>
              <div class="geo-pin-row" style="margin-top: 10px;">
                <span class="status-dot is-online" style="background:var(--chart-2);"></span>
                <span><strong>Thợ (${prov ? prov.full_name : 'Thợ'}):</strong> Đang ở tọa độ ${prov ? prov.lattitude : '10.7312'}, ${prov ? prov.longtitude : '106.7159'}</span>
              </div>
              <div style="font-size:12px; color:var(--app-muted); margin-top:8px;">
                Cập nhật vị trí GPS thời gian thực từ bảng <code>provider_profiles (lattitude, longtitude)</code>
              </div>
            </div>

            ${
              prov
                ? `
              <div style="display:flex; align-items:center; justify-content:space-between; padding-top:12px;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <img src="${prov.avatar_url}" alt="${prov.full_name}" style="width:52px; height:52px; border-radius:50%; object-fit:cover;">
                  <div>
                    <div style="font-weight:600; font-size:16px;">${prov.full_name}</div>
                    <div style="font-size:13px; color:var(--app-muted);">⭐ ${prov.average_rating} · ${prov.total_reviews} lượt đánh giá</div>
                  </div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.openModal('1.7', {provider_id: ${prov.provider_id}})">Hồ sơ chi tiết</button>
              </div>`
                : ''
            }
          </div>
        </div>

        <!-- Breakdown and Audit History -->
        <div class="col-5">
          <div class="panel form-stack">
            <h2 class="panel-title">Quyết toán chi phí đơn hàng</h2>
            <div style="font-size:14px; display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--app-muted);">Giá dịch vụ gốc:</span>
                <span>${formatMoney(b.total_amount - b.total_incidental)}</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--app-muted);">Chi phí phát sinh (total_incidental):</span>
                <span style="color:var(--warning); font-weight:600;">+ ${formatMoney(b.total_incidental)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; border-top:1px solid var(--app-rule); padding-top:8px; font-weight:600; font-size:16px;">
                <span>Tổng cộng (total_amount):</span>
                <span style="color:var(--accent);">${formatMoney(b.total_amount)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-top:4px;">
                <span style="color:var(--app-muted);">Trạng thái thanh toán:</span>
                <span class="badge ${b.payment_status === 'paid' ? 'badge-positive' : b.payment_status === 'refunded' ? 'badge-info' : 'badge-warning'}">
                  ${b.payment_status}
                </span>
              </div>
            </div>

            <div style="border-top:1px solid var(--app-rule); padding-top:14px; margin-top:10px;">
              <h3 style="font-size:14px; font-weight:600; margin-bottom:10px;">Lịch sử kiểm toán (booking_status_history)</h3>
              <div style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
                ${logs
                  .map(
                    (l) => `
                  <div style="background:var(--app-raised); padding:8px 10px; border-radius:6px;">
                    <div><strong>${l.previous_status || 'start'} &rarr; ${l.new_status}</strong> · <span class="stamp">${formatDateTime(l.created_at)}</span></div>
                    <div style="color:var(--app-muted); margin-top:2px;">${l.reason || '—'}</div>
                  </div>`
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 1.4: Quản lý lịch hẹn dịch vụ
  function renderScreen_1_4(container, params = {}) {
    const db = window.GDX_DB;
    const filter = params.filter || 'all';
    let userBookings = db.bookings.filter((b) => b.customer_id === state.activeCustomerId);
    if (filter !== 'all') {
      userBookings = userBookings.filter((b) => b.status === filter);
    }

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">1.4. Lịch sử &amp; Quản lý đơn hàng dịch vụ</h1>
          <p class="screen-finding">Bảng liên quan: bookings, services, reviews. Phục vụ theo dõi, đánh giá và đặt lại.</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.go('1.2')">+ Đặt lịch mới</button>
      </div>

      <div class="underline-tabs">
        <button type="button" class="u-tab" aria-selected="${filter === 'all'}" onclick="GDXApp.go('1.4', {filter:'all'})">Tất cả (${db.bookings.filter((b) => b.customer_id === state.activeCustomerId).length})</button>
        <button type="button" class="u-tab" aria-selected="${filter === 'pending'}" onclick="GDXApp.go('1.4', {filter:'pending'})">Chờ xác nhận</button>
        <button type="button" class="u-tab" aria-selected="${filter === 'in_progress'}" onclick="GDXApp.go('1.4', {filter:'in_progress'})">Đang làm</button>
        <button type="button" class="u-tab" aria-selected="${filter === 'completed'}" onclick="GDXApp.go('1.4', {filter:'completed'})">Hoàn thành</button>
        <button type="button" class="u-tab" aria-selected="${filter === 'cancelled'}" onclick="GDXApp.go('1.4', {filter:'cancelled'})">Đã hủy</button>
      </div>

      <div style="display:flex; flex-direction:column; gap:16px;">
        ${
          userBookings.length === 0
            ? `<div class="panel" style="text-align:center; padding:40px; color:var(--app-muted);">Không có đơn hàng nào trong mục này.</div>`
            : userBookings
                .map((b) => {
                  const s = db.services.find((item) => item.service_id === b.service_id);
                  const prov = db.getProviderPublicProfiles().find((item) => item.provider_id === b.provider_id);
                  const rev = db.reviews.find((r) => r.booking_id === b.booking_id);

                  return `
            <div class="panel" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
              <div>
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                  <span class="mono-id">#${b.booking_id}</span>
                  <span class="badge ${b.status === 'completed' ? 'badge-positive' : b.status === 'in_progress' ? 'badge-warning' : b.status === 'cancelled' ? 'badge-negative' : 'badge-neutral'}">
                    ${b.status}
                  </span>
                  <span class="badge ${b.payment_status === 'paid' ? 'badge-positive' : 'badge-warning'}">
                    ${b.payment_status}
                  </span>
                </div>
                <h3 style="font-size:16px; font-weight:600;">${s ? s.title : 'Dịch vụ'}</h3>
                <div style="font-size:13px; color:var(--app-muted); margin-top:4px;">
                  Hẹn lúc: <strong>${formatDateTime(b.scheduled_time)}</strong> · Thợ: ${prov ? prov.full_name : '—'}
                </div>
                <div style="font-size:13px; color:var(--app-muted); margin-top:2px;">
                  Địa chỉ: ${b.address}
                </div>
              </div>

              <div style="text-align:right;">
                <div style="font-size:18px; font-weight:600; color:var(--accent);">${formatMoney(b.total_amount)}</div>
                ${b.total_incidental > 0 ? `<div style="font-size:12px; color:var(--warning);">Đã gồm ${formatMoney(b.total_incidental)} phát sinh</div>` : ''}
                
                <div style="display:flex; gap:8px; margin-top:10px;">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.go('1.3', {booking_id: ${b.booking_id}})">Xem chi tiết</button>
                  ${
                    b.status === 'completed' && !rev
                      ? `<button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.openModal('1.9', {booking_id: ${b.booking_id}})">Đánh giá thợ</button>`
                      : b.status === 'completed' && rev
                      ? `<span class="badge badge-positive" style="font-size:12px;">Đã đánh giá (${rev.rating}⭐)</span>`
                      : ''
                  }
                  <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.startBookingFromCatalog(${b.service_id})">Đặt lại</button>
                </div>
              </div>
            </div>`;
                })
                .join('')
        }
      </div>
    `;
  }

  // 1.5: Hồ sơ cá nhân & Sổ địa chỉ
  function renderScreen_1_5(container) {
    const db = window.GDX_DB;
    const u = db.users.find((user) => user.user_id === state.activeUserId);
    const cp = db.customer_profiles.find((p) => p.user_id === state.activeUserId);
    const wards = db.ward.filter((w) => w.provinceId === '79');

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">1.5. Hồ sơ cá nhân &amp; Sổ địa chỉ mặc định</h1>
          <p class="screen-finding">Bảng liên quan: users, customer_profiles, province, ward. RLS cp_own cho phép sửa địa chỉ.</p>
        </div>
      </div>

      <div class="settings-split-row">
        <div class="settings-meta-col">
          <h2>Thông tin tài khoản định danh</h2>
          <p>Họ tên và số điện thoại dùng để liên lạc khi thợ đến nhà.</p>
        </div>
        <div class="settings-panel-col">
          <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.saveUserProfile(this);">
            <div class="field-group">
              <label class="field-label">Họ và tên (users.full_name)</label>
              <input type="text" name="full_name" class="input" value="${u ? u.full_name : ''}" required>
            </div>
            <div class="field-group">
              <label class="field-label">Số điện thoại (users.phone_number)</label>
              <input type="tel" name="phone_number" class="input" value="${u ? u.phone_number : ''}" required>
            </div>
            <button type="submit" class="btn btn-primary btn-sm" style="align-self: flex-start;">Lưu thông tin</button>
          </form>
        </div>
      </div>

      <div class="settings-split-row">
        <div class="settings-meta-col">
          <h2>Địa chỉ &amp; Tọa độ mặc định</h2>
          <p>Tự động điền vào Booking Wizard ở các lần đặt sau.</p>
        </div>
        <div class="settings-panel-col">
          <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.saveCustomerAddress(this);">
            <div class="form-row-2">
              <div class="field-group">
                <label class="field-label">Phường / Xã (customer_profiles.ward_id)</label>
                <select name="ward_id" class="select">
                  ${wards.map((w) => `<option value="${w.ward_id}" ${cp && cp.ward_id === w.ward_id ? 'selected' : ''}>${w.name}</option>`).join('')}
                </select>
              </div>
              <div class="field-group">
                <label class="field-label">Tọa độ GPS (latitude, longitude)</label>
                <input type="text" name="coords" class="input" value="${cp ? cp.latitude : '10.728912'}, ${cp ? cp.longitude : '106.712405'}">
              </div>
            </div>
            <div class="field-group">
              <label class="field-label">Địa chỉ chi tiết (customer_profiles.default_address)</label>
              <input type="text" name="default_address" class="input" value="${cp ? cp.default_address : ''}">
            </div>
            <button type="submit" class="btn btn-primary btn-sm" style="align-self: flex-start;">Lưu địa chỉ</button>
          </form>
        </div>
      </div>
    `;
  }

  function saveUserProfile(form) {
    const db = window.GDX_DB;
    const u = db.users.find((user) => user.user_id === state.activeUserId);
    if (u) {
      u.full_name = form.full_name.value;
      u.phone_number = form.phone_number.value;
      showToast('Đã cập nhật thông tin cá nhân!');
    }
  }

  function saveCustomerAddress(form) {
    const db = window.GDX_DB;
    const cp = db.customer_profiles.find((p) => p.user_id === state.activeUserId);
    if (cp) {
      cp.ward_id = form.ward_id.value;
      cp.default_address = form.default_address.value;
      showToast('Đã lưu sổ địa chỉ mặc định!');
    }
  }

  // 1.6: Danh sách Dịch vụ yêu thích
  function renderScreen_1_6(container) {
    const db = window.GDX_DB;
    const favs = db.favorites.filter((f) => f.customer_id === state.activeCustomerId);

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">1.6. Dịch vụ gia đình đã lưu (${favs.length})</h1>
          <p class="screen-finding">Bảng liên quan: favorites join services. RLS fav_own chỉ trả về dữ liệu của customer sở hữu.</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">
        ${
          favs.length === 0
            ? `<div class="panel col-12" style="text-align:center; padding:40px; color:var(--app-muted);">Chưa có dịch vụ yêu thích nào.</div>`
            : favs
                .map((f) => {
                  const s = db.services.find((item) => item.service_id === f.service_id);
                  if (!s) return '';
                  return `
            <div class="panel" style="display:flex; flex-direction:column; justify-content:space-between; gap:14px;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:baseline;">
                  <h3 style="font-size:16px; font-weight:600;">${s.title}</h3>
                  <span style="font-weight:600; color:var(--accent); font-size:16px;">${formatMoney(s.price)}${s.pricing_type === 'hourly' ? '/h' : ''}</span>
                </div>
                <p style="font-size:13px; color:var(--app-muted); margin-top:8px;">${s.description}</p>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--app-rule); padding-top:10px;">
                <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.toggleFavorite(${s.service_id}); GDXApp.renderScreen_1_6(document.getElementById('mainViewport'));">
                  Xóa khỏi mục lưu
                </button>
                <button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.startBookingFromCatalog(${s.service_id})">
                  Đặt lịch ngay &rarr;
                </button>
              </div>
            </div>`;
                })
                .join('')
        }
      </div>
    `;
  }

  // =====================================================================
  // SCREEN RENDERERS: PHÂN HỆ 2 (PROVIDER PORTAL)
  // =====================================================================

  // 2.1: Sàn nhận việc làm (Job Board)
  function renderScreen_2_1(container) {
    const db = window.GDX_DB;
    const pendingJobs = db.bookings.filter((b) => b.status === 'pending');

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">2.1. Sàn nhận việc làm · Ca hẹn mới (${pendingJobs.length})</h1>
          <p class="screen-finding">Lọc tự động theo chuyên môn (provider_services) và khu vực đăng ký (provider_areas).</p>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.go('2.4')">Cấu hình kỹ năng &amp; Khu vực</button>
      </div>

      <div style="display:flex; flex-direction:column; gap:16px;">
        ${
          pendingJobs.length === 0
            ? `<div class="panel" style="text-align:center; padding:40px; color:var(--app-muted);">Hiện không có ca hẹn mới nào chờ nhận.</div>`
            : pendingJobs
                .map((b) => {
                  const s = db.services.find((item) => item.service_id === b.service_id);
                  const w = db.ward.find((item) => item.ward_id === b.ward_id);

                  return `
            <div class="panel" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
              <div>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                  <span class="mono-id">#${b.booking_id}</span>
                  <span class="badge badge-warning">Chờ nhận việc (pending)</span>
                </div>
                <h3 style="font-size:17px; font-weight:600;">${s ? s.title : 'Dịch vụ'}</h3>
                <div style="font-size:13px; color:var(--app-muted); margin-top:4px;">
                  Thời gian bắt đầu: <strong>${formatDateTime(b.scheduled_time)}</strong> (${s ? s.estimated_duration : 120} phút)
                </div>
                <div style="font-size:13px; color:var(--app-muted); margin-top:2px;">
                  Địa chỉ: ${b.address} (${w ? w.name : ''})
                </div>
                ${b.notes ? `<div style="font-size:13px; background:var(--app-raised); padding:6px 10px; border-radius:4px; margin-top:6px;">Ghi chú: ${b.notes}</div>` : ''}
              </div>

              <div style="text-align:right;">
                <div style="font-size:20px; font-weight:600; color:var(--accent);">${formatMoney(b.total_amount)}</div>
                <div style="font-size:12px; color:var(--app-muted);">Thu nhập dự kiến</div>

                <div style="display:flex; gap:8px; margin-top:12px;">
                  <button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.providerAcceptJob(${b.booking_id})">
                    Nhận việc ngay
                  </button>
                  <button type="button" class="btn btn-danger btn-sm" onclick="GDXApp.openModal('2.8', {booking_id: ${b.booking_id}, action: 'reject'})">
                    Từ chối
                  </button>
                </div>
              </div>
            </div>`;
                })
                .join('')
        }
      </div>
    `;
  }

  function providerAcceptJob(bookingId) {
    const res = RPC.transitionBookingStatus(bookingId, 'confirmed', 'Thợ Đặng Thị Mai Lan đã xác nhận nhận ca');
    if (res.success) {
      showToast(`Đã nhận ca #${bookingId}!`);
      state.activeBookingId = bookingId;
      go('2.2');
    } else {
      showToast(res.message, 'error');
    }
  }

  // 2.2: Live Working Shift & Timer
  function renderScreen_2_2(container) {
    const db = window.GDX_DB;
    // Find active shift in_progress or confirmed
    let b = db.bookings.find((item) => item.status === 'in_progress' || item.status === 'confirmed') || db.bookings[0];
    const s = db.services.find((item) => item.service_id === b.service_id);

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">2.2. Ca làm việc hiện tại · Bấm giờ &amp; Tác nghiệp tại nhà</h1>
          <p class="screen-finding">Bảng liên quan: bookings (total_incidental, status in_progress -> completed).</p>
        </div>
        <div class="screen-actions">
          <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.openModal('2.7', {booking_id: ${b.booking_id}})">
            + Kê khai chi phí phát sinh
          </button>
          <button type="button" class="btn btn-warning btn-sm" onclick="GDXApp.openModal('2.9', {booking_id: ${b.booking_id}})">
            Báo cáo sự cố khẩn cấp
          </button>
        </div>
      </div>

      <div class="grid-12">
        <!-- Timer Clock and Actions -->
        <div class="col-6">
          <div class="panel form-stack" style="text-align:center; padding:32px 20px;">
            <div class="badge badge-info" style="align-self:center; font-size:13px; padding:4px 12px;">
              Đơn hàng #${b.booking_id} · Trạng thái: ${b.status}
            </div>

            <div style="margin: 20px 0;">
              <div id="liveTimerDigits" class="timer-digits" style="font-size: 56px; font-weight: 600; color: var(--app-text); letter-spacing: 2px;">
                ${formatSeconds(state.timerSeconds)}
              </div>
              <div style="font-size:13px; color:var(--app-muted); margin-top:4px;">
                Đồng hồ thời gian làm việc thực tế (pricing_type: ${s ? s.pricing_type : 'hourly'})
              </div>
            </div>

            <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
              ${
                b.status === 'confirmed'
                  ? `<button type="button" class="btn btn-primary" onclick="GDXApp.startShiftWork(${b.booking_id})">Bắt đầu tính giờ ca làm</button>`
                  : b.status === 'in_progress'
                  ? `
                <button type="button" class="btn btn-secondary" onclick="GDXApp.toggleTimerPause()">
                  ${state.isTimerRunning ? 'Tạm dừng đồng hồ' : 'Tiếp tục bấm giờ'}
                </button>
                <button type="button" class="btn btn-primary" onclick="GDXApp.completeShiftWork(${b.booking_id})">
                  Hoàn thành ca làm việc &rarr;
                </button>`
                  : `<span class="badge badge-positive" style="font-size:15px; padding:8px 16px;">Ca làm đã kết thúc (${b.status})</span>`
              }
              <button type="button" class="btn btn-danger btn-sm" onclick="GDXApp.openModal('2.8', {booking_id: ${b.booking_id}, action: 'cancel'})">
                Hủy ca bất khả kháng
              </button>
            </div>
          </div>
        </div>

        <!-- Details & Customer Coordinates -->
        <div class="col-6">
          <div class="panel form-stack">
            <h2 class="panel-title">Chi tiết khách hàng &amp; Vật tư</h2>
            <div style="font-size:14px; display:flex; flex-direction:column; gap:8px;">
              <div><strong>Khách hàng:</strong> Nguyễn Minh Thảo (0908341289)</div>
              <div><strong>Địa chỉ:</strong> ${b.address}</div>
              <div><strong>Ghi chú:</strong> ${b.notes || 'Không có'}</div>
              <div style="border-top:1px solid var(--app-rule); padding-top:8px;">
                <strong>Chi phí phát sinh hiện tại:</strong> <span style="color:var(--warning); font-weight:600;">${formatMoney(b.total_incidental)}</span>
              </div>
              <div>
                <strong>Tổng hóa đơn sau cùng:</strong> <span style="color:var(--accent); font-weight:600; font-size:16px;">${formatMoney(b.total_amount)}</span>
              </div>
            </div>

            <div class="geo-map-canvas" style="min-height:160px; margin-top:8px;">
              <div class="geo-pin-row">
                <span class="status-dot is-online"></span>
                <span>Tọa độ đích: ${b.latitude}, ${b.longitude} (Đã check-in hiện trường)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    startLiveTimer();
  }

  function startShiftWork(bookingId) {
    RPC.transitionBookingStatus(bookingId, 'in_progress', 'Thợ đã đến nhà khách, check-in GPS và bắt đầu bấm giờ');
    state.isTimerRunning = true;
    showToast('Đã bắt đầu tính giờ ca làm!');
    renderScreen_2_2(document.getElementById('mainViewport'));
  }

  function toggleTimerPause() {
    state.isTimerRunning = !state.isTimerRunning;
    showToast(state.isTimerRunning ? 'Đã tiếp tục bấm giờ' : 'Đã tạm dừng đồng hồ');
    renderScreen_2_2(document.getElementById('mainViewport'));
  }

  function completeShiftWork(bookingId) {
    RPC.transitionBookingStatus(bookingId, 'completed', 'Thợ đã hoàn tất công việc, bàn giao và chốt chi phí');
    state.isTimerRunning = false;
    showToast('Đã chuyển trạng thái ca làm sang COMPLETED! Chờ khách thanh toán.');
    renderScreen_2_2(document.getElementById('mainViewport'));
  }

  // 2.3: Income Wallet & Shift Calendar
  function renderScreen_2_3(container) {
    const db = window.GDX_DB;
    const completedPaid = db.bookings.filter((b) => b.provider_id === state.activeProviderId && b.status === 'completed' && b.payment_status === 'paid');
    const totalEarnings = completedPaid.reduce((acc, cur) => acc + cur.total_amount, 0);
    const prov = db.provider_profiles.find((p) => p.provider_id === state.activeProviderId);
    const scheds = db.availability_schedules.filter((s) => s.provider_id === state.activeProviderId);

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">2.3. Ví thu nhập &amp; Lịch làm việc tuần</h1>
          <p class="screen-finding">Bảng liên quan: bookings (completed &amp; paid), availability_schedules, availability_exceptions.</p>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.openModal('2.6')">
          Cài đặt Lịch cố định &amp; Nghỉ phép
        </button>
      </div>

      <!-- KPI Summary Strip -->
      <div class="kpi-strip">
        <div class="kpi-cell">
          <div class="kpi-label">Tổng thu nhập đã quyết toán</div>
          <div class="kpi-val">${formatMoney(totalEarnings)}</div>
          <div class="kpi-note delta-pos">Từ ${completedPaid.length} ca hoàn thành</div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">Điểm đánh giá uy tín</div>
          <div class="kpi-val">${prov ? prov.average_rating : '5.0'} ⭐</div>
          <div class="kpi-note">${prov ? prov.total_reviews : '0'} lượt đánh giá từ khách</div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">Số ngày làm cố định</div>
          <div class="kpi-val">${scheds.length} ngày / tuần</div>
          <div class="kpi-note">Theo availability_schedules</div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">Tỷ lệ hoàn thành ca</div>
          <div class="kpi-val">98.5%</div>
          <div class="kpi-note delta-pos">+1.2% so với tháng trước</div>
        </div>
      </div>

      <!-- Chart and Schedule -->
      <div class="grid-12">
        <div class="col-7">
          <div class="panel form-stack">
            <h2 class="panel-title">Doanh thu 7 ngày gần nhất (Charts.bars)</h2>
            <div id="providerWeeklyIncomeChart" style="min-height: 220px; width:100%;"></div>
          </div>
        </div>

        <div class="col-5">
          <div class="panel form-stack">
            <h2 class="panel-title">Khung giờ làm việc tuần này</h2>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${
                scheds.length === 0
                  ? `<div style="color:var(--app-muted);">Chưa cài đặt lịch làm.</div>`
                  : scheds
                      .map((s) => {
                        const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
                        return `
                    <div style="display:flex; justify-content:space-between; padding:8px 10px; background:var(--app-raised); border-radius:6px; font-size:13px;">
                      <span><strong>${dayNames[s.day_of_week]}</strong></span>
                      <span class="mono-id">${s.start_time} — ${s.end_time}</span>
                    </div>`;
                      })
                      .join('')
              }
            </div>
            <button type="button" class="btn btn-secondary btn-sm" style="margin-top:10px;" onclick="GDXApp.openModal('2.6')">
              Đăng ký nghỉ phép đột xuất
            </button>
          </div>
        </div>
      </div>
    `;

    // Render SVG chart using taste-skill charts.js
    setTimeout(() => {
      const chartEl = document.getElementById('providerWeeklyIncomeChart');
      if (chartEl && window.Charts) {
        chartEl.innerHTML = '';
        window.Charts.bars(chartEl, {
          labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
          values: [560000, 625000, 480000, 0, 750000, 890000, 505000],
          highlight: 5,
          format: (v) => formatMoney(v),
        });
      }
    }, 50);
  }

  // 2.4: Skills & Service Areas Configuration
  function renderScreen_2_4(container) {
    const db = window.GDX_DB;
    const prov = db.provider_profiles.find((p) => p.provider_id === state.activeProviderId);
    const u = db.users.find((user) => user.user_id === state.activeUserId);
    const myServices = db.provider_services.filter((ps) => ps.provider_id === state.activeProviderId).map((ps) => ps.service_id);
    const myAreas = db.provider_areas.filter((pa) => pa.provider_id === state.activeProviderId).map((pa) => pa.ward_id);
    const wards = db.ward.filter((w) => w.provinceId === '79');

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">2.4. Cấu hình Năng lực chuyên môn &amp; Địa bàn hoạt động</h1>
          <p class="screen-finding">Bảng liên quan: provider_services, provider_areas. Nếu rỗng hệ thống sẽ không phân phối đơn hàng.</p>
        </div>
      </div>

      <div class="settings-split-row">
        <div class="settings-meta-col">
          <h2>Hồ sơ đối tác hành nghề</h2>
          <p>Số CCCD đã được xác minh lý lịch tư pháp không thể chỉnh sửa.</p>
        </div>
        <div class="settings-panel-col form-stack">
          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label">Họ và tên</label>
              <input type="text" class="input" value="${u ? u.full_name : ''}">
            </div>
            <div class="field-group">
              <label class="field-label">Số CCCD (verification_status: verified)</label>
              <input type="text" class="input" value="${prov ? prov.id_card_number : ''}" readonly>
            </div>
          </div>
          <div class="field-group">
            <label class="field-label">Mô tả kinh nghiệm &amp; Giới thiệu (provider_profiles.info)</label>
            <textarea class="textarea" rows="2">${prov ? prov.info : ''}</textarea>
          </div>
        </div>
      </div>

      <div class="settings-split-row">
        <div class="settings-meta-col">
          <h2>Danh mục dịch vụ tiếp nhận</h2>
          <p>Chọn các dịch vụ có chứng chỉ nghiệp vụ (provider_services).</p>
        </div>
        <div class="settings-panel-col">
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px;">
            ${db.services
              .filter((s) => s.is_active)
              .map(
                (s) => `
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; background:var(--app-surface); padding:8px 12px; border-radius:6px; border:1px solid var(--app-border);">
                <input type="checkbox" name="provServices" value="${s.service_id}" ${myServices.includes(s.service_id) ? 'checked' : ''}>
                <span>${s.title}</span>
              </label>`
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="settings-split-row">
        <div class="settings-meta-col">
          <h2>Địa bàn nhận việc (Phường / Xã)</h2>
          <p>Chỉ những đơn hàng thuộc danh sách Phường này mới hiển thị trên Job Board (provider_areas).</p>
        </div>
        <div class="settings-panel-col">
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px;">
            ${wards
              .map(
                (w) => `
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; background:var(--app-surface); padding:8px 12px; border-radius:6px; border:1px solid var(--app-border);">
                <input type="checkbox" name="provAreas" value="${w.ward_id}" ${myAreas.includes(w.ward_id) ? 'checked' : ''}>
                <span>${w.name}</span>
              </label>`
              )
              .join('')}
          </div>
          <button type="button" class="btn btn-primary" style="margin-top:16px;" onclick="GDXApp.showToast('Đã lưu cấu hình năng lực & địa bàn thành công!')">
            Lưu thay đổi năng lực
          </button>
        </div>
      </div>
    `;
  }

  // =====================================================================
  // SCREEN RENDERERS: PHÂN HỆ 3 (ADMIN PORTAL)
  // =====================================================================

  // 3.1: Admin Overview & Dispatch Dashboard
  function renderScreen_3_1(container) {
    const db = window.GDX_DB;
    const totalRev = db.bookings.filter((b) => b.payment_status === 'paid').reduce((a, c) => a + c.total_amount, 0);
    const pendingJobs = db.bookings.filter((b) => b.status === 'pending');
    const runningJobs = db.bookings.filter((b) => b.status === 'in_progress');
    const openTickets = db.support_tickets.filter((t) => t.status === 'open' || t.status === 'in_progress');
    const pendingKYC = db.provider_profiles.filter((p) => p.verification_status === 'pending');

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">3.1. Dashboard Tổng quan &amp; Điều phối Trung tâm</h1>
          <p class="screen-finding">Thực thi quyền admin_all trên 16 bảng. Giám sát doanh thu, đơn hàng kẹt và kiểm toán hệ thống.</p>
        </div>
        <div class="screen-actions">
          <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.openModal('3.9')">Quản lý Tỉnh/Phường</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.openModal('3.8')">+ Thêm Dịch vụ mới</button>
        </div>
      </div>

      <!-- KPI Strip -->
      <div class="kpi-strip">
        <div class="kpi-cell">
          <div class="kpi-label">Tổng doanh thu hệ thống</div>
          <div class="kpi-val">${formatMoney(totalRev)}</div>
          <div class="kpi-note delta-pos">Đã thanh toán (paid)</div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">Đơn đang chạy / Chờ điều phối</div>
          <div class="kpi-val">${runningJobs.length} / ${pendingJobs.length} đơn</div>
          <div class="kpi-note">in_progress / pending</div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">Hồ sơ Thợ chờ duyệt KYC</div>
          <div class="kpi-val">${pendingKYC.length} hồ sơ</div>
          <div class="kpi-note"><a href="#3.3" onclick="GDXApp.go('3.3'); return false;" style="color:var(--accent);">Xét duyệt ngay &rarr;</a></div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">Phiếu hỗ trợ đang mở</div>
          <div class="kpi-val">${openTickets.length} phiếu</div>
          <div class="kpi-note">open / in_progress</div>
        </div>
      </div>

      <!-- Revenue Chart & Dispatch Map -->
      <div class="grid-12" style="margin-bottom: 24px;">
        <div class="col-7">
          <div class="panel form-stack">
            <h2 class="panel-title">Doanh thu thanh toán theo tháng (Charts.line)</h2>
            <div id="adminRevenueLineChart" style="min-height: 220px; width:100%;"></div>
          </div>
        </div>
        <div class="col-5">
          <div class="panel form-stack">
            <h2 class="panel-title">Bản đồ nhiệt điều phối vị trí Thợ &amp; Khách</h2>
            <div class="geo-map-canvas" style="min-height: 220px;">
              <div class="geo-pin-row">
                <span class="status-dot is-online"></span>
                <span>3 Thợ verified đang trực tuyến tại Q.7 &amp; TP. Thủ Đức</span>
              </div>
              <div class="geo-pin-row">
                <span class="status-dot is-online" style="background:var(--negative);"></span>
                <span>${pendingJobs.length} Đơn hàng đang chờ thợ nhận việc tại Phường Tân Phong</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Dispatch & Booking Action Table -->
      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Danh sách đơn hàng cần giám sát điều phối</h2>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Thợ phân công</th>
                <th>Thời gian hẹn</th>
                <th>Địa chỉ</th>
                <th>Trạng thái</th>
                <th>Thanh toán</th>
                <th class="col-num">Tổng tiền</th>
                <th>Thao tác quản trị</th>
              </tr>
            </thead>
            <tbody>
              ${db.bookings
                .map((b) => {
                  const cust = db.users.find((u) => {
                    const cp = db.customer_profiles.find((p) => p.customer_id === b.customer_id);
                    return cp && cp.user_id === u.user_id;
                  });
                  const prov = db.getProviderPublicProfiles().find((p) => p.provider_id === b.provider_id);

                  return `
                <tr>
                  <td class="mono-id">#${b.booking_id}</td>
                  <td>${cust ? cust.full_name : 'Khách #' + b.customer_id}</td>
                  <td>${prov ? prov.full_name : 'Chưa phân công'}</td>
                  <td>${formatDateTime(b.scheduled_time)}</td>
                  <td>${b.address}</td>
                  <td>
                    <span class="badge ${b.status === 'completed' ? 'badge-positive' : b.status === 'in_progress' ? 'badge-warning' : b.status === 'cancelled' ? 'badge-negative' : 'badge-neutral'}">
                      ${b.status}
                    </span>
                  </td>
                  <td>
                    <span class="badge ${b.payment_status === 'paid' ? 'badge-positive' : b.payment_status === 'refunded' ? 'badge-info' : 'badge-warning'}">
                      ${b.payment_status}
                    </span>
                  </td>
                  <td class="col-num"><strong>${formatMoney(b.total_amount)}</strong></td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.openModal('3.5', {booking_id: ${b.booking_id}})">Xem Log</button>
                      <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.openModal('3.6', {booking_id: ${b.booking_id}})">Hoàn tiền/Sửa</button>
                    </div>
                  </td>
                </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    setTimeout(() => {
      const chartEl = document.getElementById('adminRevenueLineChart');
      if (chartEl && window.Charts) {
        chartEl.innerHTML = '';
        window.Charts.line(chartEl, {
          labels: ['Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10'],
          series: [{ name: 'Doanh thu (VND)', values: [18500000, 24000000, 31200000, 42800000, 58900000, 74200000] }],
          format: (v) => formatMoney(v),
        });
      }
    }, 50);
  }

  // 3.2: Category & Pricing Management
  function renderScreen_3_2(container) {
    const db = window.GDX_DB;

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">3.2. Quản lý Danh mục &amp; Cấu hình Biểu giá Dịch vụ</h1>
          <p class="screen-finding">Bảng liên quan: service_categories (cây danh mục parent_id), services (ràng buộc price >= 0, duration > 0).</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.openModal('3.8')">+ Thêm Danh mục / Dịch vụ</button>
      </div>

      <!-- Categories Table -->
      <div class="panel" style="margin-bottom: 24px;">
        <h2 class="panel-title" style="margin-bottom: 12px;">Cây danh mục dịch vụ (service_categories)</h2>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên danh mục</th>
                <th>Cấp cha (parent_id)</th>
                <th>Đường dẫn (slug)</th>
                <th>Hiển thị (status)</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              ${db.service_categories
                .map(
                  (c) => `
                <tr>
                  <td class="mono-id">${c.category_id}</td>
                  <td><strong>${c.parent_id ? '↳ ' : ''}${c.category_name}</strong></td>
                  <td>${c.parent_id ? '#' + c.parent_id : 'Danh mục gốc'}</td>
                  <td class="mono-id">${c.slug}</td>
                  <td>
                    <label style="display:flex; align-items:center; gap:6px;">
                      <input type="checkbox" ${c.status ? 'checked' : ''} onchange="c.status = this.checked; GDXApp.showToast('Đã đổi trạng thái danh mục')">
                      <span>${c.status ? 'Hiển thị' : 'Ẩn'}</span>
                    </label>
                  </td>
                  <td>
                    <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.openModal('3.8', {category_id: ${c.category_id}})">Sửa</button>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Services Table -->
      <div class="panel">
        <h2 class="panel-title" style="margin-bottom: 12px;">Bảng dịch vụ chi tiết (services)</h2>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên dịch vụ</th>
                <th>Danh mục</th>
                <th>Giá niêm yết</th>
                <th>Kiểu tính</th>
                <th>Thời lượng</th>
                <th>Trạng thái (is_active)</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              ${db.services
                .map((s) => {
                  const cat = db.service_categories.find((c) => c.category_id === s.category_id);
                  return `
                <tr>
                  <td class="mono-id">${s.service_id}</td>
                  <td><strong>${s.title}</strong></td>
                  <td>${cat ? cat.category_name : '—'}</td>
                  <td><strong style="color:var(--accent);">${formatMoney(s.price)}</strong></td>
                  <td>${s.pricing_type}</td>
                  <td>${s.estimated_duration} phút</td>
                  <td>
                    <label style="display:flex; align-items:center; gap:6px;">
                      <input type="checkbox" ${s.is_active ? 'checked' : ''} onchange="s.is_active = this.checked; GDXApp.showToast('Đã cập nhật is_active dịch vụ')">
                      <span>${s.is_active ? 'Kích hoạt' : 'Tạm tắt'}</span>
                    </label>
                  </td>
                  <td>
                    <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.openModal('3.8', {service_id: ${s.service_id}})">Sửa</button>
                  </td>
                </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 3.3: Partner KYC Verification
  function renderScreen_3_3(container, params = {}) {
    const db = window.GDX_DB;
    const filter = params.filter || 'pending';
    const provs = db.provider_profiles.filter((p) => p.verification_status === filter);

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">3.3. Xét duyệt Hồ sơ Đối tác Thợ (KYC Review)</h1>
          <p class="screen-finding">Bảng liên quan: provider_profiles (verification_status: pending -> verified / rejected).</p>
        </div>
      </div>

      <div class="underline-tabs">
        <button type="button" class="u-tab" aria-selected="${filter === 'pending'}" onclick="GDXApp.go('3.3', {filter:'pending'})">
          Chờ duyệt (${db.provider_profiles.filter((p) => p.verification_status === 'pending').length})
        </button>
        <button type="button" class="u-tab" aria-selected="${filter === 'verified'}" onclick="GDXApp.go('3.3', {filter:'verified'})">
          Đã phê duyệt (${db.provider_profiles.filter((p) => p.verification_status === 'verified').length})
        </button>
        <button type="button" class="u-tab" aria-selected="${filter === 'rejected'}" onclick="GDXApp.go('3.3', {filter:'rejected'})">
          Đã từ chối (${db.provider_profiles.filter((p) => p.verification_status === 'rejected').length})
        </button>
      </div>

      <div style="display:flex; flex-direction:column; gap:16px;">
        ${
          provs.length === 0
            ? `<div class="panel" style="text-align:center; padding:40px; color:var(--app-muted);">Không có hồ sơ nào trong mục này.</div>`
            : provs
                .map((p) => {
                  const u = db.users.find((user) => user.user_id === p.user_id);
                  const svcs = db.provider_services
                    .filter((ps) => ps.provider_id === p.provider_id)
                    .map((ps) => {
                      const s = db.services.find((item) => item.service_id === ps.service_id);
                      return s ? s.title : '';
                    })
                    .filter(Boolean);
                  const areas = db.provider_areas
                    .filter((pa) => pa.provider_id === p.provider_id)
                    .map((pa) => {
                      const w = db.ward.find((item) => item.ward_id === pa.ward_id);
                      return w ? w.name : '';
                    })
                    .filter(Boolean);

                  return `
            <div class="panel" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
              <div style="display:flex; gap:16px; align-items:flex-start;">
                <img src="${p.avatar_url}" alt="${u ? u.full_name : ''}" style="width:64px; height:64px; border-radius:50%; object-fit:cover;">
                <div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <h3 style="font-size:17px; font-weight:600;">${u ? u.full_name : '—'}</h3>
                    <span class="badge ${p.verification_status === 'verified' ? 'badge-positive' : p.verification_status === 'pending' ? 'badge-warning' : 'badge-negative'}">
                      ${p.verification_status}
                    </span>
                  </div>
                  <div style="font-size:13px; color:var(--app-muted); margin-top:4px;">
                    SĐT: <strong>${u ? u.phone_number : '—'}</strong> · Số CCCD: <strong class="mono-id">${p.id_card_number}</strong>
                  </div>
                  <p style="font-size:14px; margin-top:8px; line-height:1.5;">${p.info || 'Chưa có thông tin giới thiệu'}</p>
                  
                  <div style="margin-top:10px; display:flex; flex-direction:column; gap:4px; font-size:12px;">
                    <div><strong>Dịch vụ đăng ký:</strong> ${svcs.join(', ') || 'Chưa đăng ký'}</div>
                    <div><strong>Khu vực đăng ký:</strong> ${areas.join('; ') || 'Chưa đăng ký'}</div>
                  </div>
                </div>
              </div>

              <div>
                ${
                  p.verification_status === 'pending'
                    ? `
                  <div style="display:flex; gap:8px;">
                    <button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.adminVerifyKYC(${p.provider_id}, 'verified')">Phê duyệt (Verified)</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="GDXApp.adminVerifyKYC(${p.provider_id}, 'rejected')">Từ chối (Reject)</button>
                  </div>`
                    : `<span class="badge badge-neutral">Đã xử lý hồ sơ</span>`
                }
              </div>
            </div>`;
                })
                .join('')
        }
      </div>
    `;
  }

  function adminVerifyKYC(providerId, status) {
    const prov = window.GDX_DB.provider_profiles.find((p) => p.provider_id === Number(providerId));
    if (prov) {
      prov.verification_status = status;
      prov.updated_at = new Date().toISOString();
      showToast(`Hồ sơ thợ #${providerId} đã chuyển sang ${status.toUpperCase()}!`);
      go('3.3', { filter: status });
    }
  }

  // 3.4: User Management & Dispute Resolution (Split Tabs)
  function renderScreen_3_4(container, params = {}) {
    const db = window.GDX_DB;
    const tab = params.tab || 'users';

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">3.4. Quản lý Người dùng, Phiếu Hỗ trợ &amp; Kiểm duyệt</h1>
          <p class="screen-finding">Bảng liên quan: users (is_active), support_tickets (status, priority), reviews.</p>
        </div>
      </div>

      <div class="underline-tabs">
        <button type="button" class="u-tab" aria-selected="${tab === 'users'}" onclick="GDXApp.go('3.4', {tab:'users'})">Người dùng (${db.users.length})</button>
        <button type="button" class="u-tab" aria-selected="${tab === 'tickets'}" onclick="GDXApp.go('3.4', {tab:'tickets'})">Phiếu hỗ trợ (${db.support_tickets.length})</button>
        <button type="button" class="u-tab" aria-selected="${tab === 'reviews'}" onclick="GDXApp.go('3.4', {tab:'reviews'})">Kiểm duyệt đánh giá (${db.reviews.length})</button>
      </div>

      <div id="tab34Container">
        ${
          tab === 'users'
            ? `
          <div class="panel">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>UUID (user_id)</th>
                    <th>Họ và tên</th>
                    <th>Số điện thoại</th>
                    <th>Vai trò (role)</th>
                    <th>Ngày tạo</th>
                    <th>Khóa / Mở (users.is_active)</th>
                  </tr>
                </thead>
                <tbody>
                  ${db.users
                    .map(
                      (u) => `
                    <tr>
                      <td class="mono-id">${u.user_id.slice(0, 8)}...</td>
                      <td><strong>${u.full_name}</strong></td>
                      <td>${u.phone_number}</td>
                      <td><span class="badge ${u.role === 'admin' ? 'badge-info' : u.role === 'provider' ? 'badge-warning' : 'badge-neutral'}">${u.role}</span></td>
                      <td class="stamp">${formatDateTime(u.created_at)}</td>
                      <td>
                        <label style="display:flex; align-items:center; gap:8px;">
                          <input type="checkbox" ${u.is_active ? 'checked' : ''} onchange="u.is_active = this.checked; GDXApp.showToast('Đã cập nhật trạng thái tài khoản')">
                          <span style="color:${u.is_active ? 'var(--positive)' : 'var(--negative)'}; font-weight:600;">
                            ${u.is_active ? 'Hoạt động' : 'Đã khóa'}
                          </span>
                        </label>
                      </td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>`
            : tab === 'tickets'
            ? `
          <div class="panel">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Đơn liên quan</th>
                    <th>Tiêu đề khiếu nại</th>
                    <th>Độ ưu tiên</th>
                    <th>Trạng thái</th>
                    <th>Ngày gửi</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  ${db.support_tickets
                    .map(
                      (t) => `
                    <tr>
                      <td class="mono-id">#${t.ticket_id}</td>
                      <td>${t.booking_id ? '#' + t.booking_id : 'Chung'}</td>
                      <td><strong>${t.subject}</strong></td>
                      <td>
                        <span class="badge ${t.priority === 'urgent' ? 'badge-negative' : t.priority === 'high' ? 'badge-warning' : 'badge-neutral'}">
                          ${t.priority}
                        </span>
                      </td>
                      <td>
                        <span class="badge ${t.status === 'open' ? 'badge-warning' : t.status === 'in_progress' ? 'badge-info' : 'badge-positive'}">
                          ${t.status}
                        </span>
                      </td>
                      <td class="stamp">${formatDateTime(t.created_at)}</td>
                      <td>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.openModal('3.7', {ticket_id: ${t.ticket_id}})">Xử lý</button>
                      </td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>`
            : `
          <div class="panel">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Đơn hàng</th>
                    <th>Số sao</th>
                    <th>Nội dung nhận xét</th>
                    <th>Ngày tạo</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  ${db.reviews
                    .map(
                      (r) => `
                    <tr>
                      <td class="mono-id">#${r.review_id}</td>
                      <td>#${r.booking_id}</td>
                      <td>⭐ ${r.rating} / 5</td>
                      <td>${r.comment || '—'}</td>
                      <td class="stamp">${formatDateTime(r.created_at)}</td>
                      <td>
                        <button type="button" class="btn btn-danger btn-sm" onclick="GDXApp.deleteReview(${r.review_id})">Xóa vi phạm</button>
                      </td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>`
        }
      </div>
    `;
  }

  function deleteReview(reviewId) {
    const db = window.GDX_DB;
    const idx = db.reviews.findIndex((r) => r.review_id === Number(reviewId));
    if (idx >= 0) {
      const pId = db.reviews[idx].provider_id;
      db.reviews.splice(idx, 1);
      db.refreshProviderRating(pId);
      showToast('Đã xóa đánh giá vi phạm và tự động tính lại điểm thợ!');
      go('3.4', { tab: 'reviews' });
    }
  }

  // =====================================================================
  // MODAL / DRAWER RENDERERS (All 15 Modals)
  // =====================================================================

  function openModal(modalId, params = {}) {
    state.activeModal = modalId;
    const backdrop = document.getElementById('modalBackdrop');
    const dialog = document.getElementById('modalDialog');
    const titleEl = document.getElementById('modalTitle');
    const subEl = document.getElementById('modalSub');
    const bodyEl = document.getElementById('modalBody');

    if (!backdrop || !dialog || !titleEl || !bodyEl) return;

    const meta = SCREENS[modalId] || { title: `Hộp thoại ${modalId}`, table: 'PostgreSQL' };
    titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = `Bảng liên quan: ${meta.table}`;

    // Apply drawer class if type is drawer
    if (meta.type === 'drawer') {
      dialog.classList.add('is-drawer');
    } else {
      dialog.classList.remove('is-drawer');
    }

    backdrop.hidden = false;

    // Render modal content
    switch (modalId) {
      case '1.7': renderModal_1_7(bodyEl, params); break;
      case '1.8': renderModal_1_8(bodyEl, params); break;
      case '1.9': renderModal_1_9(bodyEl, params); break;
      case '1.10': renderModal_1_10(bodyEl, params); break;
      case '1.11': renderModal_1_11(bodyEl, params); break;
      case '2.6': renderModal_2_6(bodyEl, params); break;
      case '2.7': renderModal_2_7(bodyEl, params); break;
      case '2.8': renderModal_2_8(bodyEl, params); break;
      case '2.9': renderModal_2_9(bodyEl, params); break;
      case '3.5': renderModal_3_5(bodyEl, params); break;
      case '3.6': renderModal_3_6(bodyEl, params); break;
      case '3.7': renderModal_3_7(bodyEl, params); break;
      case '3.8': renderModal_3_8(bodyEl, params); break;
      case '3.9': renderModal_3_9(bodyEl, params); break;
      case 'CATALOG': renderModal_Catalog(bodyEl); break;
      default:
        bodyEl.innerHTML = `<div>Đang phát triển nội dung modal ${modalId}</div>`;
    }
  }

  function closeModal() {
    const backdrop = document.getElementById('modalBackdrop');
    if (backdrop) backdrop.hidden = true;
    state.activeModal = null;
  }

  // 1.7: Provider Public Profile Modal
  function renderModal_1_7(container, params = {}) {
    const db = window.GDX_DB;
    const pId = Number(params.provider_id || 201);
    const prov = db.getProviderPublicProfiles().find((p) => p.provider_id === pId);
    if (!prov) {
      container.innerHTML = 'Không tìm thấy hồ sơ thợ.';
      return;
    }
    const myServices = db.provider_services
      .filter((ps) => ps.provider_id === pId)
      .map((ps) => {
        const s = db.services.find((item) => item.service_id === ps.service_id);
        return s ? s.title : '';
      })
      .filter(Boolean);
    const revs = db.reviews.filter((r) => r.provider_id === pId);

    container.innerHTML = `
      <div style="display:flex; gap:16px; align-items:center; border-bottom:1px solid var(--app-rule); padding-bottom:16px; margin-bottom:16px;">
        <img src="${prov.avatar_url}" alt="${prov.full_name}" style="width:64px; height:64px; border-radius:50%; object-fit:cover;">
        <div>
          <h3 style="font-size:18px; font-weight:600;">${prov.full_name}</h3>
          <div style="font-size:13px; color:var(--app-muted); margin-top:2px;">
            ${prov.average_rating} / 5 (${prov.total_reviews} đánh giá) · ${prov.is_available_online ? '<span class="status-dot is-online" style="display:inline-block;"></span> Sẵn sàng nhận việc' : '<span class="status-dot" style="display:inline-block;"></span> Tạm bận'}
          </div>
          <div style="font-size:12px; color:var(--app-muted); margin-top:2px;">
            View <code>provider_public_profiles</code> bảo mật: Đã ẩn số CCCD
          </div>
        </div>
      </div>

      <div class="form-stack">
        <div>
          <h4 style="font-size:14px; font-weight:600; margin-bottom:4px;">Giới thiệu năng lực</h4>
          <p style="font-size:14px; line-height:1.5; color:var(--app-text);">${prov.info}</p>
        </div>

        <div>
          <h4 style="font-size:14px; font-weight:600; margin-bottom:8px;">Dịch vụ đảm nhận</h4>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${myServices.map((title) => `<span class="badge badge-neutral">${title}</span>`).join('')}
          </div>
        </div>

        <div>
          <h4 style="font-size:14px; font-weight:600; margin-bottom:8px;">Đánh giá gần đây từ khách hàng</h4>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${
              revs.length === 0
                ? `<div style="font-size:13px; color:var(--app-muted);">Chưa có đánh giá nào.</div>`
                : revs
                    .map(
                      (r) => `
                  <div style="background:var(--app-raised); padding:10px; border-radius:6px; font-size:13px;">
                    <div>⭐ ${r.rating} / 5 · <span class="stamp">${formatDateTime(r.created_at)}</span></div>
                    <div style="margin-top:4px;">${r.comment}</div>
                  </div>`
                    )
                    .join('')
            }
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Đóng</button>
      </div>
    `;
  }

  // 1.8: Checkout & Payment Modal
  function renderModal_1_8(container, params = {}) {
    const db = window.GDX_DB;
    const bId = Number(params.booking_id || state.activeBookingId);
    const b = db.bookings.find((item) => item.booking_id === bId) || db.bookings[0];

    container.innerHTML = `
      <div class="form-stack">
        <div style="background:var(--app-raised); padding:16px; border-radius:8px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span style="color:var(--app-muted);">Mã đơn hàng:</span>
            <span class="mono-id">#${b.booking_id}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span style="color:var(--app-muted);">Phí dịch vụ gốc:</span>
            <span>${formatMoney(b.total_amount - b.total_incidental)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span style="color:var(--app-muted);">Chi phí phát sinh (total_incidental):</span>
            <span style="color:var(--warning); font-weight:600;">+ ${formatMoney(b.total_incidental)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; border-top:1px solid var(--app-border); padding-top:8px; font-size:18px; font-weight:600;">
            <span>TỔNG THANH TOÁN:</span>
            <span style="color:var(--accent);">${formatMoney(b.total_amount)}</span>
          </div>
        </div>

        <div style="text-align:center; padding:16px; border:1px dashed var(--app-border); border-radius:8px;">
          <div style="font-weight:600; margin-bottom:10px;">Quét mã QR VietQR / SePay</div>
          <!-- SVG QR Code Placeholder -->
          <svg width="140" height="140" viewBox="0 0 100 100" style="margin:0 auto; display:block;" aria-label="QR Code">
            <rect width="100" height="100" fill="#fff" />
            <path d="M10 10h30v30h-30z M60 10h30v30h-30z M10 60h30v30h-30z M20 20h10v10h-10z M70 20h10v10h-10z M20 70h10v10h-10z M45 20h10v30h-10z M45 60h30v10h-30z M60 75h20v15h-20z" fill="#000" />
          </svg>
          <div style="font-size:12px; color:var(--app-muted); margin-top:8px;">
            Số tài khoản: <strong>0908341289</strong> · Ngân hàng: <strong>MBBank</strong>
          </div>
          <div style="font-size:12px; color:var(--app-muted);">
            Nội dung chuyển khoản: <strong class="mono-id">GDX ${b.booking_id}</strong>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Để sau</button>
          <button type="button" class="btn btn-primary" onclick="GDXApp.handleConfirmPayment(${b.booking_id})">
            Xác nhận đã thanh toán xong &rarr;
          </button>
        </div>
      </div>
    `;
  }

  function handleConfirmPayment(bookingId) {
    const res = RPC.confirmPayment(bookingId);
    if (res.success) {
      showToast(`Đã ghi nhận thanh toán đơn #${bookingId}!`);
      closeModal();
      go('1.3', { booking_id: bookingId });
    }
  }

  // 1.9: Review & Rating Modal
  function renderModal_1_9(container, params = {}) {
    const db = window.GDX_DB;
    const bId = Number(params.booking_id || 1040);
    const b = db.bookings.find((item) => item.booking_id === bId) || db.bookings[0];
    const prov = db.getProviderPublicProfiles().find((p) => p.provider_id === b.provider_id);

    container.innerHTML = `
      <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.submitReview(this, ${b.booking_id}, ${b.provider_id});">
        <div>
          <div>Đánh giá dịch vụ đơn hàng <strong class="mono-id">#${b.booking_id}</strong></div>
          <div style="font-size:13px; color:var(--app-muted); margin-top:2px;">
            Thợ thực hiện: <strong>${prov ? prov.full_name : '—'}</strong>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">Chấm điểm số sao (reviews.rating 1..5 - Bắt buộc)</label>
          <select name="rating" class="select" required>
            <option value="5" selected>⭐⭐⭐⭐⭐ (5 sao - Tuyệt vời)</option>
            <option value="4">⭐⭐⭐⭐ (4 sao - Rất tốt)</option>
            <option value="3">⭐⭐⭐ (3 sao - Tạm được)</option>
            <option value="2">⭐⭐ (2 sao - Cần cải thiện)</option>
            <option value="1">⭐ (1 sao - Kém)</option>
          </select>
        </div>

        <div class="field-group">
          <label class="field-label">Nhận xét chi tiết (reviews.comment)</label>
          <textarea name="comment" class="textarea" rows="3" required placeholder="Thái độ phục vụ, tính đúng giờ, độ tỉ mỉ sạch sẽ..."></textarea>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Hủy</button>
          <button type="submit" class="btn btn-primary">Gửi đánh giá &rarr;</button>
        </div>
      </form>
    `;
  }

  function submitReview(form, bookingId, providerId) {
    const db = window.GDX_DB;
    const newRev = {
      review_id: Date.now(),
      booking_id: Number(bookingId),
      customer_id: state.activeCustomerId,
      provider_id: Number(providerId),
      rating: Number(form.rating.value),
      comment: form.comment.value,
      created_at: new Date().toISOString(),
    };

    db.reviews.unshift(newRev);
    db.refreshProviderRating(providerId);

    showToast('Cảm ơn bạn! Đánh giá đã được ghi nhận và điểm thợ đã được cập nhật.');
    closeModal();
    go('1.4');
  }

  // 1.10: Customer Cancel Booking Modal
  function renderModal_1_10(container, params = {}) {
    const bId = Number(params.booking_id || state.activeBookingId);
    container.innerHTML = `
      <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.handleCustomerCancel(this, ${bId});">
        <div style="background:var(--pill-negative-bg); color:var(--pill-negative-ink); padding:12px; border-radius:6px; font-size:13px;">
          Lưu ý: Hủy ca sát giờ làm việc có thể ảnh hưởng đến lịch trình của nhân viên điều dưỡng.
        </div>

        <div class="field-group">
          <label class="field-label">Lý do hủy lịch hẹn (booking_status_history.reason - Bắt buộc)</label>
          <select name="reasonSelect" class="select" onchange="this.form.reasonText.value = this.value">
            <option value="Bận việc đột xuất trong gia đình">Bận việc đột xuất trong gia đình</option>
            <option value="Đổi lịch sang ngày khác">Đổi lịch sang ngày khác</option>
            <option value="Tòa nhà chung cư cúp nước / cúp điện bảo trì">Tòa nhà chung cư cúp nước / cúp điện bảo trì</option>
            <option value="Lý do khác">Lý do khác...</option>
          </select>
        </div>

        <div class="field-group">
          <label class="field-label">Chi tiết lý do</label>
          <textarea name="reasonText" class="textarea" rows="2" required>Bận việc đột xuất trong gia đình</textarea>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Quay lại</button>
          <button type="submit" class="btn btn-danger">Xác nhận hủy đơn &rarr;</button>
        </div>
      </form>
    `;
  }

  function handleCustomerCancel(form, bookingId) {
    const reason = form.reasonText.value;
    const res = RPC.transitionBookingStatus(bookingId, 'cancelled', reason);
    if (res.success) {
      showToast(`Đã hủy lịch hẹn #${bookingId}.`);
      closeModal();
      go('1.4');
    }
  }

  // 1.11: Support Ticket Drawer
  function renderModal_1_11(container, params = {}) {
    const db = window.GDX_DB;
    const bId = params.booking_id ? Number(params.booking_id) : '';
    const myTickets = db.support_tickets.filter((t) => t.user_id === state.activeUserId);

    container.innerHTML = `
      <div class="form-stack">
        <div style="border-bottom:1px solid var(--app-rule); padding-bottom:14px;">
          <h3 style="font-size:15px; font-weight:600;">Gửi phiếu hỗ trợ / Khiếu nại dịch vụ</h3>
          <p class="field-hint">Ánh xạ bảng support_tickets (user_id, booking_id, subject, priority)</p>
        </div>

        <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.createSupportTicket(this);">
          <div class="field-group">
            <label class="field-label">Mã đơn hàng liên quan (tùy chọn)</label>
            <input type="number" name="booking_id" class="input" value="${bId}" placeholder="Ví dụ: 1042">
          </div>
          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label">Tiêu đề yêu cầu (subject)</label>
              <input type="text" name="subject" class="input" required placeholder="Mô tả tóm tắt sự cố..." maxlength="200">
            </div>
            <div class="field-group">
              <label class="field-label">Mức độ ưu tiên (priority)</label>
              <select name="priority" class="select">
                <option value="low">Low (Thấp)</option>
                <option value="medium" selected>Medium (Bình thường)</option>
                <option value="high">High (Khẩn cấp)</option>
                <option value="urgent">Urgent (Nghiêm trọng)</option>
              </select>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-sm" style="align-self:flex-start;">Gửi phiếu yêu cầu</button>
        </form>

        <div style="border-top:1px solid var(--app-rule); padding-top:16px; margin-top:14px;">
          <h4 style="font-size:14px; font-weight:600; margin-bottom:10px;">Lịch sử phiếu đã gửi (${myTickets.length})</h4>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${
              myTickets.length === 0
                ? `<div style="font-size:13px; color:var(--app-muted);">Chưa có phiếu hỗ trợ nào.</div>`
                : myTickets
                    .map(
                      (t) => `
                  <div style="background:var(--app-raised); padding:10px; border-radius:6px; font-size:13px;">
                    <div style="display:flex; justify-content:space-between;">
                      <span class="mono-id">#${t.ticket_id} · ${t.booking_id ? 'Đơn #' + t.booking_id : 'Chung'}</span>
                      <span class="badge ${t.status === 'open' ? 'badge-warning' : t.status === 'in_progress' ? 'badge-info' : 'badge-positive'}">${t.status}</span>
                    </div>
                    <div style="font-weight:600; margin-top:4px;">${t.subject}</div>
                    <div class="stamp" style="margin-top:2px;">${formatDateTime(t.created_at)} · Priority: ${t.priority}</div>
                  </div>`
                    )
                    .join('')
            }
          </div>
        </div>
      </div>
    `;
  }

  function createSupportTicket(form) {
    const db = window.GDX_DB;
    const bId = form.booking_id.value ? Number(form.booking_id.value) : null;
    const newT = {
      ticket_id: Date.now(),
      user_id: state.activeUserId,
      booking_id: bId,
      subject: form.subject.value,
      status: 'open',
      priority: form.priority.value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.support_tickets.unshift(newT);
    showToast(`Đã gửi thành công phiếu hỗ trợ #${newT.ticket_id}!`);
    renderModal_1_11(document.getElementById('modalBody'), { booking_id: bId });
  }

  // 2.6: Weekly Schedule & Absence Exception Modal
  function renderModal_2_6(container) {
    const db = window.GDX_DB;
    const scheds = db.availability_schedules.filter((s) => s.provider_id === state.activeProviderId);
    const excs = db.availability_exceptions.filter((e) => e.provider_id === state.activeProviderId);

    container.innerHTML = `
      <div class="form-stack">
        <div class="underline-tabs" id="schedTabs">
          <button type="button" class="u-tab" aria-selected="true" onclick="GDXApp.setSchedTab('weekly')">Lịch cố định tuần (availability_schedules)</button>
          <button type="button" class="u-tab" aria-selected="false" onclick="GDXApp.setSchedTab('exception')">Báo nghỉ phép (availability_exceptions)</button>
        </div>

        <div id="schedTabContent">
          <!-- Weekly Schedule Tab by default -->
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${scheds
              .map(
                (s) => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:var(--app-raised); padding:8px 12px; border-radius:6px; font-size:13px;">
                <span>Thứ: <strong>${['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][s.day_of_week]}</strong></span>
                <span class="mono-id">${s.start_time} — ${s.end_time}</span>
                <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.deleteSchedule(${s.id})">Xóa</button>
              </div>`
              )
              .join('')}
          </div>

          <form class="form-row-2" style="margin-top:14px;" onsubmit="event.preventDefault(); GDXApp.addSchedule(this);">
            <div class="field-group">
              <label class="field-label">Thứ trong tuần (0..6)</label>
              <select name="day_of_week" class="select">
                <option value="1">Thứ Hai</option>
                <option value="2">Thứ Ba</option>
                <option value="3">Thứ Tư</option>
                <option value="4">Thứ Năm</option>
                <option value="5">Thứ Sáu</option>
                <option value="6">Thứ Bảy</option>
                <option value="0">Chủ Nhật</option>
              </select>
            </div>
            <div class="field-group">
              <label class="field-label">Từ giờ &rarr; Đến giờ</label>
              <div style="display:flex; gap:6px;">
                <input type="time" name="start_time" class="input" value="08:00" required>
                <input type="time" name="end_time" class="input" value="17:00" required>
              </div>
            </div>
            <div style="grid-column: span 2;">
              <button type="submit" class="btn btn-primary btn-sm">+ Thêm khung giờ làm</button>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Đóng</button>
        </div>
      </div>
    `;
  }

  function setSchedTab(tab) {
    const content = document.getElementById('schedTabContent');
    if (!content) return;
    const tabs = document.querySelectorAll('#schedTabs .u-tab');
    tabs.forEach((t, i) => {
      t.setAttribute('aria-selected', (tab === 'weekly' && i === 0) || (tab === 'exception' && i === 1));
    });

    const db = window.GDX_DB;
    if (tab === 'weekly') {
      renderModal_2_6(document.getElementById('modalBody'));
    } else {
      const excs = db.availability_exceptions.filter((e) => e.provider_id === state.activeProviderId);
      content.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${
            excs.length === 0
              ? `<div style="font-size:13px; color:var(--app-muted);">Chưa có lịch nghỉ đột xuất nào.</div>`
              : excs
                  .map(
                    (e) => `
                <div style="background:var(--app-raised); padding:10px; border-radius:6px; font-size:13px;">
                  <div style="display:flex; justify-content:space-between;">
                    <strong>Ngày nghỉ: ${e.exception_date}</strong>
                    <span class="mono-id">${e.start_time} — ${e.end_time}</span>
                  </div>
                  <div style="color:var(--app-muted); margin-top:2px;">Lý do: ${e.reason || 'Bận việc'}</div>
                </div>`
                  )
                  .join('')
          }
        </div>

        <form class="form-stack" style="margin-top:16px;" onsubmit="event.preventDefault(); GDXApp.addException(this);">
          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label">Ngày xin nghỉ (exception_date)</label>
              <input type="date" name="exception_date" class="input" value="2026-10-30" required>
            </div>
            <div class="field-group">
              <label class="field-label">Khung giờ nghỉ</label>
              <div style="display:flex; gap:6px;">
                <input type="time" name="start_time" class="input" value="08:00" required>
                <input type="time" name="end_time" class="input" value="18:00" required>
              </div>
            </div>
          </div>
          <div class="field-group">
            <label class="field-label">Lý do nghỉ phép</label>
            <input type="text" name="reason" class="input" placeholder="Đi khám sức khỏe định kỳ..." required>
          </div>
          <button type="submit" class="btn btn-warning btn-sm" style="align-self:flex-start;">Đăng ký ngày nghỉ</button>
        </form>
      `;
    }
  }

  function addSchedule(form) {
    const db = window.GDX_DB;
    db.availability_schedules.push({
      id: Date.now(),
      provider_id: state.activeProviderId,
      day_of_week: Number(form.day_of_week.value),
      start_time: form.start_time.value,
      end_time: form.end_time.value,
      updated_at: new Date().toISOString(),
    });
    showToast('Đã lưu khung giờ làm việc cố định!');
    renderModal_2_6(document.getElementById('modalBody'));
  }

  function deleteSchedule(id) {
    const db = window.GDX_DB;
    const idx = db.availability_schedules.findIndex((s) => s.id === Number(id));
    if (idx >= 0) {
      db.availability_schedules.splice(idx, 1);
      showToast('Đã xóa khung giờ làm.');
      renderModal_2_6(document.getElementById('modalBody'));
    }
  }

  function addException(form) {
    const db = window.GDX_DB;
    db.availability_exceptions.push({
      id: Date.now(),
      provider_id: state.activeProviderId,
      exception_date: form.exception_date.value,
      start_time: form.start_time.value,
      end_time: form.end_time.value,
      reason: form.reason.value,
      created_at: new Date().toISOString(),
    });
    showToast('Đã thêm lịch nghỉ phép đột xuất!');
    setSchedTab('exception');
  }

  // 2.7: Incidental Cost Modal
  function renderModal_2_7(container, params = {}) {
    const db = window.GDX_DB;
    const bId = Number(params.booking_id || state.activeBookingId);
    const b = db.bookings.find((item) => item.booking_id === bId) || db.bookings[0];

    container.innerHTML = `
      <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.handleSaveIncidental(this, ${b.booking_id});">
        <div>
          <div>Đơn hàng tác nghiệp: <strong class="mono-id">#${b.booking_id}</strong></div>
          <p class="field-hint">Kê khai vật tư mua thêm tại nhà thuốc / siêu thị (bookings.total_incidental).</p>
        </div>

        <div class="field-group">
          <label class="field-label">Số tiền phát sinh (VND - Bắt buộc >= 0)</label>
          <input type="number" name="incidental" class="input" value="${b.total_incidental || 0}" min="0" step="1000" required>
        </div>

        <div class="field-group">
          <label class="field-label">Lý do &amp; Hóa đơn đính kèm (ghi chú vào bookings.notes)</label>
          <textarea name="notes" class="textarea" rows="2" required placeholder="Mua thêm hộp que thử đường huyết Accu-Chek, cồn 70 độ...">Mua thêm que thử đường huyết tại hiệu thuốc</textarea>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Hủy</button>
          <button type="submit" class="btn btn-primary">Lưu chi phí &amp; Ghi Audit Log &rarr;</button>
        </div>
      </form>
    `;
  }

  function handleSaveIncidental(form, bookingId) {
    const cost = Number(form.incidental.value);
    const note = form.notes.value;
    const res = RPC.updateIncidentalCost(bookingId, cost, note);
    if (res.success) {
      showToast(`Đã cập nhật chi phí phát sinh: ${formatMoney(cost)}!`);
      closeModal();
      go('2.2');
    }
  }

  // 2.8: Provider Reject/Cancel Job Modal
  function renderModal_2_8(container, params = {}) {
    const bId = Number(params.booking_id || state.activeBookingId);
    const action = params.action || 'reject';

    container.innerHTML = `
      <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.handleProviderRejectCancel(this, ${bId}, '${action}');">
        <div style="background:var(--pill-negative-bg); color:var(--pill-negative-ink); padding:12px; border-radius:6px; font-size:13px;">
          Cảnh báo: Hành động này sẽ được ghi vết vĩnh viễn vào bảng <code>booking_status_history</code> để Admin kiểm toán.
        </div>

        <div class="field-group">
          <label class="field-label">Lý do ${action === 'reject' ? 'từ chối nhận đơn' : 'hủy ca bất khả kháng'} (Bắt buộc):</label>
          <textarea name="reason" class="textarea" rows="3" required placeholder="Xe bị hỏng trên đường di chuyển, trùng lịch ca bệnh viện..."></textarea>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Quay lại</button>
          <button type="submit" class="btn btn-danger">Xác nhận ${action === 'reject' ? 'từ chối đơn' : 'hủy ca'}</button>
        </div>
      </form>
    `;
  }

  function handleProviderRejectCancel(form, bookingId, action) {
    const newStatus = action === 'reject' ? 'rejected' : 'cancelled';
    const reason = form.reason.value;
    const res = RPC.transitionBookingStatus(bookingId, newStatus, reason);
    if (res.success) {
      showToast(`Đã ${action === 'reject' ? 'từ chối' : 'hủy'} đơn #${bookingId}.`);
      closeModal();
      go('2.1');
    }
  }

  // 2.9: Partner Emergency Incident Drawer
  function renderModal_2_9(container, params = {}) {
    const bId = Number(params.booking_id || state.activeBookingId);
    container.innerHTML = `
      <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.submitEmergencyTicket(this, ${bId});">
        <div style="background:var(--pill-negative-bg); color:var(--pill-negative-ink); padding:12px; border-radius:6px; font-size:13px;">
          Báo cáo khẩn cấp gửi trực tiếp đến Ban điều phối Admin trực ban 24/7 (priority = urgent).
        </div>

        <div class="field-group">
          <label class="field-label">Mã đơn hàng gặp sự cố</label>
          <input type="number" class="input" value="${bId}" readonly>
        </div>

        <div class="field-group">
          <label class="field-label">Mô tả sự cố tại hiện trường (support_tickets.subject)</label>
          <textarea name="subject" class="textarea" rows="3" required placeholder="Khách hàng không mở cửa, địa chỉ giả mạo, tai nạn giao thông trên đường đến..."></textarea>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Hủy</button>
          <button type="submit" class="btn btn-danger">Gửi báo cáo khẩn cấp ngay &rarr;</button>
        </div>
      </form>
    `;
  }

  function submitEmergencyTicket(form, bookingId) {
    const db = window.GDX_DB;
    db.support_tickets.unshift({
      ticket_id: Date.now(),
      user_id: state.activeUserId,
      booking_id: Number(bookingId),
      subject: form.subject.value,
      status: 'open',
      priority: 'urgent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    showToast('Đã gửi báo cáo khẩn cấp đến đội ngũ quản trị Admin!');
    closeModal();
  }

  // 3.5: Booking Audit Log Drawer
  function renderModal_3_5(container, params = {}) {
    const db = window.GDX_DB;
    const bId = Number(params.booking_id || state.activeBookingId);
    const b = db.bookings.find((item) => item.booking_id === bId) || db.bookings[0];
    const logs = db.booking_status_history.filter((l) => l.booking_id === b.booking_id);

    container.innerHTML = `
      <div class="form-stack">
        <div style="background:var(--app-raised); padding:14px; border-radius:8px;">
          <h3 style="font-size:15px; font-weight:600; margin-bottom:8px;">Chi tiết đơn hàng #${b.booking_id}</h3>
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:6px; font-size:13px;">
            <div>Khách hàng: <strong>Customer #${b.customer_id}</strong></div>
            <div>Thợ: <strong>Provider #${b.provider_id}</strong></div>
            <div>Thời gian: <strong>${formatDateTime(b.scheduled_time)}</strong></div>
            <div>Phường/Xã: <strong class="mono-id">${b.ward_id}</strong></div>
            <div>Trạng thái: <span class="badge badge-neutral">${b.status}</span></div>
            <div>Thanh toán: <span class="badge badge-neutral">${b.payment_status}</span></div>
            <div>Phát sinh: <strong>${formatMoney(b.total_incidental)}</strong></div>
            <div>Tổng tiền: <strong style="color:var(--accent);">${formatMoney(b.total_amount)}</strong></div>
          </div>
        </div>

        <div>
          <h3 style="font-size:15px; font-weight:600; margin-bottom:10px;">Lịch sử biến động trạng thái (booking_status_history)</h3>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${
              logs.length === 0
                ? `<div style="font-size:13px; color:var(--app-muted);">Chưa có lịch sử biến động.</div>`
                : logs
                    .map((l) => {
                      const u = db.users.find((user) => user.user_id === l.changed_by);
                      return `
                  <div style="border:1px solid var(--app-border); padding:10px 12px; border-radius:6px; font-size:13px;">
                    <div style="display:flex; justify-content:space-between;">
                      <span><strong>${l.previous_status || 'Khởi tạo'} &rarr; ${l.new_status}</strong></span>
                      <span class="stamp">${formatDateTime(l.created_at)}</span>
                    </div>
                    <div style="color:var(--app-muted); margin-top:4px;">
                      Thao tác bởi: <strong>${u ? u.full_name : l.changed_by}</strong> (${u ? u.role : 'user'})
                    </div>
                    <div style="margin-top:4px; font-style:italic;">Lý do: "${l.reason || '—'}"</div>
                  </div>`;
                    })
                    .join('')
            }
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Đóng</button>
        </div>
      </div>
    `;
  }

  // 3.6: Admin Refund & Payment Adjustment Modal
  function renderModal_3_6(container, params = {}) {
    const db = window.GDX_DB;
    const bId = Number(params.booking_id || state.activeBookingId);
    const b = db.bookings.find((item) => item.booking_id === bId) || db.bookings[0];

    container.innerHTML = `
      <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.handleAdminAdjust(this, ${b.booking_id});">
        <div>
          <div>Điều chỉnh tài chính đơn hàng: <strong class="mono-id">#${b.booking_id}</strong></div>
          <p class="field-hint">Áp dụng hàm RPC rpc_admin_adjust_payment_and_refund</p>
        </div>

        <div class="form-row-2">
          <div class="field-group">
            <label class="field-label">Chi phí phát sinh (total_incidental)</label>
            <input type="number" name="incidental" class="input" value="${b.total_incidental}" required>
          </div>
          <div class="field-group">
            <label class="field-label">Tổng hóa đơn sau cùng (total_amount)</label>
            <input type="number" name="total" class="input" value="${b.total_amount}" required>
          </div>
        </div>

        <div class="form-row-2">
          <div class="field-group">
            <label class="field-label">Trạng thái thanh toán (payment_status)</label>
            <select name="payment_status" class="select">
              <option value="unpaid" ${b.payment_status === 'unpaid' ? 'selected' : ''}>unpaid (Chưa thanh toán)</option>
              <option value="paid" ${b.payment_status === 'paid' ? 'selected' : ''}>paid (Đã thanh toán)</option>
              <option value="refunded" ${b.payment_status === 'refunded' ? 'selected' : ''}>refunded (Đã hoàn tiền)</option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">Trạng thái đơn hàng (status)</label>
            <select name="status" class="select">
              <option value="pending" ${b.status === 'pending' ? 'selected' : ''}>pending</option>
              <option value="confirmed" ${b.status === 'confirmed' ? 'selected' : ''}>confirmed</option>
              <option value="in_progress" ${b.status === 'in_progress' ? 'selected' : ''}>in_progress</option>
              <option value="completed" ${b.status === 'completed' ? 'selected' : ''}>completed</option>
              <option value="cancelled" ${b.status === 'cancelled' ? 'selected' : ''}>cancelled</option>
              <option value="rejected" ${b.status === 'rejected' ? 'selected' : ''}>rejected</option>
            </select>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">Lý do điều chỉnh (Bắt buộc để ghi Audit Log):</label>
          <textarea name="reason" class="textarea" rows="2" required placeholder="Hoàn tiền cho khách do sự cố kỹ thuật..."></textarea>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Hủy</button>
          <button type="submit" class="btn btn-primary">Lưu điều chỉnh &rarr;</button>
        </div>
      </form>
    `;
  }

  function handleAdminAdjust(form, bookingId) {
    const incidental = Number(form.incidental.value);
    const total = Number(form.total.value);
    const payStatus = form.payment_status.value;
    const bkStatus = form.status.value;
    const reason = form.reason.value;

    const res = RPC.adminAdjustPaymentAndRefund(bookingId, incidental, total, payStatus, bkStatus, reason);
    if (res.success) {
      showToast(`Đã điều chỉnh thành công đơn hàng #${bookingId}!`);
      closeModal();
      go('3.1');
    }
  }

  // 3.7: Admin Support Ticket Detail Drawer
  function renderModal_3_7(container, params = {}) {
    const db = window.GDX_DB;
    const tId = Number(params.ticket_id || 701);
    const t = db.support_tickets.find((item) => item.ticket_id === tId) || db.support_tickets[0];
    const u = db.users.find((user) => user.user_id === t.user_id);

    container.innerHTML = `
      <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.updateTicketByAdmin(this, ${t.ticket_id});">
        <div>
          <div style="font-size:16px; font-weight:600;">Phiếu hỗ trợ #${t.ticket_id}</div>
          <div style="font-size:13px; color:var(--app-muted);">Gửi lúc: ${formatDateTime(t.created_at)}</div>
        </div>

        <div style="background:var(--app-raised); padding:12px; border-radius:6px; font-size:13px;">
          <div>Người gửi: <strong>${u ? u.full_name : 'User'}</strong> (${u ? u.phone_number : ''} · ${u ? u.role : ''})</div>
          <div>Đơn liên quan: <strong>${t.booking_id ? '#' + t.booking_id : 'Không có'}</strong></div>
          <div style="margin-top:6px;">Nội dung: <strong>"${t.subject}"</strong></div>
        </div>

        <div class="form-row-2">
          <div class="field-group">
            <label class="field-label">Mức độ ưu tiên (priority)</label>
            <select name="priority" class="select">
              <option value="low" ${t.priority === 'low' ? 'selected' : ''}>low</option>
              <option value="medium" ${t.priority === 'medium' ? 'selected' : ''}>medium</option>
              <option value="high" ${t.priority === 'high' ? 'selected' : ''}>high</option>
              <option value="urgent" ${t.priority === 'urgent' ? 'selected' : ''}>urgent</option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">Trạng thái xử lý (status)</label>
            <select name="status" class="select">
              <option value="open" ${t.status === 'open' ? 'selected' : ''}>open (Mới mở)</option>
              <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>in_progress (Đang xử lý)</option>
              <option value="resolved" ${t.status === 'resolved' ? 'selected' : ''}>resolved (Đã giải quyết)</option>
              <option value="closed" ${t.status === 'closed' ? 'selected' : ''}>closed (Đóng ticket)</option>
            </select>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Đóng</button>
          <button type="submit" class="btn btn-primary">Cập nhật phiếu</button>
        </div>
      </form>
    `;
  }

  function updateTicketByAdmin(form, ticketId) {
    const db = window.GDX_DB;
    const t = db.support_tickets.find((item) => item.ticket_id === Number(ticketId));
    if (t) {
      t.priority = form.priority.value;
      t.status = form.status.value;
      t.updated_at = new Date().toISOString();
      showToast(`Đã cập nhật trạng thái phiếu #${ticketId}!`);
      closeModal();
      go('3.4', { tab: 'tickets' });
    }
  }

  // 3.8: Add/Edit Category & Service Modal
  function renderModal_3_8(container, params = {}) {
    const db = window.GDX_DB;
    const isService = !params.category_id;

    container.innerHTML = `
      <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.saveServiceOrCategory(this, ${isService});">
        <div class="field-group">
          <label class="field-label">Loại cấu hình:</label>
          <div style="font-weight:600;">${isService ? 'Thêm / Cập nhật Dịch vụ (services)' : 'Cập nhật Danh mục (service_categories)'}</div>
        </div>

        ${
          isService
            ? `
          <div class="field-group">
            <label class="field-label">Tên dịch vụ (title - Bắt buộc)</label>
            <input type="text" name="title" class="input" required placeholder="Ví dụ: Chăm sóc vết mổ sau sinh">
          </div>
          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label">Danh mục (category_id)</label>
              <select name="category_id" class="select">
                ${db.service_categories.map((c) => `<option value="${c.category_id}">${c.category_name}</option>`).join('')}
              </select>
            </div>
            <div class="field-group">
              <label class="field-label">Giá niêm yết (price >= 0)</label>
              <input type="number" name="price" class="input" value="350000" min="0" required>
            </div>
          </div>
          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label">Kiểu tính giá (pricing_type)</label>
              <select name="pricing_type" class="select">
                <option value="fixed" selected>fixed (Trọn gói theo ca)</option>
                <option value="hourly">hourly (Theo giờ)</option>
              </select>
            </div>
            <div class="field-group">
              <label class="field-label">Thời lượng dự kiến (phút)</label>
              <input type="number" name="duration" class="input" value="120" min="15" required>
            </div>
          </div>
          <div class="field-group">
            <label class="field-label">Mô tả dịch vụ</label>
            <textarea name="description" class="textarea" rows="2">Mô tả quy trình dịch vụ và vật tư bao gồm...</textarea>
          </div>`
            : `
          <div class="field-group">
            <label class="field-label">Tên danh mục (category_name)</label>
            <input type="text" name="category_name" class="input" required value="Chăm sóc Phục hồi chức năng">
          </div>
          <div class="field-group">
            <label class="field-label">Slug</label>
            <input type="text" name="slug" class="input" required value="phuc-hoi-chuc-nang">
          </div>`
        }

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Hủy</button>
          <button type="submit" class="btn btn-primary">Lưu bản ghi &rarr;</button>
        </div>
      </form>
    `;
  }

  function saveServiceOrCategory(form, isService) {
    const db = window.GDX_DB;
    if (isService) {
      db.services.push({
        service_id: 300 + db.services.length + 1,
        category_id: Number(form.category_id.value),
        title: form.title.value,
        description: form.description.value,
        price: Number(form.price.value),
        pricing_type: form.pricing_type.value,
        estimated_duration: Number(form.duration.value),
        is_active: true,
        image_url: 'assets/service-cleaning.jpg',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      showToast('Đã thêm dịch vụ mới vào cơ sở dữ liệu!');
    }
    closeModal();
    go('3.2');
  }

  // 3.9: Administrative Boundaries Modal
  function renderModal_3_9(container) {
    const db = window.GDX_DB;
    container.innerHTML = `
      <div class="form-stack">
        <div>
          <h3 style="font-size:15px; font-weight:600;">Quản lý Tỉnh/Thành &amp; Phường/Xã</h3>
          <p class="field-hint">Bảng province, ward (khóa ngoại ON DELETE RESTRICT chặt chẽ).</p>
        </div>

        <div class="table-wrap" style="max-height:220px; overflow-y:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Mã Phường</th>
                <th>Tên Phường/Xã</th>
                <th>Tỉnh</th>
              </tr>
            </thead>
            <tbody>
              ${db.ward
                .map(
                  (w) => `
                <tr>
                  <td class="mono-id">${w.ward_id}</td>
                  <td>${w.name}</td>
                  <td>${w.provinceId === '79' ? 'TP.HCM' : w.provinceId === '01' /* taste-skill-ignore: province code */ ? 'Hà Nội' : 'Đà Nẵng'}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>

        <form class="form-row-2" onsubmit="event.preventDefault(); GDXApp.addWard(this);">
          <div class="field-group">
            <label class="field-label">Mã Phường (tối đa 8 ký tự)</label>
            <input type="text" name="ward_id" class="input" required placeholder="27409" maxlength="8">
          </div>
          <div class="field-group">
            <label class="field-label">Tên Phường/Xã</label>
            <input type="text" name="name" class="input" required placeholder="Phường Tân Kiểng, Q.7">
          </div>
          <div style="grid-column:span 2;">
            <button type="submit" class="btn btn-primary btn-sm">+ Thêm Phường/Xã</button>
          </div>
        </form>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Đóng</button>
        </div>
      </div>
    `;
  }

  function addWard(form) {
    const db = window.GDX_DB;
    db.ward.push({
      ward_id: form.ward_id.value,
      name: form.name.value,
      provinceId: '79',
    });
    showToast(`Đã thêm phường ${form.name.value}!`);
    renderModal_3_9(document.getElementById('modalBody'));
  }

  // Master Catalog Modal: 34 UI Elements Matrix
  function openScreenCatalogModal() {
    openModal('CATALOG');
  }

  function renderModal_Catalog(container) {
    const screensArr = Object.values(SCREENS);
    const p0 = screensArr.filter((s) => s.portal === 0);
    const p1 = screensArr.filter((s) => s.portal === 1);
    const p2 = screensArr.filter((s) => s.portal === 2);
    const p3 = screensArr.filter((s) => s.portal === 3);

    function renderGroup(title, list) {
      return `
        <div style="margin-bottom: 16px;">
          <h4 style="font-size:14px; font-weight:600; color:var(--app-muted); margin-bottom:8px;">${title} (${list.length})</h4>
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:6px;">
            ${list
              .map(
                (s) => `
              <button type="button" class="btn btn-secondary btn-sm" style="justify-content:space-between; font-size:12px; height:auto; padding:6px 10px;" onclick="GDXApp.closeModal(); ${s.type === 'page' ? `GDXApp.switchPortal(${s.portal}); GDXApp.go('${s.id}')` : `GDXApp.openModal('${s.id}')`};">
                <span style="text-align:left;">${s.title}</span>
                <span class="badge ${s.type === 'page' ? 'badge-info' : 'badge-neutral'}" style="font-size:10px;">${s.type}</span>
              </button>`
              )
              .join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div style="max-height:65svh; overflow-y:auto; padding-right:6px;">
        <p style="font-size:13px; color:var(--app-muted); margin-bottom:14px;">
          Bấm vào bất kỳ mục nào bên dưới để chuyển trực tiếp tới màn hình hoặc mở hộp thoại tương ứng:
        </p>
        ${renderGroup('PHÂN HỆ 0: DÙNG CHUNG & XÁC THỰC', p0)}
        ${renderGroup('PHÂN HỆ 1: GIAO DIỆN KHÁCH HÀNG (CUSTOMER PORTAL)', p1)}
        ${renderGroup('PHÂN HỆ 2: GIAO DIỆN ĐỐI TÁC / THỢ (PROVIDER PORTAL)', p2)}
        ${renderGroup('PHÂN HỆ 3: GIAO DIỆN QUẢN TRỊ VIÊN (ADMIN PORTAL)', p3)}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Đóng</button>
      </div>
    `;
  }

  // --- INITIALIZATION ---
  function init() {
    switchPortal(1);
    go('1.1');
  }

  // Auto initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    state,
    go,
    switchPortal,
    openModal,
    closeModal,
    showToast,
    toggleProviderOnline,
    refreshProviderGPS,
    openScreenCatalogModal,
    setAuthTab,
    handleLogin,
    handleRegister,
    updateQuickStubPrice,
    startBookingFromCatalog,
    toggleFavorite,
    wizardChangeService,
    wizardChangeHours,
    wizardSelectProvider,
    confirmBookingCreation,
    saveUserProfile,
    saveCustomerAddress,
    providerAcceptJob,
    startShiftWork,
    toggleTimerPause,
    completeShiftWork,
    adminVerifyKYC,
    deleteReview,
    handleConfirmPayment,
    submitReview,
    handleCustomerCancel,
    createSupportTicket,
    setSchedTab,
    addSchedule,
    deleteSchedule,
    addException,
    handleSaveIncidental,
    handleProviderRejectCancel,
    submitEmergencyTicket,
    handleAdminAdjust,
    updateTicketByAdmin,
    saveServiceOrCategory,
    addWard,
    renderScreen_1_6,
  };
})();
