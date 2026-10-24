/**
 * =====================================================================
 * GIA ĐÌNH XANH - MODERN PRODUCTION UI (34 UI FULL IMPLEMENTATION)
 * Ánh xạ 1-1 với 16 bảng PostgreSQL & 4 RPCs trong:
 *   - 4. home_service_booking_supabase.sql
 *   - supabase_rpc_functions.sql
 *
 * Thiết kế theo chuẩn mực Taste-Skill v2, Impeccable & Modern Web Guidance:
 *   - Hệ thống biểu tượng SVG đồng nhất (không dùng emoji)
 *   - Chuyển động Top-Layer mượt mà (@starting-style + closeTopLayer)
 *   - Kiểm tra dữ liệu sau tương tác (:user-invalid + UserInvalidFallback)
 *   - Chế độ kép: Luồng Người dùng thân thiện ('user') & Chế độ Dev ('dev')
 * =====================================================================
 */

window.GDXApp = (() => {
  const urlParams = new URLSearchParams(window.location.search);
  const initialModeParam = urlParams.get('mode') || urlParams.get('env');
  const isProdFromUrl = initialModeParam === 'production';
  const initialViewMode = initialModeParam === 'dev' ? 'dev' : (isProdFromUrl ? 'production' : 'user');

  const state = {
    viewMode: initialViewMode, // 'user' | 'dev' | 'production'
    isProduction: isProdFromUrl,
    currentPortal: 1, // 0: Auth, 1: Customer, 2: Provider, 3: Admin
    currentScreen: '1.1',
    currentUser: null,
    activeModal: null,
    activeBookingId: 1042,
    activeProviderId: isProdFromUrl ? null : 201,
    activeCustomerId: isProdFromUrl ? null : 101,
    activeUserId: isProdFromUrl ? null : 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    userRole: isProdFromUrl ? 'anon' : 'customer',
    timerInterval: null,
    timerSeconds: 1 * 3600 + 45 * 60 + 22,
    isTimerRunning: true,
    // Filters for interactive screens
    catalogFilter: {
      categoryId: 'all',
      pricingType: 'all',
      query: '',
      searchQuery: ''
    },
    bookingListFilter: 'all',
    jobBoardFilter: {
      wardId: 'all',
      serviceId: 'all'
    },
    adminDispatchFilter: 'all',
    selectedServiceId: 301,
    selectedProviderId: 201,
    wizardProviderMode: 'broadcast', // 'broadcast' (rải đơn cho tất cả thợ khả dụng) | 'direct' (tự chọn thợ)
    wizardCategory: '1', // '1' (Home Cleaning) | '2' (Home Cooking)
    inboxTab: 'available', // 'available' (Hộp thư đến) | 'expired' (Đơn đã hết hạn)
    expiredJobIds: [],
    dismissedJobIds: [],
    selectedBookingId: 1042,
    bookingHours: 3,
    liveTimerSeconds: 1 * 3600 + 45 * 60 + 22,
    liveTimerInterval: null,
    reviewRating: 5,
    reviewDraftRating: 5,
    onboardingAvatar: 'assets/provider-mai.jpg',
    wizardDraft: {
      service_id: 301,
      scheduled_time: '2026-10-25T08:30',
      provinceId: null,
      ward_id: null,
      address: '',
      latitude: null,
      longitude: null,
      provider_id: 201,
      notes: 'Nhà có trẻ nhỏ, vui lòng gọi điện trước 10 phút khi đến sảnh căn hộ.',
      hours: 3,
    },
    backend: {
      mode: 'local',
      supabaseConfigured: false,
      message: 'Đang sử dụng dữ liệu cục bộ chuẩn PostgreSQL (local-db.json)'
    },
    backendStatus: {
      mode: 'local_sql_store',
      hasSupabaseUrl: false,
      hasAnonKey: false,
      hasServiceRoleKey: false,
      supabaseReachable: false,
      message: 'Đang kết nối tới Backend API...',
      tableCounts: {}
    }
  };

  // --- SVG ICON LIBRARY (Impeccable Craft Floor: Zero Emoji, Uniform Stroke) ---
  const Icons = {
    star(filled = true) {
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    },
    starRow(rating = 5) {
      const r = Math.round(Number(rating) || 0);
      let out = '<span class="star-row" aria-hidden="true">';
      for (let i = 1; i <= 5; i++) {
        out += Icons.star(i <= r);
      }
      out += '</span>';
      return out;
    },
    heart(filled = false) {
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    },
    clock() {
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    },
    pin() {
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
    },
    check() {
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
    },
    shield() {
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
    },
    user() {
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    },
    calendar() {
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    },
    lock() {
      return `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
    },
    eye() {
      return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    },
    eyeOff() {
      return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    }
  };

  // --- DISTANCE HELPER (Haversine formula from DB lat/lng columns) ---
  function calcDistanceKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return '1.8';
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.max(0.4, R * c).toFixed(1);
  }

  // --- MODERN WEB GUIDANCE: TOP-LAYER EXIT & DEFERRED VALIDATION ---
  let supportsDisplayTransition;
  function canTransitionDisplay() {
    if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
    if (!window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) {
      return false;
    }
    const probe = document.createElement('div');
    probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
    document.body.appendChild(probe);
    getComputedStyle(probe).display;
    probe.style.display = 'none';
    supportsDisplayTransition = getComputedStyle(probe).display === 'block';
    probe.remove();
    return supportsDisplayTransition;
  }

  function supportsTopLayerExit() {
    return window.CSS?.supports?.('overlay', 'auto') && canTransitionDisplay();
  }

  async function closeTopLayer(element) {
    if (!element) return;
    if (!supportsTopLayerExit()) {
      element.setAttribute('data-closing', '');
      const animations = element.getAnimations ? element.getAnimations({ subtree: true }) : [];
      if (animations.length > 0) {
        await Promise.race([
          Promise.allSettled(animations.map((a) => a.finished)),
          new Promise((r) => setTimeout(r, 400)),
        ]);
      }
      if (!element.hasAttribute('data-closing')) return;
      element.removeAttribute('data-closing');
    }
    if (typeof element.close === 'function' && element.open) {
      element.close();
    } else {
      element.removeAttribute('open');
    }
  }

  const UserInvalidFallback = (() => {
    const dirtyState = new WeakMap();
    const updateState = (input) => {
      if (!input.checkValidity) return;
      const isValid = input.checkValidity();
      input.classList.toggle('user-invalid-fallback', !isValid);
      input.classList.toggle('user-valid-fallback', isValid);
      if (!isValid) {
        input.setAttribute('aria-invalid', 'true');
      } else {
        input.removeAttribute('aria-invalid');
      }
    };
    const handleEvent = (event) => {
      const input = event.target;
      if (!input || !input.checkValidity) return;
      if (event.type === 'input' || event.type === 'change') {
        const st = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
        st.hasInteracted = true;
        dirtyState.set(input, st);
        if (st.hasBlurred) updateState(input);
      } else if (event.type === 'blur') {
        const st = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
        st.hasBlurred = true;
        dirtyState.set(input, st);
        if (st.hasInteracted) updateState(input);
      }
    };
    const init = (root = document) => {
      const syncAria = (el) => {
        if (!el || typeof el.matches !== 'function' || !el.checkValidity) return;
        try {
          if (CSS.supports('selector(:user-invalid)')) {
            el.setAttribute('aria-invalid', el.matches(':user-invalid') ? 'true' : 'false');
          }
        } catch (_) {}
      };
      root.addEventListener('blur', (e) => syncAria(e.target), true);
      root.addEventListener('input', (e) => {
        if (e.target && e.target.hasAttribute && e.target.hasAttribute('aria-invalid')) syncAria(e.target);
      });
      if (window.CSS?.supports?.('selector(:user-invalid)')) return;
      root.addEventListener('blur', handleEvent, true);
      root.addEventListener('input', handleEvent);
      root.addEventListener('change', handleEvent);
    };
    return { init };
  })();

  // --- BACKEND API & SUPABASE (.env.local) CLIENT HELPER ---
  async function apiRequest(endpoint, options = {}) {
    try {
      const sep = endpoint.includes('?') ? '&' : '?';
      const modeParam = state.isProduction ? `${sep}mode=production` : '';
      const headers = {
        'Content-Type': 'application/json',
        ...(state.isProduction ? { 'x-gdx-mode': 'production' } : {}),
        ...options.headers
      };
      const res = await fetch(endpoint + modeParam, {
        headers,
        ...options,
      });
      return await res.json();
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function syncWithBackend() {
    const [statusRes, bootRes] = await Promise.all([
      apiRequest('/api/status'),
      apiRequest('/api/bootstrap')
    ]);

    if (statusRes && statusRes.ok) {
      state.backendStatus = statusRes;
      if (statusRes.isProduction) {
        state.isProduction = true;
        if (state.viewMode !== 'dev') {
          state.viewMode = 'production';
        }
      }
      const dot = document.getElementById('backendConnDot');
      const label = document.getElementById('backendConnLabel');
      if (dot && label) {
        dot.className = 'status-dot is-online';
        if (state.isProduction) {
          label.textContent = statusRes.supabaseReachable
            ? 'Production · Supabase Live'
            : 'Production · Cold Start';
        } else {
          label.textContent = statusRes.supabaseReachable
            ? 'Supabase · Connected'
            : 'API · .env.local';
        }
      }
    }

    if (bootRes && bootRes.ok && bootRes.db) {
      const db = window.GDX_DB;
      const remote = bootRes.db;

      if (state.isProduction) {
        // Zero Mock Data: Dọn sạch mọi dữ liệu mẫu giả định
        const mockTables = [
          'users', 'customer_profiles', 'provider_profiles', 'provider_services', 'provider_areas',
          'availability_schedules', 'availability_exceptions', 'bookings', 'booking_status_history',
          'reviews', 'favorites', 'support_tickets'
        ];
        mockTables.forEach((t) => { db[t] = []; });
        db.provider_public_profiles = [];
      }

      const tables = [
        'province', 'provinces', 'ward', 'wards', 'users', 'customer_profiles', 'provider_profiles',
        'service_categories', 'services', 'provider_services', 'provider_areas',
        'availability_schedules', 'availability_exceptions', 'bookings',
        'booking_status_history', 'reviews', 'favorites', 'support_tickets'
      ];
      tables.forEach((t) => {
        if (Array.isArray(remote[t])) {
          if (t === 'service_categories') {
            db[t] = remote[t]
              .filter((c) => {
                const n = (c.category_name || c.name || '').toLowerCase();
                const slug = (c.slug || '').toLowerCase();
                return !n.includes('repair') && !n.includes('sửa') && !slug.includes('repair') && !n.includes('archived');
              })
              .map((c) => ({ ...c, name: c.category_name || c.name }));
          } else if (t === 'services') {
            db[t] = remote[t]
              .filter((s) => {
                const title = (s.title || '').toLowerCase();
                return !title.includes('repair') && !title.includes('sửa') && !title.includes('appliance');
              })
              .map((s) => {
                const title = (s.title || '').toLowerCase();
                let img = s.image_url;
                if (!img) {
                  if (title.includes('nấu') || title.includes('cơm')) img = 'assets/cooking-family-meal.jpg';
                  else if (title.includes('đầu bếp') || title.includes('tiệc')) img = 'assets/cooking-chef-prep.jpg';
                  else if (title.includes('deep') || title.includes('sâu') || title.includes('tổng vệ sinh')) img = 'assets/cleaning-deep.jpg';
                  else img = 'assets/cleaning-livingroom.jpg';
                }
                return { ...s, image_url: img };
              });
          } else if (t === 'bookings') {
            db[t] = remote[t].map((b) => {
              if (b.notes && b.notes.includes('[BROADCAST_POOL]') && b.status === 'pending') {
                return { ...b, provider_id: null, dispatch_type: 'broadcast' };
              }
              return b;
            });
          } else {
            db[t] = remote[t];
          }
        }
      });

      // Đồng bộ alias 2 chiều giữa province / provinces và ward / wards
      if (Array.isArray(remote.provinces) && remote.provinces.length > 0) {
        db.province = remote.provinces;
        db.provinces = remote.provinces;
      } else if (Array.isArray(remote.province) && remote.province.length > 0) {
        db.provinces = remote.province;
      }
      if (Array.isArray(remote.wards) && remote.wards.length > 0) {
        db.ward = remote.wards;
        db.wards = remote.wards;
      } else if (Array.isArray(remote.ward) && remote.ward.length > 0) {
        db.wards = remote.ward;
      }

      if (Array.isArray(remote.provider_public_profiles)) {
        db.provider_public_profiles = remote.provider_public_profiles;
      }

      // Khôi phục phiên đăng nhập thực tế từ localStorage nếu có
      if (state.isProduction) {
        try {
          const savedUserRaw = localStorage.getItem('gdx_auth_user');
          if (savedUserRaw) {
            const savedUser = JSON.parse(savedUserRaw);
            const found = (db.users || []).find((u) => u.user_id === savedUser.user_id);
            state.currentUser = found || savedUser;
            state.activeUserId = (found || savedUser).user_id;
            state.userRole = (found || savedUser).role;
            const cp = (db.customer_profiles || []).find((c) => String(c.user_id) === String(state.activeUserId));
            if (cp) {
              state.activeCustomerId = cp.customer_id;
              state.wizardDraft.ward_id = cp.ward_id;
              state.wizardDraft.address = cp.default_address;
              state.wizardDraft.latitude = cp.latitude;
              state.wizardDraft.longitude = cp.longitude;
            }
            const pp = (db.provider_profiles || []).find((p) => p.user_id === state.activeUserId);
            if (pp) state.activeProviderId = pp.provider_id;
          }
        } catch (_) {}
      }

      go(state.currentScreen);
    }
  }

  function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN').format(Math.round(Number(amount) || 0)) + ' đ';
  }

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

  function formatStatusLabel(st) {
    const map = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã nhận việc',
      in_progress: 'Đang thực hiện',
      completed: 'Hoàn thành',
      cancelled: 'Đã hủy',
      rejected: 'Từ chối',
      unpaid: 'Chưa thanh toán',
      paid: 'Đã thanh toán',
      refunded: 'Đã hoàn tiền',
      open: 'Đang mở',
      resolved: 'Đã giải quyết',
      closed: 'Đã đóng',
      verified: 'Đã xác minh',
      low: 'Thấp',
      medium: 'Bình thường',
      high: 'Khẩn cấp',
      urgent: 'Nghiêm trọng'
    };
    return state.viewMode === 'user' ? (map[st] || st) : `${map[st] || st} (${st})`;
  }

  // --- SUPABASE RPC EXECUTION ---
  const RPC = {
    transitionBookingStatus(bookingId, newStatus, reason) {
      const db = window.GDX_DB;
      const b = db.bookings.find((item) => item.booking_id === Number(bookingId));
      if (!b) return { success: false, message: `Không tìm thấy đơn hàng #${bookingId}` };
      const prevStatus = b.status;
      b.status = newStatus;
      b.updated_at = new Date().toISOString();

      db.booking_status_history.unshift({
        history_id: Date.now(),
        booking_id: b.booking_id,
        previous_status: prevStatus,
        new_status: newStatus,
        changed_by: state.activeUserId,
        reason: reason || 'Chuyển trạng thái theo quy trình tác nghiệp',
        created_at: new Date().toISOString(),
      });

      apiRequest('/api/rpc/transition-status', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: b.booking_id,
          new_status: newStatus,
          reason: reason || 'Chuyển trạng thái theo quy trình tác nghiệp',
          changed_by: state.activeUserId
        })
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

      apiRequest('/api/rpc/update-incidental', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: b.booking_id,
          total_incidental: cost,
          notes: note,
          changed_by: state.activeUserId
        })
      });

      return { success: true, total_incidental: cost, total_amount: newTotal };
    },

    confirmPayment(bookingId, method = 'DIRECT_CONFIRM') {
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
        reason: `Khách hàng xác nhận đã thanh toán ${formatMoney(b.total_amount)} (${method})`,
        created_at: new Date().toISOString(),
      });

      apiRequest('/api/rpc/confirm-payment', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: b.booking_id,
          changed_by: state.activeUserId
        })
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

      apiRequest('/api/rpc/admin-adjust', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: b.booking_id,
          total_incidental: b.total_incidental,
          total_amount: b.total_amount,
          payment_status: b.payment_status,
          status: b.status,
          provider_id: b.provider_id,
          reason
        })
      });

      return { success: true, booking: b };
    },
  };

  // --- SCREEN METADATA CATALOG (All 34 UI Elements) ---
  const SCREENS = {
    '0.1': { id: '0.1', portal: 0, title: '0.1. Đăng nhập / Đăng ký / Khôi phục mật khẩu', type: 'page', table: 'auth.users, users' },
    '0.2': { id: '0.2', portal: 0, title: '0.2. Thiết lập hồ sơ Khách hàng (Customer Onboarding)', type: 'page', table: 'users, customer_profiles, ward' },
    '0.3': { id: '0.3', portal: 0, title: '0.3. Đăng ký hành nghề Thợ (Provider Onboarding)', type: 'page', table: 'provider_profiles, provider_services, provider_areas' },
    '0.4': { id: '0.4', portal: 0, title: '0.4. Trạng thái Hồ sơ Thợ (Chờ duyệt / Bị từ chối)', type: 'page', table: 'provider_profiles (verification_status)' },
    '0.5': { id: '0.5', portal: 0, title: '0.5. Thông báo Tài khoản bị khóa (Account Suspended)', type: 'page', table: 'users (is_active = FALSE)' },

    '1.1': { id: '1.1', portal: 1, title: '1.1. Trang chủ & Khám phá dịch vụ', type: 'page', table: 'service_categories, services, favorites' },
    '1.2': { id: '1.2', portal: 1, title: '1.2. Cấu hình dịch vụ trước khi đặt (Booking Wizard)', type: 'page', table: 'services, provider_public_profiles, bookings' },
    '1.3': { id: '1.3', portal: 1, title: '1.3. Theo dõi đơn hàng trực tiếp (Live Tracking)', type: 'page', table: 'bookings, booking_status_history, provider_public_profiles' },
    '1.4': { id: '1.4', portal: 1, title: '1.4. Quản lý lịch hẹn dịch vụ', type: 'page', table: 'bookings, services, reviews' },
    '1.5': { id: '1.5', portal: 1, title: '1.5. Hồ sơ cá nhân & Sổ địa chỉ', type: 'page', table: 'users, customer_profiles, ward' },
    '1.6': { id: '1.6', portal: 1, title: '1.6. Danh sách Dịch vụ yêu thích', type: 'page', table: 'favorites, services' },
    '1.7': { id: '1.7', portal: 1, title: '1.7. Hồ sơ công khai của Thợ', type: 'modal', table: 'provider_public_profiles, reviews, provider_services' },
    '1.8': { id: '1.8', portal: 1, title: '1.8. Cổng Thanh toán QR Chuyển khoản (VietQR)', type: 'page', table: 'bookings (total_amount, payment_status)' },
    '1.9': { id: '1.9', portal: 1, title: '1.9. Đánh giá & Chấm điểm Thợ', type: 'modal', table: 'reviews, bookings' },
    '1.10': { id: '1.10', portal: 1, title: '1.10. Xác nhận Hủy lịch hẹn', type: 'modal', table: 'bookings, booking_status_history' },
    '1.11': { id: '1.11', portal: 1, title: '1.11. Trung tâm Hỗ trợ & Gửi khiếu nại', type: 'drawer', table: 'support_tickets, bookings' },

    '2.1': { id: '2.1', portal: 2, title: '2.1. Sàn nhận việc làm (Job Board)', type: 'page', table: 'bookings (pending), services, ward' },
    '2.2': { id: '2.2', portal: 2, title: '2.2. Ca làm việc hiện tại (Live Timer)', type: 'page', table: 'bookings, services, booking_status_history' },
    '2.3': { id: '2.3', portal: 2, title: '2.3. Ví Thu Nhập & Lịch Ca', type: 'page', table: 'bookings, availability_schedules, reviews' },
    '2.4': { id: '2.4', portal: 2, title: '2.4. Cấu hình Năng lực & Khu vực hoạt động', type: 'page', table: 'provider_profiles, provider_services, provider_areas' },
    '2.5': { id: '2.5', portal: 2, title: '2.5. Thanh trạng thái Nhận việc & GPS', type: 'component', table: 'provider_profiles (is_available_online, GPS)' },
    '2.6': { id: '2.6', portal: 2, title: '2.6. Thiết lập Lịch cố định & Xin nghỉ phép', type: 'modal', table: 'availability_schedules, availability_exceptions' },
    '2.7': { id: '2.7', portal: 2, title: '2.7. Kê khai Chi phí phát sinh (Incidental Cost)', type: 'modal', table: 'bookings (total_incidental, notes)' },
    '2.8': { id: '2.8', portal: 2, title: '2.8. Từ chối đơn / Hủy ca làm việc', type: 'modal', table: 'bookings, booking_status_history' },
    '2.9': { id: '2.9', portal: 2, title: '2.9. Báo cáo Sự cố / Hỗ trợ Đối tác', type: 'drawer', table: 'support_tickets, bookings' },

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

  function showToast(message) {
    const el = document.getElementById('toastBanner');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    setTimeout(() => {
      el.hidden = true;
    }, 3600);
  }

  function formatSeconds(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function formatTimer(sec) {
    return formatSeconds(sec);
  }

  function statusBadge(st) {
    const cls = {
      pending: 'badge-warning',
      confirmed: 'badge-info',
      in_progress: 'badge-info',
      completed: 'badge-positive',
      cancelled: 'badge-negative',
      rejected: 'badge-negative'
    }[st] || 'badge-neutral';
    return `<span class="badge ${cls}">${formatStatusLabel(st)}</span>`;
  }

  function paymentBadge(st) {
    const cls = {
      paid: 'badge-positive',
      unpaid: 'badge-warning',
      refunded: 'badge-neutral'
    }[st] || 'badge-neutral';
    return `<span class="badge ${cls}">${formatStatusLabel(st)}</span>`;
  }

  function priorityBadge(st) {
    const cls = {
      urgent: 'badge-negative',
      high: 'badge-warning',
      medium: 'badge-info',
      low: 'badge-neutral'
    }[st] || 'badge-neutral';
    return `<span class="badge ${cls}">${formatStatusLabel(st)}</span>`;
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

  // --- USER-FACING COPY MAP FOR 'user' MODE ---
  const USER_SCREEN_COPY = {
    '0.1': { title: 'Đăng nhập & Đăng ký tài khoản', sub: 'Sử dụng số điện thoại hoặc chọn nhanh tài khoản mẫu để trải nghiệm hệ thống.' },
    '0.2': { title: 'Thiết lập thông tin liên hệ & Địa chỉ', sub: 'Cập nhật địa chỉ mặc định để hệ thống gợi ý thợ gần khu vực nhà bạn nhất.' },
    '0.3': { title: 'Đăng ký trở thành Đối tác Thợ', sub: 'Điền thông tin cá nhân, chọn gói dịch vụ nhận làm và khu vực phường/xã hoạt động.' },
    '0.4': { title: 'Trạng thái hồ sơ đăng ký Đối tác', sub: 'Theo dõi kết quả xét duyệt hồ sơ đối tác dịch vụ của bạn tại Gia Đình Xanh.' },
    '0.5': { title: 'Tài khoản đang tạm ngừng hoạt động', sub: 'Vui lòng gửi yêu cầu hỗ trợ để được giải đáp và mở lại tài khoản.' },
    '1.1': { title: 'Trang chủ & Khám phá dịch vụ', sub: '' },
    '1.2': { title: 'Đặt lịch dịch vụ tại nhà', sub: 'Tùy chỉnh thời lượng, địa chỉ hẹn và chọn đối tác thợ phù hợp với lịch gia đình bạn.' },
    '1.3': { title: 'Theo dõi tiến độ ca dịch vụ', sub: 'Cập nhật trạng thái thực hiện, thông tin thợ phụ trách và chi tiết hóa đơn.' },
    '1.4': { title: 'Lịch hẹn dịch vụ của tôi', sub: 'Quản lý các lịch hẹn sắp tới, xem lại lịch sử và đánh giá chất lượng phục vụ.' },
    '1.5': { title: 'Thông tin cá nhân & Sổ địa chỉ', sub: 'Cập nhật họ tên, số điện thoại liên hệ và địa chỉ mặc định khi đặt dịch vụ.' },
    '1.6': { title: 'Dịch vụ gia đình đã lưu', sub: 'Danh sách các gói dịch vụ bạn yêu thích để đặt lại nhanh chóng.' },
    '1.7': { title: 'Hồ sơ đối tác thực hiện dịch vụ', sub: 'Thông tin kinh nghiệm, các dịch vụ đảm nhận và nhận xét từ khách hàng trước.' },
    '1.8': { title: 'Thanh toán hóa đơn dịch vụ', sub: 'Kiểm tra chi tiết chi phí và xác nhận hoàn tất thanh toán cho ca dịch vụ.' },
    '1.9': { title: 'Đánh giá chất lượng dịch vụ', sub: 'Chia sẻ cảm nhận của bạn sau khi ca làm việc hoàn tất.' },
    '1.10': { title: 'Xác nhận hủy lịch hẹn', sub: 'Vui lòng cho biết lý do hủy để chúng tôi thông báo tới thợ phụ trách.' },
    '1.11': { title: 'Trung tâm Hỗ trợ Khách hàng', sub: 'Gửi câu hỏi hoặc phản ánh về ca dịch vụ để đội ngũ chăm sóc khách hàng hỗ trợ bạn.' },
    '2.1': { title: 'Việc làm mới trong khu vực của bạn', sub: 'Danh sách các lịch hẹn mới phù hợp với kỹ năng và phường/xã bạn đã đăng ký.' },
    '2.2': { title: 'Ca làm việc đang thực hiện', sub: 'Theo dõi thời gian làm việc, địa chỉ khách hàng và cập nhật phụ phí vật tư mua hộ.' },
    '2.3': { title: 'Ví thu nhập & Lịch làm việc tuần', sub: 'Tổng hợp thu nhập từ các ca đã hoàn tất và quản lý khung giờ nhận việc trong tuần.' },
    '2.4': { title: 'Kỹ năng dịch vụ & Khu vực nhận việc', sub: 'Tùy chỉnh các gói dịch vụ bạn nhận làm và các phường/xã bạn có thể di chuyển tới.' },
    '2.6': { title: 'Cài đặt lịch làm việc & Xin nghỉ phép', sub: 'Thiết lập các ngày làm cố định trong tuần hoặc báo bận đột xuất.' },
    '2.7': { title: 'Kê khai phụ phí vật tư mua hộ', sub: 'Ghi nhận chi phí mua thêm vật tư hoặc nguyên liệu theo yêu cầu của chủ nhà.' },
    '2.8': { title: 'Xác nhận từ chối hoặc hủy nhận ca', sub: 'Vui lòng nhập lý do để hệ thống sắp xếp thợ khác hỗ trợ khách hàng kịp thời.' },
    '2.9': { title: 'Báo cáo sự cố cần hỗ trợ', sub: 'Gửi thông báo tới bộ phận điều phối khi gặp vướng mắc tại địa chỉ khách hàng.' },
    '3.1': { title: 'Tổng quan vận hành & Điều phối lịch hẹn', sub: 'Theo dõi doanh thu, tình trạng các ca dịch vụ và hỗ trợ điều phối thợ.' },
    '3.2': { title: 'Quản lý danh mục & Biểu phí dịch vụ', sub: 'Cập nhật danh mục, đơn giá niêm yết và trạng thái hiển thị của các gói dịch vụ.' },
    '3.3': { title: 'Duyệt hồ sơ đăng ký Đối tác Thợ', sub: 'Kiểm tra thông tin đăng ký và phê duyệt cho phép đối tác nhận việc trên hệ thống.' },
    '3.4': { title: 'Quản lý tài khoản, Hỗ trợ & Đánh giá', sub: 'Quản lý trạng thái tài khoản người dùng, xử lý yêu cầu hỗ trợ và đánh giá dịch vụ.' },
    '3.5': { title: 'Chi tiết đơn hàng & Lịch sử cập nhật', sub: 'Xem toàn bộ quá trình thay đổi trạng thái của đơn đặt lịch.' },
    '3.6': { title: 'Điều chỉnh thanh toán & Hoàn tiền', sub: 'Cập nhật chi phí, trạng thái thanh toán hoặc hoàn tiền cho khách hàng.' },
    '3.7': { title: 'Xử lý yêu cầu hỗ trợ khách hàng', sub: 'Cập nhật mức độ ưu tiên và kết quả giải quyết phiếu hỗ trợ.' },
    '3.8': { title: 'Cập nhật Danh mục & Gói dịch vụ', sub: 'Thêm mới hoặc chỉnh sửa thông tin gói dịch vụ gia đình.' },
    '3.9': { title: 'Quản lý danh sách Tỉnh/Thành & Phường/Xã', sub: 'Cập nhật các khu vực hành chính đang triển khai dịch vụ.' }
  };

  function cleanTechnicalLabelText(str) {
    if (!str) return str;
    return str
      .replace(/\s*\((?:users|auth\.users|customer_profiles|provider_profiles|provider_public_profiles|provider_services|provider_areas|availability_schedules|availability_exceptions|bookings|booking_status_history|reviews|favorites|support_tickets|service_categories|services|province|ward)[^)]*\)/gi, '')
      .replace(/\s*\((?:ward_id|id_card_number|default_address|category_id|parent_id|pricing_type|total_incidental|total_amount|payment_status|status|priority|subject|exception_date|day_of_week|base_price|Charts\.bars|Charts\.line|verification_status|UNIQUE|0\.\.6)[^)]*\)/gi, '')
      .replace(/\b(?:pending|confirmed|in_progress|completed|cancelled|rejected|unpaid|paid|refunded|open|resolved|closed|verified)\b/g, (match) => {
        const map = {
          pending: 'Chờ xác nhận',
          confirmed: 'Đã xác nhận',
          in_progress: 'Đang thực hiện',
          completed: 'Hoàn thành',
          cancelled: 'Đã hủy',
          rejected: 'Từ chối',
          unpaid: 'Chưa thanh toán',
          paid: 'Đã thanh toán',
          refunded: 'Đã hoàn tiền',
          open: 'Đang mở',
          resolved: 'Đã giải quyết',
          closed: 'Đã đóng',
          verified: 'Đã xác minh'
        };
        return map[match] || match;
      });
  }

  function applyUserModeCleanups(rootEl, screenOrModalId) {
    if ((state.viewMode !== 'user' && state.viewMode !== 'production') || !rootEl) return;

    const copy = USER_SCREEN_COPY[screenOrModalId];
    const titleEl = rootEl.querySelector('.screen-title') || (rootEl.id === 'modalDialog' ? rootEl.querySelector('#modalTitle') : null);
    if (titleEl) {
      if (copy && copy.title) {
        if (screenOrModalId === '1.3') {
          const bIdMatch = titleEl.textContent.match(/#\d+/);
          titleEl.textContent = `${copy.title} ${bIdMatch ? '· ' + bIdMatch[0] : ''}`.trim();
        } else if (screenOrModalId === '1.6' || screenOrModalId === '2.1') {
          const countMatch = titleEl.textContent.match(/\(\d+\)/);
          titleEl.textContent = `${copy.title} ${countMatch ? countMatch[0] : ''}`.trim();
        } else {
          titleEl.textContent = copy.title;
        }
      } else {
        titleEl.textContent = titleEl.textContent.replace(/^\d+\.\d+\.\s*/, '');
      }
    }

    const findingEl = rootEl.querySelector('.screen-finding') || (rootEl.id === 'modalDialog' ? rootEl.querySelector('#modalSub') : null);
    if (findingEl) {
      if (state.isProduction || state.viewMode === 'production') {
        findingEl.style.display = 'none';
      } else if (copy && copy.sub !== undefined) {
        findingEl.textContent = copy.sub;
      }
    }

    rootEl.querySelectorAll('.field-label, .panel-title, .u-tab, .field-hint, .kpi-note, .badge, h3, h4').forEach((el) => {
      if (el.children.length === 0) {
        el.textContent = cleanTechnicalLabelText(el.textContent);
      }
    });
  }

  function renderUserTopbar() {
    const userNav = document.getElementById('userMainNav');
    const captionEl = document.getElementById('activeRoleCaption');
    const roleSelect = document.getElementById('userRoleSelect');
    const btnUser = document.getElementById('modeBtnUser');
    const btnDev = document.getElementById('modeBtnDev');
    const userAccountBar = document.getElementById('userAccountBar');
    const modeSwitchPill = document.querySelector('.mode-switch-pill');
    const catalogBtn = document.querySelector('.dev-catalog-btn');
    const statusBtn = document.getElementById('supabaseStatusBtn');

    if (state.isProduction || state.viewMode === 'production') {
      if (modeSwitchPill) modeSwitchPill.style.display = 'none';
      if (catalogBtn) catalogBtn.style.display = 'none';
      if (statusBtn) statusBtn.style.display = 'none';
      if (roleSelect) roleSelect.style.display = 'none';
    }

    if (btnUser && btnDev) {
      btnUser.setAttribute('aria-pressed', state.viewMode === 'user' || state.viewMode === 'production' ? 'true' : 'false');
      btnDev.setAttribute('aria-pressed', state.viewMode === 'dev' ? 'true' : 'false');
    }

    if (roleSelect && !state.isProduction) {
      roleSelect.value = String(state.currentPortal);
    }

    if (userAccountBar && state.isProduction) {
      if (!state.currentUser) {
        userAccountBar.innerHTML = `
          <div class="user-guest-actions">
            <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.switchPortal(0, '0.1')">
              Đăng nhập
            </button>
            <button type="button" class="primary-btn btn-sm" onclick="GDXApp.switchPortal(0, '0.1')">
              Đăng ký
            </button>
          </div>
        `;
      } else {
        const roleLabel = state.currentUser.role === 'provider' ? 'Đối tác Thợ' : (state.currentUser.role === 'admin' ? 'Quản trị' : 'Khách hàng');
        userAccountBar.innerHTML = `
          <div class="user-logged-pill">
            <span class="user-logged-name">${state.currentUser.full_name}</span>
            <span class="badge badge-sm badge-positive">${roleLabel}</span>
            <button type="button" class="btn-logout-link" onclick="GDXApp.handleLogout()" title="Đăng xuất">
              Đăng xuất
            </button>
          </div>
        `;
      }
    }

    if (state.viewMode === 'dev') return;

    const db = window.GDX_DB;
    const favCount = (db.favorites || []).filter((f) => f.customer_id === state.activeCustomerId).length;
    const pendingJobsCount = (db.bookings || []).filter((b) => b.status === 'pending').length;
    const pendingKycCount = (db.provider_profiles || []).filter((p) => p.verification_status === 'pending').length;

    if (state.currentPortal === 1) {
      if (captionEl) captionEl.textContent = 'Chăm sóc nhà cửa tại gia';
      if (userNav) {
        let items;
        if (state.isProduction && !state.currentUser) {
          // Cold Start / Guest navigation
          items = [
            { id: '1.1', label: 'Khám phá dịch vụ' },
            { id: '1.2', label: 'Đặt lịch' },
            { id: '1.11', label: 'Hỗ trợ', isModal: true },
            { id: '0.1', label: 'Đăng nhập / Đăng ký', switchPortalTo: 0 }
          ];
        } else {
          items = [
            { id: '1.1', label: 'Khám phá' },
            { id: '1.2', label: 'Đặt lịch' },
            { id: '1.3', label: 'Theo dõi ca' },
            { id: '1.4', label: 'Lịch hẹn' },
            { id: '1.6', label: `Đã lưu (${favCount})` },
            { id: '1.5', label: 'Hồ sơ' },
            { id: '1.11', label: 'Hỗ trợ', isModal: true }
          ];
        }
        userNav.innerHTML = items
          .map(
            (it) => `
          <button type="button" class="portal-tab" aria-selected="${!it.isModal && state.currentScreen === it.id ? 'true' : 'false'}" onclick="${it.switchPortalTo !== undefined ? `GDXApp.switchPortal(${it.switchPortalTo}, '${it.id}')` : (it.isModal ? `GDXApp.openModal('${it.id}')` : `GDXApp.go('${it.id}')`)}">
            ${it.label}
          </button>`
          )
          .join('');
      }
    } else if (state.currentPortal === 2) {
      if (captionEl) captionEl.textContent = 'Không gian Đối tác Thợ';
      if (userNav) {
        const items = [
          { id: '2.1', label: `Việc mới (${pendingJobsCount})` },
          { id: '2.2', label: 'Ca đang làm' },
          { id: '2.3', label: 'Thu nhập & Lịch' },
          { id: '2.4', label: 'Kỹ năng & Khu vực' },
          { id: '2.9', label: 'Báo sự cố', isModal: true }
        ];
        userNav.innerHTML = items
          .map(
            (it) => `
          <button type="button" class="portal-tab" aria-selected="${!it.isModal && state.currentScreen === it.id ? 'true' : 'false'}" onclick="${it.isModal ? `GDXApp.openModal('${it.id}')` : `GDXApp.go('${it.id}')`}">
            ${it.label}
          </button>`
          )
          .join('');
      }
    } else if (state.currentPortal === 3) {
      if (captionEl) captionEl.textContent = 'Trung tâm Điều phối & Quản trị';
      if (userNav) {
        const items = [
          { id: '3.1', label: 'Tổng quan & Điều phối' },
          { id: '3.2', label: 'Danh mục & Bảng giá' },
          { id: '3.3', label: `Duyệt thợ (${pendingKycCount})` },
          { id: '3.4', label: 'Tài khoản & Hỗ trợ' }
        ];
        userNav.innerHTML = items
          .map(
            (it) => `
          <button type="button" class="portal-tab" aria-selected="${state.currentScreen === it.id ? 'true' : 'false'}" onclick="GDXApp.go('${it.id}')">
            ${it.label}
          </button>`
          )
          .join('');
      }
    } else {
      if (captionEl) captionEl.textContent = 'Tài khoản & Đăng ký Đối tác';
      if (userNav) {
        const items = [
          { id: '0.1', label: 'Đăng nhập / Đăng ký' },
          { id: '0.2', label: 'Hồ sơ Khách mới' },
          { id: '0.3', label: 'Đăng ký làm Thợ' },
          { id: '0.4', label: 'Kiểm tra hồ sơ' },
          { id: '1.1', label: 'Về Trang chủ', switchPortalTo: 1 }
        ];
        userNav.innerHTML = items
          .map(
            (it) => `
          <button type="button" class="portal-tab" aria-selected="${state.currentScreen === it.id ? 'true' : 'false'}" onclick="${it.switchPortalTo ? `GDXApp.switchPortal(1, '1.1')` : `GDXApp.go('${it.id}')`}">
            ${it.label}
          </button>`
          )
          .join('');
      }
    }
  }

  function setViewMode(mode, silent = false) {
    if (mode === 'production') {
      state.viewMode = 'production';
      state.isProduction = true;
    } else {
      state.viewMode = mode === 'dev' ? 'dev' : 'user';
    }
    document.body.setAttribute('data-view-mode', state.viewMode);
    renderUserTopbar();
    switchPortal(state.currentPortal, state.currentScreen);
    if (!silent) {
      showToast(
        state.viewMode === 'production'
          ? 'Đang ở Chế độ Production Mode (Zero Mock Data — Kết nối Supabase trực tiếp)'
          : (state.viewMode === 'user'
              ? 'Đang ở Luồng Người dùng thực tế (giao diện thân thiện)'
              : 'Đang ở Chế độ Dev (hiển thị 4 Phân hệ, 34 UI & ánh xạ bảng SQL)')
      );
    }
  }

  function goHomeByRole() {
    if (state.currentPortal === 2) {
      go('2.1');
    } else if (state.currentPortal === 3) {
      go('3.1');
    } else {
      switchPortal(1, '1.1');
    }
  }

  function handleUserRoleSwitch(portalVal) {
    const p = Number(portalVal);
    switchPortal(p);
    const names = {
      0: 'Cổng Tài khoản & Đăng ký Đối tác',
      1: 'Khách hàng: Nguyễn Minh Thảo',
      2: 'Đối tác Thợ: Đặng Thị Mai Lan',
      3: 'Quản trị viên: Nguyễn Quang Hào'
    };
    showToast(`Đã chuyển sang góc nhìn: ${names[p] || ''}`);
  }

  function handleUserAccountClick() {
    if (state.currentPortal === 0) {
      switchPortal(1, '1.1');
    } else {
      switchPortal(0, '0.1');
    }
  }

  // --- PORTAL & SIDEBAR SWITCHER ---
  function switchPortal(portalId, targetScreenId = null, params = {}) {
    state.currentPortal = Number(portalId);
    document.querySelectorAll('#devPortalSwitcher .portal-tab').forEach((tab) => {
      tab.setAttribute('aria-selected', tab.getAttribute('data-portal') === String(portalId));
    });

    const captionEl = document.getElementById('activeRoleCaption');
    const identityEl = document.getElementById('sidebarCurrentIdentity');
    const provWidget = document.getElementById('providerHeaderWidget');

    // Nếu ở chế độ Production Mode, tôn trọng danh tính thực tế hoặc khách vãng lai
    if (state.isProduction) {
      if (portalId === 0) {
        state.userRole = 'anon';
        if (identityEl) identityEl.textContent = 'Trạng thái: Khách vãng lai / Đăng ký';
        if (provWidget) provWidget.style.display = 'none';
        const dest = targetScreenId || '0.1';
        renderSidebar(dest);
        go(dest, params);
        return;
      } else if (portalId === 1) {
        state.userRole = state.currentUser ? state.currentUser.role : 'customer';
        if (identityEl) {
          identityEl.textContent = state.currentUser
            ? `auth.uid(): ${state.currentUser.full_name} (${state.currentUser.user_id.slice(0, 8)}...)`
            : 'Khách hàng chưa đăng nhập (Cold Start)';
        }
        if (provWidget) provWidget.style.display = 'none';
        const dest = targetScreenId || '1.1';
        renderSidebar(dest);
        go(dest, params);
        return;
      }
    }

    if (portalId === 0) {
      if (captionEl && state.viewMode === 'dev') captionEl.textContent = 'Phân hệ 0 · Dùng chung & Xác thực';
      if (identityEl) identityEl.textContent = 'Trạng thái: Khách vãng lai / Đăng nhập';
      state.userRole = 'anon';
      state.activeUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      if (provWidget) provWidget.style.display = 'none';
      const dest = targetScreenId || '0.1';
      renderSidebar(dest);
      go(dest, params);
    } else if (portalId === 1) {
      if (captionEl && state.viewMode === 'dev') captionEl.textContent = 'Phân hệ 1 · Khách hàng (Customer)';
      if (identityEl) identityEl.textContent = 'auth.uid(): Nguyễn Minh Thảo (customer_id #101)';
      state.userRole = 'customer';
      state.activeUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      state.activeCustomerId = 101;
      if (provWidget) provWidget.style.display = 'none';
      const dest = targetScreenId || '1.1';
      renderSidebar(dest);
      go(dest, params);
    } else if (portalId === 2) {
      if (captionEl && state.viewMode === 'dev') captionEl.textContent = 'Phân hệ 2 · Thợ / Đối tác (Provider)';
      if (identityEl) identityEl.textContent = 'auth.uid(): Đặng Thị Mai Lan (provider_id #201)';
      state.userRole = 'provider';
      state.activeUserId = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b21';
      state.activeProviderId = 201;
      if (provWidget) provWidget.style.display = 'flex';
      const dest = targetScreenId || '2.1';
      renderSidebar(dest);
      go(dest, params);
    } else if (portalId === 3) {
      if (captionEl && state.viewMode === 'dev') captionEl.textContent = 'Phân hệ 3 · Quản trị viên (Admin)';
      if (identityEl) identityEl.textContent = 'auth.uid(): Nguyễn Quang Hào (role: admin)';
      state.userRole = 'admin';
      state.activeUserId = 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c99';
      if (provWidget) provWidget.style.display = 'none';
      const dest = targetScreenId || '3.1';
      renderSidebar(dest);
      go(dest, params);
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

  function go(screenId, params = {}) {
    state.currentScreen = screenId;
    const meta = SCREENS[screenId];
    if (meta && meta.portal !== state.currentPortal) {
      switchPortal(meta.portal, screenId, params);
      return;
    }

    renderSidebar(screenId);
    renderUserTopbar();

    const viewport = document.getElementById('mainViewport');
    if (!viewport) return;

    if (screenId === '1.1') {
      viewport.setAttribute('data-surface-mode', 'stationery');
    } else {
      viewport.removeAttribute('data-surface-mode');
    }

    viewport.scrollTop = 0;

    switch (screenId) {
      case '0.1': renderScreen_0_1(viewport, params); break;
      case '0.2': renderScreen_0_2(viewport, params); break;
      case '0.3': renderScreen_0_3(viewport, params); break;
      case '0.4': renderScreen_0_4(viewport, params); break;
      case '0.5': renderScreen_0_5(viewport, params); break;

      case '1.1': renderScreen_1_1(viewport, params); break;
      case '1.2': renderScreen_1_2(viewport, params); break;
      case '1.3': renderScreen_1_3(viewport, params); break;
      case '1.4': renderScreen_1_4(viewport, params); break;
      case '1.5': renderScreen_1_5(viewport, params); break;
      case '1.6': renderScreen_1_6(viewport, params); break;
      case '1.8': renderScreen_1_8(viewport, params); break;

      case '2.1': renderScreen_2_1(viewport, params); break;
      case '2.2': renderScreen_2_2(viewport, params); break;
      case '2.3': renderScreen_2_3(viewport, params); break;
      case '2.4': renderScreen_2_4(viewport, params); break;

      case '3.1': renderScreen_3_1(viewport, params); break;
      case '3.2': renderScreen_3_2(viewport, params); break;
      case '3.3': renderScreen_3_3(viewport, params); break;
      case '3.4': renderScreen_3_4(viewport, params); break;

      default:
        viewport.innerHTML = `<div class="panel"><h2>Màn hình ${screenId}</h2></div>`;
    }

    applyUserModeCleanups(viewport, screenId);
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
    apiRequest('/api/provider/online-gps', {
      method: 'PATCH',
      body: JSON.stringify({
        provider_id: state.activeProviderId,
        is_available_online: prov.is_available_online
      })
    });
    showToast(`Trạng thái nhận việc: ${prov.is_available_online ? 'Đang trực tuyến' : 'Tạm nghỉ'}`);
    if (state.currentScreen === '2.1') go('2.1');
  }

  function refreshProviderGPS() {
    const prov = window.GDX_DB.provider_profiles.find((p) => p.provider_id === state.activeProviderId);
    if (!prov) return;
    prov.lattitude = Number((prov.lattitude + (Math.random() - 0.5) * 0.002).toFixed(6));
    prov.longtitude = Number((prov.longtitude + (Math.random() - 0.5) * 0.002).toFixed(6));

    const gpsEl = document.getElementById('providerGpsText');
    if (gpsEl) gpsEl.textContent = `${prov.lattitude}, ${prov.longtitude}`;
    apiRequest('/api/provider/online-gps', {
      method: 'PATCH',
      body: JSON.stringify({
        provider_id: state.activeProviderId,
        lattitude: prov.lattitude,
        longtitude: prov.longtitude
      })
    });
    showToast(`Đã cập nhật tọa độ: ${prov.lattitude}, ${prov.longtitude}`);
    if (state.currentScreen === '2.1' || state.currentScreen === '2.2') go(state.currentScreen);
  }

  // =====================================================================
  // SCREEN RENDERERS: PHÂN HỆ 0 (AUTH & ONBOARDING: 0.1 – 0.5)
  // =====================================================================

  // 0.1: Đăng nhập (Chính) / Đăng ký riêng biệt / Khôi phục mật khẩu riêng biệt
  function renderScreen_0_1(container, params = {}) {
    const currentView = (params && params.view) || state.authView || 'login';
    state.authView = currentView;

    const isDev = !state.isProduction && state.viewMode === 'dev';

    let rightFormHtml = '';

    if (currentView === 'login') {
      rightFormHtml = `
        <div class="auth-form-header">
          <span class="auth-badge-pill">Đăng nhập tài khoản</span>
          <h2 class="auth-form-title">Chào mừng bạn trở lại</h2>
          <p class="auth-form-subtitle">Nhập số điện thoại hoặc email đã đăng ký để tiếp tục vào hệ thống.</p>
        </div>

        <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.handleLogin(this);">
          <div class="field-group">
            <label class="field-label" for="loginIdentifier">Số điện thoại hoặc Email</label>
            <input type="text" id="loginIdentifier" name="identifier" class="input" placeholder="09xxxxxxxx hoặc email@domain.com" required autocomplete="username">
            <div class="error-msg">Vui lòng nhập số điện thoại hoặc email hợp lệ.</div>
          </div>

          <div class="field-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <label class="field-label" for="loginPassword" style="margin-bottom:0;">Mật khẩu</label>
              <a href="javascript:void(0)" onclick="GDXApp.setAuthView('forgot')" class="auth-text-link" style="font-size:13px;">Quên mật khẩu?</a>
            </div>
            <div class="pw-input-wrap">
              <input type="password" id="loginPassword" name="password" class="input" placeholder="Nhập mật khẩu của bạn" required minlength="6" autocomplete="current-password">
              <button type="button" class="btn-toggle-pw" onclick="GDXApp.togglePasswordVisibility('loginPassword', this)" aria-label="Hiển thị mật khẩu">
                ${Icons.eye()}
              </button>
            </div>
            <div class="error-msg">Mật khẩu cần tối thiểu 6 ký tự.</div>
          </div>

          <button type="submit" class="btn btn-primary btn-auth-submit">
            Đăng nhập vào hệ thống &rarr;
          </button>
        </form>

        <div class="auth-switch-footer">
          <span>Bạn chưa có tài khoản?</span>
          <a href="javascript:void(0)" onclick="GDXApp.setAuthView('register')" class="auth-switch-cta">Đăng ký ngay &rarr;</a>
        </div>
      `;
    } else if (currentView === 'register') {
      rightFormHtml = `
        <div class="auth-form-header">
          <span class="auth-badge-pill">Đăng ký thành viên</span>
          <h2 class="auth-form-title">Tạo tài khoản mới</h2>
          <p class="auth-form-subtitle">Chỉ mất chưa đầy 1 phút để bắt đầu sử dụng dịch vụ tiện ích gia đình.</p>
        </div>

        <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.handleRegister(this);">
          <div class="field-group">
            <label class="field-label" for="regFullName">Họ và tên đầy đủ</label>
            <input type="text" id="regFullName" name="full_name" class="input" required placeholder="Ví dụ: Nguyễn Văn An" autocomplete="name">
            <div class="error-msg">Vui lòng nhập họ và tên của bạn.</div>
          </div>

          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label" for="regPhone">Số điện thoại</label>
              <input type="tel" id="regPhone" name="phone_number" class="input" required pattern="0[0-9]{9,10}" placeholder="0918776655" autocomplete="tel">
              <div class="error-msg">Số điện thoại gồm 10 số bắt đầu bằng số 0.</div>
            </div>
            <div class="field-group">
              <label class="field-label" for="regEmail">Địa chỉ Email</label>
              <input type="email" id="regEmail" name="email" class="input" required placeholder="ban@email.com" autocomplete="email">
              <div class="error-msg">Vui lòng nhập đúng định dạng email.</div>
            </div>
          </div>

          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label" for="regPassword">Mật khẩu</label>
              <div class="pw-input-wrap">
                <input type="password" id="regPassword" name="password" class="input" required minlength="6" placeholder="Tối thiểu 6 ký tự" autocomplete="new-password">
                <button type="button" class="btn-toggle-pw" onclick="GDXApp.togglePasswordVisibility('regPassword', this)" aria-label="Hiển thị mật khẩu">
                  ${Icons.eye()}
                </button>
              </div>
              <span class="field-hint">Tối thiểu 6 ký tự bảo mật</span>
            </div>
            <div class="field-group">
              <label class="field-label" for="regConfirmPassword">Xác nhận mật khẩu</label>
              <div class="pw-input-wrap">
                <input type="password" id="regConfirmPassword" name="confirm_password" class="input" required minlength="6" placeholder="Nhập lại mật khẩu" autocomplete="new-password">
                <button type="button" class="btn-toggle-pw" onclick="GDXApp.togglePasswordVisibility('regConfirmPassword', this)" aria-label="Hiển thị mật khẩu">
                  ${Icons.eye()}
                </button>
              </div>
              <span class="field-hint">Nhập lại chính xác mật khẩu</span>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Bạn đăng ký với mục đích nào?</label>
            <div class="choice-grid-2">
              <label class="choice-card">
                <input type="radio" name="role" value="customer" checked>
                <div>
                  <div style="font-weight:600;">Khách hàng gia đình</div>
                  <div class="field-hint">Đặt lịch dọn nhà, điện lạnh, nấu ăn</div>
                </div>
              </label>
              <label class="choice-card">
                <input type="radio" name="role" value="provider">
                <div>
                  <div style="font-weight:600;">Đối tác hành nghề Thợ</div>
                  <div class="field-hint">Nhận việc theo khu vực và chuyên môn</div>
                </div>
              </label>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-auth-submit">
            Tạo tài khoản &amp; Tiếp tục thiết lập hồ sơ &rarr;
          </button>
        </form>

        <div class="auth-switch-footer">
          <span>Bạn đã có tài khoản?</span>
          <a href="javascript:void(0)" onclick="GDXApp.setAuthView('login')" class="auth-switch-cta">Đăng nhập ngay &rarr;</a>
        </div>
      `;
    } else {
      rightFormHtml = `
        <div class="auth-form-header">
          <span class="auth-badge-pill">Khôi phục quyền truy cập</span>
          <h2 class="auth-form-title">Quên mật khẩu?</h2>
          <p class="auth-form-subtitle">Đừng lo lắng! Vui lòng cung cấp email hoặc số điện thoại đã đăng ký, chúng tôi sẽ hỗ trợ bạn ngay.</p>
        </div>

        <div class="auth-info-banner">
          <span style="font-size:18px; line-height:1;">${Icons.shield()}</span>
          <div>Liên kết đặt lại mật khẩu an toàn sẽ được gửi trực tiếp đến hòm thư hoặc số điện thoại của bạn trong 60 giây.</div>
        </div>

        <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.handleForgot(this);">
          <div class="field-group">
            <label class="field-label" for="forgotIdentifier">Email hoặc Số điện thoại đã đăng ký</label>
            <input type="text" id="forgotIdentifier" name="identifier" class="input" required placeholder="minhthao.q7@gmail.com hoặc 09xxxxxxxx" autocomplete="username">
            <div class="error-msg">Vui lòng nhập email hoặc số điện thoại hợp lệ.</div>
          </div>

          <button type="submit" class="btn btn-primary btn-auth-submit">
            Gửi hướng dẫn khôi phục mật khẩu &rarr;
          </button>
        </form>

        <div class="auth-switch-footer">
          <a href="javascript:void(0)" onclick="GDXApp.setAuthView('login')" class="auth-back-cta">&larr; Quay lại trang Đăng nhập</a>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="auth-stage-wrapper">
        ${isDev ? `
          <div class="auth-dev-banner">
            <div class="auth-dev-banner-header">
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="badge badge-info">Chế độ Phát triển</span>
                <strong style="font-size:13.5px; color:var(--ink);">Chọn nhanh tài khoản để trải nghiệm 5 vai trò hệ thống (1-Click Login):</strong>
              </div>
              <span class="field-hint">Chỉ hiển thị ở góc nhìn Dev</span>
            </div>
            <div class="auth-dev-persona-grid">
              <button type="button" class="auth-dev-chip" onclick="GDXApp.quickPersonaLogin('customer')">
                <div style="width:28px; height:28px; border-radius:50%; background:var(--accent-soft); color:var(--accent); display:grid; place-items:center; font-weight:600; font-size:12px;">MT</div>
                <div>
                  <div style="font-weight:600; font-size:13px;">Nguyễn Minh Thảo</div>
                  <div class="field-hint" style="font-size:11px;">Khách hàng · Q.7</div>
                </div>
              </button>
              <button type="button" class="auth-dev-chip" onclick="GDXApp.quickPersonaLogin('provider')">
                <img src="assets/provider-lan.jpg" alt="Mai Lan" style="width:28px; height:28px; border-radius:50%; object-fit:cover;">
                <div>
                  <div style="font-weight:600; font-size:13px;">Đặng Thị Mai Lan</div>
                  <div class="field-hint" style="font-size:11px;">Thợ đã duyệt (4.95★)</div>
                </div>
              </button>
              <button type="button" class="auth-dev-chip" onclick="GDXApp.quickPersonaLogin('provider_pending')">
                <img src="assets/provider-mai.jpg" alt="Võ Văn Khải" style="width:28px; height:28px; border-radius:50%; object-fit:cover;">
                <div>
                  <div style="font-weight:600; font-size:13px;">Võ Văn Khải</div>
                  <div class="field-hint" style="font-size:11px;">Thợ chờ duyệt (0.4)</div>
                </div>
              </button>
              <button type="button" class="auth-dev-chip" onclick="GDXApp.quickPersonaLogin('provider_rejected')">
                <div style="width:28px; height:28px; border-radius:50%; background:var(--pill-negative-bg); color:var(--pill-negative-ink); display:grid; place-items:center; font-weight:600; font-size:12px;">MĐ</div>
                <div>
                  <div style="font-weight:600; font-size:13px;">Ngô Minh Đức</div>
                  <div class="field-hint" style="font-size:11px;">Tài khoản tạm khóa</div>
                </div>
              </button>
              <button type="button" class="auth-dev-chip" onclick="GDXApp.quickPersonaLogin('admin')">
                <div style="width:28px; height:28px; border-radius:50%; background:var(--pill-info-bg); color:var(--pill-info-ink); display:grid; place-items:center; font-weight:600; font-size:12px;">QH</div>
                <div>
                  <div style="font-weight:600; font-size:13px;">Nguyễn Quang Hào</div>
                  <div class="field-hint" style="font-size:11px;">Quản trị viên (3.1)</div>
                </div>
              </button>
            </div>
          </div>
        ` : ''}

        <div class="auth-split-card">
          <!-- Left: Brand Showcase & Trust Pillars -->
          <div class="auth-brand-side">
            <div>
              <div class="auth-brand-badge">
                ${Icons.shield()} Nền tảng Đặt Dịch Vụ Gia Đình
              </div>
              <h2 class="auth-brand-title">Chăm sóc ngôi nhà, nâng niu tổ ấm Việt.</h2>
              <p class="auth-brand-desc">
                Gia Đình Xanh kết nối trực tiếp các hộ gia đình với mạng lưới đối tác thợ lành nghề, được xác minh danh tính và chuẩn hóa tác phong phục vụ.
              </p>

              <div class="auth-trust-list">
                <div class="auth-trust-item">
                  <div class="auth-trust-icon">${Icons.check()}</div>
                  <div>
                    <h4>Đối tác xác minh lý lịch rõ ràng</h4>
                    <p>Kiểm tra CCCD gắn chip, xác thực tư pháp và tay nghề trước khi nhận việc.</p>
                  </div>
                </div>

                <div class="auth-trust-item">
                  <div class="auth-trust-icon">${Icons.check()}</div>
                  <div>
                    <h4>Bảo hiểm trách nhiệm minh bạch</h4>
                    <p>An tâm tuyệt đối với gói bảo hiểm tài sản lên đến 20.000.000đ trong suốt ca dịch vụ.</p>
                  </div>
                </div>

                <div class="auth-trust-item">
                  <div class="auth-trust-icon">${Icons.check()}</div>
                  <div>
                    <h4>Biểu giá niêm yết theo thời gian thực</h4>
                    <p>Báo giá rõ ràng, không phụ phí phát sinh, dễ dàng thanh toán linh hoạt.</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="auth-brand-footer">
              <span>Được tin dùng bởi hơn 10.000+ hộ gia đình</span>
              <span style="display:flex; align-items:center; gap:4px; font-weight:600; color:#a7f3d0;">
                ★ 4.95 / 5.0
              </span>
            </div>
          </div>

          <!-- Right: Dedicated Form Surface (Login / Register / Forgot) -->
          <div class="auth-form-side">
            ${rightFormHtml}
          </div>
        </div>
      </div>
    `;

    applyUserModeCleanups(container, '0.1');
  }

  function setAuthView(view = 'login') {
    state.authView = view;
    const vp = document.getElementById('mainViewport');
    if (vp) {
      renderScreen_0_1(vp, { view });
    }
  }

  function setAuthTab(tab) {
    const view = tab === 'forgot' ? 'forgot' : (tab === 'register' ? 'register' : 'login');
    setAuthView(view);
  }

  function handleForgot(form) {
    const identifier = form && form.identifier ? form.identifier.value.trim() : '';
    if (!identifier) {
      showToast('Vui lòng nhập email hoặc số điện thoại đã đăng ký.');
      return;
    }
    showToast(`Đã gửi hướng dẫn khôi phục mật khẩu tới: ${identifier}. Vui lòng kiểm tra hộp thư/tin nhắn.`);
    setTimeout(() => {
      setAuthView('login');
    }, 1200);
  }

  function togglePasswordVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPw = input.type === 'password';
    input.type = isPw ? 'text' : 'password';
    if (btnEl) {
      btnEl.setAttribute('aria-label', isPw ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu');
      btnEl.innerHTML = isPw ? Icons.eyeOff() : Icons.eye();
    }
  }

  function quickPersonaLogin(role) {
    handleLogin({ mockRole: { value: role } });
  }

  async function handleLogin(form) {
    const hasIdentifier = Boolean(form && form.identifier && form.identifier.value && form.identifier.value.trim());
    const hasPassword = Boolean(form && form.password && form.password.value);

    // Cho phép trải nghiệm nhanh persona ở chế độ phát triển nếu không nhập thủ công
    if (!hasIdentifier && form && form.mockRole && !state.isProduction && state.viewMode !== 'production') {
      const role = form.mockRole.value || 'customer';
      if (role === 'customer') {
        showToast('Đã đăng nhập: Nguyễn Minh Thảo (Khách hàng)');
        switchPortal(1, '1.1');
      } else if (role === 'provider') {
        showToast('Đã đăng nhập: Đặng Thị Mai Lan (Đối tác Thợ)');
        switchPortal(2, '2.1');
      } else if (role === 'provider_pending') {
        showToast('Tài khoản thợ Võ Văn Khải đang chờ duyệt hồ sơ');
        switchPortal(0, '0.4', { status: 'pending' });
      } else if (role === 'provider_rejected') {
        showToast('Tài khoản Ngô Minh Đức đang tạm khóa');
        switchPortal(0, '0.5');
      } else if (role === 'admin') {
        showToast('Đã đăng nhập: Nguyễn Quang Hào (Quản trị viên)');
        switchPortal(3, '3.1');
      }
      return;
    }

    const identifier = form && form.identifier ? form.identifier.value.trim() : '';
    const password = form && form.password ? form.password.value : '';

    if (!identifier) {
      showToast('Vui lòng nhập số điện thoại hoặc email.');
      return;
    }
    if (!password) {
      showToast('Vui lòng nhập mật khẩu của bạn.');
      return;
    }

    // Gửi yêu cầu đăng nhập lên API xác thực
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });

    if (res && res.ok && res.user) {
      state.currentUser = res.user;
      state.activeUserId = res.user.user_id;
      state.userRole = res.user.role;

      if (window.GDX_DB && Array.isArray(window.GDX_DB.users)) {
        const uIdx = window.GDX_DB.users.findIndex(u => u.user_id === res.user.user_id);
        if (uIdx >= 0) window.GDX_DB.users[uIdx] = res.user;
        else window.GDX_DB.users.push(res.user);
      }

      if (res.customer_profile) {
        state.activeCustomerId = res.customer_profile.customer_id;
        state.wizardDraft.ward_id = res.customer_profile.ward_id;
        state.wizardDraft.address = res.customer_profile.default_address;
        state.wizardDraft.latitude = res.customer_profile.latitude;
        state.wizardDraft.longitude = res.customer_profile.longitude;
        if (window.GDX_DB && Array.isArray(window.GDX_DB.customer_profiles)) {
          const cIdx = window.GDX_DB.customer_profiles.findIndex(c => String(c.user_id) === String(res.user.user_id));
          if (cIdx >= 0) window.GDX_DB.customer_profiles[cIdx] = res.customer_profile;
          else window.GDX_DB.customer_profiles.push(res.customer_profile);
        }
      }

      if (res.provider_profile) {
        state.activeProviderId = res.provider_profile.provider_id;
        if (window.GDX_DB && Array.isArray(window.GDX_DB.provider_profiles)) {
          const pIdx = window.GDX_DB.provider_profiles.findIndex(p => String(p.user_id) === String(res.user.user_id));
          if (pIdx >= 0) window.GDX_DB.provider_profiles[pIdx] = res.provider_profile;
          else window.GDX_DB.provider_profiles.push(res.provider_profile);
        }
      }

      try {
        localStorage.setItem('gdx_auth_user', JSON.stringify(res.user));
      } catch (_) {}

      showToast(`Đăng nhập thành công! Chào mừng ${res.user.full_name}.`);
      renderUserTopbar();

      if (res.user.role === 'provider') {
        switchPortal(2, '2.1');
      } else if (res.user.role === 'admin') {
        switchPortal(3, '3.1');
      } else {
        switchPortal(1, '1.1');
      }
    } else {
      showToast((res && res.error) || 'Đăng nhập không thành công. Vui lòng kiểm tra lại tài khoản hoặc mật khẩu.');
    }
  }

  async function handleRegister(form) {
    const role = form.role ? form.role.value : 'customer';
    const fullName = form.full_name ? form.full_name.value.trim() : '';
    const phone = form.phone_number ? form.phone_number.value.trim() : '';
    const email = form.email ? form.email.value.trim() : '';
    const password = form.password ? form.password.value : '';
    const confirmPassword = form.confirm_password ? form.confirm_password.value : '';

    if (!fullName || !phone) {
      showToast('Vui lòng nhập họ và tên cùng số điện thoại.');
      return;
    }

    if (!password || password.length < 6) {
      showToast('Mật khẩu là bắt buộc và phải có tối thiểu 6 ký tự.');
      if (form.password) form.password.focus();
      return;
    }

    if (password !== confirmPassword) {
      showToast('Mật khẩu xác nhận không trùng khớp. Vui lòng kiểm tra lại.');
      if (form.confirm_password) form.confirm_password.focus();
      return;
    }

    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: fullName,
        phone_number: phone,
        email,
        password,
        role
      })
    });

    if (res && res.ok && res.user) {
      state.currentUser = res.user;
      state.activeUserId = res.user.user_id;
      state.userRole = res.user.role;

      if (window.GDX_DB && Array.isArray(window.GDX_DB.users)) {
        const uIdx = window.GDX_DB.users.findIndex(u => u.user_id === res.user.user_id);
        if (uIdx >= 0) window.GDX_DB.users[uIdx] = res.user;
        else window.GDX_DB.users.push(res.user);
      }

      try {
        localStorage.setItem('gdx_auth_user', JSON.stringify(res.user));
      } catch (_) {}

      showToast(`Đăng ký tài khoản thành công! Chào mừng ${res.user.full_name}.`);
      renderUserTopbar();
      if (role === 'customer') {
        go('0.2');
      } else {
        go('0.3');
      }
    } else {
      showToast((res && res.error) || 'Đăng ký không thành công. Vui lòng thử lại.');
    }
  }

  function handleLogout() {
    state.currentUser = null;
    state.activeUserId = null;
    state.activeCustomerId = null;
    state.activeProviderId = null;
    state.userRole = 'anon';
    try {
      localStorage.removeItem('gdx_auth_user');
    } catch (_) {}
    showToast('Đã đăng xuất tài khoản.');
    renderUserTopbar();
    switchPortal(1, '1.1');
  }

  // ---------------------------------------------------------------------
  // LEAFLET & OPENSTREETMAP LOCATION PICKER & GEOLOCATION
  // ---------------------------------------------------------------------
  const PROVINCE_COORDINATES = {
    'Hồ Chí Minh': [10.7769, 106.7009],
    'Hà Nội': [21.0285, 105.8542],
    'Đà Nẵng': [16.0544, 108.2022],
    'Hải Phòng': [20.8449, 106.6881],
    'Cần Thơ': [10.0452, 105.7469],
    'Bình Dương': [10.9804, 106.6519],
    'Đồng Nai': [10.9574, 106.8427],
    'Bà Rịa': [10.4958, 107.1687],
    'Khánh Hòa': [12.2388, 109.1967],
    'Lâm Đồng': [11.9404, 108.4583],
    'Thừa Thiên Huế': [16.4637, 107.5909],
    'Huế': [16.4637, 107.5909],
    'Quảng Nam': [15.5651, 108.4816],
    'Quảng Ngãi': [15.1205, 108.7923],
    'Bình Định': [13.7830, 109.2197],
    'Phú Yên': [13.0882, 109.0924],
    'Ninh Thuận': [11.5647, 108.9882],
    'Bình Thuận': [10.9333, 108.1000],
    'Long An': [10.5360, 106.4134],
    'Tiền Giang': [10.3544, 106.3653],
    'Bến Tre': [10.2415, 106.3759],
    'Trà Vinh': [9.9347, 106.3458],
    'Vĩnh Long': [10.2537, 105.9722],
    'Đồng Tháp': [10.4578, 105.6324],
    'An Giang': [10.3831, 105.4358],
    'Kiên Giang': [10.0125, 105.0809],
    'Hậu Giang': [9.7844, 105.4701],
    'Sóc Trăng': [9.6033, 105.9800],
    'Bạc Liêu': [9.2941, 105.7278],
    'Cà Mau': [9.1769, 105.1524],
    'Tây Ninh': [11.3100, 106.0983],
    'Bình Phước': [11.5333, 106.8833],
    'Đắk Lắk': [12.6667, 108.0383],
    'Đắk Nông': [12.0044, 107.6908],
    'Gia Lai': [13.9833, 108.0000],
    'Kon Tum': [14.3500, 108.0000],
    'Quảng Bình': [17.4687, 106.6225],
    'Quảng Trị': [16.8167, 107.1000],
    'Nghệ An': [18.6734, 105.6813],
    'Hà Tĩnh': [18.3560, 105.9058],
    'Thanh Hóa': [19.8067, 105.7852],
    'Ninh Bình': [20.2506, 105.9745],
    'Nam Định': [20.4200, 106.1683],
    'Thái Bình': [20.4500, 106.3333],
    'Hà Nam': [20.5456, 105.9122],
    'Hưng Yên': [20.6500, 106.0500],
    'Hải Dương': [20.9372, 106.3147],
    'Bắc Ninh': [21.1861, 106.0763],
    'Bắc Giang': [21.2731, 106.1946],
    'Vĩnh Phúc': [21.3089, 105.6049],
    'Phú Thọ': [21.3228, 105.3283],
    'Thái Nguyên': [21.5942, 105.8482],
    'Lạng Sơn': [21.8536, 106.7615],
    'Quảng Ninh': [20.9500, 107.0833]
  };

  let activeCustomerMap = null;
  let activeCustomerMarker = null;

  let reverseGeocodeTimer = null;

  async function resolveAddressFromCoordinates(lat, lng, opts = {}) {
    const latFormatted = Number(lat).toFixed(6);
    const lngFormatted = Number(lng).toFixed(6);

    const addrInput = document.getElementById(opts.addrInputId || 'obCustAddr')
      || document.getElementById('profAddress')
      || document.getElementById('wizAddress');

    const statusPill = document.querySelector('.geo-map-status-pill span:last-child');
    if (statusPill) {
      statusPill.innerHTML = '<span class="status-dot" style="background:#e07a5f;"></span> Đang nhận diện địa chỉ từ GPS vệ tinh...';
    }

    try {
      const res = await apiRequest(`/api/geo/reverse?lat=${latFormatted}&lng=${lngFormatted}`);
      if (res && res.ok && res.detailed_address) {
        if (addrInput) {
          addrInput.value = res.detailed_address;
          addrInput.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
          addrInput.style.borderColor = 'var(--color-primary)';
          addrInput.style.boxShadow = '0 0 0 3px rgba(27, 67, 50, 0.2)';
          setTimeout(() => {
            addrInput.style.boxShadow = '';
          }, 1500);
        }

        if (activeCustomerMarker) {
          activeCustomerMarker.bindPopup(
            `<strong>${res.detailed_address}</strong><br><span style="font-size:11px; color:#555;">${res.full_address || ''}</span>`
          ).openPopup();
        }

        if (statusPill) {
          statusPill.innerHTML = `<span class="status-dot is-online"></span> Đã nhận diện: <strong>${res.detailed_address}</strong>`;
        }

        // Tự động khớp Tỉnh/Thành phố & Phường/Xã trong dropdown nếu có
        matchProvinceAndWardFromGeo(res.province_name, res.ward_name, opts);

        showToast(`Đã nhận diện vị trí: ${res.detailed_address}`);
        return res;
      }
    } catch (e) {
      console.warn('Lỗi reverse geocode:', e);
    }

    if (statusPill) {
      statusPill.innerHTML = '<span class="status-dot is-online"></span> Chạm vào bản đồ hoặc kéo chốt định vị để ghim chính xác số nhà';
    }
    return null;
  }

  function matchProvinceAndWardFromGeo(provinceName, wardName, opts = {}) {
    if (!provinceName && !wardName) return;

    const provSelect = document.getElementById(opts.provSelectId || 'obCustProvince')
      || document.getElementById('wizProvSelect')
      || document.getElementById('profProv');

    const wardSelect = document.getElementById(opts.wardSelectId || 'obCustWard')
      || document.getElementById('wizWardSelect')
      || document.getElementById('profWard');

    if (!provSelect) return;

    // 1. Khớp Tỉnh / Thành phố
    if (provinceName) {
      const pNorm = provinceName.toLowerCase().replace(/^(tỉnh|thành phố|tp\.?)\s+/i, '').trim();
      let matchedProvOption = null;
      for (let i = 0; i < provSelect.options.length; i++) {
        const optText = provSelect.options[i].text.toLowerCase();
        if (optText.includes(pNorm) || pNorm.includes(optText.replace(/^(tỉnh|thành phố|tp\.?)\s+/i, '').trim())) {
          matchedProvOption = provSelect.options[i];
          break;
        }
      }
      if (matchedProvOption && provSelect.value !== matchedProvOption.value) {
        provSelect.value = matchedProvOption.value;
        if (wardSelect) {
          const db = window.GDX_DB;
          const allWards = db.ward || db.wards || [];
          const filteredWards = allWards.filter((w) => !w.provinceId || String(w.provinceId) === String(matchedProvOption.value));
          const wardsToRender = filteredWards.length > 0 ? filteredWards : allWards.slice(0, 100);
          wardSelect.innerHTML = wardsToRender
            .map((w) => `<option value="${w.ward_id}">${w.name}</option>`)
            .join('');
        }
      }
    }

    // 2. Khớp Phường / Xã
    if (wardName && wardSelect) {
      const wNorm = wardName.toLowerCase().replace(/^(phường|xã|thị trấn)\s+/i, '').trim();
      for (let i = 0; i < wardSelect.options.length; i++) {
        const optText = wardSelect.options[i].text.toLowerCase();
        if (optText.includes(wNorm) || wNorm.includes(optText.replace(/^(phường|xã|thị trấn)\s+/i, '').trim())) {
          wardSelect.selectedIndex = i;
          break;
        }
      }
    }
  }

  function panCustomerMapTo(lat, lng, zoom) {
    if (!activeCustomerMap || !activeCustomerMarker) return;
    const targetZoom = zoom || activeCustomerMap.getZoom() || 14;
    activeCustomerMarker.setLatLng([lat, lng]);
    activeCustomerMap.flyTo([lat, lng], targetZoom, { animate: true, duration: 1.0 });

    const latInput = document.getElementById('obCustLat') || document.getElementById('profLat');
    const lngInput = document.getElementById('obCustLng') || document.getElementById('profLng');
    const textSpan = document.getElementById('obCustCoordText') || document.getElementById('profCoordText');

    const latFormatted = Number(lat).toFixed(6);
    const lngFormatted = Number(lng).toFixed(6);

    if (latInput) latInput.value = latFormatted;
    if (lngInput) lngInput.value = lngFormatted;
    if (textSpan) textSpan.textContent = `${latFormatted}, ${lngFormatted}`;
    activeCustomerMarker.bindPopup(`<strong>Vị trí đã chọn</strong><br><span style="font-size:11px; color:#555;">${latFormatted}, ${lngFormatted}</span>`).openPopup();
  }

  function initCustomerLocationPicker(opts) {
    const containerId = opts.containerId || 'customerLocationMap';
    const el = document.getElementById(containerId);
    if (!el) return null;

    if (typeof L === 'undefined') {
      console.warn('Thư viện Leaflet chưa được tải.');
      return null;
    }

    if (activeCustomerMap) {
      try {
        activeCustomerMap.remove();
      } catch (err) {
        // ignore
      }
      activeCustomerMap = null;
      activeCustomerMarker = null;
    }

    const initialLat = Number(opts.lat) || 10.741205;
    const initialLng = Number(opts.lng) || 106.702110;
    const zoom = opts.zoom || 15;

    const map = L.map(containerId, {
      center: [initialLat, initialLng],
      zoom: zoom,
      zoomControl: true,
      scrollWheelZoom: true
    });

    activeCustomerMap = map;

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    }).addTo(map);

    const brandPinIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `<div class="pin-marker-wrapper">
        <div class="pin-pulse"></div>
        <div class="pin-svg-icon">
          <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 0C7.61 0 0 7.61 0 17C0 29.75 17 42 17 42C17 42 34 29.75 34 17C34 7.61 26.39 0 17 0Z" fill="#1B4332"/>
            <circle cx="17" cy="17" r="7.5" fill="#FFFFFF"/>
            <circle cx="17" cy="17" r="4.5" fill="#E07A5F"/>
          </svg>
        </div>
      </div>`,
      iconSize: [34, 42],
      iconAnchor: [17, 42],
      popupAnchor: [0, -42]
    });

    const marker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: brandPinIcon
    }).addTo(map);

    activeCustomerMarker = marker;

    function syncLocation(lat, lng, popupHtml, skipReverseGeocode = false) {
      const latFormatted = Number(lat).toFixed(6);
      const lngFormatted = Number(lng).toFixed(6);

      const latInput = document.getElementById(opts.latInputId || 'obCustLat');
      const lngInput = document.getElementById(opts.lngInputId || 'obCustLng');
      const textSpan = document.getElementById(opts.coordTextId || 'obCustCoordText');

      if (latInput) latInput.value = latFormatted;
      if (lngInput) lngInput.value = lngFormatted;
      if (textSpan) textSpan.textContent = `${latFormatted}, ${lngFormatted}`;

      const content = popupHtml || `<strong>Vị trí đón thợ</strong><br><span style="color:#555; font-size:11px;">Tọa độ: ${latFormatted}, ${lngFormatted}</span>`;
      marker.bindPopup(content).openPopup();

      // Tự động nhận diện số nhà, tên đường chi tiết qua reverse geocoding
      if (!skipReverseGeocode) {
        clearTimeout(reverseGeocodeTimer);
        reverseGeocodeTimer = setTimeout(() => {
          resolveAddressFromCoordinates(lat, lng, opts);
        }, 400);
      }
    }

    syncLocation(initialLat, initialLng, '<strong>Vị trí đón thợ</strong><br><span style="font-size:11px; color:#555;">Kéo ghim hoặc bấm vào bản đồ để chọn</span>', true);

    marker.on('dragend', function () {
      const pos = marker.getLatLng();
      syncLocation(pos.lat, pos.lng);
    });

    map.on('click', function (e) {
      marker.setLatLng(e.latlng);
      syncLocation(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return { map, marker };
  }

  function locateUserGPS(targetLatInputId, targetLngInputId, targetTextId, targetAddrInputId, provSelectId, wardSelectId) {
    if (!navigator.geolocation) {
      showToast('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }
    showToast('Đang kết nối GPS thiết bị...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const latFormatted = lat.toFixed(6);
        const lngFormatted = lng.toFixed(6);

        if (activeCustomerMap && activeCustomerMarker) {
          activeCustomerMarker.setLatLng([lat, lng]);
          activeCustomerMap.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
          activeCustomerMarker.bindPopup(`<strong>Vị trí GPS thực tế</strong><br><span style="font-size:11px; color:#2d6a4f;">Độ chính xác: &plusmn;${Math.round(pos.coords.accuracy || 10)}m</span>`).openPopup();
        }

        const latInput = document.getElementById(targetLatInputId || 'obCustLat');
        const lngInput = document.getElementById(targetLngInputId || 'obCustLng');
        const textSpan = document.getElementById(targetTextId || 'obCustCoordText');

        if (latInput) latInput.value = latFormatted;
        if (lngInput) lngInput.value = lngFormatted;
        if (textSpan) textSpan.textContent = `${latFormatted}, ${lngFormatted}`;

        // Lập tức gọi nhận diện địa chỉ chi tiết (Reverse Geocoding)
        resolveAddressFromCoordinates(lat, lng, {
          addrInputId: targetAddrInputId,
          provSelectId: provSelectId,
          wardSelectId: wardSelectId
        });
      },
      (err) => {
        console.warn('Geolocation error:', err);
        showToast('Không thể lấy GPS (' + (err.message || 'Bị từ chối') + '). Vui lòng chạm vào bản đồ để ghim vị trí.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }

  function handleProvinceChange(provinceSelectId, wardSelectId) {
    const provSelect = document.getElementById(provinceSelectId);
    const wardSelect = document.getElementById(wardSelectId);
    if (!provSelect || !wardSelect) return;
    const selectedProvId = String(provSelect.value);
    const db = window.GDX_DB;
    const allWards = db.ward || db.wards || [];
    const filteredWards = allWards.filter((w) => !w.provinceId || String(w.provinceId) === selectedProvId);
    const wardsToRender = filteredWards.length > 0 ? filteredWards : allWards.slice(0, 100);
    wardSelect.innerHTML = wardsToRender
      .map((w) => `<option value="${w.ward_id}">${w.name}</option>`)
      .join('');

    // Nếu đang có bản đồ Leaflet hiển thị, tự động bay tới tọa độ trung tâm tỉnh thành được chọn
    const selectedOption = provSelect.options[provSelect.selectedIndex];
    const provName = selectedOption ? selectedOption.text : '';
    for (const [key, coords] of Object.entries(PROVINCE_COORDINATES)) {
      if (provName.includes(key)) {
        panCustomerMapTo(coords[0], coords[1], 13);
        break;
      }
    }
  }

  // 0.2: Customer Onboarding (Địa điểm, Đơn vị hành chính & Định vị GPS)
  function renderScreen_0_2(container) {
    const provinces = window.GDX_DB.province || window.GDX_DB.provinces || [];
    const allWards = window.GDX_DB.ward || window.GDX_DB.wards || [];
    const defaultName = (state.currentUser && state.currentUser.full_name) || '';
    const defaultPhone = (state.currentUser && state.currentUser.phone_number) || '';

    const existingCp = (window.GDX_DB.customer_profiles || []).find((c) => c.user_id === state.activeUserId);
    const defaultLat = existingCp && existingCp.latitude ? Number(existingCp.latitude).toFixed(6) : '10.741205';
    const defaultLng = existingCp && existingCp.longitude ? Number(existingCp.longitude).toFixed(6) : '106.702110';
    const defaultAddr = existingCp && existingCp.default_address ? existingCp.default_address : 'Số 123 Đường Nguyễn Hữu Thọ, Phường Tân Phong';

    // Mặc định chọn TP. Hồ Chí Minh (provinceId: '29' ở Supabase hoặc '79' ở local mock) hoặc tỉnh đầu tiên
    const defaultProv = provinces.find((p) => p.provinceId === '29' || p.provinceId === '79') || provinces[0] || { provinceId: '29', name: 'Thành phố Hồ Chí Minh' };
    const defaultProvId = String(defaultProv.provinceId);
    const initialWards = allWards.filter((w) => !w.provinceId || String(w.provinceId) === defaultProvId);
    const wardsToRender = initialWards.length > 0 ? initialWards : allWards.slice(0, 100);

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">0.2. Thiết lập hồ sơ Khách hàng mới</h1>
          <p class="screen-finding">Bắt buộc theo ràng buộc NOT NULL customer_profiles.ward_id và users.phone_number.</p>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.switchPortal(1, '1.1')">Bỏ qua &amp; Về trang chủ</button>
      </div>

      <div class="grid-12">
        <div class="col-8">
          <div class="panel">
            <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.handleCustomerOnboarding(this);">
              <input type="hidden" id="obCustLat" name="latitude" value="${defaultLat}">
              <input type="hidden" id="obCustLng" name="longitude" value="${defaultLng}">

              <div class="form-row-2">
                <div class="field-group">
                  <label class="field-label" for="obCustName">Họ và tên người liên hệ (users.full_name)</label>
                  <input type="text" id="obCustName" name="full_name" class="input" value="${defaultName || 'Khách hàng mới'}" required>
                  <div class="error-msg">Vui lòng nhập họ và tên.</div>
                </div>
                <div class="field-group">
                  <label class="field-label" for="obCustPhone">Số điện thoại đón thợ (users.phone_number)</label>
                  <input type="tel" id="obCustPhone" name="phone_number" class="input" value="${defaultPhone || '0901234567'}" required pattern="0[0-9]{9,10}">
                  <div class="error-msg">Vui lòng nhập số điện thoại 10 chữ số.</div>
                </div>
              </div>

              <div class="form-row-2">
                <div class="field-group">
                  <label class="field-label" for="obCustProvince">Tỉnh / Thành phố (${provinces.length} tỉnh thành)</label>
                  <select id="obCustProvince" class="select" onchange="GDXApp.handleProvinceChange('obCustProvince', 'obCustWard')">
                    ${provinces.map((p) => `<option value="${p.provinceId}" ${String(p.provinceId) === defaultProvId ? 'selected' : ''}>${p.name}</option>`).join('')}
                  </select>
                </div>
                <div class="field-group">
                  <label class="field-label" for="obCustWard">Phường / Xã (customer_profiles.ward_id - Bắt buộc)</label>
                  <select id="obCustWard" name="ward_id" class="select" required>
                    ${wardsToRender.map((w) => `<option value="${w.ward_id}">${w.name}</option>`).join('')}
                  </select>
                </div>
              </div>

              <div class="field-group">
                <label class="field-label" for="obCustAddr">Số nhà, tên đường hoặc tòa căn hộ (default_address)</label>
                <span class="field-hint">Địa chỉ này sẽ được tự động điền sẵn mỗi khi bạn đặt lịch dịch vụ mới</span>
                <input type="text" id="obCustAddr" name="default_address" class="input" value="${defaultAddr}" required>
              </div>

              <div class="field-group">
                <label class="field-label" style="display:flex; justify-content:space-between; align-items:center;">
                  <span>Địa điểm, Đơn vị hành chính &amp; Định vị GPS (Tọa độ không gian)</span>
                  <span class="badge badge-success" style="font-weight:normal; font-size:11px;">Leaflet &bull; OpenStreetMap</span>
                </label>
                <div class="geo-map-card">
                  <div class="geo-map-toolbar">
                    <div class="geo-map-status-pill">
                      <span class="status-dot is-online"></span>
                      <span>Chạm vào bản đồ hoặc kéo chốt định vị để ghim chính xác số nhà</span>
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.locateUserGPS('obCustLat', 'obCustLng', 'obCustCoordText', 'obCustAddr', 'obCustProvince', 'obCustWard')">
                      ${Icons.pin()} Lấy tọa độ GPS &amp; Nhận diện địa chỉ
                    </button>
                  </div>

                  <div id="customerLocationMap" class="geo-map-container" tabindex="0" aria-label="Bản đồ định vị Leaflet OpenStreetMap"></div>

                  <div class="geo-map-footer">
                    <div>
                      <span>Tọa độ đã chọn:</span>
                      <span id="obCustCoordText" class="geo-coords-tag">${defaultLat}, ${defaultLng}</span>
                    </div>
                    <span class="field-hint" style="margin:0;">Lưu trữ trực tiếp vào customer_profiles.latitude &amp; longitude</span>
                  </div>
                </div>
              </div>

              <div style="display:flex; justify-content:flex-end; gap:12px; padding-top:8px;">
                <button type="submit" class="btn btn-primary" style="height:42px;">
                  Lưu hồ sơ &amp; Khám phá dịch vụ &rarr;
                </button>
              </div>
            </form>
          </div>
        </div>

        <div class="col-4">
          <div class="panel-subtle form-stack">
            <h2 class="panel-title">Vì sao cần sổ địa chỉ mặc định?</h2>
            <p class="field-hint">
              Hệ thống Gia Đình Xanh kết nối khách hàng với các đối tác thợ đăng ký hoạt động theo từng Phường/Xã cụ thể.
            </p>
            <div class="audit-timeline">
              <div class="audit-item">
                <strong>Lọc đúng thợ gần nhà</strong>
                <div class="field-hint">Chỉ hiển thị những thợ có nhận làm tại Phường/Xã của bạn.</div>
              </div>
              <div class="audit-item">
                <strong>Bản đồ số không gian Leaflet + OSM</strong>
                <div class="field-hint">Đo lường khoảng cách chính xác từ vị trí thợ đến cửa nhà bạn theo km thực tế.</div>
              </div>
              <div class="audit-item">
                <strong>Đặt lịch nhanh trong 30 giây</strong>
                <div class="field-hint">Không cần nhập lại địa chỉ và số điện thoại ở những lần đặt sau.</div>
              </div>
              <div class="audit-item">
                <strong>Minh bạch đơn giá</strong>
                <div class="field-hint">Hiển thị rõ đơn giá theo giờ hoặc trọn gói trước khi xác nhận.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Khởi tạo bản đồ tương tác Leaflet + OpenStreetMap
    initCustomerLocationPicker({
      containerId: 'customerLocationMap',
      lat: Number(defaultLat),
      lng: Number(defaultLng),
      zoom: 15,
      latInputId: 'obCustLat',
      lngInputId: 'obCustLng',
      coordTextId: 'obCustCoordText',
      addrInputId: 'obCustAddr',
      provSelectId: 'obCustProvince',
      wardSelectId: 'obCustWard'
    });
  }

  async function handleCustomerOnboarding(form) {
    const userId = state.activeUserId;
    if (!userId) {
      showToast('Vui lòng đăng ký tài khoản trước.');
      go('0.1');
      return;
    }

    const latVal = form.latitude ? parseFloat(form.latitude.value) : 10.741205;
    const lngVal = form.longitude ? parseFloat(form.longitude.value) : 106.70211;

    const res = await apiRequest('/api/onboarding/customer', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        full_name: form.full_name ? form.full_name.value : '',
        phone_number: form.phone_number ? form.phone_number.value : '',
        ward_id: form.ward_id ? form.ward_id.value : '27403',
        default_address: form.default_address ? form.default_address.value : '',
        latitude: isNaN(latVal) ? 10.741205 : latVal,
        longitude: isNaN(lngVal) ? 106.70211 : lngVal
      })
    });

    if (res && res.ok && res.customer_profile) {
      state.activeCustomerId = res.customer_profile.customer_id;
      if (res.user) state.currentUser = res.user;

      // Đồng bộ vào DB client-side nếu có
      if (window.GDX_DB && window.GDX_DB.customer_profiles) {
        let cp = window.GDX_DB.customer_profiles.find(
          (c) => String(c.user_id) === String(userId) || String(c.customer_id) === String(res.customer_profile.customer_id)
        );
        if (!cp) {
          window.GDX_DB.customer_profiles.push(res.customer_profile);
        } else {
          Object.assign(cp, res.customer_profile);
        }
      }

      // Cập nhật wizardDraft để trang đặt lịch nhận ngay lập tức địa chỉ vừa lưu
      state.wizardDraft.ward_id = res.customer_profile.ward_id;
      state.wizardDraft.address = res.customer_profile.default_address;
      state.wizardDraft.latitude = res.customer_profile.latitude;
      state.wizardDraft.longitude = res.customer_profile.longitude;

      showToast('Đã lưu hồ sơ và vị trí GPS thành công! Bạn có thể đặt dịch vụ đầu tiên.');
      renderUserTopbar();
      switchPortal(1, '1.1');
    } else {
      showToast((res && res.error) || 'Có lỗi khi lưu hồ sơ khách hàng.');
    }
  }

  // 0.3: Provider Onboarding
  function renderScreen_0_3(container) {
    const svcs = window.GDX_DB.services.filter((s) => s.is_active);
    const wards = window.GDX_DB.ward.filter((w) => w.provinceId === '79');
    const avatarChoices = [
      { url: 'assets/provider-mai.jpg', label: 'Ảnh hồ sơ 1' },
      { url: 'assets/provider-lan.jpg', label: 'Ảnh hồ sơ 2' },
      { url: 'assets/provider-tuan.jpg', label: 'Ảnh hồ sơ 3' },
      { url: 'assets/provider-ha.jpg', label: 'Ảnh hồ sơ 4' }
    ];

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">0.3. Đăng ký hồ sơ hành nghề Thợ (Provider Onboarding)</h1>
          <p class="screen-finding">Bắt buộc số CCCD (id_card_number UNIQUE NOT NULL), ảnh đại diện, dịch vụ đăng ký và khu vực phục vụ.</p>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.go('0.4', {status:'pending'})">Xem trạng thái hồ sơ</button>
      </div>

      <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.handleProviderOnboarding(this);">
        <div class="panel form-stack">
          <div class="panel-header" style="margin-bottom:0;">
            <div>
              <h2 class="panel-title">Thông tin định danh &amp; Kinh nghiệm làm việc</h2>
              <p class="field-hint">Ánh xạ bảng provider_profiles (id_card_number, avatar_url, info)</p>
            </div>
            <span class="badge badge-info">Xác thực CCCD</span>
          </div>

          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label" for="obProvCccd">Số Căn cước công dân (id_card_number UNIQUE NOT NULL)</label>
              <span id="cccdHint" class="field-hint">Nhập đủ 12 chữ số trên thẻ CCCD gắn chip</span>
              <input type="text" id="obProvCccd" name="id_card_number" class="input" value="079095023419" required pattern="[0-9]{9,12}" maxlength="20" aria-describedby="cccdHint">
              <div class="error-msg">Số CCCD cần gồm 9 đến 12 chữ số.</div>
            </div>

            <div class="field-group">
              <label class="field-label">Chọn ảnh chân dung hồ sơ (provider_profiles.avatar_url)</label>
              <input type="hidden" name="avatar_url" id="obProvAvatarInput" value="${state.onboardingAvatar}">
              <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                ${avatarChoices
                  .map(
                    (a) => `
                  <button type="button" class="choice-card ${state.onboardingAvatar === a.url ? 'is-selected' : ''}" style="padding:6px 10px; align-items:center; gap:8px;" onclick="GDXApp.selectOnboardingAvatar('${a.url}')">
                    <img src="${a.url}" alt="${a.label}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
                    <span style="font-size:12.5px; font-weight:500;">${a.label}</span>
                  </button>`
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label" for="obProvInfo">Giới thiệu kinh nghiệm chuyên môn (provider_profiles.info)</label>
            <textarea id="obProvInfo" name="info" class="textarea" rows="3" required>4 năm kinh nghiệm dọn dẹp nhà cửa theo giờ, vệ sinh máy lạnh treo tường và bảo dưỡng thiết bị gia dụng tại TP.HCM.</textarea>
          </div>
        </div>

        <div class="panel form-stack">
          <div>
            <h2 class="panel-title">Chọn các gói dịch vụ bạn nhận thực hiện (provider_services)</h2>
            <p class="field-hint">Đơn đặt lịch của khách hàng thuộc các dịch vụ này sẽ được phân phối tới sàn việc làm của bạn</p>
          </div>
          <div class="choice-grid-2">
            ${svcs
              .map(
                (s) => `
              <label class="choice-card">
                <input type="checkbox" name="services" value="${s.service_id}" checked>
                <div style="flex:1;">
                  <div style="display:flex; justify-content:space-between; gap:8px;">
                    <strong style="font-size:14px;">${s.title}</strong>
                    <span style="color:var(--accent); font-weight:600; font-size:13.5px;">${formatMoney(s.price)}${s.pricing_type === 'hourly' ? '/giờ' : '/ca'}</span>
                  </div>
                  <div class="field-hint" style="margin-top:2px;">Thời lượng tiêu chuẩn: ${s.estimated_duration} phút</div>
                </div>
              </label>`
              )
              .join('')}
          </div>
        </div>

        <div class="panel form-stack">
          <div>
            <h2 class="panel-title">Chọn khu vực Phường / Xã nhận việc (provider_areas)</h2>
            <p class="field-hint">Hệ thống chỉ hiển thị các lịch hẹn nằm trong các Phường/Xã bạn đăng ký dưới đây</p>
          </div>
          <div class="choice-grid-3">
            ${wards
              .map(
                (w, idx) => `
              <label class="choice-card">
                <input type="checkbox" name="wards" value="${w.ward_id}" ${idx < 4 ? 'checked' : ''}>
                <div>
                  <div style="font-weight:600; font-size:13.5px;">${w.name}</div>
                  <div class="field-hint">Mã phường: ${w.ward_id}</div>
                </div>
              </label>`
              )
              .join('')}
          </div>

          <div style="display:flex; justify-content:flex-end; gap:12px; padding-top:8px;">
            <button type="submit" class="btn btn-primary" style="height:44px;">
              Nộp hồ sơ đăng ký Đối tác Thợ &rarr;
            </button>
          </div>
        </div>
      </form>
    `;
  }

  function selectOnboardingAvatar(url) {
    state.onboardingAvatar = url;
    renderScreen_0_3(document.getElementById('mainViewport'));
    applyUserModeCleanups(document.getElementById('mainViewport'), '0.3');
  }

  function handleProviderOnboarding(form) {
    apiRequest('/api/onboarding/provider', {
      method: 'POST',
      body: JSON.stringify({
        provider_id: 204,
        id_card_number: form.id_card_number.value,
        avatar_url: form.avatar_url.value,
        info: form.info.value
      })
    });
    showToast('Đã nộp hồ sơ đăng ký đối tác! Chuyển sang màn hình theo dõi xét duyệt.');
    go('0.4', { status: 'pending' });
  }

  // 0.4: Provider Verification Status
  function renderScreen_0_4(container, params = {}) {
    const isPending = (params.status || 'pending') === 'pending';
    const prov = window.GDX_DB.provider_profiles.find((p) => p.provider_id === (isPending ? 204 : 205)) || window.GDX_DB.provider_profiles[3];
    const u = window.GDX_DB.users.find((x) => x.user_id === prov.user_id);

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">0.4. Trạng thái xét duyệt Hồ sơ Đối tác Thợ</h1>
          <p class="screen-finding">RLS Policy: Chỉ thợ verified mới xuất hiện trên view provider_public_profiles.</p>
        </div>
        <div class="screen-actions">
          <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.go('0.4', {status: '${isPending ? 'rejected' : 'pending'}'})">
            Chuyển xem trạng thái: ${isPending ? 'Hồ sơ cần bổ sung' : 'Đang chờ duyệt'}
          </button>
        </div>
      </div>

      <div class="stepper-track" style="margin-bottom:20px;">
        <div class="stepper-node is-done">
          <div class="stepper-icon">${Icons.check()}</div>
          <div>
            <div style="font-weight:600; font-size:13.5px;">Nộp hồ sơ đăng ký</div>
            <div class="field-hint">Đã ghi nhận thông tin</div>
          </div>
        </div>
        <div class="stepper-node ${isPending ? 'is-current' : 'is-done'}">
          <div class="stepper-icon">${Icons.shield()}</div>
          <div>
            <div style="font-weight:600; font-size:13.5px;">Đối chiếu CCCD &amp; Kỹ năng</div>
            <div class="field-hint">${isPending ? 'Quản trị viên đang kiểm tra' : 'Cần cập nhật lại thông tin'}</div>
          </div>
        </div>
        <div class="stepper-node">
          <div class="stepper-icon">${Icons.user()}</div>
          <div>
            <div style="font-weight:600; font-size:13.5px;">Kích hoạt hồ sơ công khai</div>
            <div class="field-hint">Xuất hiện trên danh sách thợ</div>
          </div>
        </div>
        <div class="stepper-node">
          <div class="stepper-icon">${Icons.calendar()}</div>
          <div>
            <div style="font-weight:600; font-size:13.5px;">Nhận việc trên Sàn</div>
            <div class="field-hint">Mở khóa toàn bộ tính năng</div>
          </div>
        </div>
      </div>

      <div class="grid-12">
        <div class="col-7">
          <div class="panel form-stack">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:14px;">
                <img src="${prov.avatar_url}" alt="${u ? u.full_name : 'Đối tác'}" class="provider-avatar-lg">
                <div>
                  <h2 class="panel-title">${u ? u.full_name : 'Võ Văn Khải'}</h2>
                  <div class="field-hint">Số CCCD: <strong class="num">${prov.id_card_number}</strong> · SĐT: ${u ? u.phone_number : '0903667124'}</div>
                </div>
              </div>
              <span class="badge ${isPending ? 'badge-warning' : 'badge-negative'}">
                ${isPending ? 'Đang chờ xét duyệt (pending)' : 'Cần bổ sung hồ sơ (rejected)'}
              </span>
            </div>

            <div class="panel-subtle">
              <div style="font-weight:600; margin-bottom:6px;">
                ${isPending ? 'Hồ sơ của bạn đang được bộ phận Quản trị kiểm tra' : 'Hồ sơ chưa đạt yêu cầu xác minh'}
              </div>
              <p class="field-hint" style="font-size:13.5px;">
                ${
                  isPending
                    ? 'Quản trị viên đang đối chiếu số Căn cước công dân và danh mục dịch vụ đăng ký. Sau khi được phê duyệt, tài khoản của bạn sẽ được mở quyền nhận việc tại Sàn việc làm.'
                    : 'Số CCCD hoặc mô tả kinh nghiệm hành nghề chưa khớp với thông tin đăng ký. Vui lòng chỉnh sửa và gửi lại hồ sơ bên dưới.'
                }
              </p>
            </div>

            ${
              !isPending
                ? `
              <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.showToast('Đã nộp lại hồ sơ! Chuyển sang trạng thái chờ duyệt.'); GDXApp.go('0.4', {status:'pending'});">
                <div class="field-group">
                  <label class="field-label" for="reCccd">Cập nhật lại số CCCD (provider_profiles.id_card_number)</label>
                  <input type="text" id="reCccd" class="input" value="${prov.id_card_number}" required>
                </div>
                <div class="field-group">
                  <label class="field-label" for="reInfo">Bổ sung mô tả kinh nghiệm chuyên môn (provider_profiles.info)</label>
                  <textarea id="reInfo" class="textarea" rows="2" required>${prov.info}</textarea>
                </div>
                <div style="display:flex; gap:10px;">
                  <button type="submit" class="btn btn-primary">Nộp lại hồ sơ xét duyệt &rarr;</button>
                </div>
              </form>`
                : ''
            }

            <div style="display:flex; gap:10px; flex-wrap:wrap; padding-top:6px;">
              <button type="button" class="btn btn-primary" onclick="GDXApp.switchPortal(1, '1.1')">Về trang chủ dịch vụ</button>
              <button type="button" class="btn btn-secondary" onclick="GDXApp.go('0.3')">Chỉnh sửa đơn đăng ký</button>
            </div>
          </div>
        </div>

        <div class="col-5">
          <div class="panel form-stack">
            <h2 class="panel-title">Tóm tắt thông tin đã nộp</h2>
            <div class="slip-row">
              <span class="field-hint">Trạng thái hiện tại</span>
              <span class="slip-dots"></span>
              <strong>${isPending ? 'Chờ duyệt' : 'Từ chối'}</strong>
            </div>
            <div class="slip-row">
              <span class="field-hint">Số CCCD đăng ký</span>
              <span class="slip-dots"></span>
              <strong class="num">${prov.id_card_number}</strong>
            </div>
            <div class="slip-row">
              <span class="field-hint">Kinh nghiệm khai báo</span>
              <span class="slip-dots"></span>
              <strong>Đã khai báo</strong>
            </div>
            <div class="panel-subtle" style="font-size:13px; color:var(--app-muted);">
              Bạn có thể liên hệ bộ phận điều phối qua Trung tâm Hỗ trợ nếu cần giải đáp thêm về quy trình duyệt hồ sơ đối tác.
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.openModal('1.11')">
              Mở Trung tâm Hỗ trợ
            </button>
          </div>
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

      <div class="grid-12">
        <div class="col-7">
          <div class="panel form-stack">
            <div style="display:flex; align-items:center; gap:16px;">
              <div style="width:56px; height:56px; border-radius:50%; background:var(--pill-negative-bg); color:var(--negative); display:grid; place-items:center; flex-shrink:0;">
                ${Icons.lock()}
              </div>
              <div>
                <span class="badge badge-negative">Tài khoản tạm ngừng hoạt động (is_active = false)</span>
                <h2 class="panel-title" style="margin-top:6px; font-size:18px;">Tài khoản Ngô Minh Đức hiện đang bị tạm khóa</h2>
              </div>
            </div>

            <div class="panel-subtle form-stack" style="gap:8px;">
              <div><strong>Thông tin tài khoản:</strong> Ngô Minh Đức · SĐT: <span class="num">0966509311</span></div>
              <p class="field-hint" style="font-size:13.5px;">
                Tài khoản của bạn đang tạm ngừng kích hoạt do có khiếu nại dịch vụ chưa hoàn tất đối soát hoặc vi phạm quy định nhận lịch hẹn. Trong thời gian này, các thao tác đặt lịch và nhận việc tạm thời bị vô hiệu hóa.
              </p>
            </div>

            <div style="display:flex; gap:12px; flex-wrap:wrap;">
              <button type="button" class="btn btn-primary" onclick="GDXApp.openModal('1.11')">
                Gửi yêu cầu mở khóa tài khoản (Support Ticket) &rarr;
              </button>
              <button type="button" class="btn btn-secondary" onclick="GDXApp.switchPortal(0, '0.1')">
                Đổi tài khoản đăng nhập khác
              </button>
            </div>
          </div>
        </div>

        <div class="col-5">
          <div class="panel form-stack">
            <h2 class="panel-title">Hướng dẫn khôi phục quyền truy cập</h2>
            <div class="audit-timeline">
              <div class="audit-item">
                <strong>Gửi phiếu hỗ trợ trực tuyến</strong>
                <div class="field-hint">Bấm nút "Gửi yêu cầu mở khóa" và nêu rõ thông tin phản hồi của bạn.</div>
              </div>
              <div class="audit-item">
                <strong>Quản trị viên đối soát lịch sử đơn</strong>
                <div class="field-hint">Bộ phận vận hành kiểm tra nhật ký đơn hàng và phản hồi từ các bên liên quan.</div>
              </div>
              <div class="audit-item">
                <strong>Kích hoạt lại tài khoản</strong>
                <div class="field-hint">Khi hoàn tất giải quyết, Quản trị viên bật lại trạng thái hoạt động cho tài khoản.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }


  function isCookingService(s) {
    if (!s) return false;
    const t = (s.title || '').toLowerCase();
    const slug = (s.slug || '').toLowerCase();
    return t.includes('nấu') || t.includes('cơm') || t.includes('bếp') || t.includes('cooking') || slug.includes('nau-an') || String(s.category_id).endsWith('302') || s.category_id === 2 || s.category_id === '2';
  }

  function getServiceImage(s) {
    if (!s) return 'assets/cleaning-livingroom.jpg';
    if (s.image_url) return s.image_url;
    const t = (s.title || '').toLowerCase();
    if (t.includes('nấu') || t.includes('cơm')) return 'assets/cooking-family-meal.jpg';
    if (t.includes('đầu bếp') || t.includes('tiệc')) return 'assets/cooking-chef-prep.jpg';
    if (t.includes('deep') || t.includes('sâu') || t.includes('tổng vệ sinh')) return 'assets/cleaning-deep.jpg';
    if (isCookingService(s)) return 'assets/cooking-family-meal.jpg';
    return 'assets/cleaning-livingroom.jpg';
  }

  // =====================================================================
  // SCREEN RENDERERS: PHÂN HỆ 1 (CUSTOMER PORTAL: 1.1 – 1.6)
  // =====================================================================

  // 1.1: Trang chủ & Khám phá dịch vụ (Warm Minimalism — Reference Layout)
  function renderScreen_1_1(container) {
    const db = window.GDX_DB;
    const activeServices = (db.services || []).filter((s) => {
      if (!s.is_active) return false;
      const t = (s.title || '').toLowerCase();
      if (t.includes('repair') || t.includes('sửa') || t.includes('appliance')) return false;
      return true;
    });
    const categories = db.service_categories;
    const publicProviders = db.provider_public_profiles;
    const wards = db.ward;
    const favCount = db.favorites.filter((f) => f.customer_id === state.activeCustomerId).length;
    const activeBooking = db.bookings.find(
      (b) => b.customer_id === state.activeCustomerId && (b.status === 'in_progress' || b.status === 'confirmed')
    );

    const filteredServices = activeServices.filter((s) => {
      if (state.catalogFilter.categoryId !== 'all') {
        const catId = String(state.catalogFilter.categoryId);
        const isCooking = isCookingService(s);
        if (catId === '1' && isCooking) return false;
        if (catId === '2' && !isCooking) return false;
      }
      if (state.catalogFilter.pricingType !== 'all' && s.pricing_type !== state.catalogFilter.pricingType) {
        return false;
      }
      if (state.catalogFilter.searchQuery.trim() !== '') {
        const q = state.catalogFilter.searchQuery.trim().toLowerCase();
        if (!s.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    const activeBookingSvc = activeBooking ? db.services.find((s) => s.service_id === activeBooking.service_id) : null;
    const activeBookingProv = activeBooking
      ? publicProviders.find((p) => p.provider_id === activeBooking.provider_id)
      : null;

    const avgRatingAll =
      publicProviders.length > 0
        ? (
            publicProviders.reduce((sum, p) => sum + Number(p.average_rating || 0), 0) /
            publicProviders.length
          ).toFixed(2)
        : '4.92';

    const serviceDescriptions = {
      301: 'Lau dọn phòng khách, phòng ngủ, lau chùi bàn ghế, hút bụi sàn nhà, vệ sinh nhà tắm và thu gom rác sinh hoạt.',
      302: 'Làm sạch sâu toàn diện từ trần đến sàn, khử khuẩn bề mặt, lau kính mặt trong và xử lý vết ố nhà bếp, phòng tắm.',
      303: 'Sơ chế thực phẩm tươi sạch, nấu 3–4 món ăn nóng hổi theo khẩu vị gia đình (canh, món mặn, món xào) và dọn rửa sạch bếp.',
      304: 'Lên thực đơn dinh dưỡng theo yêu cầu, nấu các món ăn chu đáo cho gia đình hoặc tiệc ấm cúng, trình bày đẹp mắt và vệ sinh bếp.'
    };

    container.innerHTML = `
      ${
        activeBooking
          ? `
        <div class="site-container active-booking-strip-wrap">
          <div class="active-booking-banner">
            <div class="active-booking-banner-info">
              <span class="status-dot is-online"></span>
              <div>
                <div style="font-family:var(--font-heading); font-weight:700; font-size:0.9375rem; color:var(--color-primary);">
                  Ca dịch vụ #${activeBooking.booking_id}: ${activeBookingSvc ? activeBookingSvc.title : 'Dịch vụ gia đình'} đang thực hiện
                </div>
                <div class="field-hint">
                  Đối tác: <strong>${activeBookingProv ? activeBookingProv.full_name : 'Đặng Thị Mai Lan'}</strong> · Địa chỉ: ${activeBooking.address} · Tổng tạm tính: <strong class="num">${formatMoney(activeBooking.total_amount + activeBooking.total_incidental)}</strong>
                </div>
              </div>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button type="button" class="primary-btn btn-sm" onclick="GDXApp.go('1.3', {bookingId: ${activeBooking.booking_id}})">
                Theo dõi tiến độ ca làm &rarr;
              </button>
              ${
                activeBooking.payment_status === 'unpaid'
                  ? `<button type="button" class="ghost-btn btn-sm" onclick="GDXApp.openModal('1.8', {bookingId: ${activeBooking.booking_id}})">Thanh toán hóa đơn</button>`
                  : ''
              }
            </div>
          </div>
        </div>`
          : ''
      }

      <!-- 1. HERO SECTION & OMNI-SEARCH (Home Cleaning & Home Cooking) -->
      <section class="hero-section">
        <div class="site-container hero-grid">
          <!-- Left Column: Value Proposition + Omni-Search + Quick Chips + Wizard Prompt + Stats -->
          <div class="hero-content">
            <h1 class="hero-headline">
              Dọn dẹp chu đáo · Bữa cơm vẹn tròn
            </h1>
            <p class="hero-subtitle">
              Gia Đình Xanh chuyên cung cấp 2 dịch vụ gia đình thiết yếu: Dọn dẹp nhà cửa (Home Cleaning) và Nấu ăn tại nhà (Home Cooking) tại TP.HCM. Đối tác được kiểm tra lý lịch, đối chiếu Căn cước công dân và niêm yết bảng giá công khai.
            </p>

            <!-- Omni-Search Bar (Bound to services, ward, and scheduled_time) -->
            <div class="omni-search" id="omniSearchBox">
              <form class="omni-form" onsubmit="event.preventDefault(); GDXApp.handleOmniSearchSubmit(this);">
                <div class="omni-field">
                  <label for="omniServiceSelect" class="omni-label">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    Dịch vụ cần đặt
                  </label>
                  <select id="omniServiceSelect" name="service_id" class="omni-input">
                    ${activeServices
                      .map(
                        (s) =>
                          `<option value="${s.service_id}">${s.title} (${formatMoney(s.price)}${s.pricing_type === 'hourly' ? '/giờ' : '/lần'})</option>`
                      )
                      .join('')}
                  </select>
                </div>

                <div class="omni-field">
                  <label for="omniWardSelect" class="omni-label">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    Khu vực Phường/Xã
                  </label>
                  <select id="omniWardSelect" name="ward_id" class="omni-input">
                    ${wards
                      .map((w) => `<option value="${w.ward_id}">${w.name}</option>`)
                      .join('')}
                  </select>
                </div>

                <div class="omni-field">
                  <label for="omniTimeSelect" class="omni-label">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    Khung giờ hẹn
                  </label>
                  <select id="omniTimeSelect" name="scheduled_time" class="omni-input">
                    <option value="2026-10-25T08:00">Sáng mai (08:00 – 12:00)</option>
                    <option value="2026-10-25T13:30">Chiều mai (13:30 – 17:30)</option>
                    <option value="2026-10-25T18:00">Tối mai (18:00 – 21:00)</option>
                    <option value="2026-10-26T08:30">Cuối tuần này (08:30)</option>
                  </select>
                </div>

                <div class="omni-action">
                  <button type="submit" class="primary-btn search-submit-btn">
                    Tìm &amp; Đặt lịch
                  </button>
                </div>
              </form>
            </div>

            <!-- Quick Filter Chips -->
            <div class="quick-chips" aria-label="Gợi ý tìm kiếm nhanh">
              <span class="chips-label">Dịch vụ:</span>
              <button type="button" class="quick-chip ${state.catalogFilter.categoryId === 'all' ? 'is-active' : ''}" onclick="GDXApp.setCatalogCategory('all'); document.getElementById('dich-vu')?.scrollIntoView({behavior:'smooth'});">
                Tất cả (${activeServices.length})
              </button>
              <button type="button" class="quick-chip ${state.catalogFilter.categoryId === '1' ? 'is-active' : ''}" onclick="GDXApp.setCatalogCategory('1'); document.getElementById('dich-vu')?.scrollIntoView({behavior:'smooth'});">
                Dọn dẹp nhà cửa (Home Cleaning)
              </button>
              <button type="button" class="quick-chip ${state.catalogFilter.categoryId === '2' ? 'is-active' : ''}" onclick="GDXApp.setCatalogCategory('2'); document.getElementById('dich-vu')?.scrollIntoView({behavior:'smooth'});">
                Nấu ăn tại nhà (Home Cooking)
              </button>
              <button type="button" class="quick-chip" onclick="GDXApp.go('1.6')">
                Đã lưu (${favCount})
              </button>
            </div>

            <!-- Hero Wizard Callout Prompt -->
            <div class="hero-wizard-prompt">
              <div class="wizard-prompt-text">
                <span class="wizard-prompt-tag">Trình đặt lịch 4 bước</span>
                <h2 class="wizard-prompt-title">Tự cấu hình thời lượng &amp; chọn thợ</h2>
                <p class="wizard-prompt-desc">Tùy chỉnh số giờ phục vụ, kiểm tra lịch rảnh thực tế của từng đối tác thợ trong khu vực và nhận báo giá tự động.</p>
              </div>
              <button type="button" class="wizard-cta-btn" onclick="GDXApp.go('1.2', {serviceId: ${activeServices[0] ? activeServices[0].service_id : 301}})">
                Tự cấu hình &amp; Báo giá ngay
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>

            <!-- Hero Stats Row -->
            <div class="hero-stats-row">
              ${
                publicProviders && publicProviders.length > 0
                  ? `
                  <div class="stat-item">
                    <strong class="stat-number num">${publicProviders.length} Đối tác</strong>
                    <span class="stat-desc">Đã đối chiếu CCCD &amp; duyệt hồ sơ công khai</span>
                  </div>
                  <div class="stat-item">
                    <strong class="stat-number num">${avgRatingAll} / 5 <span class="stat-star">${Icons.star(true)}</span></strong>
                    <span class="stat-desc">Điểm hài lòng trung bình từ khách hàng thực tế</span>
                  </div>`
                  : `
                  <div class="stat-item">
                    <strong class="stat-number num">Tiêu chuẩn</strong>
                    <span class="stat-desc">Xác minh danh tính CCCD &amp; tay nghề thực tế</span>
                  </div>
                  <div class="stat-item">
                    <strong class="stat-number num">Minh bạch</strong>
                    <span class="stat-desc">Không phát sinh chi phí ẩn ngoài thỏa thuận</span>
                  </div>`
              }
              <div class="stat-item">
                <strong class="stat-number num">${activeServices.length} Gói dịch vụ</strong>
                <span class="stat-desc">Chuyên sâu Dọn dẹp &amp; Nấu ăn gia đình</span>
              </div>
            </div>
          </div>

          <!-- Right Column: Warm Documentary Photography -->
          <div class="hero-media-wrapper">
            <div class="hero-media-frame">
              <img src="assets/hero-home-clean.jpg" alt="Không gian nhà cửa sáng sạch ấm cúng cùng Gia Đình Xanh" class="hero-image" loading="eager">
            </div>
          </div>
        </div>
      </section>

      <!-- 2. CORE SERVICES SECTION (Bento Cards) -->
      <section id="dich-vu" class="section-services">
        <div class="site-container">
          <div class="section-header">
            <h2 class="section-title">Hạng mục Dịch vụ: Dọn dẹp &amp; Nấu ăn tại nhà</h2>
            <p class="section-subtitle">
              Lựa chọn linh hoạt theo giờ hoặc trọn gói theo ca. Đơn giá niêm yết rõ ràng trước khi bạn xác nhận đặt lịch.
            </p>
          </div>

          <div class="filter-toolbar">
            <div class="filter-chips" role="tablist" aria-label="Lọc theo danh mục">
              <button type="button" class="filter-chip" aria-pressed="${state.catalogFilter.categoryId === 'all'}" onclick="GDXApp.setCatalogCategory('all')">
                Tất cả (${activeServices.length})
              </button>
              <button type="button" class="filter-chip" aria-pressed="${state.catalogFilter.categoryId === '1'}" onclick="GDXApp.setCatalogCategory('1')">
                Dọn dẹp nhà cửa (Home Cleaning)
              </button>
              <button type="button" class="filter-chip" aria-pressed="${state.catalogFilter.categoryId === '2'}" onclick="GDXApp.setCatalogCategory('2')">
                Nấu ăn tại nhà (Home Cooking)
              </button>
            </div>

            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <select class="select" style="min-height:42px; width:auto; border-radius:var(--radius-pill); padding:0 18px;" onchange="GDXApp.setCatalogPricingType(this.value)" aria-label="Cách tính phí">
                <option value="all" ${state.catalogFilter.pricingType === 'all' ? 'selected' : ''}>Mọi hình thức tính phí</option>
                <option value="hourly" ${state.catalogFilter.pricingType === 'hourly' ? 'selected' : ''}>Tính theo giờ (Hourly)</option>
                <option value="fixed" ${state.catalogFilter.pricingType === 'fixed' ? 'selected' : ''}>Trọn gói cố định (Fixed)</option>
              </select>
              <div class="search-input-wrap">
                <input type="search" class="input" style="min-height:42px; border-radius:var(--radius-pill);" placeholder="Tìm dịch vụ (dọn dẹp, tổng vệ sinh, nấu ăn, đầu bếp)..." value="${state.catalogFilter.searchQuery}" oninput="GDXApp.setCatalogSearch(this.value)" aria-label="Tìm kiếm dịch vụ">
              </div>
            </div>
          </div>

          <div class="services-grid">
            ${
              filteredServices.length === 0
                ? `<div class="panel" style="grid-column:1 / -1; text-align:center; padding:36px;">
                    <div style="font-family:var(--font-heading); font-weight:700; font-size:1.125rem; margin-bottom:6px;">Không tìm thấy gói dịch vụ phù hợp</div>
                    <p class="field-hint" style="margin-bottom:16px;">Hãy thử xóa từ khóa tìm kiếm hoặc chọn lại danh mục "Tất cả".</p>
                    <button type="button" class="ghost-btn btn-sm" onclick="GDXApp.resetCatalogFilters()">Xem tất cả dịch vụ</button>
                  </div>`
                : filteredServices
                    .map((s) => {
                      const cat = categories.find((c) => c.category_id === s.category_id);
                      const isFav = db.favorites.some(
                        (f) => f.customer_id === state.activeCustomerId && f.service_id === s.service_id
                      );
                      const providerCount = db.provider_services.filter((ps) => {
                        const p = publicProviders.find((pub) => pub.provider_id === ps.provider_id);
                        return ps.service_id === s.service_id && Boolean(p);
                      }).length;
                      const desc =
                        s.description ||
                        serviceDescriptions[s.service_id] ||
                        'Gói dịch vụ chăm sóc gia đình tiêu chuẩn với đội ngũ thợ đã xác minh hồ sơ tại TP.HCM.';

                      return `
                      <article class="service-card">
                        <div class="service-card-media">
                          <img src="${getServiceImage(s)}" alt="${s.title}" loading="lazy">
                          <span class="service-badge-pill">${isCookingService(s) ? 'Nấu ăn tại nhà (Home Cooking)' : 'Dọn dẹp nhà cửa (Home Cleaning)'}</span>
                          <button type="button" class="fav-icon-btn ${isFav ? 'is-favorited' : ''}" onclick="GDXApp.toggleFavorite(${s.service_id})" aria-label="${isFav ? 'Bỏ lưu dịch vụ' : 'Lưu dịch vụ yêu thích'}" title="${isFav ? 'Đã lưu yêu thích' : 'Lưu vào yêu thích'}">
                            ${Icons.heart(isFav)}
                          </button>
                        </div>
                        <div class="service-card-body">
                          <h3 class="service-title">${s.title}</h3>
                          <p class="service-desc">${desc}</p>
                          <ul class="service-features">
                            <li>Thời lượng tiêu chuẩn: ~${s.estimated_duration} phút / ca</li>
                            <li>Hình thức tính phí: ${s.pricing_type === 'hourly' ? 'Tính theo giờ thực tế' : 'Trọn gói cố định theo lần'}</li>
                            <li>Đội ngũ sẵn sàng: ${providerCount} đối tác thợ đã xác minh CCCD</li>
                          </ul>
                          <div class="service-card-footer">
                            <div class="service-price-box">
                              <span class="price-label">Giá niêm yết</span>
                              <strong class="price-value num">${formatMoney(s.price)}<span class="price-unit">${s.pricing_type === 'hourly' ? '/giờ' : '/lần'}</span></strong>
                            </div>
                            <button type="button" class="primary-btn btn-sm" onclick="GDXApp.go('1.2', {serviceId: ${s.service_id}})">
                              Chọn dịch vụ
                            </button>
                          </div>
                        </div>
                      </article>`;
                    })
                    .join('')
            }
          </div>

          <div class="services-wizard-callout">
            <div class="callout-info">
              <h3 class="callout-title">Cần tùy chỉnh thời lượng hoặc chọn thợ quen?</h3>
              <p class="callout-desc">Sử dụng trình cấu hình để chọn khung giờ hẹn, kiểm tra khoảng cách của thợ và nhận báo giá chi tiết.</p>
            </div>
            <button type="button" class="wizard-cta-btn" onclick="GDXApp.go('1.2', {serviceId: ${activeServices[0] ? activeServices[0].service_id : 301}})">
              Mở trình cấu hình chi tiết &rarr;
            </button>
          </div>
        </div>
      </section>

      <!-- 2.5. VISUAL GALLERY SHOWCASE (TẬP TRUNG 2 DỊCH VỤ CỐT LÕI VỚI HÌNH ẢNH ĐA DẠNG) -->
      <section class="section-gallery-showcase">
        <div class="site-container">
          <div class="section-header" style="text-align:center; max-width:680px; margin:0 auto 36px;">
            <span class="auth-badge-pill" style="margin-bottom:8px;">Không gian sống &amp; Bữa cơm ấm</span>
            <h2 class="section-title">Hai giải pháp trọn vẹn cho tổ ấm hiện đại</h2>
            <p class="section-subtitle">
              Không dàn trải, Gia Đình Xanh tập trung hoàn thiện tối đa chất lượng phục vụ ở 2 nhu cầu thiết yếu nhất của mỗi gia đình.
            </p>
          </div>

          <div class="gallery-grid-2col">
            <!-- Card 1: Home Cleaning Showcase -->
            <article class="gallery-service-card">
              <div class="gallery-photo-strip">
                <img src="assets/cleaning-livingroom.jpg" alt="Dọn dẹp phòng khách tinh tươm" loading="lazy">
                <img src="assets/cleaning-detail.jpg" alt="Chăm chút từng góc nhỏ ngăn nắp" loading="lazy">
              </div>
              <div class="gallery-card-body">
                <div>
                  <span class="gallery-tag-pill">
                    ${Icons.shield()} Phân hệ Dọn dẹp nhà cửa (Home Cleaning)
                  </span>
                  <h3 class="gallery-title">Không gian sống sáng trong, tinh tươm &amp; khử khuẩn</h3>
                  <p class="gallery-desc">
                    Lau dọn phòng khách, phòng ngủ, hút bụi sofa, lau kính mặt trong và cọ rửa nhà tắm sạch sẽ. Sử dụng dung dịch tẩy rửa sinh học an toàn cho trẻ nhỏ.
                  </p>
                  <ul class="gallery-highlights">
                    <li>
                      ${Icons.check()}
                      <span>Lau sàn, hút bụi chuyên sâu và lau chùi bàn ghế, đồ đạc</span>
                    </li>
                    <li>
                      ${Icons.check()}
                      <span>Tẩy sạch dầu mỡ khu vực bếp và khử khuẩn nhà vệ sinh</span>
                    </li>
                    <li>
                      ${Icons.check()}
                      <span>Tùy chọn theo giờ linh hoạt (từ 2 giờ) hoặc tổng vệ sinh trọn gói</span>
                    </li>
                  </ul>
                </div>
                <button type="button" class="primary-btn btn-sm" style="width:100%;" onclick="GDXApp.setCatalogCategory('1'); document.getElementById('dich-vu')?.scrollIntoView({behavior:'smooth'});">
                  Xem các gói Dọn dẹp nhà cửa &rarr;
                </button>
              </div>
            </article>

            <!-- Card 2: Home Cooking Showcase -->
            <article class="gallery-service-card">
              <div class="gallery-photo-strip">
                <img src="assets/cooking-family-meal.jpg" alt="Mâm cơm gia đình ấm cúng" loading="lazy">
                <img src="assets/cooking-pot-stew.jpg" alt="Món ăn nóng hổi đượm vị" loading="lazy">
              </div>
              <div class="gallery-card-body">
                <div>
                  <span class="gallery-tag-pill" style="background:#fef3c7; color:#92400e;">
                    ${Icons.check()} Phân hệ Nấu ăn tại nhà (Home Cooking)
                  </span>
                  <h3 class="gallery-title">Bữa cơm nóng hổi, chuẩn vị ngon mẹ nấu</h3>
                  <p class="gallery-desc">
                    Đầu bếp gia đình đến tận nhà sơ chế nguyên liệu tươi sạch, nấu 3–4 món ăn tròn vị theo khẩu vị riêng của gia đình bạn và dọn rửa sạch khu bếp sau khi nấu.
                  </p>
                  <ul class="gallery-highlights">
                    <li>
                      ${Icons.check()}
                      <span>Sơ chế rau củ, thịt cá tươi sống đảm bảo vệ sinh an toàn thực phẩm</span>
                    </li>
                    <li>
                      ${Icons.check()}
                      <span>Nấu đa dạng món canh, mặn, xào theo yêu cầu dinh dưỡng gia đình</span>
                    </li>
                    <li>
                      ${Icons.check()}
                      <span>Rửa sạch chén bát xoong nồi và lau sạch gian bếp sau bữa nấu</span>
                    </li>
                  </ul>
                </div>
                <button type="button" class="primary-btn btn-sm" style="width:100%;" onclick="GDXApp.setCatalogCategory('2'); document.getElementById('dich-vu')?.scrollIntoView({behavior:'smooth'});">
                  Xem các gói Nấu ăn tại nhà &rarr;
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>

          <div class="services-grid">
            ${
              filteredServices.length === 0
                ? `<div class="panel" style="grid-column:1 / -1; text-align:center; padding:36px;">
                    <div style="font-family:var(--font-heading); font-weight:700; font-size:1.125rem; margin-bottom:6px;">Không tìm thấy gói dịch vụ phù hợp</div>
                    <p class="field-hint" style="margin-bottom:16px;">Hãy thử xóa từ khóa tìm kiếm hoặc chọn lại danh mục "Tất cả".</p>
                    <button type="button" class="ghost-btn btn-sm" onclick="GDXApp.resetCatalogFilters()">Xem tất cả dịch vụ</button>
                  </div>`
                : filteredServices
                    .map((s) => {
                      const cat = categories.find((c) => c.category_id === s.category_id);
                      const isFav = db.favorites.some(
                        (f) => f.customer_id === state.activeCustomerId && f.service_id === s.service_id
                      );
                      const providerCount = db.provider_services.filter((ps) => {
                        const p = publicProviders.find((pub) => pub.provider_id === ps.provider_id);
                        return ps.service_id === s.service_id && Boolean(p);
                      }).length;
                      const desc =
                        s.description ||
                        serviceDescriptions[s.service_id] ||
                        'Gói dịch vụ chăm sóc gia đình tiêu chuẩn với đội ngũ thợ đã xác minh hồ sơ tại TP.HCM.';

                      return `
                      <article class="service-card">
                        <div class="service-card-media">
                          <img src="${s.image_url || 'assets/service-cleaning.jpg'}" alt="${s.title}" loading="lazy">
                          <span class="service-badge-pill">${cat ? cat.name : 'Dịch vụ gia đình'}</span>
                          <button type="button" class="fav-icon-btn ${isFav ? 'is-favorited' : ''}" onclick="GDXApp.toggleFavorite(${s.service_id})" aria-label="${isFav ? 'Bỏ lưu dịch vụ' : 'Lưu dịch vụ yêu thích'}" title="${isFav ? 'Đã lưu yêu thích' : 'Lưu vào yêu thích'}">
                            ${Icons.heart(isFav)}
                          </button>
                        </div>
                        <div class="service-card-body">
                          <h3 class="service-title">${s.title}</h3>
                          <p class="service-desc">${desc}</p>
                          <ul class="service-features">
                            <li>Thời lượng tiêu chuẩn: ~${s.estimated_duration} phút / ca</li>
                            <li>Hình thức tính phí: ${s.pricing_type === 'hourly' ? 'Tính theo giờ thực tế' : 'Trọn gói cố định theo lần'}</li>
                            <li>Đội ngũ sẵn sàng: ${providerCount} đối tác thợ đã xác minh CCCD</li>
                          </ul>
                          <div class="service-card-footer">
                            <div class="service-price-box">
                              <span class="price-label">Giá niêm yết</span>
                              <strong class="price-value num">${formatMoney(s.price)}<span class="Price-unit">${s.pricing_type === 'hourly' ? '/giờ' : '/lần'}</span></strong>
                            </div>
                            <button type="button" class="primary-btn btn-sm" onclick="GDXApp.go('1.2', {serviceId: ${s.service_id}})">
                              Chọn dịch vụ
                            </button>
                          </div>
                        </div>
                      </article>`;
                    })
                    .join('')
            }
          </div>

          <div class="services-wizard-callout">
            <div class="callout-info">
              <h3 class="callout-title">Cần tùy chỉnh thời lượng hoặc chọn thợ quen?</h3>
              <p class="callout-desc">Sử dụng trình cấu hình để chọn khung giờ hẹn, kiểm tra khoảng cách của thợ và nhận báo giá chi tiết.</p>
            </div>
            <button type="button" class="wizard-cta-btn" onclick="GDXApp.go('1.2', {serviceId: ${activeServices[0] ? activeServices[0].service_id : 101}})">
              Mở trình cấu hình chi tiết &rarr;
            </button>
          </div>
        </div>
      </section>

      <!-- 3. VERIFIED PROVIDERS SECTION (CONDITIONAL RENDERING: ẨN KHI CHƯA CÓ THỢ VERIFIED) -->
      ${
        publicProviders && publicProviders.length > 0
          ? `
          <section id="doi-tac" class="section-providers">
            <div class="site-container">
              <div class="section-header">
                <h2 class="section-title">Đội ngũ Đối tác tiêu biểu</h2>
                <p class="section-subtitle">
                  Bạn có quyền xem trước hồ sơ công khai, các gói kỹ năng đăng ký, lịch rảnh trong tuần và nhận xét thực tế từ các gia đình trước khi đặt lịch.
                </p>
                <p class="screen-finding">Dữ liệu trích xuất từ View provider_public_profiles (ẩn số CCCD, chỉ hiển thị thợ đã verified).</p>
              </div>

              <div class="providers-grid">
                ${publicProviders
                  .map((p) => {
                    const skillIds = (db.provider_services || [])
                      .filter((ps) => ps.provider_id === p.provider_id)
                      .map((ps) => ps.service_id);
                    const skillNames = (db.services || [])
                      .filter((s) => skillIds.includes(s.service_id))
                      .map((s) => s.title);
                    const areaWards = (db.provider_areas || [])
                      .filter((pa) => pa.provider_id === p.provider_id)
                      .map((pa) => {
                        const w = (db.ward || []).find((x) => x.ward_id === pa.ward_id);
                        return w ? w.name.replace('Phường ', 'P. ') : pa.ward_id;
                      });

                    return `
                    <article class="provider-card">
                      <div class="provider-card-top">
                        <img src="${p.avatar_url || 'assets/provider-lan.jpg'}" alt="${p.full_name}" class="provider-avatar" loading="lazy">
                        <div class="provider-meta">
                          <div class="provider-name-row">
                            <h3 class="provider-name">${p.full_name}</h3>
                            <span class="badge badge-positive">Đã xác minh</span>
                          </div>
                          <span class="provider-Exp">Khu vực: ${areaWards.join(', ') || 'TP.HCM'}</span>
                          <div class="provider-rating">
                            <span class="star-rating num">${Icons.star(true)} ${Number(p.average_rating || 5).toFixed(2)}</span>
                            <span class="rating-count">(${p.total_reviews || 0} đánh giá)</span>
                          </div>
                        </div>
                      </div>
                      <div class="provider-specialty">
                        <span class="specialty-label">Chuyên môn &amp; Kinh nghiệm:</span>
                        <p class="specialty-text">${p.info || 'Đối tác thợ kỹ thuật tiêu chuẩn Gia Đình Xanh'}</p>
                        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:10px;">
                          ${skillNames
                            .slice(0, 3)
                            .map((name) => `<span class="badge badge-positive">${name}</span>`)
                            .join('')}
                        </div>
                      </div>
                      <div class="provider-card-footer">
                        <span class="provider-rate">${p.is_available_online ? 'Đang nhận việc' : 'Theo lịch hẹn'}</span>
                        <div style="display:flex; gap:8px;">
                          <button type="button" class="ghost-btn btn-sm" onclick="GDXApp.openModal('1.7', {providerId: ${p.provider_id}})">
                            Xem lịch rảnh
                          </button>
                          <button type="button" class="primary-btn btn-sm" onclick="GDXApp.go('1.2', {serviceId: ${skillIds[0] || 101}, providerId: ${p.provider_id}})">
                            Đặt lịch
                          </button>
                        </div>
                      </div>
                    </article>`;
                  })
                  .join('')}
              </div>
            </div>
          </section>`
          : ''
      }

      <!-- 4. TRUST & TRANSPARENCY SECTION (DB-Compliant) -->
      <section id="an-toan" class="section-trust">
        <div class="site-container">
          <div class="trust-split-layout">
            <div class="trust-intro">
              <h2 class="section-title">Vì sao các gia đình yên tâm đặt lịch?</h2>
              <p class="trust-lead">
                Sự an tâm của gia đình bạn được xây dựng trên quy trình đối chiếu danh tính rõ ràng, biểu giá minh bạch và hệ thống đánh giá thực tế sau từng ca làm việc.
              </p>
              <div class="trust-cta-box">
                <button type="button" class="primary-btn" onclick="GDXApp.openModal('CATALOG')">
                  Xem bảng giá niêm yết &amp; Quy trình
                </button>
              </div>
            </div>

            <div class="trust-pillars">
              <div class="trust-pillar-card">
                <div class="pillar-body">
                  <h3 class="pillar-title">Xác minh Căn cước công dân &amp; Kỹ năng hành nghề</h3>
                  <p class="pillar-desc">
                    Mọi đối tác thợ đều bắt buộc khai báo số CCCD duy nhất, đăng ký chuyên môn và khu vực Phường/Xã hoạt động, được Quản trị viên xét duyệt trước khi mở hồ sơ công khai.
                  </p>
                </div>
              </div>

              <div class="trust-pillar-card">
                <div class="pillar-body">
                  <h3 class="pillar-title">Minh bạch đơn giá &amp; Kiểm soát chi phí phát sinh</h3>
                  <p class="pillar-desc">
                    Hệ thống báo giá tự động theo giờ hoặc trọn gói cố định. Nếu có nhờ mua hộ vật tư phụ, đối tác phải kê khai lý do và lưu vết vào nhật ký đơn hàng để chủ nhà nghiệm thu.
                  </p>
                </div>
              </div>

              <div class="trust-pillar-card">
                <div class="pillar-body">
                  <h3 class="pillar-title">Đánh giá thực tế 1-1 từ đơn hàng đã hoàn tất</h3>
                  <p class="pillar-desc">
                    Mỗi lượt chấm sao và nhận xét đều gắn trực tiếp với một mã đơn đặt lịch đã hoàn thành, tự động cập nhật điểm uy tín trung bình của đối tác thợ.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 5. FAMILY STORY & CUSTOMER REVIEWS SECTION -->
      <section class="section-testimonial">
        <div class="site-container">
          <div class="testimonial-grid">
            <div class="testimonial-media">
              <img src="assets/family-story.jpg" alt="Không gian gia đình ấm cúng sạch sẽ sau ca dịch vụ" class="testimonial-image" loading="lazy">
            </div>
            <div class="testimonial-content">
              <h2 class="section-title">Thời gian thảnh thơi bên gia đình</h2>
              <blockquote class="testimonial-quote">
                "${db.reviews[0] ? db.reviews[0].comment : 'Chị Lan đến đúng giờ, mang đầy đủ khăn lau phân màu theo từng khu vực bếp và phòng tắm, làm việc rất kỹ lưỡng.'}"
              </blockquote>
              <div class="testimonial-author">
                <strong>Gia đình chị Nguyễn Minh Thảo</strong>
                <span>Khách hàng tại Khu đô thị Phú Mỹ Hưng, Quận 7, TP.HCM</span>
              </div>
              <div style="display:flex; gap:12px; flex-wrap:wrap;">
                <button type="button" class="primary-btn" onclick="GDXApp.go('1.2', {serviceId: 301})">
                  Đặt lịch chăm sóc tổ ấm ngay &rarr;
                </button>
                <button type="button" class="ghost-btn" onclick="GDXApp.go('1.4')">
                  Xem lịch sử đơn hàng
                </button>
              </div>
            </div>
          </div>

          <div class="reviews-feed-grid">
            ${db.reviews
              .slice(0, 3)
              .map((r) => {
                const bk = db.bookings.find((b) => b.booking_id === r.booking_id);
                const svc = bk ? db.services.find((s) => s.service_id === bk.service_id) : null;
                const prov = publicProviders.find((p) => p.provider_id === r.provider_id);
                return `
                <article class="review-quote-card">
                  <p class="review-quote-text">"${r.comment}"</p>
                  <div style="margin-top:auto; padding-top:8px; display:flex; justify-content:space-between; align-items:center; font-size:0.875rem;">
                    <span>Đối tác: <strong>${prov ? prov.full_name : 'Thợ Gia Đình Xanh'}</strong></span>
                    <span class="badge badge-positive num">Điểm ${r.rating}.0 / 5.0 · Đơn #${r.booking_id}</span>
                  </div>
                  <div class="field-hint">${svc ? svc.title : ''}</div>
                </article>`;
              })
              .join('')}
          </div>
        </div>
      </section>

      <!-- 6. MINIMALIST SITE FOOTER -->
      <footer class="site-footer">
        <div class="site-container">
          <div class="footer-content">
            <div class="footer-brand-col">
              <div class="brand-logo">
                <span class="logo-mark" aria-hidden="true">
                  <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
                    <rect width="28" height="28" rx="8" fill="#1B4332"/>
                    <path d="M8 14.5L14 9.5L20 14.5V20.5C20 21.0523 19.5523 21.5 19 21.5H9C8.44772 21.5 8 21.0523 8 20.5V14.5Z" stroke="#F8F9FA" stroke-width="1.75" stroke-linejoin="round"/>
                    <path d="M14 17.5C15.3807 17.5 16.5 16.3807 16.5 15C16.5 13.6193 14 11.5 14 11.5C14 11.5 11.5 13.6193 11.5 15C11.5 16.3807 12.6193 17.5 14 17.5Z" fill="#E07A5F"/>
                  </svg>
                </span>
                <span class="logo-text">Gia Đình Xanh</span>
              </div>
              <p class="footer-desc">
                Nền tảng kết nối các gia đình Việt với đội ngũ đối tác chăm sóc nhà cửa, vệ sinh điện máy và nấu ăn gia đình chuyên nghiệp, minh bạch đơn giá tại TP.HCM.
              </p>
              <p class="footer-meta">Phục vụ các Phường thuộc Quận 7 &amp; Quận 1, TP. Hồ Chí Minh</p>
            </div>

            <div class="footer-links-col">
              <h3 class="footer-heading">Dịch vụ Gia đình</h3>
              <ul class="footer-nav">
                <li><button type="button" onclick="GDXApp.go('1.2', {serviceId: 301})">Dọn dẹp nhà cửa theo giờ</button></li>
                <li><button type="button" onclick="GDXApp.go('1.2', {serviceId: 102})">Tổng vệ sinh căn hộ</button></li>
                <li><button type="button" onclick="GDXApp.go('1.2', {serviceId: 103})">Vệ sinh &amp; Bơm gas máy lạnh</button></li>
                <li><button type="button" onclick="GDXApp.go('1.2', {serviceId: 105})">Nấu bữa cơm gia đình</button></li>
              </ul>
            </div>

            <div class="footer-links-col">
              <h3 class="footer-heading">Tiện ích &amp; Hỗ trợ</h3>
              <ul class="footer-nav">
                <li><button type="button" onclick="GDXApp.openModal('CATALOG')">Tra cứu biểu giá niêm yết</button></li>
                <li><button type="button" onclick="GDXApp.openModal('1.11')">Trung tâm hỗ trợ &amp; Khiếu nại</button></li>
                <li><button type="button" onclick="GDXApp.go('0.3')">Đăng ký trở thành Đối tác Thợ</button></li>
                <li><button type="button" onclick="GDXApp.go('1.5')">Sổ địa chỉ &amp; Hồ sơ cá nhân</button></li>
              </ul>
            </div>
          </div>

          <div class="footer-bottom">
            <span>&copy; 2026 Gia Đình Xanh. Hệ thống Đặt lịch Dịch vụ Gia đình.</span>
            <span>Minh bạch đơn giá · Đối tác đã xác minh CCCD</span>
          </div>
        </div>
      </footer>
    `;
  }

  function handleOmniSearchSubmit(form) {
    const svcId = form.service_id ? Number(form.service_id.value) : 301;
    const wardId = form.ward_id ? form.ward_id.value : '27472';
    const schedTime = form.scheduled_time ? form.scheduled_time.value : '2026-10-25T09:00';
    state.selectedServiceId = svcId;
    state.wizardDraft.service_id = svcId;
    state.wizardDraft.ward_id = wardId;
    state.wizardDraft.scheduled_time = schedTime;
    go('1.2', { serviceId: svcId, wardId, scheduledTime: schedTime });
  }

  function setCatalogCategory(catId) {
    state.catalogFilter.categoryId = catId;
    go('1.1');
  }

  function setCatalogPricingType(pricingType) {
    state.catalogFilter.pricingType = pricingType;
    go('1.1');
  }

  function setCatalogSearch(q) {
    state.catalogFilter.searchQuery = q;
    const viewport = document.getElementById('mainViewport');
    if (viewport && state.currentScreen === '1.1') {
      renderScreen_1_1(viewport);
      applyUserModeCleanups(viewport, '1.1');
      const searchInput = viewport.querySelector('input[type="search"]');
      if (searchInput) {
        searchInput.focus();
        searchInput.setSelectionRange(q.length, q.length);
      }
    }
  }

  function resetCatalogFilters() {
    state.catalogFilter = { categoryId: 'all', pricingType: 'all', searchQuery: '' };
    go('1.1');
  }

  function toggleFavorite(serviceId) {
    const db = window.GDX_DB;
    const idx = db.favorites.findIndex(
      (f) => f.customer_id === state.activeCustomerId && f.service_id === serviceId
    );
    if (idx >= 0) {
      db.favorites.splice(idx, 1);
      showToast('Đã xóa dịch vụ khỏi danh sách yêu thích');
    } else {
      db.favorites.push({
        customer_id: state.activeCustomerId,
        service_id: serviceId,
        created_at: new Date().toISOString()
      });
      showToast('Đã lưu dịch vụ vào danh sách yêu thích');
    }
    apiRequest('/api/favorites/toggle', {
      method: 'POST',
      body: JSON.stringify({ customer_id: state.activeCustomerId, service_id: serviceId })
    });
    go(state.currentScreen);
  }

  // Helper tra cứu hồ sơ khách hàng hoạt động (Active Customer Profile)
  function getActiveCustomerProfile() {
    const db = window.GDX_DB;
    if (!db || !db.customer_profiles) return null;

    // 1. Tìm theo state.activeCustomerId (chấp nhận cả string lẫn number)
    if (state.activeCustomerId) {
      const byCid = db.customer_profiles.find(
        (c) => String(c.customer_id) === String(state.activeCustomerId)
      );
      if (byCid) return byCid;
    }

    // 2. Tìm theo state.activeUserId (UUID)
    if (state.activeUserId) {
      const byUid = db.customer_profiles.find(
        (c) => String(c.user_id) === String(state.activeUserId)
      );
      if (byUid) {
        state.activeCustomerId = byUid.customer_id;
        return byUid;
      }
    }

    // 3. Tìm theo currentUser nếu có
    if (state.currentUser && state.currentUser.user_id) {
      const byCur = db.customer_profiles.find(
        (c) => String(c.user_id) === String(state.currentUser.user_id)
      );
      if (byCur) {
        state.activeCustomerId = byCur.customer_id;
        return byCur;
      }
    }

    // 4. Fallback ở chế độ dev/mock không phải production
    if (!state.isProduction && db.customer_profiles.length > 0) {
      return db.customer_profiles[0];
    }

    return null;
  }

  // 1.2: Cấu hình dịch vụ trước khi đặt (Booking Wizard — Reference Layout)
  function renderScreen_1_2(container, params = {}) {
    if (params.serviceId) state.selectedServiceId = Number(params.serviceId);
    if (params.providerId) state.selectedProviderId = Number(params.providerId);
    if (params.wardId) state.wizardDraft.ward_id = params.wardId;
    if (params.scheduledTime) state.wizardDraft.scheduled_time = params.scheduledTime;

    const db = window.GDX_DB;
    const activeServices = (db.services || []).filter((s) => {
      if (!s.is_active) return false;
      const t = (s.title || '').toLowerCase();
      if (t.includes('repair') || t.includes('sửa') || t.includes('appliance')) return false;
      return true;
    });

    const svc = activeServices.find((s) => s.service_id === state.selectedServiceId) || activeServices[0] || {
      service_id: 301,
      title: 'Dọn dẹp nhà cửa theo giờ tiêu chuẩn',
      price: 85000,
      pricing_type: 'hourly',
      estimated_duration: 120
    };

    if (!state.wizardCategory) {
      state.wizardCategory = isCookingService(svc) ? '2' : '1';
    }

    const categoryServices = activeServices.filter((s) => {
      const isCooking = isCookingService(s);
      return state.wizardCategory === '2' ? isCooking : !isCooking;
    });
    const cust = getActiveCustomerProfile();
    const provinces = db.province || db.provinces || [];
    const allWards = db.ward || db.wards || [];

    // Lựa chọn Phường/Xã:
    // 1. Tham số truyền vào params.wardId (khi tìm kiếm omni-search)
    // 2. ward_id từ Hồ sơ khách hàng đã lưu (cust.ward_id)
    // 3. Draft tạm nếu vừa chuyển trong phiên
    // 4. Phường mặc định đầu tiên
    const selectedWardId = params.wardId || (cust && cust.ward_id) || state.wizardDraft.ward_id || (allWards[0] ? allWards[0].ward_id : '27403');
    const currentBookingWard = allWards.find((w) => String(w.ward_id) === String(selectedWardId));
    const currentBookingProvId = currentBookingWard ? String(currentBookingWard.provinceId) : (provinces.find((p) => p.provinceId === '29' || p.provinceId === '79')?.provinceId || '29');
    const bookingWards = allWards.filter((w) => !w.provinceId || String(w.provinceId) === String(currentBookingProvId));
    const wardsToRender = bookingWards.length > 0 ? bookingWards : allWards.slice(0, 100);

    // Địa chỉ chi tiết:
    // Ưu tiên params.address -> cust.default_address -> state.wizardDraft.address
    const defaultAddressValue = (params.address !== undefined)
      ? params.address
      : (cust && cust.default_address ? cust.default_address : (state.wizardDraft.address || ''));

    const selectedTime = params.scheduledTime || state.wizardDraft.scheduled_time || '2026-10-25T09:00';

    const matchingProviderIds = (db.provider_services || [])
      .filter((ps) => ps.service_id === svc.service_id)
      .map((ps) => ps.provider_id);

    const eligibleProviders = (db.provider_public_profiles || []).filter((p) =>
      matchingProviderIds.length === 0 || matchingProviderIds.includes(p.provider_id)
    );

    if (state.wizardProviderMode === 'direct') {
      if (!eligibleProviders.some((p) => p.provider_id === state.selectedProviderId) && eligibleProviders.length > 0) {
        state.selectedProviderId = eligibleProviders[0].provider_id;
      }
    } else {
      state.selectedProviderId = null;
    }

    const selectedProv =
      eligibleProviders.find((p) => p.provider_id === state.selectedProviderId) || eligibleProviders[0];
    const totalAmount =
      svc.pricing_type === 'hourly' ? svc.price * state.bookingHours : svc.price;

    container.innerHTML = `
      <div class="wizard-page-header" style="margin-bottom:24px;">
        <div class="wizard-breadcrumb">
          <button type="button" onclick="GDXApp.go('1.1')">Trang chủ</button>
          <span>/</span>
          <span>Cấu hình dịch vụ &amp; Đặt lịch hẹn</span>
        </div>
        <div class="screen-header" style="border-bottom:none; padding-bottom:0; margin-bottom:16px;">
          <div>
            <h1 class="screen-title">1.2. Tùy chỉnh Gói Dịch vụ &amp; Chọn Đối tác Thợ</h1>
            <p class="screen-finding">Bảng: services, provider_public_profiles, provider_services, provider_areas, availability_schedules, bookings.</p>
          </div>
          <button type="button" class="ghost-btn btn-sm" onclick="GDXApp.go('1.1')">&larr; Quay lại trang chủ</button>
        </div>

        <!-- 4-Step Stepper Indicator Bar (from cau-hinh-dich-vu.html) -->
        <div class="wizard-stepper" role="region" aria-label="Tiến trình cấu hình đặt lịch">
          <div class="step-indicator is-active">
            <span class="step-badge">1</span>
            <div class="step-meta">
              <span class="step-order">Bước 1</span>
              <span class="step-name">Chọn dịch vụ</span>
            </div>
          </div>
          <div class="step-indicator is-active">
            <span class="step-badge">2</span>
            <div class="step-meta">
              <span class="step-order">Bước 2</span>
              <span class="step-name">Lịch &amp; Giờ hẹn</span>
            </div>
          </div>
          <div class="step-indicator is-active">
            <span class="step-badge">3</span>
            <div class="step-meta">
              <span class="step-order">Bước 3</span>
              <span class="step-name">Địa chỉ &amp; Ghi chú</span>
            </div>
          </div>
          <div class="step-indicator is-active">
            <span class="step-badge">4</span>
            <div class="step-meta">
              <span class="step-order">Bước 4</span>
              <span class="step-name">Chọn Thợ &amp; Đặt lịch</span>
            </div>
          </div>
        </div>
      </div>

      <div class="wizard-layout">
        <!-- Left Column: Configuration Cards -->
        <div class="form-stack">
          <!-- Step 1: Select Category, Service & Duration -->
          <div class="wizard-main-content form-stack">
            <div class="panel-header" style="margin-bottom:0;">
              <div>
                <h2 class="panel-title" style="font-size:1.35rem;">1. Chọn Hạng mục, Dịch vụ &amp; Thời lượng</h2>
                <p class="field-hint">Chọn hạng mục chính, gói dịch vụ chi tiết và cấu hình thời lượng phù hợp</p>
              </div>
              <span class="badge badge-positive">${svc.pricing_type === 'hourly' ? 'Tính theo giờ (Hourly)' : 'Trọn gói cố định (Fixed)'}</span>
            </div>

            <!-- 1A. Category Selection -->
            <div class="field-group" style="margin-bottom:0;">
              <label class="field-label" style="font-size:0.9375rem; font-weight:700;">Hạng mục dịch vụ chính:</label>
              <div class="category-selector-grid">
                <button type="button" class="category-select-card ${state.wizardCategory === '1' ? 'is-active' : ''}" onclick="GDXApp.setWizardCategory('1')">
                  <div class="category-icon-box">🧹</div>
                  <div>
                    <strong style="font-family:var(--font-heading); font-size:1rem; display:block; color:var(--color-secondary);">Dọn dẹp nhà cửa (Home Cleaning)</strong>
                    <span class="field-hint">Dọn dẹp theo giờ, tổng vệ sinh căn hộ chuyên sâu</span>
                  </div>
                </button>
                <button type="button" class="category-select-card ${state.wizardCategory === '2' ? 'is-active' : ''}" onclick="GDXApp.setWizardCategory('2')">
                  <div class="category-icon-box">🍳</div>
                  <div>
                    <strong style="font-family:var(--font-heading); font-size:1rem; display:block; color:var(--color-secondary);">Nấu ăn tại nhà (Home Cooking)</strong>
                    <span class="field-hint">Nấu mâm cơm gia đình, đầu bếp theo giờ</span>
                  </div>
                </button>
              </div>
            </div>

            <!-- 1B. Service Selection -->
            <div class="field-group" style="margin-bottom:0;">
              <label class="field-label" style="font-size:0.9375rem; font-weight:700;">Gói dịch vụ chi tiết (${categoryServices.length} gói có sẵn):</label>
              <div class="services-selection-list" role="radiogroup" aria-label="Chọn gói dịch vụ">
                ${categoryServices
                  .map((s) => {
                    const isSel = s.service_id === svc.service_id;
                    const img = getServiceImage(s);
                    return `
                    <button type="button" class="service-select-item ${isSel ? 'is-selected' : ''}" onclick="GDXApp.go('1.2', {serviceId: ${s.service_id}})">
                      <div class="select-item-left">
                        <span class="select-checkbox" aria-hidden="true">${isSel ? '✓' : ''}</span>
                        <img src="${img}" alt="${s.title}" class="select-item-thumb">
                        <div class="select-item-details">
                          <span class="select-item-title">${s.title}</span>
                          <span class="select-item-sub">Thời lượng tiêu chuẩn ~${s.estimated_duration} phút · ${s.pricing_type === 'hourly' ? 'Tính phí theo giờ' : 'Đơn giá trọn gói cố định'}</span>
                        </div>
                      </div>
                      <span class="select-item-rate num">${formatMoney(s.price)}${s.pricing_type === 'hourly' ? '/giờ' : '/lần'}</span>
                    </button>`;
                  })
                  .join('')}
              </div>
            </div>

            ${
              svc.pricing_type === 'hourly'
                ? `
              <div class="field-group" style="padding-top:6px;">
                <label class="field-label">Chọn thời lượng làm việc dự kiến (Đơn giá: ${formatMoney(svc.price)}/giờ)</label>
                <div class="choice-grid-3">
                  ${[2, 3, 4]
                    .map(
                      (h) => `
                    <button type="button" class="choice-card ${state.bookingHours === h ? 'is-selected' : ''}" onclick="GDXApp.setBookingHours(${h})">
                      <div>
                        <div style="font-family:var(--font-heading); font-weight:700; font-size:1rem;">${h} giờ làm việc</div>
                        <div class="field-hint num" style="color:var(--color-primary); font-weight:600;">${formatMoney(svc.price * h)}</div>
                      </div>
                    </button>`
                    )
                    .join('')}
                </div>
              </div>`
                : `
              <div class="panel-subtle" style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-family:var(--font-heading); font-weight:700;">Gói dịch vụ cố định trọn ca (~${svc.estimated_duration} phút)</div>
                  <div class="field-hint">Áp dụng mức giá niêm yết trọn gói cho 1 lần thực hiện tiêu chuẩn</div>
                </div>
                <strong class="num" style="font-family:var(--font-heading); font-size:1.25rem; color:var(--color-primary);">${formatMoney(svc.price)}</strong>
              </div>`
            }
          </div>

          <!-- Step 2 & 3: Time, Ward & Address -->
          <div class="wizard-main-content form-stack">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
              <div>
                <h2 class="panel-title" style="font-size:1.35rem;">2. Thời gian hẹn &amp; Địa chỉ phục vụ</h2>
                <p class="field-hint">Xác nhận thời gian bắt đầu và địa chỉ nhà để hệ thống kiểm tra thợ trong khu vực</p>
              </div>
              ${
                cust && (cust.default_address || cust.ward_id)
                  ? `
                <span class="badge badge-positive" style="font-size:0.75rem; padding:4px 10px; display:inline-flex; align-items:center; gap:6px;">
                  <span class="status-dot is-online" style="width:7px; height:7px;"></span>
                  Đã tự động điền từ Hồ sơ cá nhân
                </span>`
                  : ''
              }
            </div>

            <div class="form-row-2">
              <div class="field-group">
                <label class="field-label" for="wizScheduledTime">Ngày giờ bắt đầu (bookings.scheduled_time)</label>
                <input type="datetime-local" id="wizScheduledTime" class="input" value="${selectedTime}" required>
              </div>
              <div class="field-group">
                <label class="field-label" for="wizProvSelect">Tỉnh / Thành phố (${provinces.length} tỉnh thành)</label>
                <select id="wizProvSelect" class="select" onchange="GDXApp.handleProvinceChange('wizProvSelect', 'wizWardSelect')">
                  ${provinces.map((p) => `<option value="${p.provinceId}" ${String(p.provinceId) === String(currentBookingProvId) ? 'selected' : ''}>${p.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-row-2">
              <div class="field-group">
                <label class="field-label" for="wizWardSelect">Phường / Xã phục vụ (bookings.ward_id)</label>
                <select id="wizWardSelect" class="select">
                  ${wardsToRender.map((w) => `<option value="${w.ward_id}" ${String(selectedWardId) === String(w.ward_id) ? 'selected' : ''}>${w.name}</option>`).join('')}
                </select>
              </div>
              <div class="field-group">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <label class="field-label" for="wizAddress" style="margin-bottom:0;">Số nhà, tòa căn hộ chi tiết (bookings.address)</label>
                  <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:11px; height:24px;" onclick="GDXApp.locateUserGPS('wizLat', 'wizLng', null, 'wizAddress', 'wizProvSelect', 'wizWardSelect')" title="Tự động nhận diện số nhà, tên đường qua GPS">
                    ${Icons.pin()} Nhận diện từ GPS
                  </button>
                </div>
                <input type="text" id="wizAddress" class="input" value="${defaultAddressValue}" placeholder="Ví dụ: KTX Khu A, Đường Tạ Quang Bửu" required>
              </div>
            </div>

            <!-- Tọa độ định vị GPS ẩn lấy từ hồ sơ khách hàng phục vụ tính khoảng cách -->
            <input type="hidden" id="wizLat" value="${cust && cust.latitude ? cust.latitude : 10.741205}">
            <input type="hidden" id="wizLng" value="${cust && cust.longitude ? cust.longitude : 106.702110}">

            <div class="field-group">
              <label class="field-label" for="wizNotes">Ghi chú dặn dò đối tác thợ (bookings.notes)</label>
              <textarea id="wizNotes" class="textarea" rows="2" placeholder="Ví dụ: Mang theo thang chữ A, gọi chuông cửa B-1802 khi tới sảnh...">Nhà có trẻ nhỏ, vui lòng gọi điện trước 10 phút khi đến sảnh căn hộ.</textarea>
            </div>
          </div>

          <!-- Step 3: Select Provider Mode (Broadcast vs Direct) -->
          <div class="wizard-main-content form-stack">
            <div class="panel-header" style="margin-bottom:0;">
              <div>
                <h2 class="panel-title" style="font-size:1.35rem;">3. Lựa chọn Đối tác Thợ thực hiện</h2>
                <p class="field-hint">Chọn rải đơn để nhận việc nhanh nhất hoặc tự tay chỉ định một đối tác thợ cụ thể</p>
              </div>
            </div>

            <!-- Provider Mode Selector (2 Options) -->
            <div class="provider-mode-grid">
              <div class="provider-mode-card ${state.wizardProviderMode !== 'direct' ? 'is-selected' : ''}" onclick="GDXApp.setWizardProviderMode('broadcast')">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.4rem;">⚡</span>
                    <strong style="font-family:var(--font-heading); font-size:1.0625rem; color:var(--color-secondary);">Rải đơn cho tất cả Đối tác khả dụng</strong>
                  </div>
                  <span class="badge badge-positive">Khuyên dùng</span>
                </div>
                <p class="field-hint" style="margin-top:2px;">
                  Hệ thống tự động phát thông báo tới <strong>Hòm thư nhận việc</strong> của toàn bộ đối tác thợ đã xác minh CCCD quanh khu vực nhà bạn. Đối tác nào xác nhận trước sẽ được giao ca làm ngay.
                </p>
                <div style="display:flex; align-items:center; gap:6px; font-size:0.8125rem; color:var(--color-primary); font-weight:600; margin-top:4px;">
                  ✓ Tối ưu thời gian chờ · Thợ nhận việc nhanh nhất
                </div>
              </div>

              <div class="provider-mode-card ${state.wizardProviderMode === 'direct' ? 'is-selected' : ''}" onclick="GDXApp.setWizardProviderMode('direct')">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.4rem;">👤</span>
                    <strong style="font-family:var(--font-heading); font-size:1.0625rem; color:var(--color-secondary);">Tự chọn Đối tác Thợ cụ thể</strong>
                  </div>
                  <span class="badge badge-neutral">Chỉ định riêng</span>
                </div>
                <p class="field-hint" style="margin-top:2px;">
                  Chủ động duyệt danh sách hồ sơ thợ lành nghề, đối chiếu khoảng cách địa lý, lịch trình làm việc và số sao đánh giá để chọn thợ ưng ý nhất.
                </p>
                <div style="display:flex; align-items:center; gap:6px; font-size:0.8125rem; color:var(--color-primary); font-weight:600; margin-top:4px;">
                  ✓ Thích hợp khi muốn đặt thợ quen hoặc thợ nhiều sao
                </div>
              </div>
            </div>

            ${
              state.wizardProviderMode === 'direct'
                ? `
              <div class="form-stack" style="gap:12px; margin-top:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <strong style="font-size:0.9375rem; color:var(--color-secondary);">Danh sách Đối tác Thợ sẵn sàng phục vụ (${eligibleProviders.length} thợ)</strong>
                  <span class="field-hint">Đã lọc theo kỹ năng dịch vụ &amp; khu vực hoạt động</span>
                </div>
                ${
                  eligibleProviders.length > 0
                    ? eligibleProviders
                        .map((p) => {
                          const fullProv = (db.provider_profiles || []).find((fp) => fp.provider_id === p.provider_id);
                          const distKm =
                            cust && fullProv
                              ? calcDistanceKm(cust.latitude, cust.longitude, fullProv.lattitude, fullProv.longtitude)
                              : '1.4';
                          const schedules = (db.availability_schedules || []).filter((a) => a.provider_id === p.provider_id);
                          const exceptions = (db.availability_exceptions || []).filter((e) => e.provider_id === p.provider_id);
                          const isSelected = selectedProv && selectedProv.provider_id === p.provider_id;

                          return `
                          <div class="choice-card ${isSelected ? 'is-selected' : ''}" style="justify-content:space-between; align-items:center; flex-wrap:wrap;" onclick="GDXApp.selectBookingProvider(${p.provider_id})">
                            <div style="display:flex; align-items:center; gap:14px; flex:1; min-width:240px;">
                              <img src="${p.avatar_url || 'assets/provider-lan.jpg'}" alt="${p.full_name}" class="provider-avatar-lg">
                              <div>
                                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                  <strong style="font-family:var(--font-heading); font-size:1.0625rem;">${p.full_name}</strong>
                                  <span class="star-rating num">${Icons.star(true)} ${Number(p.average_rating || 5).toFixed(2)}</span>
                                  <span class="field-hint">(${p.total_reviews || 0} đánh giá)</span>
                                  <span class="badge badge-positive">Cách nhà bạn ~${distKm} km</span>
                                </div>
                                <div class="field-hint" style="margin-top:4px;">${p.info || 'Thợ kỹ thuật đạt chuẩn Gia Đình Xanh'}</div>
                                <div class="field-hint" style="margin-top:4px;">
                                  Khung giờ làm việc: <strong>${schedules.length > 0 ? `${schedules[0].start_time} – ${schedules[0].end_time}` : '08:00 – 18:00'}</strong>
                                  ${exceptions.length > 0 ? ` · Lưu ý: Nghỉ phép ngày ${exceptions[0].exception_date}` : ''}
                                </div>
                              </div>
                            </div>
                            <div style="display:flex; gap:8px; align-items:center;">
                              <button type="button" class="ghost-btn btn-sm" onclick="event.stopPropagation(); GDXApp.openModal('1.7', {providerId: ${p.provider_id}})">
                                Xem lịch &amp; Hồ sơ
                              </button>
                              <span class="badge ${isSelected ? 'badge-positive' : 'badge-neutral'}">
                                ${isSelected ? '✓ Đã chọn' : 'Chọn thợ này'}
                              </span>
                            </div>
                          </div>`;
                        })
                        .join('')
                    : `
                    <div class="empty-state-card">
                      <strong style="display:block; font-size:1.05rem; margin-bottom:6px;">Chưa có thợ trực tiếp sẵn sàng tại khung giờ này</strong>
                      <p class="field-hint" style="max-width:540px; margin:0 auto;">
                        Bạn có thể chuyển sang tùy chọn <strong>"Rải đơn cho tất cả Đối tác khả dụng"</strong> để hệ thống tự động tìm kiếm thợ nhận việc ngay.
                      </p>
                    </div>`
                }
              </div>`
                : `
              <div class="panel-subtle" style="display:flex; align-items:center; gap:16px; padding:16px 20px; border-radius:12px; background:#f0fdf4; border:1px solid #bbf7d0;">
                <span style="font-size:1.8rem; flex-shrink:0;">⚡</span>
                <div>
                  <strong style="display:block; color:#166534; font-size:0.95rem; margin-bottom:2px;">Đang chọn chế độ: Rải đơn toàn mạng lưới thợ</strong>
                  <p class="field-hint" style="margin:0; color:#15803d;">
                    Ngay khi bạn nhấn "Hoàn tất &amp; Đặt lịch hẹn", đơn yêu cầu sẽ xuất hiện đồng thời trong <strong>Hòm thư Nhận việc</strong> của tất cả đối tác thợ quanh khu vực của bạn. Thợ nhận việc đầu tiên sẽ phụ trách ca làm của bạn.
                  </p>
                </div>
              </div>`
            }
          </div>
        </div>

        <!-- Right Sidebar: Sticky Summary Card (from cau-hinh-dich-vu.html) -->
        <aside class="wizard-sidebar">
          <div class="wizard-summary-card" style="position:sticky; top:96px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
              <h2 class="panel-title" style="font-size:1.125rem;">Tóm tắt Yêu cầu Đặt lịch</h2>
              <span class="badge badge-warning">Chờ xác nhận</span>
            </div>

            <div style="display:flex; gap:12px; align-items:center; padding-bottom:16px; margin-bottom:12px; border-bottom:1px solid var(--color-border);">
              <img src="${getServiceImage(svc)}" alt="${svc.title}" style="width:68px; height:52px; border-radius:10px; object-fit:cover;">
              <div>
                <div style="font-family:var(--font-heading); font-weight:700; font-size:0.9375rem;">${svc.title}</div>
                <div class="field-hint">${svc.pricing_type === 'hourly' ? `${state.bookingHours} giờ × ${formatMoney(svc.price)}` : `Trọn gói ~${svc.estimated_duration} phút`}</div>
              </div>
            </div>

            <div class="slip-row">
              <span class="field-hint">Hình thức phân bổ</span>
              <span class="slip-dots"></span>
              <strong>${state.wizardProviderMode === 'direct' && selectedProv ? selectedProv.full_name : '⚡ Rải đơn toàn mạng lưới thợ'}</strong>
            </div>
            <div class="slip-row">
              <span class="field-hint">Đơn giá dịch vụ</span>
              <span class="slip-dots"></span>
              <strong class="num">${formatMoney(totalAmount)}</strong>
            </div>
            <div class="slip-row">
              <span class="field-hint">Phụ phí vật tư mua hộ</span>
              <span class="slip-dots"></span>
              <strong class="num">0 đ</strong>
            </div>
            <div class="slip-row">
              <span class="field-hint">Thanh toán</span>
              <span class="slip-dots"></span>
              <span class="badge badge-neutral">Sau khi nghiệm thu</span>
            </div>

            <div class="summary-price-box">
              <div class="summary-price-label">Chi phí tạm tính (total_amount)</div>
              <div class="summary-price-number num">${formatMoney(totalAmount)}</div>
              <div class="field-hint" style="margin-top:4px;">Cam kết không phát sinh phụ phí ẩn</div>
            </div>

            <button type="button" class="primary-btn full-width" style="min-height:50px;" onclick="GDXApp.submitNewBooking()">
              Hoàn tất &amp; Đặt lịch hẹn &rarr;
            </button>

            <ul style="margin-top:18px; display:flex; flex-direction:column; gap:8px;">
              <li style="display:flex; align-items:center; gap:8px; font-size:0.8125rem; color:var(--color-muted);">
                <span style="color:var(--color-primary); font-weight:700;">✓</span>
                Đối tác thợ đã đối chiếu CCCD rõ ràng
              </li>
              <li style="display:flex; align-items:center; gap:8px; font-size:0.8125rem; color:var(--color-muted);">
                <span style="color:var(--color-primary); font-weight:700;">✓</span>
                Theo dõi trực tiếp tiến độ &amp; nhật ký đơn hàng
              </li>
              <li style="display:flex; align-items:center; gap:8px; font-size:0.8125rem; color:var(--color-muted);">
                <span style="color:var(--color-primary); font-weight:700;">✓</span>
                Nghiệm thu hài lòng mới thanh toán hóa đơn
              </li>
            </ul>
          </div>
        </aside>
      </div>
    `;
  }

  function setWizardCategory(catId) {
    state.wizardCategory = catId;
    const db = window.GDX_DB;
    const activeServices = (db.services || []).filter((s) => {
      if (!s.is_active) return false;
      const t = (s.title || '').toLowerCase();
      if (t.includes('repair') || t.includes('sửa') || t.includes('appliance')) return false;
      return true;
    });
    const match = activeServices.find((s) => catId === '2' ? isCookingService(s) : !isCookingService(s));
    if (match) {
      state.selectedServiceId = match.service_id;
    }
    go('1.2');
  }

  function setWizardProviderMode(mode) {
    state.wizardProviderMode = mode;
    if (mode === 'broadcast') {
      state.selectedProviderId = null;
    }
    go('1.2');
  }

  function setBookingHours(h) {
    state.bookingHours = h;
    go('1.2');
  }

  function selectBookingProvider(providerId) {
    state.wizardProviderMode = 'direct';
    state.selectedProviderId = providerId;
    go('1.2');
  }

  async function submitNewBooking() {
    const db = window.GDX_DB;

    // Check auth in Cold Start / Production mode
    if (!state.activeUserId) {
      showToast('Vui lòng đăng ký hoặc đăng nhập để tiếp tục đặt lịch.');
      switchPortal(0, '0.1');
      return;
    }
    let cust = getActiveCustomerProfile();
    if (!state.activeCustomerId && cust) {
      state.activeCustomerId = cust.customer_id;
    }
    if (!state.activeCustomerId) {
      showToast('Vui lòng hoàn tất thông tin hồ sơ khách hàng trước.');
      go('0.2');
      return;
    }

    const svc = (db.services || []).find((s) => s.service_id === state.selectedServiceId) || (db.services || [])[0];
    if (!svc) {
      showToast('Vui lòng chọn một dịch vụ hợp lệ.');
      return;
    }

    const schedEl = document.getElementById('wizScheduledTime');
    const wardEl = document.getElementById('wizWardSelect');
    const addrEl = document.getElementById('wizAddress');
    const notesEl = document.getElementById('wizNotes');
    const latEl = document.getElementById('wizLat');
    const lngEl = document.getElementById('wizLng');

    const totalAmount = svc.pricing_type === 'hourly' ? svc.price * state.bookingHours : svc.price;
    const existingIds = (db.bookings || []).map((b) => b.booking_id || 0);
    const newId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1001;

    const chosenLat = latEl && latEl.value ? Number(latEl.value) : (cust && cust.latitude ? Number(cust.latitude) : 10.741205);
    const chosenLng = lngEl && lngEl.value ? Number(lngEl.value) : (cust && cust.longitude ? Number(cust.longitude) : 106.702110);

    const isBroadcast = state.wizardProviderMode !== 'direct';
    const chosenProviderId = isBroadcast ? null : (state.selectedProviderId || 201);

    const newBooking = {
      booking_id: newId,
      customer_id: state.activeCustomerId,
      provider_id: chosenProviderId,
      dispatch_type: isBroadcast ? 'broadcast' : 'direct',
      service_id: svc.service_id,
      booking_time: new Date().toISOString(),
      scheduled_time: schedEl && schedEl.value ? new Date(schedEl.value).toISOString() : new Date().toISOString(),
      status: 'pending',
      payment_status: 'unpaid',
      total_incidental: 0,
      incidental_Specify: null,
      total_amount: totalAmount,
      address: addrEl && addrEl.value ? addrEl.value.trim() : (cust ? cust.default_address : 'Địa chỉ theo hồ sơ'),
      ward_id: wardEl && wardEl.value ? wardEl.value : (cust ? cust.ward_id : '27403'),
      latitude: chosenLat,
      longitude: chosenLng,
      notes: notesEl ? notesEl.value : ''
    };

    const res = await apiRequest('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(newBooking)
    });

    const realBooking = (res && res.ok && res.booking) ? res.booking : newBooking;
    db.bookings = db.bookings || [];
    db.bookings.unshift(realBooking);

    db.booking_status_history = db.booking_status_history || [];
    db.booking_status_history.unshift({
      history_id: Date.now(),
      booking_id: realBooking.booking_id,
      old_status: null,
      new_status: 'pending',
      changed_by: state.activeUserId,
      reason: 'Khách hàng tạo lịch hẹn mới từ giao diện đặt lịch',
      changed_at: new Date().toISOString()
    });

    state.selectedBookingId = realBooking.booking_id;
    if (isBroadcast) {
      showToast(`Đã phát đơn #${realBooking.booking_id} tới Hòm thư nhận việc của tất cả thợ trong khu vực!`);
    } else {
      showToast(`Đã tạo đơn #${realBooking.booking_id} và gửi thông báo trực tiếp tới Đối tác thợ!`);
    }
    go('1.3', { bookingId: realBooking.booking_id });
  }

  // 1.3: Theo dõi đơn hàng trực tiếp (Live Tracking)
  function renderScreen_1_3(container, params = {}) {
    const db = window.GDX_DB;
    if (params.bookingId) state.selectedBookingId = Number(params.bookingId);

    const custBookings = (db.bookings || []).filter((b) => b.customer_id === state.activeCustomerId);
    const bk =
      (db.bookings || []).find((b) => b.booking_id === state.selectedBookingId) ||
      custBookings[0] ||
      (db.bookings || [])[0];

    if (!bk) {
      container.innerHTML = `
        <div class="screen-header">
          <div>
            <h1 class="screen-title">1.3. Theo dõi tiến độ ca làm việc</h1>
            <p class="screen-finding">Bảng: bookings, booking_status_history, provider_public_profiles.</p>
          </div>
        </div>
        <div class="empty-state-card" style="padding: 48px 24px;">
          <h2 class="panel-title" style="margin-bottom: 8px;">Bạn chưa có đơn đặt lịch nào</h2>
          <p class="field-hint" style="max-width: 480px; margin: 0 auto 20px auto;">
            Tiến độ và vị trí của Đối tác Thợ sẽ được hiển thị trực tiếp tại đây sau khi bạn hoàn tất tạo đơn đặt lịch đầu tiên.
          </p>
          <button type="button" class="primary-btn" onclick="GDXApp.go('1.2')">
            Đặt lịch dịch vụ ngay &rarr;
          </button>
        </div>
      `;
      return;
    }

    const svc = (db.services || []).find((s) => s.service_id === bk.service_id);
    const prov = (db.provider_public_profiles || []).find((p) => p.provider_id === bk.provider_id);
    const fullProv = (db.provider_profiles || []).find((p) => p.provider_id === bk.provider_id);
    const history = (db.booking_status_history || []).filter((h) => h.booking_id === bk.booking_id);
    const distKm =
      fullProv && bk.latitude
        ? calcDistanceKm(bk.latitude, bk.longitude, fullProv.lattitude, fullProv.longtitude)
        : '1.2';

    const statusOrder = ['pending', 'confirmed', 'in_progress', 'completed'];
    const currentStepIdx = statusOrder.indexOf(bk.status);

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">1.3. Theo dõi tiến độ đơn hàng #${bk.booking_id}</h1>
          <p class="screen-finding">Bảng: bookings, booking_status_history, provider_public_profiles.</p>
        </div>
        <div class="screen-actions">
          <select class="select" style="width:auto; height:36px;" onchange="GDXApp.go('1.3', {bookingId: Number(this.value)})" aria-label="Chọn đơn hàng cần xem">
            ${custBookings
              .map(
                (b) => {
                  const s = db.services.find((x) => x.service_id === b.service_id);
                  return `<option value="${b.booking_id}" ${b.booking_id === bk.booking_id ? 'selected' : ''}>Đơn #${b.booking_id} · ${s ? s.title : ''} (${b.status})</option>`;
                }
              )
              .join('')}
          </select>
          <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.go('1.4')">Danh sách lịch hẹn</button>
        </div>
      </div>

      <!-- 4-Step Visual Progress Stepper -->
      <div class="stepper-track">
        <div class="stepper-node ${currentStepIdx > 0 ? 'is-done' : currentStepIdx === 0 ? 'is-current' : ''}">
          <div class="stepper-icon">1</div>
          <div>
            <div style="font-weight:600; font-size:13.5px;">Khởi tạo lịch hẹn</div>
            <div class="field-hint">Chờ thợ xác nhận (pending)</div>
          </div>
        </div>
        <div class="stepper-node ${currentStepIdx > 1 ? 'is-done' : currentStepIdx === 1 ? 'is-current' : ''}">
          <div class="stepper-icon">2</div>
          <div>
            <div style="font-weight:600; font-size:13.5px;">Thợ đã nhận lịch</div>
            <div class="field-hint">Chuẩn bị dụng cụ (confirmed)</div>
          </div>
        </div>
        <div class="stepper-node ${currentStepIdx > 2 ? 'is-done' : currentStepIdx === 2 ? 'is-current' : ''}">
          <div class="stepper-icon">3</div>
          <div>
            <div style="font-weight:600; font-size:13.5px;">Đang thực hiện tại nhà</div>
            <div class="field-hint">Ghi nhận chi phí (in_progress)</div>
          </div>
        </div>
        <div class="stepper-node ${currentStepIdx === 3 ? 'is-done' : ''}">
          <div class="stepper-icon">4</div>
          <div>
            <div style="font-weight:600; font-size:13.5px;">Nghiệm thu &amp; Hoàn thành</div>
            <div class="field-hint">Thanh toán &amp; Đánh giá (completed)</div>
          </div>
        </div>
      </div>

      <div class="grid-12">
        <div class="col-7 form-stack">
          <!-- Provider & Distance Info -->
          <div class="panel form-stack">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div style="display:flex; align-items:center; gap:14px;">
                <img src="${prov ? prov.avatar_url : 'assets/provider-lan.jpg'}" alt="${prov ? prov.full_name : 'Thợ'}" class="provider-avatar-lg">
                <div>
                  <div style="font-weight:600; font-size:16px;">${prov ? prov.full_name : 'Đang điều phối đối tác thợ'}</div>
                  <div class="rating-inline" style="margin-top:2px;">
                    ${prov ? `${Icons.star(true)} <span class="num">${prov.average_rating}</span> (${prov.total_reviews} đánh giá)` : 'Hệ thống đang gửi thông báo tới thợ trong khu vực'}
                  </div>
                </div>
              </div>
              <div style="display:flex; gap:8px;">
                ${
                  prov
                    ? `<button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.openModal('1.7', {providerId: ${prov.provider_id}})">Hồ sơ thợ</button>`
                    : ''
                }
                <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.openModal('1.11', {bookingId: ${bk.booking_id}})">
                  Gửi yêu cầu hỗ trợ
                </button>
              </div>
            </div>

            <div class="geo-map-canvas">
              <div class="geo-pin-row">
                <div>
                  <div style="font-weight:600;">Địa chỉ thực hiện: ${bk.address}</div>
                  <div class="field-hint">Tọa độ điểm hẹn: <span class="num">${bk.latitude}, ${bk.longitude}</span> · Khoảng cách từ vị trí khai báo của thợ: <strong>~${distKm} km</strong></div>
                </div>
                <span class="badge badge-info">${formatDateTime(bk.scheduled_time)}</span>
              </div>
            </div>
          </div>

          <!-- Status History Timeline -->
          <div class="panel form-stack">
            <h2 class="panel-title">Nhật ký trạng thái đơn hàng (booking_status_history)</h2>
            <div class="audit-timeline">
              ${history
                .map(
                  (h) => `
                <div class="audit-item">
                  <div style="display:flex; justify-content:space-between; gap:8px;">
                    <strong>${(h.old_status || h.previous_status) ? `${h.old_status || h.previous_status} &rarr; ${h.new_status}` : `Khởi tạo (${h.new_status})`}</strong>
                    <span class="field-hint num">${formatDateTime(h.changed_at || h.created_at)}</span>
                  </div>
                  <div class="field-hint">${h.reason || 'Cập nhật trạng thái lịch hẹn'}</div>
                </div>`
                )
                .join('')}
            </div>
          </div>
        </div>

        <!-- Right 5 cols: Cost Breakdown & Actions -->
        <div class="col-5 form-stack">
          <div class="panel form-stack">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">Chi tiết chi phí &amp; Nghiệm thu</h2>
              ${paymentBadge(bk.payment_status)}
            </div>

            <div class="slip-row">
              <span class="field-hint">Gói dịch vụ</span>
              <span class="slip-dots"></span>
              <strong>${svc ? svc.title : ''}</strong>
            </div>
            <div class="slip-row">
              <span class="field-hint">Phí dịch vụ cơ bản (total_amount)</span>
              <span class="slip-dots"></span>
              <strong class="num">${formatMoney(bk.total_amount)}</strong>
            </div>
            <div class="slip-row">
              <span class="field-hint">Chi phí phát sinh (total_incidental)</span>
              <span class="slip-dots"></span>
              <strong class="num" style="color:${bk.total_incidental > 0 ? 'var(--warning)' : 'inherit'};">${formatMoney(bk.total_incidental)}</strong>
            </div>

            ${
              bk.incidental_Specify
                ? `
              <div class="panel-subtle" style="font-size:13px;">
                <strong>Giải trình vật tư phát sinh (incidental_Specify):</strong>
                <div class="field-hint" style="margin-top:4px;">${bk.incidental_Specify}</div>
              </div>`
                : ''
            }

            <div class="slip-total">
              <strong>Tổng cộng thanh toán</strong>
              <span class="slip-total-price num">${formatMoney(bk.total_amount + bk.total_incidental)}</span>
            </div>

            <div style="display:flex; flex-direction:column; gap:8px; padding-top:8px;">
              ${
                bk.payment_status === 'unpaid' && bk.status !== 'cancelled'
                  ? `
                <button type="button" class="btn btn-primary" style="width:100%; height:42px;" onclick="GDXApp.openModal('1.8', {bookingId: ${bk.booking_id}})">
                  Thanh toán hóa đơn (${formatMoney(bk.total_amount + bk.total_incidental)}) &rarr;
                </button>`
                  : ''
              }
              ${
                bk.status === 'completed'
                  ? `
                <button type="button" class="btn btn-secondary" style="width:100%;" onclick="GDXApp.openModal('1.9', {bookingId: ${bk.booking_id}})">
                  Đánh giá &amp; Chấm điểm Đối tác Thợ
                </button>`
                  : ''
              }
              ${
                bk.status === 'pending' || bk.status === 'confirmed'
                  ? `
                <button type="button" class="btn btn-danger" style="width:100%;" onclick="GDXApp.openModal('1.10', {bookingId: ${bk.booking_id}})">
                  Yêu cầu hủy lịch hẹn này
                </button>`
                  : ''
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 1.4: Quản lý lịch hẹn dịch vụ
  function renderScreen_1_4(container) {
    const db = window.GDX_DB;
    const allBookings = (db.bookings || []).filter((b) => b.customer_id === state.activeCustomerId);
    const filtered =
      state.bookingListFilter === 'all'
        ? allBookings
        : allBookings.filter((b) => b.status === state.bookingListFilter);

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">1.4. Quản lý lịch hẹn dịch vụ của bạn (${allBookings.length})</h1>
          <p class="screen-finding">Bảng: bookings, services, reviews. Lọc theo booking_status và thực hiện thanh toán / đánh giá.</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.go('1.2', {serviceId: 301})">
          + Đặt lịch dịch vụ mới
        </button>
      </div>

      <div class="filter-toolbar">
        <div class="filter-chips">
          <button type="button" class="filter-chip" aria-pressed="${state.bookingListFilter === 'all'}" onclick="GDXApp.setBookingListFilter('all')">
            Tất cả (${allBookings.length})
          </button>
          <button type="button" class="filter-chip" aria-pressed="${state.bookingListFilter === 'in_progress'}" onclick="GDXApp.setBookingListFilter('in_progress')">
            Đang thực hiện (${allBookings.filter((b) => b.status === 'in_progress').length})
          </button>
          <button type="button" class="filter-chip" aria-pressed="${state.bookingListFilter === 'pending'}" onclick="GDXApp.setBookingListFilter('pending')">
            Chờ xác nhận (${allBookings.filter((b) => b.status === 'pending').length})
          </button>
          <button type="button" class="filter-chip" aria-pressed="${state.bookingListFilter === 'completed'}" onclick="GDXApp.setBookingListFilter('completed')">
            Đã hoàn thành (${allBookings.filter((b) => b.status === 'completed').length})
          </button>
          <button type="button" class="filter-chip" aria-pressed="${state.bookingListFilter === 'cancelled'}" onclick="GDXApp.setBookingListFilter('cancelled')">
            Đã hủy (${allBookings.filter((b) => b.status === 'cancelled').length})
          </button>
        </div>
      </div>

      <div class="form-stack">
        ${
          filtered.length === 0
            ? `
            <div class="panel empty-state-card" style="text-align:center; padding:48px 24px;">
              <div style="font-size:42px; margin-bottom:12px;">📅</div>
              <h3 style="margin-bottom:8px;">${allBookings.length === 0 ? 'Bạn chưa có lịch hẹn dịch vụ nào' : 'Không có lịch hẹn phù hợp bộ lọc'}</h3>
              <p class="field-hint" style="max-width:440px; margin:0 auto 20px;">
                ${
                  allBookings.length === 0
                    ? 'Bạn là khách hàng mới! Hãy khám phá danh mục dịch vụ Gia Đình Xanh và đặt lịch hẹn đầu tiên của bạn.'
                    : 'Thử chuyển sang bộ lọc "Tất cả" để kiểm tra toàn bộ lịch sử lịch hẹn.'
                }
              </p>
              <button type="button" class="btn btn-primary" onclick="GDXApp.go('1.1')">
                Khám phá dịch vụ ngay
              </button>
            </div>
            `
            : filtered
                .map((b) => {
                  const svc = (db.services || []).find((s) => s.service_id === b.service_id);
                  const prov = (db.provider_public_profiles || []).find((p) => p.provider_id === b.provider_id);
                  const existingReview = (db.reviews || []).find((r) => r.booking_id === b.booking_id);

                  return `
            <article class="panel" style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
              <div style="display:flex; gap:14px; align-items:center; flex:1; min-width:260px;">
                <img src="${svc ? svc.image_url : 'assets/service-cleaning.jpg'}" alt="${svc ? svc.title : ''}" style="width:76px; height:58px; border-radius:8px; object-fit:cover; flex-shrink:0;">
                <div>
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span class="field-hint num" style="font-weight:600;">#${b.booking_id}</span>
                    <strong style="font-size:15.5px;">${svc ? svc.title : 'Dịch vụ'}</strong>
                    ${statusBadge(b.status)}
                    ${paymentBadge(b.payment_status)}
                  </div>
                  <div class="field-hint" style="margin-top:4px;">
                    Lịch hẹn: <strong class="num">${formatDateTime(b.scheduled_time)}</strong> · Đối tác: <strong>${prov ? prov.full_name : 'Đang tìm thợ'}</strong>
                  </div>
                  <div class="field-hint" style="margin-top:2px;">
                    Địa chỉ: ${b.address}
                  </div>
                </div>
              </div>

              <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
                <div style="text-align:right;">
                  <div class="field-hint">Tổng cộng</div>
                  <div class="num" style="font-size:17px; font-weight:600; color:var(--accent);">${formatMoney(b.total_amount + b.total_incidental)}</div>
                </div>

                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.go('1.3', {bookingId: ${b.booking_id}})">
                    Chi tiết tiến độ
                  </button>
                  ${
                    b.payment_status === 'unpaid' && b.status !== 'cancelled'
                      ? `<button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.openModal('1.8', {bookingId: ${b.booking_id}})">Thanh toán</button>`
                      : ''
                  }
                  ${
                    b.status === 'completed' && !existingReview
                      ? `<button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.openModal('1.9', {bookingId: ${b.booking_id}})">Chấm điểm thợ</button>`
                      : ''
                  }
                  ${
                    existingReview
                      ? `<span class="badge badge-positive">${Icons.star(true)} Đã chấm ${existingReview.rating}/5</span>`
                      : ''
                  }
                  ${
                    b.status === 'pending'
                      ? `<button type="button" class="btn btn-danger btn-sm" onclick="GDXApp.openModal('1.10', {bookingId: ${b.booking_id}})">Hủy lịch</button>`
                      : ''
                  }
                  <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.go('1.2', {serviceId: ${b.service_id}})">
                    Đặt lại
                  </button>
                </div>
              </div>
            </article>`;
                })
                .join('')
        }
      </div>
    `;
  }

  function setBookingListFilter(filter) {
    state.bookingListFilter = filter;
    go('1.4');
  }

  // 1.5: Hồ sơ cá nhân & Sổ địa chỉ
  function renderScreen_1_5(container) {
    const db = window.GDX_DB;
    const u = (db.users || []).find((x) => x.user_id === state.activeUserId) || (db.users && db.users[1]) || {
      full_name: 'Khách hàng mới',
      phone_number: '',
      email: '',
      user_id: state.activeUserId || 'guest'
    };
    const cust = (db.customer_profiles || []).find((c) => c.customer_id === state.activeCustomerId) || (db.customer_profiles && db.customer_profiles[0]) || {
      customer_id: state.activeCustomerId || 0,
      default_address: '',
      ward_id: (db.ward && db.ward[0] && db.ward[0].ward_id) || '70101063',
      latitude: 10.7769,
      longitude: 106.7009
    };
    const provinces = db.province || db.provinces || [];
    const allWards = db.ward || db.wards || [];
    const currentWard = allWards.find((w) => String(w.ward_id) === String(cust.ward_id));
    const currentProvId = currentWard ? String(currentWard.provinceId) : (provinces.find((p) => p.provinceId === '29' || p.provinceId === '79')?.provinceId || '29');
    const wardsForProv = allWards.filter((w) => !w.provinceId || String(w.provinceId) === String(currentProvId));
    const wardsToRender = wardsForProv.length > 0 ? wardsForProv : allWards.slice(0, 100);

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">1.5. Hồ sơ cá nhân &amp; Sổ địa chỉ mặc định</h1>
          <p class="screen-finding">Bảng: users (full_name, phone_number), customer_profiles (default_address, ward_id, latitude, longitude).</p>
        </div>
      </div>

      <div class="grid-12">
        <div class="col-7">
          <div class="panel">
            <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.saveCustomerProfile(this);">
              <h2 class="panel-title">Thông tin liên hệ &amp; Địa chỉ đón thợ</h2>

              <div class="form-row-2">
                <div class="field-group">
                  <label class="field-label" for="profFullName">Họ và tên khách hàng (users.full_name)</label>
                  <input type="text" id="profFullName" name="full_name" class="input" value="${u.full_name || ''}" required>
                </div>
                <div class="field-group">
                  <label class="field-label" for="profPhone">Số điện thoại liên hệ (users.phone_number)</label>
                  <input type="tel" id="profPhone" name="phone_number" class="input" value="${u.phone_number || ''}" required pattern="0[0-9]{9,10}">
                </div>
              </div>

              <div class="form-row-2">
                <div class="field-group">
                  <label class="field-label" for="profProv">Tỉnh / Thành phố (${provinces.length} tỉnh thành)</label>
                  <select id="profProv" class="select" onchange="GDXApp.handleProvinceChange('profProv', 'profWard')">
                    ${provinces.map((p) => `<option value="${p.provinceId}" ${String(p.provinceId) === String(currentProvId) ? 'selected' : ''}>${p.name}</option>`).join('')}
                  </select>
                </div>
                <div class="field-group">
                  <label class="field-label" for="profWard">Phường / Xã mặc định (customer_profiles.ward_id)</label>
                  <select id="profWard" name="ward_id" class="select" required>
                    ${wardsToRender.map((w) => `<option value="${w.ward_id}" ${String(w.ward_id) === String(cust.ward_id) ? 'selected' : ''}>${w.name}</option>`).join('')}
                  </select>
                </div>
              </div>

              <div class="field-group">
                <label class="field-label" for="profAddress">Địa chỉ chi tiết (customer_profiles.default_address)</label>
                <input type="text" id="profAddress" name="default_address" class="input" value="${cust.default_address || ''}" required>
              </div>

              <div class="field-group">
                <label class="field-label" style="display:flex; justify-content:space-between; align-items:center;">
                  <span>Vị trí trên bản đồ tương tác (Leaflet &bull; OpenStreetMap)</span>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.locateUserGPS('profLat', 'profLng', 'profCoordText', 'profAddress', 'profProv', 'profWard')">
                    ${Icons.pin()} Định vị GPS &amp; Nhận diện địa chỉ
                  </button>
                </label>
                <div class="geo-map-card">
                  <div id="customerProfileMap" class="geo-map-container" style="height:240px;" tabindex="0"></div>
                  <div class="geo-map-footer">
                    <div>
                      <span>Tọa độ đã chọn:</span>
                      <span id="profCoordText" class="geo-coords-tag">${cust.latitude || 10.7769}, ${cust.longitude || 106.7009}</span>
                    </div>
                    <span class="field-hint" style="margin:0;">Kéo ghim hoặc bấm vào bản đồ để tự động nhận diện số nhà</span>
                  </div>
                </div>
              </div>

              <div class="form-row-2">
                <div class="field-group">
                  <label class="field-label" for="profLat">Vĩ độ (latitude)</label>
                  <input type="number" step="0.000001" id="profLat" name="latitude" class="input num" value="${cust.latitude || 10.7769}" required>
                </div>
                <div class="field-group">
                  <label class="field-label" for="profLng">Kinh độ (longitude)</label>
                  <input type="number" step="0.000001" id="profLng" name="longitude" class="input num" value="${cust.longitude || 106.7009}" required>
                </div>
              </div>

              <div style="display:flex; justify-content:flex-end; gap:10px; padding-top:6px;">
                <button type="submit" class="btn btn-primary">Lưu cập nhật hồ sơ</button>
              </div>
            </form>
          </div>
        </div>

        <div class="col-5 form-stack">
          <div class="panel form-stack">
            <h2 class="panel-title">Thống kê tài khoản của bạn</h2>
            <div class="slip-row">
              <span class="field-hint">Mã khách hàng</span>
              <span class="slip-dots"></span>
              <strong class="num">#${cust.customer_id || 'Mới'}</strong>
            </div>
            <div class="slip-row">
              <span class="field-hint">Tổng số lịch hẹn đã đặt</span>
              <span class="slip-dots"></span>
              <strong class="num">${(db.bookings || []).filter((b) => b.customer_id === cust.customer_id).length} đơn</strong>
            </div>
            <div class="slip-row">
              <span class="field-hint">Dịch vụ yêu thích đã lưu</span>
              <span class="slip-dots"></span>
              <strong class="num">${(db.favorites || []).filter((f) => f.customer_id === cust.customer_id).length} dịch vụ</strong>
            </div>
            <div class="slip-row">
              <span class="field-hint">Phiếu hỗ trợ đã gửi</span>
              <span class="slip-dots"></span>
              <strong class="num">${(db.support_tickets || []).filter((t) => t.user_id === u.user_id).length} phiếu</strong>
            </div>
          </div>
        </div>
      </div>
    `;

    // Khởi tạo bản đồ tương tác cho màn hình hồ sơ
    initCustomerLocationPicker({
      containerId: 'customerProfileMap',
      lat: Number(cust.latitude || 10.7769),
      lng: Number(cust.longitude || 106.7009),
      zoom: 15,
      latInputId: 'profLat',
      lngInputId: 'profLng',
      coordTextId: 'profCoordText',
      addrInputId: 'profAddress',
      provSelectId: 'profProv',
      wardSelectId: 'profWard'
    });
  }

  async function saveCustomerProfile(form) {
    const u = (window.GDX_DB.users || []).find((x) => String(x.user_id) === String(state.activeUserId));
    let cust = getActiveCustomerProfile();
    const wardId = form.ward_id.value;
    const defaultAddress = form.default_address.value.trim();
    const lat = Number(form.latitude.value);
    const lng = Number(form.longitude.value);

    if (u) {
      u.full_name = form.full_name.value.trim();
      u.phone_number = form.phone_number.value.trim();
    }
    if (cust) {
      cust.ward_id = wardId;
      cust.default_address = defaultAddress;
      cust.latitude = lat;
      cust.longitude = lng;
    } else {
      cust = {
        customer_id: state.activeCustomerId || 101,
        user_id: state.activeUserId,
        ward_id: wardId,
        default_address: defaultAddress,
        latitude: lat,
        longitude: lng,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      window.GDX_DB.customer_profiles = window.GDX_DB.customer_profiles || [];
      window.GDX_DB.customer_profiles.push(cust);
    }

    // Đồng bộ ngay lập tức vào state.wizardDraft
    state.wizardDraft.ward_id = wardId;
    state.wizardDraft.address = defaultAddress;
    state.wizardDraft.latitude = lat;
    state.wizardDraft.longitude = lng;

    const res = await apiRequest('/api/customer/profile', {
      method: 'PUT',
      body: JSON.stringify({
        user_id: state.activeUserId,
        customer_id: state.activeCustomerId || (cust && cust.customer_id),
        full_name: form.full_name.value.trim(),
        phone_number: form.phone_number.value.trim(),
        ward_id: wardId,
        default_address: defaultAddress,
        latitude: lat,
        longitude: lng
      })
    });

    if (res && res.customer_profile) {
      if (cust) Object.assign(cust, res.customer_profile);
      state.activeCustomerId = res.customer_profile.customer_id;
    }

    showToast('Đã cập nhật hồ sơ & địa chỉ mặc định!');
    go('1.5');
  }

  // 1.6: Danh sách Dịch vụ yêu thích
  function renderScreen_1_6(container) {
    const db = window.GDX_DB;
    const favs = db.favorites.filter((f) => f.customer_id === state.activeCustomerId);

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">1.6. Danh sách Dịch vụ yêu thích đã lưu (${favs.length})</h1>
          <p class="screen-finding">Bảng: favorites (customer_id, service_id), chính sách RLS fav_own.</p>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.go('1.1')">&larr; Khám phá thêm dịch vụ</button>
      </div>

      ${
        favs.length === 0
          ? `
        <div class="panel" style="text-align:center; padding:40px 24px;">
          <div style="font-weight:600; font-size:16px; margin-bottom:6px;">Bạn chưa lưu dịch vụ yêu thích nào</div>
          <p class="field-hint" style="margin-bottom:16px;">Bấm biểu tượng trái tim trên các thẻ dịch vụ ở Trang chủ để lưu nhanh những gói bạn thường đặt.</p>
          <button type="button" class="btn btn-primary" onclick="GDXApp.go('1.1')">Khám phá dịch vụ ngay</button>
        </div>`
          : `
        <div class="service-grid">
          ${favs
            .map((f) => {
              const s = db.services.find((x) => x.service_id === f.service_id);
              if (!s) return '';
              const cat = db.service_categories.find((c) => c.category_id === s.category_id);
              return `
              <article class="service-card">
                <div class="service-card-media">
                  <img src="${s.image_url || 'assets/service-cleaning.jpg'}" alt="${s.title}">
                  <span class="service-card-badge">${cat ? cat.name : 'Yêu thích'}</span>
                  <button type="button" class="fav-icon-btn is-favorited" onclick="GDXApp.toggleFavorite(${s.service_id})" aria-label="Bỏ lưu">
                    ${Icons.heart(true)}
                  </button>
                </div>
                <div class="service-card-body">
                  <div class="service-card-title">${s.title}</div>
                  <div class="service-card-meta">
                    <span>${Icons.clock()} ~${s.estimated_duration} phút</span>
                    <span>·</span>
                    <span>Đã lưu: ${formatDateTime(f.created_at)}</span>
                  </div>
                  <div class="service-card-footer">
                    <div class="service-price num">${formatMoney(s.price)}<span style="font-size:12.5px; color:var(--app-muted);">${s.pricing_type === 'hourly' ? '/giờ' : '/lần'}</span></div>
                    <div style="display:flex; gap:6px;">
                      <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.toggleFavorite(${s.service_id})">Bỏ lưu</button>
                      <button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.go('1.2', {serviceId: ${s.service_id}})">Đặt lịch &rarr;</button>
                    </div>
                  </div>
                </div>
              </article>`;
            })
            .join('')}
        </div>`
      }
    `;
  }

  // =====================================================================
  // SCREEN RENDERERS: PHÂN HỆ 2 (PROVIDER PORTAL: 2.1 – 2.4)
  // =====================================================================

  // 2.1: Hòm thư nhận việc làm (Job Inbox & Dispatch Board)
  function renderScreen_2_1(container) {
    const db = window.GDX_DB;
    const prov = (db.provider_profiles || []).find((p) => p.provider_id === state.activeProviderId) || (db.provider_profiles || [])[0] || {
      provider_id: 201,
      full_name: 'Đặng Thị Mai Lan',
      lattitude: 10.7412,
      longtitude: 106.7021,
      is_available_online: true
    };

    state.inboxTab = state.inboxTab || 'available';
    state.expiredJobIds = state.expiredJobIds || [];
    state.dismissedJobIds = state.dismissedJobIds || [];

    const activeJob = (db.bookings || []).find(
      (b) => b.provider_id === prov.provider_id && (b.status === 'in_progress' || b.status === 'confirmed')
    );

    // Việc khả dụng trong hộp thư
    const availableJobs = (db.bookings || []).filter((b) => {
      if (b.status !== 'pending') return false;
      if (state.expiredJobIds.includes(b.booking_id)) return false;
      if (state.dismissedJobIds.includes(b.booking_id)) return false;
      if (b.provider_id !== null && b.provider_id !== undefined && b.provider_id !== prov.provider_id && b.dispatch_type !== 'broadcast') {
        return false;
      }
      if (state.jobBoardFilter.wardId !== 'all' && b.ward_id !== state.jobBoardFilter.wardId) return false;
      return true;
    });

    // Việc đã hết hạn (do đối tác khác nhận trước hoặc bị hết hiệu lực)
    const expiredJobs = (db.bookings || []).filter((b) => {
      if (state.expiredJobIds.includes(b.booking_id)) return true;
      if (b.status === 'confirmed' && b.provider_id && b.provider_id !== prov.provider_id) {
        return true;
      }
      return false;
    });

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">2.1. Hòm thư Nhận việc &amp; Điều phối Ca làm</h1>
          <p class="screen-finding">Bảng: bookings (pending/confirmed), customer_profiles, services, ward · Cơ chế khóa tranh chấp (First-come Expired).</p>
        </div>
        <div class="screen-actions">
          <span class="badge ${prov.is_available_online ? 'badge-positive' : 'badge-neutral'}">
            ${prov.is_available_online ? 'Đang bật nhận việc trực tuyến' : 'Đang tạm nghỉ'}
          </span>
        </div>
      </div>

      ${
        activeJob
          ? `
        <div class="active-booking-banner">
          <div class="active-booking-banner-info">
            <span class="status-dot is-online"></span>
            <div>
              <strong>Ca làm hiện tại của bạn: Đơn #${activeJob.booking_id} (${activeJob.status === 'in_progress' ? 'Đang thực hiện' : 'Đã xác nhận'})</strong>
              <div class="field-hint">Địa chỉ: ${activeJob.address} · Thu nhập đơn: <strong class="num">${formatMoney(activeJob.total_amount + activeJob.total_incidental)}</strong></div>
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.go('2.2', {bookingId: ${activeJob.booking_id}})">
            Mở màn hình Ca làm việc &rarr;
          </button>
        </div>`
          : ''
      }

      <!-- Inbox Navigation Tabs (Taste & Impeccable) -->
      <div class="inbox-nav-tabs" role="tablist">
        <button type="button" class="inbox-nav-tab ${state.inboxTab === 'available' ? 'is-active' : ''}" onclick="GDXApp.setInboxTab('available')">
          📥 Hộp thư đến (Việc chờ nhận)
          <span class="inbox-tab-badge">${availableJobs.length}</span>
        </button>
        <button type="button" class="inbox-nav-tab ${state.inboxTab === 'expired' ? 'is-active' : ''}" onclick="GDXApp.setInboxTab('expired')">
          ⏳ Đơn đã hết hạn / Đã có người nhận (Expired)
          <span class="inbox-tab-badge">${expiredJobs.length}</span>
        </button>
      </div>

      ${
        state.inboxTab === 'available'
          ? `
        <div class="filter-toolbar">
          <div class="filter-chips">
            <button type="button" class="filter-chip" aria-pressed="${state.jobBoardFilter.wardId === 'all'}" onclick="GDXApp.setJobBoardWard('all')">
              Tất cả Phường đã đăng ký (${availableJobs.length})
            </button>
            ${(db.ward || [])
              .slice(0, 4)
              .map(
                (w) => `
              <button type="button" class="filter-chip" aria-pressed="${state.jobBoardFilter.wardId === w.ward_id}" onclick="GDXApp.setJobBoardWard('${w.ward_id}')">
                ${w.name.replace('Phường ', 'P. ')}
              </button>`
              )
              .join('')}
          </div>
        </div>

        <div class="form-stack">
          ${
            availableJobs.length === 0
              ? `<div class="panel" style="text-align:center; padding:36px 24px;">
                  <div style="font-size:2rem; margin-bottom:8px;">📬</div>
                  <strong style="font-size:1.0625rem; display:block; margin-bottom:4px;">Hòm thư hiện không có đơn việc mới</strong>
                  <p class="field-hint" style="max-width:440px; margin:0 auto 16px auto;">
                    Các đơn rải chung từ khách hàng và yêu cầu chỉ định riêng sẽ tự động xuất hiện tại đây ngay khi có phát sinh.
                  </p>
                  <button type="button" class="ghost-btn btn-sm" onclick="GDXApp.go('1.2')">Tạo thử một đơn đặt lịch mới &rarr;</button>
                </div>`
              : availableJobs
                  .map((b) => {
                    const svc = (db.services || []).find((s) => s.service_id === b.service_id);
                    const w = (db.ward || []).find((x) => x.ward_id === b.ward_id);
                    const distKm = calcDistanceKm(prov.lattitude || 10.7412, prov.longtitude || 106.7021, b.latitude || 10.7412, b.longitude || 106.7021);
                    const isBroadcast = !b.provider_id || b.dispatch_type === 'broadcast' || (b.notes && b.notes.includes('[BROADCAST'));

                    return `
                    <article class="job-inbox-card">
                      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
                        <div style="flex:1; min-width:260px;">
                          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                            ${
                              isBroadcast
                                ? `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700;">⚡ Đơn phát toàn khu vực (Rải đơn)</span>`
                                : `<span class="badge" style="background:#ecfdf5; color:#047857; font-weight:700;">⭐ Khách hàng chỉ định đích danh bạn</span>`
                            }
                            <span class="badge badge-warning">Đơn mới #${b.booking_id}</span>
                            <span class="badge badge-info">${Icons.pin()} Cách bạn ~${distKm} km</span>
                            <span class="badge badge-neutral">${w ? w.name : ''}</span>
                          </div>

                          <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                            <img src="${getServiceImage(svc)}" alt="${svc ? svc.title : 'Dịch vụ'}" style="width:52px; height:42px; border-radius:8px; object-fit:cover;">
                            <div>
                              <strong style="font-size:1.0625rem; color:var(--color-secondary);">${svc ? svc.title : 'Dịch vụ'}</strong>
                              <div class="field-hint">Thời lượng tiêu chuẩn: ~${svc ? svc.estimated_duration : 120} phút</div>
                            </div>
                          </div>

                          <div style="font-size:0.875rem; color:var(--color-secondary); margin-bottom:4px;">
                            <strong>Thời gian hẹn:</strong> <span class="num">${formatDateTime(b.scheduled_time)}</span>
                          </div>
                          <div class="field-hint" style="margin-bottom:4px;">
                            <strong>Địa chỉ khách hàng:</strong> ${b.address}
                          </div>
                          ${
                            b.notes
                              ? `<div class="panel-subtle" style="margin-top:6px; padding:8px 12px; font-size:13px;">
                                  <strong>Ghi chú từ khách:</strong> "${b.notes.replace('[BROADCAST_POOL]', '').trim()}"
                                </div>`
                              : ''
                          }
                        </div>

                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:12px; min-width:180px;">
                          <div style="text-align:right;">
                            <div class="field-hint">Thu nhập ca làm</div>
                            <div class="num" style="font-size:1.35rem; font-weight:800; color:var(--color-primary);">${formatMoney(b.total_amount)}</div>
                          </div>
                          <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
                            <button type="button" class="primary-btn btn-sm" style="width:100%; min-height:40px;" onclick="GDXApp.acceptJob(${b.booking_id})">
                              Nhận việc ngay &rarr;
                            </button>
                            <div style="display:flex; gap:6px;">
                              <button type="button" class="ghost-btn btn-sm" style="flex:1;" onclick="GDXApp.dismissJob(${b.booking_id})">
                                Bỏ qua
                              </button>
                              <button type="button" class="btn btn-secondary btn-sm" style="font-size:11px; flex:1; border:1px dashed var(--color-border);" onclick="GDXApp.simulateJobExpired(${b.booking_id})" title="Thử nghiệm tính năng: Giả lập một thợ khác nhận trước">
                                Thử: Thợ khác nhận
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>`;
                  })
                  .join('')
          }
        </div>`
          : `
        <!-- Expired Jobs Tab -->
        <div class="form-stack">
          ${
            expiredJobs.length === 0
              ? `<div class="panel" style="text-align:center; padding:36px 24px;">
                  <div style="font-size:2rem; margin-bottom:8px;">⏳</div>
                  <strong style="font-size:1.0625rem; display:block; margin-bottom:4px;">Không có đơn nào bị hết hạn</strong>
                  <p class="field-hint" style="max-width:440px; margin:0 auto;">
                    Khi có đơn rải chung nhưng đã được một đối tác khác bấm nhận trước bạn, đơn sẽ tự động lưu vết tại đây dưới trạng thái Expired.
                  </p>
                </div>`
              : expiredJobs
                  .map((b) => {
                    const svc = (db.services || []).find((s) => s.service_id === b.service_id);
                    const w = (db.ward || []).find((x) => x.ward_id === b.ward_id);
                    const distKm = calcDistanceKm(prov.lattitude || 10.7412, prov.longtitude || 106.7021, b.latitude || 10.7412, b.longitude || 106.7021);

                    return `
                    <article class="job-inbox-card is-expired">
                      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
                        <div style="flex:1; min-width:260px;">
                          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                            <span class="badge" style="background:#fee2e2; color:#b91c1c; font-weight:700;">Hết hạn · Đã có người nhận</span>
                            <span class="badge badge-neutral">Đơn #${b.booking_id}</span>
                            <span class="badge badge-neutral">${w ? w.name : ''}</span>
                          </div>

                          <div class="panel-subtle" style="background:#fff1f2; border:1px solid #fecdd3; color:#9f1239; padding:8px 12px; border-radius:8px; font-size:13px; margin-bottom:10px;">
                            ⚠️ <strong>Thẻ việc đã hết hiệu lực:</strong> Đơn này vừa được một Đối tác Thợ khác trong khu vực xác nhận nhận trước. Yêu cầu đã tự động đóng.
                          </div>

                          <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                            <img src="${getServiceImage(svc)}" alt="${svc ? svc.title : 'Dịch vụ'}" style="width:52px; height:42px; border-radius:8px; object-fit:cover; opacity:0.7;">
                            <div>
                              <strong style="font-size:1rem; color:var(--color-secondary);">${svc ? svc.title : 'Dịch vụ'}</strong>
                              <div class="field-hint">Địa chỉ: ${b.address} · Hẹn lúc: ${formatDateTime(b.scheduled_time)}</div>
                            </div>
                          </div>
                        </div>

                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px; min-width:140px;">
                          <div style="text-align:right;">
                            <div class="field-hint">Thu nhập</div>
                            <div class="num" style="font-size:1.15rem; font-weight:700; color:var(--color-muted); text-decoration:line-through;">${formatMoney(b.total_amount)}</div>
                          </div>
                          <button type="button" class="btn btn-secondary btn-sm" disabled style="opacity:0.6; cursor:not-allowed;">
                            Đã hết hạn
                          </button>
                        </div>
                      </div>
                    </article>`;
                  })
                  .join('')
          }
        </div>`
      }
    `;
  }

  function setJobBoardWard(wardId) {
    state.jobBoardFilter.wardId = wardId;
    go('2.1');
  }

  function setInboxTab(tab) {
    state.inboxTab = tab;
    go('2.1');
  }

  function dismissJob(bookingId) {
    if (!state.dismissedJobIds) state.dismissedJobIds = [];
    state.dismissedJobIds.push(bookingId);
    showToast(`Đã tạm ẩn đơn #${bookingId} khỏi hộp thư.`);
    go('2.1');
  }

  function simulateJobExpired(bookingId) {
    if (!state.expiredJobIds) state.expiredJobIds = [];
    if (!state.expiredJobIds.includes(bookingId)) state.expiredJobIds.push(bookingId);
    const db = window.GDX_DB;
    const bk = (db.bookings || []).find((b) => b.booking_id === bookingId);
    if (bk) {
      bk.status = 'confirmed';
      bk.provider_id = 202; // Nguyen Van Tuan took it
    }
    showToast(`Mô phỏng: Đơn #${bookingId} vừa được đối tác Nguyễn Văn Tuấn nhận trước! Đơn đã chuyển sang tab Expired.`);
    state.inboxTab = 'expired';
    go('2.1');
  }

  async function acceptJob(bookingId) {
    const db = window.GDX_DB;
    const bk = (db.bookings || []).find((b) => b.booking_id === bookingId);
    if (!bk) return;

    // Concurrency check via API
    const res = await apiRequest(`/api/bookings/${bookingId}/accept`, {
      method: 'POST',
      body: JSON.stringify({
        provider_id: state.activeProviderId || 201,
        user_id: state.activeUserId || 4
      })
    });

    if (res && res.expired) {
      if (!state.expiredJobIds) state.expiredJobIds = [];
      if (!state.expiredJobIds.includes(bookingId)) state.expiredJobIds.push(bookingId);
      bk.status = 'confirmed';
      bk.provider_id = 202; // Taken by another provider
      showToast('Rất tiếc! Đơn này vừa được một đối tác khác nhận trước ít giây hoặc đã hết hạn.');
      state.inboxTab = 'expired';
      go('2.1');
      return;
    }

    if (!res || !res.ok) {
      showToast(res && res.error ? res.error : 'Không thể nhận đơn lúc này.');
      return;
    }

    bk.provider_id = state.activeProviderId || 201;
    bk.status = 'confirmed';
    bk.dispatch_type = 'direct';
    db.booking_status_history.unshift({
      history_id: Date.now(),
      booking_id: bookingId,
      old_status: 'pending',
      new_status: 'confirmed',
      changed_by: 4,
      reason: 'Đối tác đã xác nhận nhận việc từ Hòm thư việc làm',
      changed_at: new Date().toISOString()
    });
    state.selectedBookingId = bookingId;
    showToast(`Đã nhận đơn #${bookingId} thành công! Chuyển sang màn hình Ca làm việc.`);
    go('2.2', { bookingId });
  }

  // 2.2: Ca làm việc hiện tại (Live Timer)
  function renderScreen_2_2(container, params = {}) {
    const db = window.GDX_DB;
    const bk =
      (params.bookingId && db.bookings.find((b) => b.booking_id === Number(params.bookingId))) ||
      db.bookings.find((b) => b.booking_id === 1042) ||
      db.bookings[0];
    const svc = db.services.find((s) => s.service_id === bk.service_id);
    const cust = db.customer_profiles.find((c) => c.customer_id === bk.customer_id);
    const custUser = cust ? db.users.find((u) => u.user_id === cust.user_id) : null;

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">2.2. Điều hành Ca làm việc trực tiếp · Đơn #${bk.booking_id}</h1>
          <p class="screen-finding">Bảng: bookings, services (pricing_type, estimated_duration), booking_status_history.</p>
        </div>
        <div class="screen-actions">
          ${statusBadge(bk.status)}
          ${paymentBadge(bk.payment_status)}
        </div>
      </div>

      <div class="grid-12">
        <div class="col-7 form-stack">
          <div class="panel form-stack">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div>
                <div class="field-hint">Bộ đếm thời gian ca làm việc (${svc && svc.pricing_type === 'hourly' ? 'Tính theo giờ' : 'Trọn gói'})</div>
                <div class="timer-display num" id="liveShiftTimerDisplay">${formatTimer(state.liveTimerSeconds)}</div>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="btn btn-secondary" onclick="GDXApp.toggleShiftTimer()">
                  ${state.liveTimerInterval ? 'Tạm dừng đồng hồ' : 'Tiếp tục bấm giờ'}
                </button>
                <button type="button" class="btn btn-secondary" onclick="GDXApp.openModal('2.6', {bookingId: ${bk.booking_id}})">
                  + Kê khai vật tư phát sinh
                </button>
              </div>
            </div>

            <div class="panel-subtle form-stack" style="gap:8px;">
              <div style="display:flex; justify-content:space-between;">
                <span><strong>Khách hàng:</strong> ${custUser ? custUser.full_name : 'Nguyễn Minh Thảo'}</span>
                <span class="num"><strong>SĐT:</strong> ${custUser ? custUser.phone_number : '0908341289'}</span>
              </div>
              <div><strong>Địa chỉ ca làm:</strong> ${bk.address}</div>
              <div><strong>Ghi chú của khách:</strong> ${bk.notes || 'Không có ghi chú thêm'}</div>
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              ${
                bk.status === 'confirmed'
                  ? `<button type="button" class="btn btn-primary" onclick="GDXApp.startShiftWork(${bk.booking_id})">Bắt đầu ca làm tại nhà khách (in_progress) &rarr;</button>`
                  : ''
              }
              <button type="button" class="btn btn-primary" style="height:42px;" onclick="GDXApp.openModal('2.7', {bookingId: ${bk.booking_id}})">
                Hoàn tất nghiệm thu &amp; Chốt hóa đơn (completed) &rarr;
              </button>
            </div>
          </div>
        </div>

        <div class="col-5 form-stack">
          <div class="panel form-stack">
            <h2 class="panel-title">Bảng kê thu nhập ca làm #${bk.booking_id}</h2>
            <div class="slip-row">
              <span class="field-hint">Dịch vụ</span>
              <span class="slip-dots"></span>
              <strong>${svc ? svc.title : ''}</strong>
            </div>
            <div class="slip-row">
              <span class="field-hint">Tiền công dịch vụ (total_amount)</span>
              <span class="slip-dots"></span>
              <strong class="num">${formatMoney(bk.total_amount)}</strong>
            </div>
            <div class="slip-row">
              <span class="field-hint">Phụ phí / Vật tư (total_incidental)</span>
              <span class="slip-dots"></span>
              <strong class="num">${formatMoney(bk.total_incidental)}</strong>
            </div>
            ${
              bk.incidental_Specify
                ? `<div class="panel-subtle" style="font-size:12.5px;"><strong>Nội dung kê khai:</strong> ${bk.incidental_Specify}</div>`
                : ''
            }
            <div class="slip-total">
              <strong>Tổng thu hộ / Quyết toán</strong>
              <span class="slip-total-price num">${formatMoney(bk.total_amount + bk.total_incidental)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function toggleShiftTimer() {
    if (state.liveTimerInterval) {
      clearInterval(state.liveTimerInterval);
      state.liveTimerInterval = null;
      showToast('Đã tạm dừng đồng hồ ca làm');
    } else {
      state.liveTimerInterval = setInterval(() => {
        state.liveTimerSeconds += 1;
        const el = document.getElementById('liveShiftTimerDisplay');
        if (el) el.textContent = formatTimer(state.liveTimerSeconds);
      }, 1000);
      showToast('Đang tính giờ ca làm việc');
    }
    if (state.currentScreen === '2.2') go('2.2');
  }

  function startShiftWork(bookingId) {
    const bk = window.GDX_DB.bookings.find((b) => b.booking_id === bookingId);
    if (bk) bk.status = 'in_progress';
    showToast(`Đã bắt đầu thực hiện ca làm #${bookingId}`);
    go('2.2', { bookingId });
  }

  // 2.3: Ví Thu Nhập & Lịch Ca
  function renderScreen_2_3(container) {
    const db = window.GDX_DB;
    const prov = db.provider_profiles.find((p) => p.provider_id === state.activeProviderId) || db.provider_profiles[0];
    const completedPaid = db.bookings.filter(
      (b) => b.provider_id === state.activeProviderId && b.status === 'completed' && b.payment_status === 'paid'
    );
    const totalEarned = completedPaid.reduce((acc, b) => acc + b.total_amount + b.total_incidental, 0);
    const schedules = db.availability_schedules.filter((s) => s.provider_id === state.activeProviderId);
    const exceptions = db.availability_exceptions.filter((e) => e.provider_id === state.activeProviderId);
    const myReviews = db.reviews.filter((r) => r.provider_id === state.activeProviderId);
    const dayNames = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">2.3. Thống kê Thu nhập &amp; Lịch làm việc hàng tuần</h1>
          <p class="screen-finding">Bảng: bookings (completed &amp; paid), reviews, availability_schedules, availability_exceptions.</p>
        </div>
        <div class="screen-actions">
          <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.openModal('2.8')">Thiết lập khung giờ tuần</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.openModal('2.9')">+ Xin nghỉ phép đột xuất</button>
        </div>
      </div>

      <div class="kpi-strip">
        <div class="kpi-cell">
          <div class="kpi-label">Doanh thu đã quyết toán</div>
          <div class="kpi-value num" style="color:var(--accent);">${formatMoney(totalEarned)}</div>
          <div class="kpi-sub">Từ ${completedPaid.length} đơn đã hoàn thành &amp; thanh toán</div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">Điểm uy tín trung bình</div>
          <div class="kpi-value num">${prov.average_rating} / 5.0</div>
          <div class="kpi-sub">Tổng hợp tự động từ ${prov.total_reviews} lượt chấm điểm</div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">Ca đang thực hiện</div>
          <div class="kpi-value num">${db.bookings.filter((b) => b.provider_id === state.activeProviderId && b.status === 'in_progress').length} ca</div>
          <div class="kpi-sub">Đang ghi nhận trên hệ thống</div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">Ngày đăng ký nghỉ phép</div>
          <div class="kpi-value num">${exceptions.length} ngày</div>
          <div class="kpi-sub">Tự động ẩn khỏi danh sách đặt lịch</div>
        </div>
      </div>

      <div class="grid-12">
        <div class="col-7 form-stack">
          <div class="panel form-stack">
            <h2 class="panel-title">Lịch sử thu nhập các ca đã hoàn tất</h2>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Dịch vụ thực hiện</th>
                    <th>Ngày hẹn</th>
                    <th class="num">Tổng thu</th>
                    <th>Thanh toán</th>
                  </tr>
                </thead>
                <tbody>
                  ${completedPaid
                    .map((b) => {
                      const s = db.services.find((x) => x.service_id === b.service_id);
                      return `
                      <tr>
                        <td class="num"><strong>#${b.booking_id}</strong></td>
                        <td>${s ? s.title : ''}</td>
                        <td class="num">${formatDateTime(b.scheduled_time)}</td>
                        <td class="num"><strong>${formatMoney(b.total_amount + b.total_incidental)}</strong></td>
                        <td>${paymentBadge(b.payment_status)}</td>
                      </tr>`;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel form-stack">
            <h2 class="panel-title">Nhận xét của khách hàng dành cho bạn (${myReviews.length})</h2>
            ${myReviews
              .map(
                (r) => `
              <div class="panel-subtle" style="display:flex; justify-content:space-between; gap:12px;">
                <div>
                  ${Icons.starRow(r.rating)}
                  <div style="margin-top:4px; font-size:13.5px;">"${r.comment}"</div>
                </div>
                <span class="field-hint num">Đơn #${r.booking_id}</span>
              </div>`
              )
              .join('')}
          </div>
        </div>

        <div class="col-5 form-stack">
          <div class="panel form-stack">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">Lịch làm việc định kỳ (availability_schedules)</h2>
              <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.openModal('2.8')">Sửa lịch</button>
            </div>
            ${schedules
              .map(
                (s) => `
              <div class="slip-row">
                <strong>${dayNames[s.day_of_week]}</strong>
                <span class="slip-dots"></span>
                <span class="badge badge-positive num">${s.start_time} – ${s.end_time}</span>
              </div>`
              )
              .join('')}
          </div>

          <div class="panel form-stack">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">Lịch nghỉ phép đột xuất (availability_exceptions)</h2>
              <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.openModal('2.9')">+ Thêm</button>
            </div>
            ${exceptions
              .map(
                (e) => `
              <div class="panel-subtle">
                <div style="display:flex; justify-content:space-between;">
                  <strong class="num">Ngày ${e.exception_date}</strong>
                  <span class="badge badge-warning">${e.start_time} – ${e.end_time}</span>
                </div>
                <div class="field-hint" style="margin-top:4px;">Lý do: ${e.reason}</div>
              </div>`
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  }

  // 2.4: Cấu hình Năng lực & Khu vực
  function renderScreen_2_4(container) {
    const db = window.GDX_DB;
    const prov = db.provider_profiles.find((p) => p.provider_id === state.activeProviderId) || db.provider_profiles[0];
    const mySvcIds = db.provider_services
      .filter((ps) => ps.provider_id === state.activeProviderId)
      .map((ps) => ps.service_id);
    const myWardIds = db.provider_areas
      .filter((pa) => pa.provider_id === state.activeProviderId)
      .map((pa) => pa.ward_id);

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">2.4. Cấu hình Chuyên môn &amp; Khu vực nhận việc</h1>
          <p class="screen-finding">Bảng: provider_profiles, provider_services, provider_areas.</p>
        </div>
      </div>

      <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.saveProviderConfig(this);">
        <div class="panel form-stack">
          <div style="display:flex; align-items:center; gap:14px;">
            <img src="${prov.avatar_url}" alt="Avatar" class="provider-avatar-lg">
            <div>
              <h2 class="panel-title">Hồ sơ công khai &amp; Giới thiệu kinh nghiệm</h2>
              <div class="field-hint">Trạng thái xác minh: <strong style="color:var(--positive);">${prov.verification_status}</strong> · Số CCCD: <span class="num">${prov.id_card_number}</span></div>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label" for="cfgProvInfo">Giới thiệu kinh nghiệm hiển thị với khách hàng (provider_profiles.info)</label>
            <textarea id="cfgProvInfo" name="info" class="textarea" rows="2" required>${prov.info}</textarea>
          </div>
        </div>

        <div class="panel form-stack">
          <h2 class="panel-title">Danh mục dịch vụ đăng ký thực hiện (provider_services)</h2>
          <div class="choice-grid-2">
            ${db.services
              .filter((s) => s.is_active)
              .map(
                (s) => `
              <label class="choice-card">
                <input type="checkbox" name="serviceIds" value="${s.service_id}" ${mySvcIds.includes(s.service_id) ? 'checked' : ''}>
                <div>
                  <div style="font-weight:600;">${s.title}</div>
                  <div class="field-hint num">${formatMoney(s.price)}${s.pricing_type === 'hourly' ? '/giờ' : '/ca'} · ~${s.estimated_duration} phút</div>
                </div>
              </label>`
              )
              .join('')}
          </div>
        </div>

        <div class="panel form-stack">
          <h2 class="panel-title">Phường / Xã đăng ký hoạt động (provider_areas)</h2>
          <div class="choice-grid-3">
            ${db.ward
              .filter((w) => w.provinceId === '79')
              .map(
                (w) => `
              <label class="choice-card">
                <input type="checkbox" name="wardIds" value="${w.ward_id}" ${myWardIds.includes(w.ward_id) ? 'checked' : ''}>
                <div>
                  <div style="font-weight:600;">${w.name}</div>
                  <div class="field-hint num">Mã: ${w.ward_id}</div>
                </div>
              </label>`
              )
              .join('')}
          </div>
          <div style="display:flex; justify-content:flex-end;">
            <button type="submit" class="btn btn-primary">Lưu cấu hình năng lực &amp; khu vực</button>
          </div>
        </div>
      </form>
    `;
  }

  function saveProviderConfig(form) {
    const prov = window.GDX_DB.provider_profiles.find((p) => p.provider_id === state.activeProviderId);
    if (prov && form.info) prov.info = form.info.value;
    showToast('Đã lưu cấu hình chuyên môn và khu vực nhận việc!');
    go('2.4');
  }


  // =====================================================================
  // SCREEN RENDERERS: PHÂN HỆ 3 (ADMIN PORTAL: 3.1 – 3.4)
  // =====================================================================

  // 3.1: Tổng quan Vận hành & Điều phối Đơn hàng
  function renderScreen_3_1(container) {
    const db = window.GDX_DB;
    const totalRevenue = db.bookings
      .filter((b) => b.payment_status === 'paid')
      .reduce((sum, b) => sum + b.total_amount + b.total_incidental, 0);
    const pendingKycCount = db.provider_profiles.filter((p) => p.verification_status === 'pending').length;
    const openTicketsCount = db.support_tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed').length;

    const filteredBookings =
      state.adminDispatchFilter === 'all'
        ? db.bookings
        : db.bookings.filter((b) => b.status === state.adminDispatchFilter);

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">3.1. Trung tâm Điều phối Đơn hàng &amp; Giám sát Vận hành</h1>
          <p class="screen-finding">Toàn quyền RLS is_admin() = TRUE trên bảng bookings, booking_status_history, support_tickets.</p>
        </div>
        <div class="screen-actions">
          <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.go('3.3')">
            Duyệt hồ sơ KYC (${pendingKycCount})
          </button>
          <button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.go('3.2')">
            Quản lý Dịch vụ &amp; Biểu giá
          </button>
        </div>
      </div>

      <div class="kpi-strip">
        <div class="kpi-cell">
          <div class="kpi-label">Doanh thu đã thanh toán</div>
          <div class="kpi-value num" style="color:var(--accent);">${formatMoney(totalRevenue)}</div>
          <div class="kpi-sub">Từ ${db.bookings.filter((b) => b.payment_status === 'paid').length} đơn đã thu tiền</div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">Tổng số đơn đặt lịch</div>
          <div class="kpi-value num">${db.bookings.length} đơn</div>
          <div class="kpi-sub">${db.bookings.filter((b) => b.status === 'in_progress').length} ca đang làm · ${db.bookings.filter((b) => b.status === 'pending').length} chờ nhận</div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">Hồ sơ Thợ chờ duyệt KYC</div>
          <div class="kpi-value num" style="color:${pendingKycCount > 0 ? 'var(--warning)' : 'inherit'};">${pendingKycCount} hồ sơ</div>
          <div class="kpi-sub">${db.provider_profiles.filter((p) => p.verification_status === 'verified').length} đối tác đã xác minh</div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">Phiếu hỗ trợ đang mở</div>
          <div class="kpi-value num">${openTicketsCount} phiếu</div>
          <div class="kpi-sub">Cần bộ phận vận hành phản hồi</div>
        </div>
      </div>

      <div class="panel form-stack">
        <div class="panel-header" style="margin-bottom:0;">
          <h2 class="panel-title">Bảng điều phối toàn bộ lịch hẹn (${filteredBookings.length})</h2>
          <div class="filter-chips">
            <button type="button" class="filter-chip" aria-pressed="${state.adminDispatchFilter === 'all'}" onclick="GDXApp.setAdminDispatchFilter('all')">Tất cả</button>
            <button type="button" class="filter-chip" aria-pressed="${state.adminDispatchFilter === 'pending'}" onclick="GDXApp.setAdminDispatchFilter('pending')">Chờ nhận</button>
            <button type="button" class="filter-chip" aria-pressed="${state.adminDispatchFilter === 'in_progress'}" onclick="GDXApp.setAdminDispatchFilter('in_progress')">Đang làm</button>
            <button type="button" class="filter-chip" aria-pressed="${state.adminDispatchFilter === 'completed'}" onclick="GDXApp.setAdminDispatchFilter('completed')">Hoàn thành</button>
          </div>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Gói dịch vụ</th>
                <th>Đối tác Thợ</th>
                <th>Giờ hẹn</th>
                <th class="num">Tổng tiền</th>
                <th>Trạng thái</th>
                <th>Thanh toán</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${filteredBookings
                .map((b) => {
                  const cust = db.customer_profiles.find((c) => c.customer_id === b.customer_id);
                  const custU = cust ? db.users.find((u) => u.user_id === cust.user_id) : null;
                  const svc = db.services.find((s) => s.service_id === b.service_id);
                  const prov = db.provider_public_profiles.find((p) => p.provider_id === b.provider_id);

                  return `
                  <tr>
                    <td class="num"><strong>#${b.booking_id}</strong></td>
                    <td>${custU ? custU.full_name : 'Khách #' + b.customer_id}</td>
                    <td>${svc ? svc.title : ''}</td>
                    <td>${prov ? prov.full_name : '<span class="badge badge-warning">Chưa gán thợ</span>'}</td>
                    <td class="num">${formatDateTime(b.scheduled_time)}</td>
                    <td class="num"><strong>${formatMoney(b.total_amount + b.total_incidental)}</strong></td>
                    <td>${statusBadge(b.status)}</td>
                    <td>${paymentBadge(b.payment_status)}</td>
                    <td>
                      <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.openModal('3.5', {bookingId: ${b.booking_id}})">
                        Nhật ký &amp; Điều phối
                      </button>
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

  function setAdminDispatchFilter(f) {
    state.adminDispatchFilter = f;
    go('3.1');
  }

  // 3.2: Quản lý Danh mục & Bảng giá Dịch vụ
  function renderScreen_3_2(container) {
    const db = window.GDX_DB;
    const rootCats = db.service_categories.filter((c) => c.parent_id === null);

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">3.2. Quản lý Cây Danh mục &amp; Biểu giá Dịch vụ</h1>
          <p class="screen-finding">Bảng: service_categories (parent_id đệ quy), services (pricing_type, price, is_active).</p>
        </div>
        <div class="screen-actions">
          <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.openModal('3.6')">+ Thêm danh mục</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.openModal('3.7')">+ Thêm gói dịch vụ mới</button>
        </div>
      </div>

      <div class="grid-12">
        <div class="col-4">
          <div class="panel form-stack">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">Cây danh mục (service_categories)</h2>
              <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.openModal('3.6')">+ Thêm</button>
            </div>
            <div class="form-stack" style="gap:10px;">
              ${rootCats
                .map((rc) => {
                  const children = db.service_categories.filter((c) => c.parent_id === rc.category_id);
                  return `
                  <div class="panel-subtle" style="padding:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <strong>${rc.name}</strong>
                      <span class="field-hint num">ID #${rc.category_id}</span>
                    </div>
                    <div class="field-hint" style="margin-top:2px;">${rc.description}</div>
                    ${
                      children.length > 0
                        ? `<div style="margin-top:8px; padding-left:12px; border-left:2px solid var(--accent); display:flex; flex-direction:column; gap:6px;">
                            ${children
                              .map(
                                (ch) => `
                              <div style="display:flex; justify-content:space-between; font-size:13px;">
                                <span>↳ ${ch.name}</span>
                                <span class="field-hint num">#${ch.category_id}</span>
                              </div>`
                              )
                              .join('')}
                          </div>`
                        : ''
                    }
                  </div>`;
                })
                .join('')}
            </div>
          </div>
        </div>

        <div class="col-8">
          <div class="panel form-stack">
            <h2 class="panel-title">Bảng giá niêm yết các gói dịch vụ (services)</h2>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Gói dịch vụ</th>
                    <th>Danh mục</th>
                    <th>Cách tính</th>
                    <th class="num">Thời lượng</th>
                    <th class="num">Đơn giá</th>
                    <th>Mở bán</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${db.services
                    .map((s) => {
                      const cat = db.service_categories.find((c) => c.category_id === s.category_id);
                      return `
                      <tr>
                        <td>
                          <div style="display:flex; align-items:center; gap:10px;">
                            <img src="${s.image_url || 'assets/service-cleaning.jpg'}" alt="${s.title}" style="width:44px; height:32px; border-radius:4px; object-fit:cover;">
                            <strong>${s.title}</strong>
                          </div>
                        </td>
                        <td>${cat ? cat.name : ''}</td>
                        <td><span class="badge badge-info">${s.pricing_type === 'hourly' ? 'Theo giờ' : 'Trọn gói'}</span></td>
                        <td class="num">${s.estimated_duration} phút</td>
                        <td class="num"><strong>${formatMoney(s.price)}</strong></td>
                        <td>
                          <label class="toggle-switch">
                            <input type="checkbox" ${s.is_active ? 'checked' : ''} onchange="GDXApp.toggleServiceActive(${s.service_id})">
                            <span>${s.is_active ? 'Đang mở' : 'Tạm ẩn'}</span>
                          </label>
                        </td>
                        <td>
                          <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.openModal('3.7', {serviceId: ${s.service_id}})">
                            Sửa giá
                          </button>
                        </td>
                      </tr>`;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function toggleServiceActive(serviceId) {
    const svc = window.GDX_DB.services.find((s) => s.service_id === serviceId);
    if (!svc) return;
    svc.is_active = !svc.is_active;
    apiRequest(`/api/admin/services/${serviceId}/toggle`, { method: 'PATCH' });
    showToast(`Gói "${svc.title}": ${svc.is_active ? 'Đã mở bán' : 'Đã tạm ẩn'}`);
    go('3.2');
  }

  // 3.3: Xét duyệt Hồ sơ Thợ (KYC Verification)
  function renderScreen_3_3(container) {
    const db = window.GDX_DB;

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">3.3. Xét duyệt Hồ sơ pháp lý Đối tác Thợ (KYC Verification)</h1>
          <p class="screen-finding">Bảng: provider_profiles (id_card_number, verification_status), provider_services, provider_areas.</p>
        </div>
      </div>

      <div class="form-stack">
        ${db.provider_profiles
          .map((p) => {
            const u = db.users.find((x) => x.user_id === p.user_id);
            const skills = db.provider_services
              .filter((ps) => ps.provider_id === p.provider_id)
              .map((ps) => {
                const s = db.services.find((x) => x.service_id === ps.service_id);
                return s ? s.title : '';
              });
            const areas = db.provider_areas
              .filter((pa) => pa.provider_id === p.provider_id)
              .map((pa) => {
                const w = db.ward.find((x) => x.ward_id === pa.ward_id);
                return w ? w.name : pa.ward_id;
              });

            return `
            <article class="panel" style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
              <div style="display:flex; gap:14px; align-items:flex-start; flex:1; min-width:280px;">
                <img src="${p.avatar_url}" alt="${u ? u.full_name : ''}" class="provider-avatar-lg">
                <div>
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <strong style="font-size:16px;">${u ? u.full_name : 'Đối tác #' + p.provider_id}</strong>
                    <span class="badge ${
                      p.verification_status === 'verified'
                        ? 'badge-positive'
                        : p.verification_status === 'pending'
                        ? 'badge-warning'
                        : 'badge-negative'
                    }">
                      ${p.verification_status}
                    </span>
                    <span class="field-hint num">CCCD: <strong>${p.id_card_number}</strong> · SĐT: ${u ? u.phone_number : ''}</span>
                  </div>
                  <p class="field-hint" style="margin-top:4px;">${p.info}</p>
                  <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
                    ${skills.map((sk) => `<span class="badge badge-info">${sk}</span>`).join('')}
                    ${areas.map((ar) => `<span class="badge badge-neutral">${ar}</span>`).join('')}
                  </div>
                </div>
              </div>

              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.openModal('3.8', {providerId: ${p.provider_id}})">
                  Xem chi tiết CCCD
                </button>
                ${
                  p.verification_status !== 'verified'
                    ? `<button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.updateProviderKyc(${p.provider_id}, 'verified')">Phê duyệt (verified)</button>`
                    : ''
                }
                ${
                  p.verification_status !== 'rejected'
                    ? `<button type="button" class="btn btn-danger btn-sm" onclick="GDXApp.updateProviderKyc(${p.provider_id}, 'rejected')">Từ chối</button>`
                    : ''
                }
              </div>
            </article>`;
          })
          .join('')}
      </div>
    `;
  }

  function updateProviderKyc(providerId, newStatus) {
    const db = window.GDX_DB;
    const prov = db.provider_profiles.find((p) => p.provider_id === providerId);
    if (!prov) return;
    prov.verification_status = newStatus;
    const u = db.users.find((x) => x.user_id === prov.user_id);

    if (newStatus === 'verified') {
      const exists = db.provider_public_profiles.some((p) => p.provider_id === providerId);
      if (!exists) {
        db.provider_public_profiles.push({
          provider_id: prov.provider_id,
          user_id: prov.user_id,
          full_name: u ? u.full_name : 'Đối tác mới',
          avatar_url: prov.avatar_url,
          info: prov.info,
          average_rating: prov.average_rating,
          total_reviews: prov.total_reviews,
          is_available_online: prov.is_available_online,
          verification_status: 'verified'
        });
      }
    } else {
      db.provider_public_profiles = db.provider_public_profiles.filter((p) => p.provider_id !== providerId);
    }

    apiRequest(`/api/admin/kyc/${providerId}`, {
      method: 'PATCH',
      body: JSON.stringify({ verification_status: newStatus })
    });
    showToast(`Đã cập nhật hồ sơ #${providerId} sang trạng thái: ${newStatus}`);
    closeModal();
    if (state.currentScreen === '3.3') go('3.3');
  }

  // 3.4: Quản lý Người dùng, Khiếu nại & Đánh giá
  function renderScreen_3_4(container) {
    const db = window.GDX_DB;

    container.innerHTML = `
      <div class="screen-header">
        <div>
          <h1 class="screen-title">3.4. Quản trị Tài khoản, Giải quyết Khiếu nại &amp; Kiểm duyệt Đánh giá</h1>
          <p class="screen-finding">Bảng: users (is_active), support_tickets (priority, status), reviews.</p>
        </div>
      </div>

      <div class="grid-12">
        <div class="col-7 form-stack">
          <div class="panel form-stack">
            <h2 class="panel-title">Danh sách Tài khoản hệ thống (users)</h2>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Họ và tên</th>
                    <th>Số điện thoại</th>
                    <th>Vai trò</th>
                    <th>Quyền truy cập (is_active)</th>
                  </tr>
                </thead>
                <tbody>
                  ${db.users
                    .map(
                      (u) => `
                    <tr>
                      <td class="num">#${u.user_id}</td>
                      <td><strong>${u.full_name}</strong></td>
                      <td class="num">${u.phone_number}</td>
                      <td><span class="badge badge-info">${u.role}</span></td>
                      <td>
                        <label class="toggle-switch">
                          <input type="checkbox" ${u.is_active ? 'checked' : ''} onchange="GDXApp.toggleUserActive(${u.user_id})">
                          <span>${u.is_active ? 'Hoạt động' : 'Đang khóa'}</span>
                        </label>
                      </td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel form-stack">
            <h2 class="panel-title">Kiểm duyệt Nhận xét &amp; Đánh giá (reviews)</h2>
            ${db.reviews
              .map(
                (r) => `
              <div class="panel-subtle" style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
                <div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    ${Icons.starRow(r.rating)}
                    <span class="field-hint num">Đơn #${r.booking_id} · Thợ #${r.provider_id}</span>
                  </div>
                  <div style="margin-top:4px; font-size:13.5px;">"${r.comment}"</div>
                </div>
                <button type="button" class="btn btn-danger btn-sm" onclick="GDXApp.deleteReview(${r.review_id})">
                  Gỡ nhận xét
                </button>
              </div>`
              )
              .join('')}
          </div>
        </div>

        <div class="col-5 form-stack">
          <div class="panel form-stack">
            <h2 class="panel-title">Danh sách Phiếu hỗ trợ &amp; Khiếu nại (support_tickets)</h2>
            ${db.support_tickets
              .map((t) => {
                const u = db.users.find((x) => x.user_id === t.user_id);
                return `
                <div class="panel-subtle form-stack" style="gap:8px;">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="field-hint num">Phiếu #${t.ticket_id} · Đơn #${t.booking_id}</span>
                    ${priorityBadge(t.priority)}
                  </div>
                  <div style="font-weight:600; font-size:14px;">${t.subject}</div>
                  <div class="field-hint">Người gửi: ${u ? u.full_name : ''} · Trạng thái: <strong>${t.status}</strong></div>
                  <div style="display:flex; justify-content:flex-end;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.openModal('3.9', {ticketId: ${t.ticket_id}})">
                      Xử lý phiếu hỗ trợ &rarr;
                    </button>
                  </div>
                </div>`;
              })
              .join('')}
          </div>
        </div>
      </div>
    `;
  }

  function toggleUserActive(userId) {
    const u = window.GDX_DB.users.find((x) => x.user_id === userId);
    if (!u) return;
    u.is_active = !u.is_active;
    apiRequest(`/api/admin/users/${userId}/toggle-active`, { method: 'PATCH' });
    showToast(`Tài khoản ${u.full_name}: ${u.is_active ? 'Đã mở khóa' : 'Đã tạm khóa'}`);
    go('3.4');
  }

  function deleteReview(reviewId) {
    const db = window.GDX_DB;
    db.reviews = db.reviews.filter((r) => r.review_id !== reviewId);
    apiRequest(`/api/admin/reviews/${reviewId}`, { method: 'DELETE' });
    showToast(`Đã gỡ đánh giá #${reviewId} và cập nhật lại điểm trung bình thợ`);
    go('3.4');
  }

  // =====================================================================
  // 15 MODALS & DRAWERS (1.7 – 1.11, 2.6 – 2.9, 3.5 – 3.9, SUPABASE_STATUS, CATALOG)
  // =====================================================================
  function openModal(modalId, params = {}) {
    const dialog = document.getElementById('appModal');
    const content = document.getElementById('modalInnerContent');
    if (!dialog || !content) return;

    dialog.className = 'modal-dialog';
    if (modalId === '1.7' || modalId === '1.11' || modalId === '3.5') {
      dialog.classList.add('is-drawer');
    }

    switch (modalId) {
      case '1.7': renderModal_1_7(content, params); break;
      case '1.8': renderModal_1_8(content, params); break;
      case '1.9': renderModal_1_9(content, params); break;
      case '1.10': renderModal_1_10(content, params); break;
      case '1.11': renderModal_1_11(content, params); break;

      case '2.6': renderModal_2_6(content, params); break;
      case '2.7': renderModal_2_7(content, params); break;
      case '2.8': renderModal_2_8(content, params); break;
      case '2.9': renderModal_2_9(content, params); break;

      case '3.5': renderModal_3_5(content, params); break;
      case '3.6': renderModal_3_6(content, params); break;
      case '3.7': renderModal_3_7(content, params); break;
      case '3.8': renderModal_3_8(content, params); break;
      case '3.9': renderModal_3_9(content, params); break;

      case 'SUPABASE_STATUS': renderModal_SupabaseStatus(content); break;
      case 'CATALOG': renderModal_Catalog(content); break;
      default:
        content.innerHTML = `<div class="modal-body"><p>Hộp thoại ${modalId}</p></div>`;
    }

    applyUserModeCleanups(content, modalId);
    if (!dialog.open) {
      dialog.showModal();
    }
  }

  function closeModal() {
    const dialog = document.getElementById('appModal');
    if (dialog && dialog.open) {
      closeTopLayer(dialog);
    }
  }

  // 1.7: Hồ sơ công khai của Thợ & Lịch rảnh tuần (Drawer / Schedule Dialog)
  function renderModal_1_7(el, params = {}) {
    const db = window.GDX_DB;
    const provId = params.providerId || 201;
    const p = db.provider_public_profiles.find((x) => x.provider_id === provId) || db.provider_public_profiles[0];
    const revs = db.reviews.filter((r) => r.provider_id === p.provider_id);
    const skillIds = db.provider_services.filter((ps) => ps.provider_id === p.provider_id).map((ps) => ps.service_id);
    const skills = db.services.filter((s) => skillIds.includes(s.service_id));
    const schedules = db.availability_schedules.filter((a) => a.provider_id === p.provider_id && a.is_available);
    const exceptions = db.availability_exceptions.filter((e) => e.provider_id === p.provider_id && !e.is_available);

    const days = [
      { dow: 1, label: 'Thứ 2' },
      { dow: 2, label: 'Thứ 3' },
      { dow: 3, label: 'Thứ 4' },
      { dow: 4, label: 'Thứ 5' },
      { dow: 5, label: 'Thứ 6' },
      { dow: 6, label: 'Thứ 7' },
      { dow: 0, label: 'CN' }
    ];
    const shifts = [
      { id: 'morning', name: 'Ca Sáng', sub: '08h - 12h', iso: '2026-10-25T08:30' },
      { id: 'afternoon', name: 'Ca Chiều', sub: '13h - 17h', iso: '2026-10-25T13:30' },
      { id: 'evening', name: 'Ca Tối', sub: '17h - 21h', iso: '2026-10-25T18:00' }
    ];

    el.innerHTML = `
      <div class="modal-header">
        <div style="display:flex; align-items:center; gap:14px;">
          <img src="${p.avatar_url}" alt="${p.full_name}" class="provider-avatar-lg" style="width:60px; height:60px;">
          <div>
            <div class="modal-title">${p.full_name}</div>
            <div class="field-hint">
              <span class="star-rating num">${Icons.star(true)} ${Number(p.average_rating).toFixed(2)}</span> (${p.total_reviews} đánh giá) · Đã xác minh CCCD
            </div>
          </div>
        </div>
        <button type="button" class="ghost-btn btn-sm" onclick="GDXApp.closeModal()">Đóng ✕</button>
      </div>
      <div class="modal-body form-stack">
        <div class="panel-subtle">
          <strong style="font-family:var(--font-heading);">Giới thiệu kinh nghiệm:</strong>
          <p class="field-hint" style="margin-top:4px;">${p.info}</p>
        </div>

        <!-- Weekly Schedule Matrix (from availability_schedules & availability_exceptions) -->
        <div>
          <strong style="font-family:var(--font-heading); font-size:0.9375rem;">
            Lịch làm việc trong tuần (availability_schedules):
          </strong>
          <p class="field-hint" style="margin-top:2px;">
            Bấm vào ô <strong style="color:var(--color-primary);">Trống</strong> để chọn nhanh ca hẹn với ${p.full_name}:
          </p>
          <div class="schedule-table-wrap">
            <table class="schedule-table">
              <thead>
                <tr>
                  <th>Ca / Ngày</th>
                  ${days.map((d) => `<th>${d.label}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${shifts
                  .map(
                    (sh, sIdx) => `
                  <tr>
                    <td class="shift-name">${sh.name}<br><small>${sh.sub}</small></td>
                    ${days
                      .map((d) => {
                        const hasSchedule =
                          schedules.length === 0 || schedules.some((sc) => Number(sc.day_of_week) === d.dow);
                        const isEveningOff = sIdx === 2 && (d.dow === 0 || d.dow === 3);
                        const isAvail = hasSchedule && !isEveningOff;
                        return `
                        <td>
                          ${
                            isAvail
                              ? `<button type="button" class="slot-btn is-available" onclick="GDXApp.selectScheduleSlotInModal(this, '${d.label} - ${sh.name} (${sh.sub})', '${sh.iso}')">Trống</button>`
                              : `<span class="slot-btn is-busy">Nghỉ</span>`
                          }
                        </td>`;
                      })
                      .join('')}
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          ${
            exceptions.length > 0
              ? `<div class="field-hint" style="margin-bottom:8px;">Lưu ý ngày nghỉ đột xuất (availability_exceptions): <strong>${exceptions.map((ex) => `${ex.exception_date} (${ex.reason || 'Bận cá nhân'})`).join(', ')}</strong></div>`
              : ''
          }
          <div class="selected-slot-box" id="modalSelectedSlotBox">
            <span style="font-size:0.875rem; font-weight:600; color:var(--color-primary);">Ca hẹn đã chọn:</span>
            <strong id="modalSelectedSlotLabel" style="font-family:var(--font-heading); color:var(--color-primary);">Sáng mai (08h - 12h)</strong>
          </div>
        </div>

        <div>
          <strong style="font-family:var(--font-heading); font-size:0.9375rem;">Các gói dịch vụ đảm nhận (${skills.length}):</strong>
          <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
            ${skills
              .map(
                (s) => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border:1px solid var(--color-border); border-radius:10px;">
                <span style="font-weight:500;">${s.title}</span>
                <strong class="num" style="color:var(--color-primary);">${formatMoney(s.price)}${s.pricing_type === 'hourly' ? '/giờ' : '/lần'}</strong>
              </div>`
              )
              .join('')}
          </div>
        </div>

        <div>
          <strong style="font-family:var(--font-heading); font-size:0.9375rem;">Nhận xét thực tế từ khách hàng (${revs.length}):</strong>
          <div class="form-stack" style="gap:8px; margin-top:8px;">
            ${revs
              .map(
                (r) => `
              <div class="panel-subtle">
                <div style="display:flex; justify-content:space-between;">
                  ${Icons.starRow(r.rating)}
                  <span class="field-hint num">Đơn #${r.booking_id}</span>
                </div>
                <div style="margin-top:4px; font-size:0.875rem;">"${r.comment}"</div>
              </div>`
              )
              .join('')}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="ghost-btn" onclick="GDXApp.closeModal()">Đóng</button>
        <button type="button" class="primary-btn" onclick="GDXApp.closeModal(); GDXApp.go('1.2', {serviceId: ${skills[0] ? skills[0].service_id : 101}, providerId: ${p.provider_id}})">
          Tiếp tục đặt lịch với ${p.full_name} &rarr;
        </button>
      </div>
    `;
  }

  function selectScheduleSlotInModal(btn, label, isoTime) {
    const dialog = document.getElementById('appModal');
    if (dialog) {
      dialog.querySelectorAll('.slot-btn.is-selected').forEach((b) => {
        b.classList.remove('is-selected');
        b.classList.add('is-available');
        b.textContent = 'Trống';
      });
    }
    btn.classList.remove('is-available');
    btn.classList.add('is-selected');
    btn.textContent = '✓ Chọn';
    const labelEl = document.getElementById('modalSelectedSlotLabel');
    if (labelEl) labelEl.textContent = label;
    if (isoTime) state.wizardDraft.scheduled_time = isoTime;
  }

  // 1.8: Cổng Thanh toán hóa đơn (Checkout Modal)
  function renderModal_1_8(el, params = {}) {
    const db = window.GDX_DB;
    const bk = db.bookings.find((b) => b.booking_id === (params.bookingId || 1042)) || db.bookings[0];
    const svc = db.services.find((s) => s.service_id === bk.service_id);
    const total = bk.total_amount + bk.total_incidental;
    state.checkoutSelectedPayMethod = 'bank';

    el.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="modal-title">1.8. Xác nhận Thanh toán Hóa đơn #${bk.booking_id}</div>
          <div class="field-hint">Kiểm tra chi phí dịch vụ và chọn phương thức thanh toán</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.closeModal()">✕</button>
      </div>
      <div class="modal-body form-stack">
        <div class="panel-subtle form-stack" style="gap:8px;">
          <div class="slip-row">
            <span>Gói dịch vụ</span>
            <span class="slip-dots"></span>
            <strong>${svc ? svc.title : 'Dịch vụ'}</strong>
          </div>
          <div class="slip-row">
            <span>Phí dịch vụ cơ bản</span>
            <span class="slip-dots"></span>
            <strong class="num">${formatMoney(bk.total_amount)}</strong>
          </div>
          <div class="slip-row">
            <span>Chi phí vật tư phát sinh</span>
            <span class="slip-dots"></span>
            <strong class="num">${formatMoney(bk.total_incidental)}</strong>
          </div>
          <div class="slip-total">
            <strong>Tổng số tiền thanh toán</strong>
            <span class="slip-total-price num">${formatMoney(total)}</span>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">Chọn phương thức thanh toán</label>
          <div class="choice-grid-2">
            <label class="choice-card is-selected" id="payMethodBankCard" style="cursor:pointer;" onclick="GDXApp.setCheckoutPayMethod('bank')">
              <input type="radio" name="payMethod" value="bank" checked>
              <div>
                <div style="font-weight:600; display:flex; align-items:center; gap:6px;">
                  <span>Chuyển khoản VietQR</span>
                  <span class="badge badge-primary" style="font-size:11px; padding:1px 6px;">Napas 24/7</span>
                </div>
                <div class="field-hint">Quét mã QR chuyển khoản tự động qua ngân hàng</div>
              </div>
            </label>
            <label class="choice-card" id="payMethodCashCard" style="cursor:pointer;" onclick="GDXApp.setCheckoutPayMethod('cash')">
              <input type="radio" name="payMethod" value="cash">
              <div>
                <div style="font-weight:600;">Tiền mặt khi nghiệm thu</div>
                <div class="field-hint">Thanh toán trực tiếp sau khi kiểm tra kết quả</div>
              </div>
            </label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Để sau</button>
        <button type="button" class="btn btn-primary" onclick="GDXApp.submitInvoicePayment(${bk.booking_id})">
          Xác nhận thanh toán (${formatMoney(total)}) &rarr;
        </button>
      </div>
    `;
  }

  function setCheckoutPayMethod(method) {
    state.checkoutSelectedPayMethod = method;
    const bCard = document.getElementById('payMethodBankCard');
    const cCard = document.getElementById('payMethodCashCard');
    if (bCard && cCard) {
      if (method === 'bank') {
        bCard.classList.add('is-selected');
        cCard.classList.remove('is-selected');
        const r = bCard.querySelector('input[type="radio"]');
        if (r) r.checked = true;
      } else {
        cCard.classList.add('is-selected');
        bCard.classList.remove('is-selected');
        const r = cCard.querySelector('input[type="radio"]');
        if (r) r.checked = true;
      }
    }
  }

  function submitInvoicePayment(bookingId) {
    const method = state.checkoutSelectedPayMethod || 'bank';
    closeModal();
    if (method === 'bank') {
      go('1.8', { bookingId, payMethod: 'bank' });
    } else {
      confirmBookingPayment(bookingId, 'CASH');
    }
  }

  function confirmBookingPayment(bookingId, method = 'CASH') {
    const bk = window.GDX_DB.bookings.find((b) => b.booking_id === bookingId);
    if (bk) bk.payment_status = 'paid';
    apiRequest(`/api/bookings/${bookingId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ booking_id: bookingId, method, changed_by: state.activeUserId || 1 })
    });
    closeModal();
    showToast(`Đã ghi nhận thanh toán hóa đơn #${bookingId} thành công!`);
    go(state.currentScreen, { bookingId });
  }

  let qrTimerInterval = null;

  // 1.8: Trang quét QR Chuyển khoản giả định (VietQR Payment Gateway)
  function renderScreen_1_8(container, params = {}) {
    if (qrTimerInterval) {
      clearInterval(qrTimerInterval);
      qrTimerInterval = null;
    }

    const db = window.GDX_DB;
    const bookingId = Number(params.bookingId) || 1042;
    const bk = db.bookings.find((b) => b.booking_id === bookingId) || db.bookings[0];
    const svc = db.services.find((s) => s.service_id === bk.service_id);
    const total = (bk.total_amount || 0) + (bk.total_incidental || 0);
    const transferMemo = `GDX${bk.booking_id}`;

    container.innerHTML = `
      <div class="vietqr-page-container">
        <!-- Breadcrumb / Back link -->
        <div style="margin-bottom:16px;">
          <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.cancelQrPayment(${bk.booking_id})" style="display:inline-flex; align-items:center; gap:6px;">
            &larr; Quay lại Theo dõi đơn hàng #${bk.booking_id}
          </button>
        </div>

        <!-- Header bar -->
        <div class="vietqr-header-bar">
          <div class="vietqr-header-left">
            <span class="vietqr-brand-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              VIETQR · NAPAS 24/7
            </span>
            <div>
              <strong style="font-size:0.95rem; color:var(--color-secondary);">Cổng Thanh toán Trực tuyến VietQR Pro</strong>
              <div class="field-hint" style="font-size:0.8rem;">Ngân hàng thụ hưởng: Vietcombank (Ngân hàng Ngoại thương Việt Nam)</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div class="field-hint" style="font-size:0.8rem;">Mã hóa đơn</div>
            <strong class="num" style="font-size:1.05rem; color:var(--color-primary);">#GDX-${bk.booking_id}</strong>
          </div>
        </div>

        <!-- Main QR and Info Grid -->
        <div class="vietqr-checkout-grid" id="vietqrMainGrid">
          <!-- Left: QR Code Box -->
          <div class="vietqr-qr-panel">
            <div style="font-weight:700; font-size:0.875rem; color:#005baa; margin-bottom:12px; letter-spacing:0.5px;">
              QUÉT MÃ ĐỂ THANH TOÁN
            </div>

            <div class="vietqr-frame">
              <span class="vietqr-frame-corner top-left"></span>
              <span class="vietqr-frame-corner top-right"></span>
              <span class="vietqr-frame-corner bottom-left"></span>
              <span class="vietqr-frame-corner bottom-right"></span>
              <img src="assets/rickroll-vietqr.svg" alt="Mã VietQR Chuyển khoản" class="vietqr-code-img">
            </div>

            <div style="font-size:0.8125rem; color:var(--color-muted); line-height:1.45; margin-bottom:8px;">
              Sử dụng <strong>App Ngân hàng</strong> bất kỳ hoặc Ví <strong>MoMo / ZaloPay</strong> để quét mã QR chuyển khoản nhanh 24/7.
            </div>
            <div class="badge badge-neutral" style="font-size:0.75rem;">
              🔒 Chuẩn thanh toán mã hóa bảo mật
            </div>
          </div>

          <!-- Right: Details & Auto-Confirm Countdown -->
          <div class="vietqr-info-panel">
            <h2 style="font-size:1.1rem; font-family:var(--font-heading); font-weight:700; margin-bottom:14px; color:var(--color-secondary);">
              Thông tin chuyển khoản ngân hàng
            </h2>

            <div class="vietqr-data-list">
              <div class="vietqr-data-row">
                <span class="vietqr-data-label">Ngân hàng thụ hưởng</span>
                <div class="vietqr-data-val">Vietcombank (VCB)</div>
              </div>
              <div class="vietqr-data-row">
                <span class="vietqr-data-label">Chủ tài khoản</span>
                <div class="vietqr-data-val">CÔNG TY CP DỊCH VỤ GIA ĐÌNH XANH</div>
              </div>
              <div class="vietqr-data-row">
                <span class="vietqr-data-label">Số tài khoản</span>
                <div class="vietqr-data-val-group">
                  <span class="vietqr-data-val num" style="letter-spacing:1px; color:#005baa;">0888 668 999</span>
                  <button type="button" class="vietqr-copy-btn" onclick="GDXApp.copyText('0888668999', this)">Sao chép</button>
                </div>
              </div>
              <div class="vietqr-data-row">
                <span class="vietqr-data-label">Số tiền thanh toán</span>
                <div class="vietqr-data-val-group">
                  <span class="vietqr-data-val num" style="color:var(--color-primary); font-size:1.1rem;">${formatMoney(total)}</span>
                  <button type="button" class="vietqr-copy-btn" onclick="GDXApp.copyText('${total}', this)">Sao chép</button>
                </div>
              </div>
              <div class="vietqr-data-row">
                <span class="vietqr-data-label">Nội dung chuyển khoản</span>
                <div class="vietqr-data-val-group">
                  <span class="vietqr-data-val num" style="color:#b91c1c;">${transferMemo}</span>
                  <button type="button" class="vietqr-copy-btn" onclick="GDXApp.copyText('${transferMemo}', this)">Sao chép</button>
                </div>
              </div>
            </div>

            <!-- Auto Confirm Countdown Box (10s) -->
            <div class="vietqr-countdown-box" id="qrCountdownContainer">
              <div class="vietqr-countdown-header">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span class="spinner" style="width:16px; height:16px; border:2px solid #bbf7d0; border-top-color:#16a34a; border-radius:50%; animation:spin 0.8s linear infinite;"></span>
                  <strong style="color:#166534; font-size:0.9rem;">Hệ thống đang chờ giao dịch...</strong>
                </div>
                <div style="font-size:0.875rem; color:#15803d;">
                  Tự động xác nhận sau: <strong id="qrCountdownSec" class="num" style="font-size:1.15rem; color:#166534;">10s</strong>
                </div>
              </div>
              <div class="field-hint" style="margin:0; font-size:0.8rem; color:#15803d;">
                Sau khi quét mã, hệ thống tự động ghi nhận thanh toán lên cơ sở dữ liệu sau 10 giây.
              </div>
              <div class="vietqr-progress-track">
                <div id="qrProgressBar" class="vietqr-progress-bar" style="width: 0%;"></div>
              </div>
            </div>

            <!-- Action buttons -->
            <div style="display:flex; flex-direction:column; gap:10px;">
              <button type="button" class="btn btn-primary" style="height:44px; font-weight:700;" onclick="GDXApp.executeQrPaymentSuccess(${bk.booking_id})">
                ✓ Tôi đã chuyển khoản thành công &rarr;
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="GDXApp.cancelQrPayment(${bk.booking_id})">
                Đổi phương thức thanh toán / Hủy
              </button>
            </div>
          </div>
        </div>

        <!-- Success Result (Initially hidden) -->
        <div id="vietqrSuccessState" class="panel form-stack vietqr-success-card" style="display:none; max-width:600px; margin:20px auto;">
          <div class="vietqr-success-icon">✓</div>
          <h2 style="font-size:1.4rem; color:var(--color-primary); font-family:var(--font-heading); margin-bottom:4px;">
            Thanh toán Thành Công!
          </h2>
          <p class="field-hint" style="margin-bottom:16px;">
            Đã xác nhận giao dịch thanh toán <strong class="num">${formatMoney(total)}</strong> qua Vietcombank Napas 24/7.
          </p>
          <div class="panel-subtle" style="font-size:0.875rem; text-align:left; gap:8px;">
            <div class="slip-row">
              <span>Mã giao dịch ngân hàng</span>
              <span class="slip-dots"></span>
              <strong id="txIdDisplay" class="num">VCB-QR...</strong>
            </div>
            <div class="slip-row">
              <span>Đơn hàng</span>
              <span class="slip-dots"></span>
              <strong>#${bk.booking_id} (${svc ? svc.title : ''})</strong>
            </div>
            <div class="slip-row">
              <span>Trạng thái cơ sở dữ liệu</span>
              <span class="slip-dots"></span>
              <span class="badge badge-positive">bookings.payment_status = 'paid'</span>
            </div>
          </div>
          <div class="field-hint" style="margin-top:14px;">
            Đang chuyển về màn hình Theo dõi đơn hàng...
          </div>
        </div>
      </div>
    `;

    // Start 10-second countdown
    let remaining = 10;
    const progressEl = document.getElementById('qrProgressBar');
    const secEl = document.getElementById('qrCountdownSec');

    qrTimerInterval = setInterval(() => {
      remaining--;
      if (secEl) secEl.textContent = `${remaining}s`;
      if (progressEl) {
        const pct = ((10 - remaining) / 10) * 100;
        progressEl.style.width = `${pct}%`;
      }

      if (remaining <= 0) {
        clearInterval(qrTimerInterval);
        qrTimerInterval = null;
        executeQrPaymentSuccess(bookingId);
      }
    }, 1000);
  }

  async function executeQrPaymentSuccess(bookingId) {
    if (qrTimerInterval) {
      clearInterval(qrTimerInterval);
      qrTimerInterval = null;
    }

    const db = window.GDX_DB;
    const bk = db.bookings.find((b) => b.booking_id === bookingId);
    if (!bk) return;

    const total = (bk.total_amount || 0) + (bk.total_incidental || 0);
    const txId = 'VCB-QR' + Date.now().toString().slice(-7);
    const nowIso = new Date().toISOString();

    const mainGrid = document.getElementById('vietqrMainGrid');
    const successCard = document.getElementById('vietqrSuccessState');
    const txDisplay = document.getElementById('txIdDisplay');
    if (mainGrid) mainGrid.style.display = 'none';
    if (successCard) {
      successCard.style.display = 'block';
      if (txDisplay) txDisplay.textContent = txId;
    }

    bk.payment_status = 'paid';
    bk.paid_at = nowIso;
    bk.updated_at = nowIso;

    if (!Array.isArray(db.booking_status_history)) db.booking_status_history = [];
    db.booking_status_history.unshift({
      history_id: Date.now(),
      booking_id: bookingId,
      previous_status: bk.status,
      new_status: bk.status,
      changed_by: state.activeUserId || 1,
      reason: `[VIETQR AUTO-CONFIRM] Khách hàng quét mã QR chuyển khoản thành công ${formatMoney(total)} (Mã GD: ${txId})`,
      created_at: nowIso
    });

    try {
      await apiRequest(`/api/bookings/${bookingId}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          booking_id: bookingId,
          method: 'VIETQR_BANK_TRANSFER',
          transaction_id: txId,
          amount: total,
          changed_by: state.activeUserId || 1
        })
      });
    } catch (err) {
      console.warn('Payment API record warning:', err);
    }

    showToast(`🎉 Đã xác nhận thanh toán hóa đơn #${bookingId} thành công qua VietQR!`);

    setTimeout(() => {
      go('1.3', { bookingId });
    }, 1800);
  }

  function cancelQrPayment(bookingId) {
    if (qrTimerInterval) {
      clearInterval(qrTimerInterval);
      qrTimerInterval = null;
    }
    go('1.3', { bookingId });
  }

  function copyText(text, btnEl) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    }
    if (btnEl) {
      const orig = btnEl.textContent;
      btnEl.textContent = '✓ Đã chép';
      btnEl.style.color = '#16a34a';
      setTimeout(() => {
        btnEl.textContent = orig;
        btnEl.style.color = '';
      }, 1500);
    }
  }

  // 1.9: Đánh giá & Chấm điểm Thợ
  function renderModal_1_9(el, params = {}) {
    const db = window.GDX_DB;
    const bk = db.bookings.find((b) => b.booking_id === (params.bookingId || 1040)) || db.bookings[1];
    const prov = db.provider_public_profiles.find((p) => p.provider_id === bk.provider_id);

    el.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="modal-title">1.9. Đánh giá chất lượng dịch vụ · Đơn #${bk.booking_id}</div>
          <div class="field-hint">Bảng: reviews (rating 1–5, comment), kích hoạt trigger trg_reviews_refresh_rating</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.closeModal()">✕</button>
      </div>
      <form onsubmit="event.preventDefault(); GDXApp.submitBookingReview(${bk.booking_id}, this);">
        <div class="modal-body form-stack">
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="${prov ? prov.avatar_url : 'assets/provider-tuan.jpg'}" alt="Thợ" style="width:48px; height:48px; border-radius:50%; object-fit:cover;">
            <div>
              <strong>Đối tác thực hiện: ${prov ? prov.full_name : 'Phạm Quốc Tuấn'}</strong>
              <div class="field-hint">Mỗi đánh giá giúp cộng đồng khách hàng chọn được thợ tận tâm</div>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Mức độ hài lòng của gia đình bạn (reviews.rating)</label>
            <div class="star-picker" id="reviewStarPicker">
              ${[1, 2, 3, 4, 5]
                .map(
                  (n) => `
                <button type="button" class="star-btn ${n <= state.reviewRating ? 'is-selected' : ''}" onclick="GDXApp.setReviewStars(${n}, ${bk.booking_id})">
                  ${Icons.star(n <= state.reviewRating)} ${n} sao
                </button>`
                )
                .join('')}
            </div>
          </div>

          <div class="field-group">
            <label class="field-label" for="revComment">Nhận xét chi tiết (reviews.comment)</label>
            <textarea id="revComment" name="comment" class="textarea" rows="3" required>Thợ đến đúng giờ, thao tác cẩn thận, dọn dẹp sạch sẽ khu vực làm việc trước khi ra về.</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Hủy</button>
          <button type="submit" class="btn btn-primary">Gửi đánh giá (${state.reviewRating} sao) &rarr;</button>
        </div>
      </form>
    `;
  }

  function setReviewStars(n, bookingId) {
    state.reviewRating = n;
    openModal('1.9', { bookingId });
  }

  function submitBookingReview(bookingId, form) {
    const db = window.GDX_DB;
    const bk = db.bookings.find((b) => b.booking_id === bookingId);
    if (!bk) return;

    db.reviews.unshift({
      review_id: Date.now(),
      booking_id: bookingId,
      customer_id: bk.customer_id,
      provider_id: bk.provider_id,
      rating: state.reviewRating,
      comment: form.comment.value,
      created_at: new Date().toISOString()
    });

    apiRequest('/api/reviews', {
      method: 'POST',
      body: JSON.stringify({
        booking_id: bookingId,
        customer_id: bk.customer_id,
        provider_id: bk.provider_id,
        rating: state.reviewRating,
        comment: form.comment.value
      })
    });

    closeModal();
    showToast('Cảm ơn bạn! Đánh giá đã được ghi nhận và cập nhật điểm uy tín của thợ.');
    go(state.currentScreen);
  }

  // 1.10: Xác nhận Hủy lịch hẹn
  function renderModal_1_10(el, params = {}) {
    const bookingId = params.bookingId || 1043;
    el.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="modal-title">1.10. Xác nhận Hủy lịch hẹn #${bookingId}</div>
          <div class="field-hint">Ghi lý do vào booking_status_history và chuyển status = 'cancelled'</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.closeModal()">✕</button>
      </div>
      <form onsubmit="event.preventDefault(); GDXApp.confirmCancelBooking(${bookingId}, this);">
        <div class="modal-body form-stack">
          <div class="field-group">
            <label class="field-label" for="cancelReason">Lý do hủy lịch hẹn (booking_status_history.reason - Bắt buộc)</label>
            <textarea id="cancelReason" name="reason" class="textarea" rows="3" required>Gia đình có việc đột xuất phải đi công tác, xin hẹn lại vào cuối tuần sau.</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Giữ lại lịch hẹn</button>
          <button type="submit" class="btn btn-danger">Xác nhận hủy đơn #${bookingId}</button>
        </div>
      </form>
    `;
  }

  function confirmCancelBooking(bookingId, form) {
    const db = window.GDX_DB;
    const bk = db.bookings.find((b) => b.booking_id === bookingId);
    if (bk) {
      const oldStatus = bk.status;
      bk.status = 'cancelled';
      db.booking_status_history.unshift({
        history_id: Date.now(),
        booking_id: bookingId,
        old_status: oldStatus,
        new_status: 'cancelled',
        changed_by: state.activeUserId,
        reason: form.reason.value,
        changed_at: new Date().toISOString()
      });
    }
    apiRequest(`/api/bookings/${bookingId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ user_id: state.activeUserId, reason: form.reason.value })
    });
    closeModal();
    showToast(`Đã hủy lịch hẹn #${bookingId}`);
    go(state.currentScreen);
  }

  // 1.11: Trung tâm Hỗ trợ & Gửi khiếu nại
  function renderModal_1_11(el, params = {}) {
    const db = window.GDX_DB;
    const myBookings = db.bookings.filter((b) => b.customer_id === state.activeCustomerId);
    const defaultBookingId = params.bookingId || (myBookings[0] ? myBookings[0].booking_id : 1042);

    el.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="modal-title">1.11. Trung tâm Hỗ trợ &amp; Gửi phiếu yêu cầu</div>
          <div class="field-hint">Bảng: support_tickets (user_id, booking_id, subject, description, priority, status)</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.closeModal()">Đóng ✕</button>
      </div>
      <form onsubmit="event.preventDefault(); GDXApp.submitSupportTicket(this);">
        <div class="modal-body form-stack">
          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label" for="tkBookingId">Đơn hàng liên quan (booking_id)</label>
              <select id="tkBookingId" name="booking_id" class="select">
                ${db.bookings
                  .map(
                    (b) => `<option value="${b.booking_id}" ${b.booking_id === defaultBookingId ? 'selected' : ''}>Đơn #${b.booking_id} (${b.status})</option>`
                  )
                  .join('')}
              </select>
            </div>
            <div class="field-group">
              <label class="field-label" for="tkPriority">Mức độ ưu tiên (ticket_priority)</label>
              <select id="tkPriority" name="priority" class="select">
                <option value="medium" selected>Trung bình (medium)</option>
                <option value="high">Cao (high)</option>
                <option value="urgent">Khẩn cấp (urgent)</option>
                <option value="low">Thấp (low)</option>
              </select>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label" for="tkSubject">Tiêu đề yêu cầu hỗ trợ (support_tickets.subject)</label>
            <input type="text" id="tkSubject" name="subject" class="input" required placeholder="Ví dụ: Cần hỗ trợ đổi giờ hẹn hoặc kiểm tra chi phí phát sinh">
          </div>

          <div class="field-group">
            <label class="field-label" for="tkDesc">Mô tả chi tiết sự việc (support_tickets.description)</label>
            <textarea id="tkDesc" name="description" class="textarea" rows="3" required placeholder="Nhập nội dung cần bộ phận điều phối hỗ trợ..."></textarea>
          </div>

          <div>
            <strong style="font-size:13.5px;">Các phiếu hỗ trợ đã gửi gần đây (${db.support_tickets.length}):</strong>
            <div class="form-stack" style="gap:8px; margin-top:8px;">
              ${db.support_tickets
                .map(
                  (t) => `
                <div class="panel-subtle">
                  <div style="display:flex; justify-content:space-between;">
                    <strong>#${t.ticket_id} · ${t.subject}</strong>
                    ${priorityBadge(t.priority)}
                  </div>
                  <div class="field-hint" style="margin-top:4px;">Đơn #${t.booking_id} · Trạng thái: <strong>${t.status}</strong></div>
                </div>`
                )
                .join('')}
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Đóng</button>
          <button type="submit" class="btn btn-primary">Gửi phiếu hỗ trợ &rarr;</button>
        </div>
      </form>
    `;
  }

  function submitSupportTicket(form) {
    const db = window.GDX_DB;
    const newTicket = {
      ticket_id: Date.now(),
      user_id: state.activeUserId,
      booking_id: Number(form.booking_id.value),
      subject: form.subject.value,
      description: form.description.value,
      priority: form.priority.value,
      status: 'open',
      created_at: new Date().toISOString()
    };
    db.support_tickets.unshift(newTicket);
    apiRequest('/api/support-tickets', {
      method: 'POST',
      body: JSON.stringify(newTicket)
    });
    closeModal();
    showToast('Đã gửi phiếu hỗ trợ tới bộ phận Quản trị!');
  }

  // 2.6: Kê khai Chi phí phát sinh
  function renderModal_2_6(el, params = {}) {
    const bk = window.GDX_DB.bookings.find((b) => b.booking_id === (params.bookingId || 1042)) || window.GDX_DB.bookings[0];
    el.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="modal-title">2.6. Kê khai Chi phí vật tư phát sinh · Đơn #${bk.booking_id}</div>
          <div class="field-hint">Cập nhật bookings.total_incidental và giải trình incidental_Specify</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.closeModal()">✕</button>
      </div>
      <form onsubmit="event.preventDefault(); GDXApp.saveIncidentalCost(${bk.booking_id}, this);">
        <div class="modal-body form-stack">
          <div class="field-group">
            <label class="field-label" for="incAmount">Số tiền vật tư phát sinh (VNĐ - total_incidental >= 0)</label>
            <input type="number" id="incAmount" name="total_incidental" class="input num" value="${bk.total_incidental || 30000}" min="0" step="5000" required>
          </div>
          <div class="field-group">
            <label class="field-label" for="incSpec">Giải trình chi tiết hạng mục (incidental_Specify)</label>
            <textarea id="incSpec" name="incidental_Specify" class="textarea" rows="3" required>${bk.incidental_Specify || 'Mua thêm 01 chai dung dịch tẩy cặn kính chuyên dụng theo sự đồng ý của chủ nhà'}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Hủy</button>
          <button type="submit" class="btn btn-primary">Lưu kê khai chi phí</button>
        </div>
      </form>
    `;
  }

  function saveIncidentalCost(bookingId, form) {
    const bk = window.GDX_DB.bookings.find((b) => b.booking_id === bookingId);
    if (bk) {
      bk.total_incidental = Number(form.total_incidental.value);
      bk.incidental_Specify = form.incidental_Specify.value;
    }
    apiRequest(`/api/bookings/${bookingId}/incidental`, {
      method: 'PATCH',
      body: JSON.stringify({
        total_incidental: Number(form.total_incidental.value),
        incidental_Specify: form.incidental_Specify.value
      })
    });
    closeModal();
    showToast('Đã cập nhật chi phí vật tư phát sinh!');
    go(state.currentScreen, { bookingId });
  }

  // 2.7: Nghiệm thu & Hoàn thành Ca
  function renderModal_2_7(el, params = {}) {
    const bk = window.GDX_DB.bookings.find((b) => b.booking_id === (params.bookingId || 1042)) || window.GDX_DB.bookings[0];
    el.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="modal-title">2.7. Nghiệm thu &amp; Hoàn thành Ca làm #${bk.booking_id}</div>
          <div class="field-hint">Chuyển status = 'completed' và ghi nhận vào booking_status_history</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.closeModal()">✕</button>
      </div>
      <div class="modal-body form-stack">
        <div class="panel-subtle form-stack" style="gap:8px;">
          <div class="slip-row">
            <span>Tiền công dịch vụ</span>
            <span class="slip-dots"></span>
            <strong class="num">${formatMoney(bk.total_amount)}</strong>
          </div>
          <div class="slip-row">
            <span>Vật tư phát sinh</span>
            <span class="slip-dots"></span>
            <strong class="num">${formatMoney(bk.total_incidental)}</strong>
          </div>
          <div class="slip-total">
            <strong>Tổng cộng nghiệm thu</strong>
            <span class="slip-total-price num">${formatMoney(bk.total_amount + bk.total_incidental)}</span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Quay lại</button>
        <button type="button" class="btn btn-primary" onclick="GDXApp.completeJobShift(${bk.booking_id})">
          Xác nhận hoàn thành ca làm &rarr;
        </button>
      </div>
    `;
  }

  function completeJobShift(bookingId) {
    const db = window.GDX_DB;
    const bk = db.bookings.find((b) => b.booking_id === bookingId);
    if (bk) {
      bk.status = 'completed';
      db.booking_status_history.unshift({
        history_id: Date.now(),
        booking_id: bookingId,
        old_status: 'in_progress',
        new_status: 'completed',
        changed_by: 4,
        reason: 'Hoàn tất nghiệm thu công việc tại nhà khách hàng',
        changed_at: new Date().toISOString()
      });
    }
    apiRequest(`/api/bookings/${bookingId}/complete`, { method: 'POST' });
    closeModal();
    showToast(`Đã hoàn tất nghiệm thu đơn #${bookingId}!`);
    go('2.3');
  }

  // 2.8: Thiết lập Lịch làm việc định kỳ
  function renderModal_2_8(el) {
    el.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="modal-title">2.8. Thiết lập Khung giờ làm việc định kỳ</div>
          <div class="field-hint">Bảng: availability_schedules (day_of_week 0–6, start_time < end_time)</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.closeModal()">✕</button>
      </div>
      <form onsubmit="event.preventDefault(); GDXApp.addWeeklySchedule(this);">
        <div class="modal-body form-stack">
          <div class="field-group">
            <label class="field-label" for="schDay">Thứ trong tuần (day_of_week)</label>
            <select id="schDay" name="day_of_week" class="select">
              <option value="1">Thứ Hai (1)</option>
              <option value="2">Thứ Ba (2)</option>
              <option value="3">Thứ Tư (3)</option>
              <option value="4">Thứ Năm (4)</option>
              <option value="5">Thứ Sáu (5)</option>
              <option value="6" selected>Thứ Bảy (6)</option>
              <option value="0">Chủ Nhật (0)</option>
            </select>
          </div>
          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label" for="schStart">Giờ bắt đầu (start_time)</label>
              <input type="time" id="schStart" name="start_time" class="input num" value="08:00" required>
            </div>
            <div class="field-group">
              <label class="field-label" for="schEnd">Giờ kết thúc (end_time)</label>
              <input type="time" id="schEnd" name="end_time" class="input num" value="17:30" required>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Hủy</button>
          <button type="submit" class="btn btn-primary">Lưu khung giờ làm việc</button>
        </div>
      </form>
    `;
  }

  function addWeeklySchedule(form) {
    window.GDX_DB.availability_schedules.push({
      availability_id: Date.now(),
      provider_id: state.activeProviderId,
      day_of_week: Number(form.day_of_week.value),
      start_time: form.start_time.value,
      end_time: form.end_time.value
    });
    closeModal();
    showToast('Đã cập nhật khung giờ làm việc định kỳ!');
    if (state.currentScreen === '2.3') go('2.3');
  }

  // 2.9: Đăng ký Nghỉ phép đột xuất
  function renderModal_2_9(el) {
    el.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="modal-title">2.9. Đăng ký Nghỉ phép / Bận đột xuất</div>
          <div class="field-hint">Bảng: availability_exceptions (exception_date, start_time, end_time, reason)</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.closeModal()">✕</button>
      </div>
      <form onsubmit="event.preventDefault(); GDXApp.addExceptionSchedule(this);">
        <div class="modal-body form-stack">
          <div class="field-group">
            <label class="field-label" for="excDate">Ngày xin nghỉ (exception_date)</label>
            <input type="date" id="excDate" name="exception_date" class="input num" value="2026-10-28" required>
          </div>
          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label" for="excStart">Từ giờ (start_time)</label>
              <input type="time" id="excStart" name="start_time" class="input num" value="08:00" required>
            </div>
            <div class="field-group">
              <label class="field-label" for="excEnd">Đến giờ (end_time)</label>
              <input type="time" id="excEnd" name="end_time" class="input num" value="18:00" required>
            </div>
          </div>
          <div class="field-group">
            <label class="field-label" for="excReason">Lý do nghỉ phép (reason)</label>
            <input type="text" id="excReason" name="reason" class="input" value="Về quê giải quyết việc gia đình" required>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Hủy</button>
          <button type="submit" class="btn btn-primary">Xác nhận đăng ký nghỉ</button>
        </div>
      </form>
    `;
  }

  function addExceptionSchedule(form) {
    window.GDX_DB.availability_exceptions.push({
      exception_id: Date.now(),
      provider_id: state.activeProviderId,
      exception_date: form.exception_date.value,
      start_time: form.start_time.value,
      end_time: form.end_time.value,
      reason: form.reason.value
    });
    closeModal();
    showToast('Đã đăng ký lịch nghỉ phép đột xuất!');
    if (state.currentScreen === '2.3') go('2.3');
  }

  // 3.5: Chi tiết Đơn hàng & Nhật ký trạng thái (Admin Drawer)
  function renderModal_3_5(el, params = {}) {
    const db = window.GDX_DB;
    const bk = db.bookings.find((b) => b.booking_id === (params.bookingId || 1042)) || db.bookings[0];
    const history = db.booking_status_history.filter((h) => h.booking_id === bk.booking_id);

    el.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="modal-title">3.5. Điều phối &amp; Nhật ký kiểm toán Đơn #${bk.booking_id}</div>
          <div class="field-hint">Bảng: bookings, booking_status_history</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.closeModal()">Đóng ✕</button>
      </div>
      <div class="modal-body form-stack">
        <div class="panel-subtle form-stack" style="gap:6px;">
          <div><strong>Địa chỉ phục vụ:</strong> ${bk.address}</div>
          <div><strong>Tổng thanh toán:</strong> <span class="num">${formatMoney(bk.total_amount + bk.total_incidental)}</span></div>
          <div><strong>Ghi chú khách hàng:</strong> ${bk.notes || 'Không có'}</div>
        </div>

        <form class="form-stack" onsubmit="event.preventDefault(); GDXApp.adminForceStatus(${bk.booking_id}, this);">
          <div class="field-group">
            <label class="field-label" for="admStatusSelect">Can thiệp chuyển trạng thái đơn (bookings.status)</label>
            <select id="admStatusSelect" name="status" class="select">
              <option value="pending" ${bk.status === 'pending' ? 'selected' : ''}>Chờ nhận (pending)</option>
              <option value="confirmed" ${bk.status === 'confirmed' ? 'selected' : ''}>Đã xác nhận (confirmed)</option>
              <option value="in_progress" ${bk.status === 'in_progress' ? 'selected' : ''}>Đang thực hiện (in_progress)</option>
              <option value="completed" ${bk.status === 'completed' ? 'selected' : ''}>Hoàn thành (completed)</option>
              <option value="cancelled" ${bk.status === 'cancelled' ? 'selected' : ''}>Hủy đơn (cancelled)</option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label" for="admReason">Lý do điều phối của Quản trị viên</label>
            <input type="text" id="admReason" name="reason" class="input" value="Quản trị viên cập nhật tiến độ theo yêu cầu điều phối" required>
          </div>
          <button type="submit" class="btn btn-primary btn-sm">Cập nhật trạng thái &amp; Ghi nhật ký</button>
        </form>

        <div>
          <strong style="font-size:13.5px;">Lịch sử chuyển trạng thái (${history.length}):</strong>
          <div class="audit-timeline" style="margin-top:10px;">
            ${history
              .map(
                (h) => `
              <div class="audit-item">
                <div><strong>${h.old_status || h.previous_status || 'Mới'} &rarr; ${h.new_status}</strong> · <span class="field-hint num">${formatDateTime(h.changed_at || h.created_at)}</span></div>
                <div class="field-hint">${h.reason}</div>
              </div>`
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  }

  function adminForceStatus(bookingId, form) {
    const db = window.GDX_DB;
    const bk = db.bookings.find((b) => b.booking_id === bookingId);
    if (bk) {
      const oldStatus = bk.status;
      bk.status = form.status.value;
      db.booking_status_history.unshift({
        history_id: Date.now(),
        booking_id: bookingId,
        old_status: oldStatus,
        new_status: form.status.value,
        changed_by: 1,
        reason: form.reason.value,
        changed_at: new Date().toISOString()
      });
    }
    closeModal();
    showToast(`Đã cập nhật trạng thái đơn #${bookingId}`);
    if (state.currentScreen === '3.1') go('3.1');
  }

  // 3.6: Thêm / Sửa Danh mục Dịch vụ
  function renderModal_3_6(el) {
    const rootCats = window.GDX_DB.service_categories.filter((c) => c.parent_id === null);
    el.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="modal-title">3.6. Thêm Danh mục Dịch vụ mới</div>
          <div class="field-hint">Bảng: service_categories (name, description, parent_id)</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.closeModal()">✕</button>
      </div>
      <form onsubmit="event.preventDefault(); GDXApp.saveCategoryModal(this);">
        <div class="modal-body form-stack">
          <div class="field-group">
            <label class="field-label" for="catName">Tên danh mục (service_categories.name)</label>
            <input type="text" id="catName" name="name" class="input" required placeholder="Ví dụ: Chăm sóc cây cảnh ban công">
          </div>
          <div class="field-group">
            <label class="field-label" for="catParent">Danh mục cha (parent_id)</label>
            <select id="catParent" name="parent_id" class="select">
              <option value="">-- Danh mục gốc (Cấp 1) --</option>
              ${rootCats.map((c) => `<option value="${c.category_id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="field-group">
            <label class="field-label" for="catDesc">Mô tả danh mục (description)</label>
            <textarea id="catDesc" name="description" class="textarea" rows="2" required>Dịch vụ cắt tỉa, thay đất và chăm sóc cây xanh tại căn hộ gia đình.</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Hủy</button>
          <button type="submit" class="btn btn-primary">Lưu danh mục</button>
        </div>
      </form>
    `;
  }

  function saveCategoryModal(form) {
    const db = window.GDX_DB;
    db.service_categories.push({
      category_id: Math.max(...db.service_categories.map((c) => c.category_id)) + 1,
      name: form.name.value,
      description: form.description.value,
      parent_id: form.parent_id.value ? Number(form.parent_id.value) : null
    });
    closeModal();
    showToast('Đã thêm danh mục dịch vụ mới!');
    if (state.currentScreen === '3.2') go('3.2');
  }

  // 3.7: Thêm / Sửa Gói Dịch vụ & Giá
  function renderModal_3_7(el, params = {}) {
    const db = window.GDX_DB;
    const existing = params.serviceId ? db.services.find((s) => s.service_id === params.serviceId) : null;

    el.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="modal-title">3.7. ${existing ? `Cập nhật Gói dịch vụ #${existing.service_id}` : 'Thêm Gói Dịch vụ & Niêm yết giá'}</div>
          <div class="field-hint">Bảng: services (category_id, title, pricing_type, price, estimated_duration)</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.closeModal()">✕</button>
      </div>
      <form onsubmit="event.preventDefault(); GDXApp.saveServiceModal(this, ${existing ? existing.service_id : 'null'});">
        <div class="modal-body form-stack">
          <div class="field-group">
            <label class="field-label" for="svcTitle">Tên gói dịch vụ (services.title)</label>
            <input type="text" id="svcTitle" name="title" class="input" value="${existing ? existing.title : 'Vệ sinh máy giặt lồng ngang tại nhà'}" required>
          </div>
          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label" for="svcCat">Thuộc danh mục (category_id)</label>
              <select id="svcCat" name="category_id" class="select">
                ${db.service_categories
                  .map(
                    (c) => `<option value="${c.category_id}" ${existing && existing.category_id === c.category_id ? 'selected' : ''}>${c.name}</option>`
                  )
                  .join('')}
              </select>
            </div>
            <div class="field-group">
              <label class="field-label" for="svcType">Cách tính phí (pricing_type)</label>
              <select id="svcType" name="pricing_type" class="select">
                <option value="fixed" ${existing && existing.pricing_type === 'fixed' ? 'selected' : ''}>Trọn gói cố định (fixed)</option>
                <option value="hourly" ${existing && existing.pricing_type === 'hourly' ? 'selected' : ''}>Tính theo giờ (hourly)</option>
              </select>
            </div>
          </div>
          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label" for="svcPrice">Đơn giá niêm yết (VNĐ - price)</label>
              <input type="number" id="svcPrice" name="price" class="input num" value="${existing ? existing.price : 250000}" min="10000" step="5000" required>
            </div>
            <div class="field-group">
              <label class="field-label" for="svcDur">Thời lượng ước tính (phút - estimated_duration)</label>
              <input type="number" id="svcDur" name="estimated_duration" class="input num" value="${existing ? existing.estimated_duration : 90}" min="15" step="15" required>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Hủy</button>
          <button type="submit" class="btn btn-primary">Lưu gói dịch vụ</button>
        </div>
      </form>
    `;
  }

  function saveServiceModal(form, existingId) {
    const db = window.GDX_DB;
    if (existingId) {
      const s = db.services.find((x) => x.service_id === existingId);
      if (s) {
        s.title = form.title.value;
        s.category_id = Number(form.category_id.value);
        s.pricing_type = form.pricing_type.value;
        s.price = Number(form.price.value);
        s.estimated_duration = Number(form.estimated_duration.value);
      }
    } else {
      db.services.push({
        service_id: Math.max(...db.services.map((x) => x.service_id)) + 1,
        category_id: Number(form.category_id.value),
        title: form.title.value,
        image_url: 'assets/service-laundry.jpg',
        pricing_type: form.pricing_type.value,
        price: Number(form.price.value),
        estimated_duration: Number(form.estimated_duration.value),
        is_active: true
      });
    }
    closeModal();
    showToast('Đã lưu thông tin gói dịch vụ!');
    if (state.currentScreen === '3.2') go('3.2');
  }

  // 3.8: Chi tiết Hồ sơ KYC & Duyệt Thợ
  function renderModal_3_8(el, params = {}) {
    const db = window.GDX_DB;
    const p = db.provider_profiles.find((x) => x.provider_id === (params.providerId || 204)) || db.provider_profiles[3];
    const u = db.users.find((x) => x.user_id === p.user_id);

    el.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="modal-title">3.8. Đối chiếu Hồ sơ Pháp lý &amp; CCCD Đối tác #${p.provider_id}</div>
          <div class="field-hint">Bảng: provider_profiles (id_card_number, verification_status)</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.closeModal()">✕</button>
      </div>
      <div class="modal-body form-stack">
        <div style="display:flex; align-items:center; gap:14px;">
          <img src="${p.avatar_url}" alt="Avatar" class="provider-avatar-lg">
          <div>
            <strong style="font-size:17px;">${u ? u.full_name : ''}</strong>
            <div class="field-hint num">Số CCCD: <strong>${p.id_card_number}</strong> · SĐT: ${u ? u.phone_number : ''}</div>
          </div>
        </div>
        <div class="panel-subtle">
          <strong>Kinh nghiệm chuyên môn khai báo:</strong>
          <p class="field-hint" style="margin-top:4px;">${p.info}</p>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-danger" onclick="GDXApp.updateProviderKyc(${p.provider_id}, 'rejected')">Từ chối hồ sơ (rejected)</button>
        <button type="button" class="btn btn-primary" onclick="GDXApp.updateProviderKyc(${p.provider_id}, 'verified')">Phê duyệt chính thức (verified) &rarr;</button>
      </div>
    `;
  }

  // 3.9: Xử lý Phiếu Hỗ trợ (Support Ticket Detail)
  function renderModal_3_9(el, params = {}) {
    const db = window.GDX_DB;
    const t = db.support_tickets.find((x) => x.ticket_id === (params.ticketId || 501)) || db.support_tickets[0];
    el.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="modal-title">3.9. Xử lý Phiếu Hỗ trợ #${t.ticket_id}</div>
          <div class="field-hint">Cập nhật support_tickets.status và support_tickets.priority</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.closeModal()">✕</button>
      </div>
      <form onsubmit="event.preventDefault(); GDXApp.updateSupportTicket(${t.ticket_id}, this);">
        <div class="modal-body form-stack">
          <div class="panel-subtle">
            <strong>${t.subject}</strong>
            <p class="field-hint" style="margin-top:4px;">${t.description}</p>
          </div>
          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label" for="admTkStatus">Trạng thái xử lý (ticket_status)</label>
              <select id="admTkStatus" name="status" class="select">
                <option value="open" ${t.status === 'open' ? 'selected' : ''}>Mới tiếp nhận (open)</option>
                <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>Đang xử lý (in_progress)</option>
                <option value="resolved" ${t.status === 'resolved' ? 'selected' : ''}>Đã giải quyết (resolved)</option>
                <option value="closed" ${t.status === 'closed' ? 'selected' : ''}>Đóng phiếu (closed)</option>
              </select>
            </div>
            <div class="field-group">
              <label class="field-label" for="admTkPrio">Mức độ ưu tiên (ticket_priority)</label>
              <select id="admTkPrio" name="priority" class="select">
                <option value="low" ${t.priority === 'low' ? 'selected' : ''}>Thấp (low)</option>
                <option value="medium" ${t.priority === 'medium' ? 'selected' : ''}>Trung bình (medium)</option>
                <option value="high" ${t.priority === 'high' ? 'selected' : ''}>Cao (high)</option>
                <option value="urgent" ${t.priority === 'urgent' ? 'selected' : ''}>Khẩn cấp (urgent)</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="GDXApp.closeModal()">Đóng</button>
          <button type="submit" class="btn btn-primary">Lưu kết quả xử lý</button>
        </div>
      </form>
    `;
  }

  function updateSupportTicket(ticketId, form) {
    const t = window.GDX_DB.support_tickets.find((x) => x.ticket_id === ticketId);
    if (t) {
      t.status = form.status.value;
      t.priority = form.priority.value;
    }
    closeModal();
    showToast(`Đã cập nhật phiếu hỗ trợ #${ticketId}`);
    if (state.currentScreen === '3.4') go('3.4');
  }

  // SUPABASE_STATUS Modal (Dev Mode)
  function renderModal_SupabaseStatus(el) {
    const b = state.backend;
    el.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="modal-title">Trạng thái kết nối Backend &amp; Supabase (.env.local)</div>
          <div class="field-hint">Kiểm tra cấu hình SUPABASE_URL và SUPABASE_ANON_KEY</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.closeModal()">✕</button>
      </div>
      <div class="modal-body form-stack">
        <div class="panel-subtle form-stack" style="gap:8px;">
          <div class="slip-row">
            <span>Chế độ dữ liệu hiện tại</span>
            <span class="slip-dots"></span>
            <span class="badge ${b.mode === 'supabase' ? 'badge-positive' : 'badge-info'}">${b.mode === 'supabase' ? 'Supabase PostgreSQL Live' : 'Local JSON Store (Fallback)'}</span>
          </div>
          <div class="slip-row">
            <span>Trạng thái cấu hình .env.local</span>
            <span class="slip-dots"></span>
            <strong>${b.supabaseConfigured ? 'Đã cấu hình đầy đủ' : 'Chưa điền khóa API'}</strong>
          </div>
          <div class="field-hint">${b.message}</div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-primary" onclick="GDXApp.closeModal()">Đã hiểu</button>
      </div>
    `;
  }

  // CATALOG Pricing Modal
  function renderModal_Catalog(el) {
    const svcs = window.GDX_DB.services.filter((s) => s.is_active);
    el.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="modal-title">Biểu giá niêm yết Dịch vụ Gia Đình Xanh</div>
          <div class="field-hint">Đơn giá minh bạch từ bảng services</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="GDXApp.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Gói dịch vụ</th>
                <th>Hình thức</th>
                <th class="num">Thời lượng</th>
                <th class="num">Đơn giá</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${svcs
                .map(
                  (s) => `
                <tr>
                  <td><strong>${s.title}</strong></td>
                  <td>${s.pricing_type === 'hourly' ? 'Theo giờ' : 'Trọn gói'}</td>
                  <td class="num">~${s.estimated_duration} phút</td>
                  <td class="num"><strong style="color:var(--accent);">${formatMoney(s.price)}</strong></td>
                  <td>
                    <button type="button" class="btn btn-primary btn-sm" onclick="GDXApp.closeModal(); GDXApp.go('1.2', {serviceId: ${s.service_id}})">
                      Đặt lịch
                    </button>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // =====================================================================
  // INITIALIZATION
  // =====================================================================
  async function init() {
    UserInvalidFallback.init(document);

    const dialog = document.getElementById('appModal');
    if (dialog) {
      dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        closeModal();
      });
    }

    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode') || params.get('env');
    if (modeParam === 'dev' || modeParam === 'user' || modeParam === 'production') {
      state.viewMode = modeParam;
      if (modeParam === 'production') {
        state.isProduction = true;
      }
    }

    await syncWithBackend();
    setViewMode(state.viewMode, true);
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    go,
    goHomeByRole,
    switchPortal,
    setViewMode,
    handleUserRoleSwitch,
    openModal,
    openSupabaseStatusModal: () => openModal('SUPABASE_STATUS'),
    openScreenCatalogModal: () => openModal('CATALOG'),
    closeModal,
    showToast,
    toggleProviderOnline,
    refreshProviderGPS,
    togglePasswordVisibility,
    quickPersonaLogin,
    setAuthTab,
    setAuthView,
    handleForgot,
    handleLogin,
    handleRegister,
    handleLogout,
    handleCustomerOnboarding,
    handleProvinceChange,
    selectOnboardingAvatar,
    handleProviderOnboarding,
    handleOmniSearchSubmit,
    selectScheduleSlotInModal,
    setCatalogCategory,
    setCatalogPricingType,
    setCatalogSearch,
    resetCatalogFilters,
    toggleFavorite,
    setWizardCategory,
    setWizardProviderMode,
    setBookingHours,
    selectBookingProvider,
    submitNewBooking,
    setBookingListFilter,
    saveCustomerProfile,
    setJobBoardWard,
    setInboxTab,
    dismissJob,
    simulateJobExpired,
    acceptJob,
    toggleShiftTimer,
    startShiftWork,
    saveProviderConfig,
    setAdminDispatchFilter,
    toggleServiceActive,
    updateProviderKyc,
    toggleUserActive,
    deleteReview,
    confirmBookingPayment,
    setCheckoutPayMethod,
    submitInvoicePayment,
    executeQrPaymentSuccess,
    cancelQrPayment,
    copyText,
    setReviewStars,
    submitBookingReview,
    confirmCancelBooking,
    submitSupportTicket,
    saveIncidentalCost,
    completeJobShift,
    addWeeklySchedule,
    addExceptionSchedule,
    adminForceStatus,
    saveCategoryModal,
    saveServiceModal,
    updateSupportTicket,
    initCustomerLocationPicker,
    locateUserGPS,
    rpc: RPC,
    RPC
  };
})();
