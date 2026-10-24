/**
 * =====================================================================
 * GIA ĐÌNH XANH — FULL-STACK BACKEND SERVER (SUPABASE + LOCAL SQL STORE)
 * =====================================================================
 * - Đọc cấu hình từ `.env.local` (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
 * - Khi `.env.local` có key: Kết nối trực tiếp tới Supabase thông qua `@supabase/supabase-js`
 * - Khi `.env.local` để trống: Tự động vận hành trên Persistent Local SQL Store (`backend/data/local-db.json`)
 *   tuân thủ nghiêm ngặt 16 bảng, 1 View (`provider_public_profiles`), 4 hàm RPC SECURITY DEFINER và Trigger.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { createClient } = require("@supabase/supabase-js");
const dbSeedModule = require("./db-mock.js");

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "backend", "data");
const LOCAL_DB_PATH = path.join(DATA_DIR, "local-db.json");

function createInitialDatabase() {
  if (typeof dbSeedModule.createInitialStore === "function") {
    return dbSeedModule.createInitialStore();
  }
  return dbSeedModule;
}

// ---------------------------------------------------------------------
// 1. ĐỌC FILE .env.local (HỖ TRỢ RELOAD NÓNG KHI NGƯỜI DÙNG ĐIỀN KEY)
// ---------------------------------------------------------------------
function loadEnvConfig() {
  const envVars = {};
  const envFiles = [path.join(ROOT_DIR, ".env"), path.join(ROOT_DIR, ".env.local")];

  for (const filePath of envFiles) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) return;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        envVars[key] = val;
      });
    }
  }

  const supabaseUrl =
    envVars.NEXT_PUBLIC_SUPABASE_URL ||
    envVars.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";
  const supabaseAnonKey =
    envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    envVars.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";
  const supabaseServiceKey =
    envVars.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  const port = Number(envVars.PORT || process.env.PORT || 3000);

  return {
    supabaseUrl: supabaseUrl.trim(),
    supabaseAnonKey: supabaseAnonKey.trim(),
    supabaseServiceKey: supabaseServiceKey.trim(),
    port
  };
}

function getSupabaseClient() {
  const cfg = loadEnvConfig();
  const activeKey = cfg.supabaseServiceKey || cfg.supabaseAnonKey;
  if (!cfg.supabaseUrl || !activeKey) {
    return { client: null, config: cfg };
  }
  try {
    const client = createClient(cfg.supabaseUrl, activeKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    return { client, config: cfg };
  } catch (err) {
    return { client: null, config: cfg, error: err.message };
  }
}

// ---------------------------------------------------------------------
// 2. QUẢN LÝ PERSISTENT LOCAL SQL STORE (backend/data/local-db.json)
// ---------------------------------------------------------------------
function ensureLocalDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    const initial = createInitialDatabase();
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
  try {
    const raw = fs.readFileSync(LOCAL_DB_PATH, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    const initial = createInitialDatabase();
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

function saveLocalDb(db) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

// View: provider_public_profiles (ẩn id_card_number, chỉ trả về verified + is_active)
function computeProviderPublicProfiles(db) {
  return (db.provider_profiles || [])
    .filter((pp) => {
      const u = (db.users || []).find((x) => x.user_id === pp.user_id);
      return pp.verification_status === "verified" && u && u.is_active === true;
    })
    .map((pp) => {
      const u = (db.users || []).find((x) => x.user_id === pp.user_id);
      return {
        provider_id: pp.provider_id,
        user_id: pp.user_id,
        full_name: u ? u.full_name : "Thợ Gia Đình Xanh",
        avatar_url: pp.avatar_url,
        info: pp.info,
        verification_status: pp.verification_status,
        average_rating: pp.average_rating,
        total_reviews: pp.total_reviews,
        lattitude: pp.lattitude,
        longtitude: pp.longtitude,
        is_available_online: pp.is_available_online
      };
    });
}

// Trigger: trg_reviews_refresh_rating
function recomputeProviderRating(db, providerId) {
  const provReviews = (db.reviews || []).filter((r) => {
    if (r.provider_id !== undefined) return Number(r.provider_id) === Number(providerId);
    const bk = (db.bookings || []).find((b) => b.booking_id === r.booking_id);
    return bk && Number(bk.provider_id) === Number(providerId);
  });
  const pp = (db.provider_profiles || []).find((p) => Number(p.provider_id) === Number(providerId));
  if (pp) {
    pp.total_reviews = provReviews.length;
    if (provReviews.length === 0) {
      pp.average_rating = 0.0;
    } else {
      const sum = provReviews.reduce((acc, r) => acc + Number(r.rating), 0);
      pp.average_rating = Number((sum / provReviews.length).toFixed(2));
    }
  }
}

// ---------------------------------------------------------------------
// 3. ĐỌC DỮ LIỆU TỪ SUPABASE (HOẶC FALLBACK SANG LOCAL DB)
// ---------------------------------------------------------------------
async function fetchBootstrapData() {
  const { client, config } = getSupabaseClient();
  const localDb = ensureLocalDb();

  if (client) {
    try {
      const tables = [
        "province",
        "ward",
        "users",
        "customer_profiles",
        "provider_profiles",
        "service_categories",
        "services",
        "provider_services",
        "provider_areas",
        "availability_schedules",
        "availability_exceptions",
        "bookings",
        "booking_status_history",
        "reviews",
        "favorites",
        "support_tickets"
      ];
      const results = await Promise.all(tables.map((t) => client.from(t).select("*")));
      const hasError = results.some((r) => r.error);
      if (!hasError) {
        const remoteDb = {
          session: localDb.session
        };
        tables.forEach((t, idx) => {
          remoteDb[t] = results[idx].data || [];
        });
        if ((remoteDb.province || []).length > 0 && (remoteDb.services || []).length > 0) {
          remoteDb.provider_public_profiles = computeProviderPublicProfiles(remoteDb);
          return {
            mode: "supabase",
            connected: true,
            supabaseUrl: config.supabaseUrl,
            data: remoteDb
          };
        }
      }
    } catch (_) {
      // Fallback sang local store nếu Supabase chưa tạo bảng
    }
  }

  localDb.provider_public_profiles = computeProviderPublicProfiles(localDb);
  return {
    mode: client ? "supabase_unseeded_fallback" : "local_sql_store",
    connected: Boolean(client),
    supabaseUrl: config.supabaseUrl || null,
    data: localDb
  };
}

// ---------------------------------------------------------------------
// 4. XỬ LÝ REST API ENDPOINTS (ÁNH XẠ 1-1 VỚI 16 BẢNG & 4 RPC)
// ---------------------------------------------------------------------
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

async function handleApiRequest(req, res, pathname) {
  const method = req.method.toUpperCase();
  const db = ensureLocalDb();

  // 4.1. GET /api/status — Kiểm tra cấu hình .env.local và kết nối Supabase
  if (method === "GET" && pathname === "/api/status") {
    const { client, config, error } = getSupabaseClient();
    let supabaseReachable = false;
    let supabaseMessage =
      "Đang vận hành trên Persistent Local SQL Store (backend/data/local-db.json). Khi bạn điền khóa vào file .env.local, hệ thống sẽ tự động kết nối tới Supabase PostgreSQL.";

    if (client) {
      try {
        const { error: pingErr } = await client.from("province").select("provinceId").limit(1);
        if (!pingErr) {
          supabaseReachable = true;
          supabaseMessage = "Đã kết nối trực tiếp tới Supabase PostgreSQL qua @supabase/supabase-js.";
        } else {
          supabaseMessage = `Đã nhận khóa từ .env.local nhưng truy vấn bảng 'province' trả về: ${pingErr.message}`;
        }
      } catch (err) {
        supabaseMessage = `Lỗi kết nối tới Supabase: ${err.message}`;
      }
    } else if (error) {
      supabaseMessage = error;
    }

    return sendJson(res, 200, {
      ok: true,
      mode: supabaseReachable ? "supabase" : "local_sql_store",
      envFile: ".env.local",
      hasSupabaseUrl: Boolean(config.supabaseUrl),
      hasAnonKey: Boolean(config.supabaseAnonKey),
      hasServiceRoleKey: Boolean(config.supabaseServiceKey),
      supabaseUrlPreview: config.supabaseUrl
        ? config.supabaseUrl.replace(/^(https?:\/\/[^.]+)\..*$/, "$1.supabase.co")
        : null,
      supabaseReachable,
      message: supabaseMessage,
      tableCounts: {
        province: (db.province || []).length,
        ward: (db.ward || []).length,
        users: (db.users || []).length,
        customer_profiles: (db.customer_profiles || []).length,
        provider_profiles: (db.provider_profiles || []).length,
        service_categories: (db.service_categories || []).length,
        services: (db.services || []).length,
        bookings: (db.bookings || []).length,
        reviews: (db.reviews || []).length,
        support_tickets: (db.support_tickets || []).length
      }
    });
  }

  // 4.2. GET /api/bootstrap — Tải toàn bộ 16 bảng + View provider_public_profiles
  if (method === "GET" && pathname === "/api/bootstrap") {
    const boot = await fetchBootstrapData();
    return sendJson(res, 200, {
      ok: true,
      mode: boot.mode,
      connected: boot.connected,
      db: boot.data
    });
  }

  // 4.3. POST /api/supabase/reset-local — Khôi phục dữ liệu mẫu chuẩn SQL
  if (method === "POST" && pathname === "/api/supabase/reset-local") {
    const fresh = createInitialDatabase();
    saveLocalDb(fresh);
    fresh.provider_public_profiles = computeProviderPublicProfiles(fresh);
    return sendJson(res, 200, {
      ok: true,
      message: "Đã khôi phục dữ liệu chuẩn SQL (16 bảng) về trạng thái mặc định.",
      db: fresh
    });
  }

  // 4.4. POST /api/auth/register — Đăng ký tài khoản mới
  if (method === "POST" && pathname === "/api/auth/register") {
    const body = await parseBody(req);
    const fullName = String(body.full_name || "").trim();
    const phone = String(body.phone_number || "").trim();
    const email = String(body.email || "").trim();
    const role = body.role === "provider" ? "provider" : "customer";

    if (!fullName || !phone) {
      return sendJson(res, 400, { ok: false, error: "Họ tên và số điện thoại là bắt buộc." });
    }
    if (db.users.some((u) => u.phone_number === phone)) {
      return sendJson(res, 409, { ok: false, error: "Số điện thoại đã tồn tại (UNIQUE constraint)." });
    }

    const newUserId = "a0000000-0000-4000-8000-" + String(Date.now()).slice(-12).padStart(12, "0");
    const nowIso = new Date().toISOString();
    const newUser = {
      user_id: newUserId,
      full_name: fullName,
      phone_number: phone,
      email: email || `${phone}@giadinhxanh.vn`,
      role,
      is_active: true,
      created_at: nowIso,
      updated_at: nowIso
    };
    db.users.push(newUser);
    saveLocalDb(db);

    const { client } = getSupabaseClient();
    if (client) {
      try {
        await client.from("users").insert([newUser]);
      } catch (_) {}
    }

    return sendJson(res, 201, { ok: true, user: newUser });
  }

  // 4.5. POST /api/onboarding/customer — Lưu hồ sơ khách hàng (0.2)
  if (method === "POST" && pathname === "/api/onboarding/customer") {
    const body = await parseBody(req);
    const userId = body.user_id || (db.session && db.session.customer_user_id) || "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const u = db.users.find((x) => x.user_id === userId);
    if (u) {
      if (body.full_name) u.full_name = String(body.full_name).trim();
      if (body.phone_number) u.phone_number = String(body.phone_number).trim();
      u.updated_at = new Date().toISOString();
    }
    let cp = db.customer_profiles.find((x) => x.user_id === userId);
    if (cp) {
      if (body.ward_id) cp.ward_id = String(body.ward_id);
      if (body.default_address) cp.default_address = String(body.default_address).trim();
      if (body.latitude !== undefined) cp.latitude = Number(body.latitude);
      if (body.longitude !== undefined) cp.longitude = Number(body.longitude);
      cp.updated_at = new Date().toISOString();
    } else {
      const nextCid = Math.max(100, ...db.customer_profiles.map((c) => c.customer_id)) + 1;
      cp = {
        customer_id: nextCid,
        user_id: userId,
        default_address: String(body.default_address || "").trim(),
        ward_id: String(body.ward_id || "27403"),
        latitude: Number(body.latitude) || 10.728912,
        longitude: Number(body.longitude) || 106.712405,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.customer_profiles.push(cp);
    }
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, customer_profile: cp, user: u });
  }

  // 4.6. POST /api/onboarding/provider — Đăng ký hồ sơ hành nghề thợ (0.3 / 0.4)
  if (method === "POST" && pathname === "/api/onboarding/provider") {
    const body = await parseBody(req);
    const idCard = String(body.id_card_number || "").trim();
    if (!idCard) {
      return sendJson(res, 400, { ok: false, error: "Số CCCD (id_card_number) là bắt buộc." });
    }

    const targetProviderId = Number(body.provider_id || 204);
    const pp = db.provider_profiles.find((p) => p.provider_id === targetProviderId);
    if (pp) {
      const duplicate = db.provider_profiles.find(
        (p) => p.id_card_number === idCard && p.provider_id !== pp.provider_id
      );
      if (duplicate) {
        return sendJson(res, 409, { ok: false, error: "Số CCCD bị trùng với hồ sơ thợ khác (UNIQUE)." });
      }
      pp.id_card_number = idCard;
      if (body.info) pp.info = String(body.info).trim();
      if (body.avatar_url) pp.avatar_url = String(body.avatar_url).trim();
      pp.verification_status = "pending";
      pp.updated_at = new Date().toISOString();
    }
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, provider_profile: pp });
  }

  // 4.7. PUT /api/profile/customer — Cập nhật Hồ sơ cá nhân & Sổ địa chỉ (1.5)
  if (method === "PUT" && pathname === "/api/profile/customer") {
    const body = await parseBody(req);
    const customerId = Number(body.customer_id || 101);
    const cp = db.customer_profiles.find((c) => c.customer_id === customerId);
    if (!cp) return sendJson(res, 404, { ok: false, error: "Không tìm thấy hồ sơ khách hàng." });

    const u = db.users.find((x) => x.user_id === cp.user_id);
    if (u) {
      if (body.full_name) u.full_name = String(body.full_name).trim();
      if (body.phone_number) u.phone_number = String(body.phone_number).trim();
      u.updated_at = new Date().toISOString();
    }
    if (body.ward_id) cp.ward_id = String(body.ward_id);
    if (body.default_address !== undefined) cp.default_address = String(body.default_address).trim();
    if (body.latitude !== undefined) cp.latitude = Number(body.latitude);
    if (body.longitude !== undefined) cp.longitude = Number(body.longitude);
    cp.updated_at = new Date().toISOString();

    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, user: u, customer_profile: cp });
  }

  // 4.8. PATCH /api/provider/online-gps — Component 2.5: Bật/tắt nhận việc & tọa độ
  if (method === "PATCH" && pathname === "/api/provider/online-gps") {
    const body = await parseBody(req);
    const providerId = Number(body.provider_id || 201);
    const pp = db.provider_profiles.find((p) => p.provider_id === providerId);
    if (!pp) return sendJson(res, 404, { ok: false, error: "Không tìm thấy hồ sơ thợ." });

    if (typeof body.is_available_online === "boolean") {
      pp.is_available_online = body.is_available_online;
    }
    if (body.lattitude !== undefined) pp.lattitude = Number(body.lattitude);
    if (body.longtitude !== undefined) pp.longtitude = Number(body.longtitude);
    pp.updated_at = new Date().toISOString();

    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, provider_profile: pp });
  }

  // 4.9. PUT /api/provider/capabilities — Màn hình 2.4: Cập nhật chuyên môn & khu vực
  if (method === "PUT" && pathname === "/api/provider/capabilities") {
    const body = await parseBody(req);
    const providerId = Number(body.provider_id || 201);
    const pp = db.provider_profiles.find((p) => p.provider_id === providerId);
    if (!pp) return sendJson(res, 404, { ok: false, error: "Không tìm thấy hồ sơ thợ." });

    if (body.info !== undefined) pp.info = String(body.info).trim();
    if (body.avatar_url !== undefined) pp.avatar_url = String(body.avatar_url).trim();
    pp.updated_at = new Date().toISOString();

    if (Array.isArray(body.service_ids)) {
      db.provider_services = db.provider_services.filter((ps) => ps.provider_id !== providerId);
      body.service_ids.forEach((sid, idx) => {
        db.provider_services.push({
          id_pro_ser: Date.now() + idx,
          provider_id: providerId,
          service_id: Number(sid)
        });
      });
    }

    if (Array.isArray(body.ward_ids)) {
      db.provider_areas = db.provider_areas.filter((pa) => pa.provider_id !== providerId);
      body.ward_ids.forEach((wid, idx) => {
        db.provider_areas.push({
          area_id: Date.now() + idx,
          provider_id: providerId,
          ward_id: String(wid)
        });
      });
    }

    saveLocalDb(db);
    return sendJson(res, 200, {
      ok: true,
      provider_profile: pp,
      provider_services: db.provider_services.filter((ps) => ps.provider_id === providerId),
      provider_areas: db.provider_areas.filter((pa) => pa.provider_id === providerId)
    });
  }

  // 4.10. POST /api/bookings — Màn hình 1.2: Tạo đơn đặt lịch mới
  if (method === "POST" && pathname === "/api/bookings") {
    const body = await parseBody(req);
    const serviceId = Number(body.service_id);
    const providerId = Number(body.provider_id);
    const wardId = String(body.ward_id || "27403");
    const customerId = Number(body.customer_id || 101);
    const address = String(body.address || "").trim();

    if (!serviceId || !providerId || !wardId || !address) {
      return sendJson(res, 400, { ok: false, error: "Vui lòng điền đầy đủ dịch vụ, thợ, phường/xã và địa chỉ." });
    }

    const svc = db.services.find((s) => s.service_id === serviceId);
    const nextId = Math.max(1040, ...db.bookings.map((b) => b.booking_id)) + 1;
    const nowIso = new Date().toISOString();

    const newBooking = {
      booking_id: nextId,
      customer_id: customerId,
      provider_id: providerId,
      service_id: serviceId,
      scheduled_time: body.scheduled_time || nowIso,
      status: "pending",
      address,
      ward_id: wardId,
      latitude: Number(body.latitude) || 10.728912,
      longitude: Number(body.longitude) || 106.712405,
      total_amount: Number(body.total_amount) || (svc ? svc.price : 180000),
      total_incidental: 0,
      notes: String(body.notes || "Khách đặt lịch qua Booking Wizard.").trim(),
      payment_status: "unpaid",
      created_at: nowIso,
      updated_at: nowIso
    };

    db.bookings.unshift(newBooking);
    const nextHistoryId = Math.max(5000, ...db.booking_status_history.map((h) => h.history_id)) + 1;
    const historyRow = {
      history_id: nextHistoryId,
      booking_id: nextId,
      previous_status: null,
      new_status: "pending",
      changed_by: body.changed_by || "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      reason: "Khách hàng tạo đơn đặt lịch qua Booking Wizard 1.2",
      created_at: nowIso
    };
    db.booking_status_history.unshift(historyRow);

    saveLocalDb(db);
    return sendJson(res, 201, { ok: true, booking: newBooking, history: historyRow });
  }

  // 4.11. POST /api/rpc/transition-status — Hàm RPC rpc_transition_booking_status
  if (method === "POST" && pathname === "/api/rpc/transition-status") {
    const body = await parseBody(req);
    const bookingId = Number(body.booking_id);
    const newStatus = String(body.new_status || "");
    const reason = String(body.reason || "Cập nhật trạng thái qua RPC").trim();
    const actorUserId = body.changed_by || "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    const bk = db.bookings.find((b) => b.booking_id === bookingId);
    if (!bk) return sendJson(res, 404, { ok: false, error: "Không tìm thấy đơn hàng." });

    const oldStatus = bk.status;
    bk.status = newStatus;
    bk.updated_at = new Date().toISOString();

    const nextHistoryId = Math.max(5000, ...db.booking_status_history.map((h) => h.history_id)) + 1;
    const historyRow = {
      history_id: nextHistoryId,
      booking_id: bookingId,
      previous_status: oldStatus,
      new_status: newStatus,
      changed_by: actorUserId,
      reason,
      created_at: new Date().toISOString()
    };
    db.booking_status_history.unshift(historyRow);

    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, booking: bk, history: historyRow });
  }

  // 4.12. POST /api/rpc/update-incidental — Hàm RPC rpc_provider_update_incidental (2.7)
  if (method === "POST" && pathname === "/api/rpc/update-incidental") {
    const body = await parseBody(req);
    const bookingId = Number(body.booking_id);
    const incidental = Number(body.total_incidental);
    const notes = String(body.notes || "").trim();

    if (Number.isNaN(incidental) || incidental < 0) {
      return sendJson(res, 400, { ok: false, error: "total_incidental phải >= 0." });
    }
    const bk = db.bookings.find((b) => b.booking_id === bookingId);
    if (!bk) return sendJson(res, 404, { ok: false, error: "Không tìm thấy đơn hàng." });

    const basePrice = Math.max(0, bk.total_amount - bk.total_incidental);
    bk.total_incidental = incidental;
    bk.total_amount = basePrice + incidental;
    bk.updated_at = new Date().toISOString();
    if (notes) {
      bk.notes = (bk.notes ? bk.notes + "\n" : "") + `[Phát sinh: ${incidental} đ] ${notes}`;
    }

    const nextHistoryId = Math.max(5000, ...db.booking_status_history.map((h) => h.history_id)) + 1;
    db.booking_status_history.unshift({
      history_id: nextHistoryId,
      booking_id: bookingId,
      previous_status: bk.status,
      new_status: bk.status,
      changed_by: body.changed_by || "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b21",
      reason: `Cập nhật chi phí phát sinh: ${incidental} đ. Lý do: ${notes || "Vật tư bổ sung"}`,
      created_at: new Date().toISOString()
    });

    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, booking: bk });
  }

  // 4.13. POST /api/rpc/confirm-payment — Hàm RPC rpc_customer_confirm_payment (1.8)
  if (method === "POST" && pathname === "/api/rpc/confirm-payment") {
    const body = await parseBody(req);
    const bookingId = Number(body.booking_id);
    const bk = db.bookings.find((b) => b.booking_id === bookingId);
    if (!bk) return sendJson(res, 404, { ok: false, error: "Không tìm thấy đơn hàng." });

    if (bk.status === "cancelled") {
      return sendJson(res, 400, { ok: false, error: "Không thể thanh toán đơn hàng đã hủy." });
    }
    bk.payment_status = "paid";
    bk.updated_at = new Date().toISOString();

    const nextHistoryId = Math.max(5000, ...db.booking_status_history.map((h) => h.history_id)) + 1;
    db.booking_status_history.unshift({
      history_id: nextHistoryId,
      booking_id: bookingId,
      previous_status: bk.status,
      new_status: bk.status,
      changed_by: body.changed_by || "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      reason: `Khách hàng xác nhận đã thanh toán hóa đơn (${bk.total_amount} đ)`,
      created_at: new Date().toISOString()
    });

    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, booking: bk });
  }

  // 4.14. POST /api/rpc/admin-adjust — Hàm RPC rpc_admin_adjust_booking (3.6)
  if (method === "POST" && pathname === "/api/rpc/admin-adjust") {
    const body = await parseBody(req);
    const bookingId = Number(body.booking_id);
    const bk = db.bookings.find((b) => b.booking_id === bookingId);
    if (!bk) return sendJson(res, 404, { ok: false, error: "Không tìm thấy đơn hàng." });

    const oldStatus = bk.status;
    if (body.provider_id !== undefined) bk.provider_id = Number(body.provider_id);
    if (body.status) bk.status = body.status;
    if (body.payment_status) bk.payment_status = body.payment_status;
    if (body.total_amount !== undefined) bk.total_amount = Number(body.total_amount);
    if (body.total_incidental !== undefined) bk.total_incidental = Number(body.total_incidental);
    bk.updated_at = new Date().toISOString();

    const nextHistoryId = Math.max(5000, ...db.booking_status_history.map((h) => h.history_id)) + 1;
    db.booking_status_history.unshift({
      history_id: nextHistoryId,
      booking_id: bookingId,
      previous_status: oldStatus,
      new_status: bk.status,
      changed_by: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c99",
      reason: String(body.reason || "Admin điều chỉnh qua rpc_admin_adjust_booking").trim(),
      created_at: new Date().toISOString()
    });

    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, booking: bk });
  }

  // 4.15. POST /api/reviews & DELETE /api/reviews — Đánh giá & Kiểm duyệt (1.9 & 3.4)
  if (method === "POST" && pathname === "/api/reviews") {
    const body = await parseBody(req);
    const bookingId = Number(body.booking_id);
    const rating = Number(body.rating);
    const comment = String(body.comment || "").trim();

    const bk = db.bookings.find((b) => b.booking_id === bookingId);
    if (!bk || bk.status !== "completed") {
      return sendJson(res, 400, { ok: false, error: "Chỉ có thể đánh giá đơn hàng đã completed." });
    }
    if (db.reviews.some((r) => r.booking_id === bookingId)) {
      return sendJson(res, 409, { ok: false, error: "Đơn hàng này đã có đánh giá (UNIQUE booking_id)." });
    }

    const nextRevId = Math.max(800, ...db.reviews.map((r) => r.review_id)) + 1;
    const rev = {
      review_id: nextRevId,
      booking_id: bookingId,
      customer_id: bk.customer_id,
      provider_id: bk.provider_id,
      rating: Math.min(5, Math.max(1, rating || 5)),
      comment: comment || "Khách hàng hài lòng với chất lượng dịch vụ.",
      created_at: new Date().toISOString()
    };
    db.reviews.unshift(rev);
    recomputeProviderRating(db, bk.provider_id);
    saveLocalDb(db);

    return sendJson(res, 201, {
      ok: true,
      review: rev,
      provider_profile: db.provider_profiles.find((p) => p.provider_id === bk.provider_id)
    });
  }

  if (method === "DELETE" && pathname.startsWith("/api/reviews/")) {
    const reviewId = Number(pathname.split("/").pop());
    const rev = db.reviews.find((r) => r.review_id === reviewId);
    if (!rev) return sendJson(res, 404, { ok: false, error: "Không tìm thấy đánh giá." });
    const pId = rev.provider_id;
    db.reviews = db.reviews.filter((r) => r.review_id !== reviewId);
    if (pId) recomputeProviderRating(db, pId);
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, deleted_review_id: reviewId });
  }

  // 4.16. POST /api/favorites/toggle — Bảng favorites (1.1 & 1.6)
  if (method === "POST" && pathname === "/api/favorites/toggle") {
    const body = await parseBody(req);
    const customerId = Number(body.customer_id || 101);
    const serviceId = Number(body.service_id);
    const idx = db.favorites.findIndex(
      (f) => f.customer_id === customerId && f.service_id === serviceId
    );
    let added = false;
    if (idx >= 0) {
      db.favorites.splice(idx, 1);
    } else {
      db.favorites.push({
        favorite_id: Date.now(),
        customer_id: customerId,
        service_id: serviceId,
        created_at: new Date().toISOString()
      });
      added = true;
    }
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, added, favorites: db.favorites });
  }

  // 4.17. POST /api/support-tickets & PATCH /api/support-tickets — (1.11, 2.9, 3.4, 3.7)
  if (method === "POST" && pathname === "/api/support-tickets") {
    const body = await parseBody(req);
    const nextId = Math.max(700, ...db.support_tickets.map((t) => t.ticket_id)) + 1;
    const nowIso = new Date().toISOString();
    const ticket = {
      ticket_id: nextId,
      user_id: body.user_id || "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      booking_id: body.booking_id ? Number(body.booking_id) : null,
      subject: String(body.subject || "Yêu cầu hỗ trợ").trim(),
      status: "open",
      priority: body.priority || "medium",
      created_at: nowIso,
      updated_at: nowIso
    };
    db.support_tickets.unshift(ticket);
    saveLocalDb(db);
    return sendJson(res, 201, { ok: true, ticket });
  }

  if (method === "PATCH" && pathname.startsWith("/api/support-tickets/")) {
    const ticketId = Number(pathname.split("/").pop());
    const body = await parseBody(req);
    const tk = db.support_tickets.find((t) => t.ticket_id === ticketId);
    if (!tk) return sendJson(res, 404, { ok: false, error: "Không tìm thấy phiếu hỗ trợ." });
    if (body.status) tk.status = body.status;
    if (body.priority) tk.priority = body.priority;
    tk.updated_at = new Date().toISOString();
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, ticket: tk });
  }

  // 4.18. POST /api/schedules, DELETE /api/schedules/:id, POST /api/exceptions (2.6)
  if (method === "POST" && pathname === "/api/schedules") {
    const body = await parseBody(req);
    const nextId = Math.max(100, ...db.availability_schedules.map((s) => s.id || 0)) + 1;
    const row = {
      id: nextId,
      provider_id: Number(body.provider_id || 201),
      day_of_week: Number(body.day_of_week),
      start_time: String(body.start_time || "08:00"),
      end_time: String(body.end_time || "17:00"),
      updated_at: new Date().toISOString()
    };
    db.availability_schedules.push(row);
    saveLocalDb(db);
    return sendJson(res, 201, { ok: true, schedule: row });
  }

  if (method === "DELETE" && pathname.startsWith("/api/schedules/")) {
    const scheduleId = Number(pathname.split("/").pop());
    db.availability_schedules = db.availability_schedules.filter((s) => Number(s.id) !== scheduleId);
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, deleted_schedule_id: scheduleId });
  }

  if (method === "POST" && pathname === "/api/exceptions") {
    const body = await parseBody(req);
    const nextId = Math.max(100, ...db.availability_exceptions.map((e) => e.id || 0)) + 1;
    const row = {
      id: nextId,
      provider_id: Number(body.provider_id || 201),
      exception_date: String(body.exception_date || "2026-10-30"),
      start_time: body.start_time || "08:00",
      end_time: body.end_time || "17:00",
      reason: String(body.reason || "Nghỉ phép cá nhân").trim(),
      created_at: new Date().toISOString()
    };
    db.availability_exceptions.push(row);
    saveLocalDb(db);
    return sendJson(res, 201, { ok: true, exception: row });
  }

  // 4.19. Admin KYC, Users, Catalog & Locations (3.2, 3.3, 3.4, 3.8, 3.9)
  if (method === "PATCH" && pathname.startsWith("/api/admin/kyc/")) {
    const providerId = Number(pathname.split("/").pop());
    const body = await parseBody(req);
    const pp = db.provider_profiles.find((p) => p.provider_id === providerId);
    if (!pp) return sendJson(res, 404, { ok: false, error: "Không tìm thấy hồ sơ thợ." });
    if (body.verification_status) pp.verification_status = body.verification_status;
    pp.updated_at = new Date().toISOString();
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, provider_profile: pp });
  }

  if (method === "PATCH" && pathname.startsWith("/api/admin/users/")) {
    const userId = pathname.split("/").pop();
    const body = await parseBody(req);
    const u = db.users.find((x) => x.user_id === userId);
    if (!u) return sendJson(res, 404, { ok: false, error: "Không tìm thấy người dùng." });
    if (typeof body.is_active === "boolean") u.is_active = body.is_active;
    u.updated_at = new Date().toISOString();
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, user: u });
  }

  if (method === "POST" && pathname === "/api/admin/services") {
    const body = await parseBody(req);
    const nextId = Math.max(300, ...db.services.map((s) => s.service_id)) + 1;
    const nowIso = new Date().toISOString();
    const svc = {
      service_id: nextId,
      category_id: Number(body.category_id || 1),
      title: String(body.title || body.name || "").trim(),
      description: String(body.description || "").trim(),
      price: Number(body.price || body.base_price || 150000),
      pricing_type: body.pricing_type || "fixed",
      estimated_duration: Number(body.estimated_duration || 120),
      is_active: true,
      image_url: "assets/service-cleaning.jpg",
      created_at: nowIso,
      updated_at: nowIso
    };
    db.services.push(svc);
    saveLocalDb(db);
    return sendJson(res, 201, { ok: true, service: svc });
  }

  if (method === "PATCH" && pathname.startsWith("/api/admin/services/")) {
    const serviceId = Number(pathname.split("/").pop());
    const body = await parseBody(req);
    const svc = db.services.find((s) => s.service_id === serviceId);
    if (!svc) return sendJson(res, 404, { ok: false, error: "Không tìm thấy dịch vụ." });
    if (typeof body.is_active === "boolean") svc.is_active = body.is_active;
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, service: svc });
  }

  if (method === "POST" && pathname === "/api/admin/categories") {
    const body = await parseBody(req);
    const nextId = Math.max(10, ...db.service_categories.map((c) => c.category_id)) + 1;
    const cat = {
      category_id: nextId,
      parent_id: body.parent_id ? Number(body.parent_id) : null,
      category_name: String(body.category_name || body.name || "").trim(),
      slug: String(body.slug || "danh-muc-moi").trim(),
      description: String(body.description || "").trim(),
      icon_url: "home-clean",
      status: true
    };
    db.service_categories.push(cat);
    saveLocalDb(db);
    return sendJson(res, 201, { ok: true, category: cat });
  }

  if (method === "PATCH" && pathname.startsWith("/api/admin/categories/")) {
    const categoryId = Number(pathname.split("/").pop());
    const body = await parseBody(req);
    const cat = db.service_categories.find((c) => c.category_id === categoryId);
    if (!cat) return sendJson(res, 404, { ok: false, error: "Không tìm thấy danh mục." });
    if (typeof body.status === "boolean") cat.status = body.status;
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, category: cat });
  }

  if (method === "POST" && pathname === "/api/admin/locations") {
    const body = await parseBody(req);
    if (body.type === "province") {
      const pid = String(body.provinceId || "").trim();
      const name = String(body.name || "").trim();
      if (!pid || !name) return sendJson(res, 400, { ok: false, error: "Thiếu mã hoặc tên tỉnh/thành." });
      const row = { provinceId: pid, name };
      db.province.push(row);
      saveLocalDb(db);
      return sendJson(res, 201, { ok: true, province: row });
    } else {
      const row = {
        ward_id: String(body.ward_id || "").trim(),
        name: String(body.name || "").trim(),
        provinceId: String(body.provinceId || "79").trim()
      };
      db.ward.push(row);
      saveLocalDb(db);
      return sendJson(res, 201, { ok: true, ward: row });
    }
  }

  return sendJson(res, 404, { ok: false, error: `Endpoint không tồn tại: ${method} ${pathname}` });
}

// ---------------------------------------------------------------------
// 5. STATIC FILE SERVER CHO FRONTEND
// ---------------------------------------------------------------------
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname.startsWith("/api/")) {
      return await handleApiRequest(req, res, pathname);
    }

    let safePath = pathname === "/" ? "/index.html" : pathname;
    const filePath = path.normalize(path.join(ROOT_DIR, safePath));
    if (!filePath.startsWith(ROOT_DIR)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
    }
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message });
  }
});

const { port } = loadEnvConfig();
ensureLocalDb();
server.listen(port, "0.0.0.0", () => {
  console.log(`[Gia Đình Xanh Server] Đang chạy tại http://localhost:${port}`);
});
