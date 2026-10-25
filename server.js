/**
 * =====================================================================
 * GIA ĐÌNH XANH — FULL-STACK BACKEND SERVER (SUPABASE + LOCAL SQL STORE)
 * =====================================================================
 * Hỗ trợ 2 chế độ vận hành:
 * 1. Chế độ Phát triển / Local Mode (mặc định):
 *    - Vận hành trên Persistent Local SQL Store (backend/data/local-db.json)
 *    - Đồng bộ tự động với Supabase nếu có khóa trong .env.local
 * 2. Chế độ Production Mode (?mode=production hoặc ENV=production):
 *    - ZERO MOCK DATA: Ngắt hoàn toàn nạp mẫu từ db-mock.js / local-db.json
 *    - Truy vấn và ghi trực tiếp 100% vào Supabase PostgreSQL
 *    - Giữ nguyên trạng thái Cold Start rỗng tự nhiên nếu DB chưa có bản ghi
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
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
// 1. ĐỌC FILE .env / .env.local & NHẬN DIỆN MÔI TRƯỜNG
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
  const env = (
    envVars.ENV ||
    envVars.NODE_ENV ||
    process.env.ENV ||
    process.env.NODE_ENV ||
    "development"
  ).trim().toLowerCase();

  return {
    supabaseUrl: supabaseUrl.trim(),
    supabaseAnonKey: supabaseAnonKey.trim(),
    supabaseServiceKey: supabaseServiceKey.trim(),
    port,
    env
  };
}

function isProductionMode(req, searchParams) {
  const cfg = loadEnvConfig();
  if (cfg.env === "production") return true;
  if (searchParams) {
    const mode = searchParams.get("mode") || searchParams.get("env");
    if (mode === "production") return true;
  }
  if (req && (req.headers["x-gdx-mode"] === "production" || req.headers["x-mode"] === "production")) {
    return true;
  }
  return false;
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
let inMemoryDb = null;

function ensureLocalDb() {
  if (inMemoryDb) {
    return inMemoryDb;
  }

  // 1. Cố gắng đọc từ file cục bộ nếu tồn tại
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const raw = fs.readFileSync(LOCAL_DB_PATH, "utf8");
      const parsed = JSON.parse(raw);
      const initial = createInitialDatabase();
      let updated = false;
      for (const key of Object.keys(initial)) {
        if (!parsed[key] && Array.isArray(initial[key])) {
          parsed[key] = initial[key];
          updated = true;
        }
      }
      if (updated) {
        try {
          fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(parsed, null, 2), "utf8");
        } catch (_) {}
      }
      inMemoryDb = parsed;
      return inMemoryDb;
    }
  } catch (e) {
    console.warn("[LocalDB] Không đọc được file, dùng in-memory fallback:", e.message);
  }

  // 2. Khởi tạo dữ liệu mẫu nếu chưa có file
  inMemoryDb = createInitialDatabase();

  // 3. Ghi ra đĩa nếu hệ thống cho phép ghi (trên Vercel read-only sẽ bỏ qua an toàn)
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(inMemoryDb, null, 2), "utf8");
  } catch (e) {
    // Môi trường Vercel Serverless (Read-only filesystem), dữ liệu hoạt động trên RAM
  }

  return inMemoryDb;
}

function saveLocalDb(db) {
  inMemoryDb = db;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), "utf8");
  } catch (e) {
    // Bỏ qua lỗi EROFS trên môi trường serverless (Vercel)
  }
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

function recomputeProviderRating(db, providerId) {
  const provReviews = (db.reviews || []).filter((r) => {
    if (r.status === "hidden") return false;
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
async function fetchSupabaseTable(client, tableName) {
  let target = tableName;
  let res = await client.from(target).select("*");
  // Hỗ trợ linh hoạt cả tên bảng số ít và số nhiều (province/provinces, ward/wards)
  if (res.error && (tableName === "province" || tableName === "provinces")) {
    target = tableName === "province" ? "provinces" : "province";
    res = await client.from(target).select("*");
  } else if (res.error && (tableName === "ward" || tableName === "wards")) {
    target = tableName === "ward" ? "wards" : "ward";
    res = await client.from(target).select("*");
  }

  if (res.error) {
    return { name: tableName, data: [], error: res.error };
  }

  let allData = res.data || [];
  // PostgREST mặc định giới hạn 1000 dòng/trang; tự động phân trang cho bảng danh mục lớn (như wards ~3300 dòng)
  if ((target === "ward" || target === "wards") && allData.length === 1000) {
    for (let page = 1; page < 6; page++) {
      const from = page * 1000;
      const to = from + 999;
      const { data: pageData, error: pageErr } = await client.from(target).select("*").range(from, to);
      if (pageErr || !pageData || pageData.length === 0) break;
      allData = allData.concat(pageData);
      if (pageData.length < 1000) break;
    }
  }

  return { name: tableName, data: allData, error: null };
}

function sanitizeServicesAndCategories(remoteDb) {
  if (!remoteDb) return;
  if (Array.isArray(remoteDb.service_categories)) {
    remoteDb.service_categories = remoteDb.service_categories.filter((c) => {
      const name = (c.category_name || c.name || "").toLowerCase();
      const slug = (c.slug || "").toLowerCase();
      if (name.includes("repair") || name.includes("sửa") || slug.includes("repair") || name.includes("archived")) return false;
      if (c.status === false) return false;
      return true;
    });
  }
  if (Array.isArray(remoteDb.services)) {
    remoteDb.services = remoteDb.services
      .filter((s) => {
        const t = (s.title || "").toLowerCase();
        if (t.includes("repair") || t.includes("sửa") || t.includes("appliance")) return false;
        return true;
      })
      .map((s) => {
        const t = (s.title || "").toLowerCase();
        let img = s.image_url;
        if (!img) {
          if (t.includes("nấu") || t.includes("cơm")) img = "assets/cooking-family-meal.jpg";
          else if (t.includes("đầu bếp") || t.includes("tiệc")) img = "assets/cooking-chef-prep.jpg";
          else if (t.includes("deep") || t.includes("sâu") || t.includes("tổng vệ sinh")) img = "assets/cleaning-deep.jpg";
          else img = "assets/cleaning-livingroom.jpg";
        }
        return { ...s, image_url: img };
      });
  }
  if (Array.isArray(remoteDb.bookings)) {
    remoteDb.bookings.forEach((b) => {
      if (b.notes && b.notes.includes("[BROADCAST_POOL]") && b.status === "pending") {
        b.provider_id = null;
        b.dispatch_type = "broadcast";
      }
    });
  }
}

async function fetchBootstrapData(isProd = false) {
  const { client, config } = getSupabaseClient();

  if (isProd) {
    if (!client) {
      return {
        ok: false,
        mode: "production",
        isProduction: true,
        connected: false,
        error: "Production Mode (Zero Mock Data) yêu cầu kết nối Supabase trực tiếp. Vui lòng cấu hình NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY."
      };
    }

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
        "support_tickets",
        "customer_addresses",
        "ticket_messages",
        "notifications",
        "audit_logs",
        "ai_conversations",
        "ai_messages"
      ];
      const results = await Promise.all(tables.map((t) => fetchSupabaseTable(client, t)));
      const hasError = results.find((r) => r.error);
      if (hasError) {
        return {
          ok: false,
          mode: "production",
          isProduction: true,
          connected: false,
          error: `Lỗi truy vấn Supabase trong Production Mode: ${hasError.error.message}`
        };
      }

      const remoteDb = {};
      results.forEach((r) => {
        remoteDb[r.name] = r.data || [];
      });
      // Đảm bảo alias đồng nhất cho cả province/provinces và ward/wards
      remoteDb.provinces = remoteDb.province;
      remoteDb.wards = remoteDb.ward;
      sanitizeServicesAndCategories(remoteDb);

      // Zero mock: Không tự động inject session giả định
      remoteDb.session = null;
      remoteDb.provider_public_profiles = computeProviderPublicProfiles(remoteDb);

      return {
        ok: true,
        mode: "production",
        isProduction: true,
        connected: true,
        supabaseUrl: config.supabaseUrl,
        data: remoteDb
      };
    } catch (err) {
      return {
        ok: false,
        mode: "production",
        isProduction: true,
        connected: false,
        error: `Lỗi kết nối Supabase trong Production Mode: ${err.message}`
      };
    }
  }

  // Chế độ Local / Hybrid Dev
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
        "support_tickets",
        "customer_addresses",
        "ticket_messages",
        "notifications",
        "audit_logs",
        "ai_conversations",
        "ai_messages"
      ];
      const results = await Promise.all(tables.map((t) => fetchSupabaseTable(client, t)));
      const hasError = results.some((r) => r.error);
      if (!hasError) {
        const remoteDb = {
          session: localDb.session
        };
        results.forEach((r) => {
          remoteDb[r.name] = r.data || [];
        });
        remoteDb.provinces = remoteDb.province;
        remoteDb.wards = remoteDb.ward;
        sanitizeServicesAndCategories(remoteDb);

        if ((remoteDb.province || []).length > 0 && (remoteDb.services || []).length > 0) {
          remoteDb.provider_public_profiles = computeProviderPublicProfiles(remoteDb);
          return {
            ok: true,
            mode: "supabase",
            connected: true,
            isProduction: false,
            supabaseUrl: config.supabaseUrl,
            data: remoteDb
          };
        }
      }
    } catch (_) {}
  }

  sanitizeServicesAndCategories(localDb);
  localDb.provider_public_profiles = computeProviderPublicProfiles(localDb);
  return {
    ok: true,
    mode: client ? "supabase_unseeded_fallback" : "local_sql_store",
    connected: Boolean(client),
    isProduction: false,
    supabaseUrl: config.supabaseUrl || null,
    data: localDb
  };
}

// ---------------------------------------------------------------------
// 4. XỬ LÝ REST API ENDPOINTS
// ---------------------------------------------------------------------
const GEO_CACHE = new Map();

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

// ---------------------------------------------------------------------
// 3.5. CÁC HÀM TRỢ GIÚP HỆ THỐNG: THÔNG BÁO, AUDIT LOG & HẾT HẠN TỰ ĐỘNG
// ---------------------------------------------------------------------
async function dispatchNotification(db, { user_id, title, body, type, link, entity_id, isProd, client }) {
  const notif = {
    notification_id: isProd ? crypto.randomUUID() : Math.max(900, ...(db?.notifications || []).map(n => typeof n.notification_id === 'number' ? n.notification_id : 0)) + 1,
    user_id: String(user_id),
    title: String(title || "Thông báo"),
    body: String(body || ""),
    type: String(type || "system"),
    link: link || null,
    is_read: false,
    created_at: new Date().toISOString()
  };
  if (isProd && client) {
    try {
      await client.from("notifications").insert([notif]);
    } catch (e) {
      console.warn("[dispatchNotification Prod Warning]", e.message);
    }
  } else if (db) {
    if (!Array.isArray(db.notifications)) db.notifications = [];
    db.notifications.unshift(notif);
    saveLocalDb(db);
  }
  return notif;
}

async function logAudit(db, { actor_id, action, target_entity, target_id, details, isProd, client }) {
  const logRow = {
    log_id: isProd ? crypto.randomUUID() : Math.max(9000, ...(db?.audit_logs || []).map(a => typeof a.log_id === 'number' ? a.log_id : 0)) + 1,
    actor_id: actor_id || "system",
    action: String(action),
    target_entity: String(target_entity),
    target_id: target_id ? String(target_id) : null,
    details: typeof details === "object" ? JSON.stringify(details) : String(details || ""),
    created_at: new Date().toISOString()
  };
  if (isProd && client) {
    try {
      await client.from("audit_logs").insert([logRow]);
    } catch (e) {
      console.warn("[logAudit Prod Warning]", e.message);
    }
  } else if (db) {
    if (!Array.isArray(db.audit_logs)) db.audit_logs = [];
    db.audit_logs.unshift(logRow);
    saveLocalDb(db);
  }
  return logRow;
}

async function autoExpirePendingBookings(db, isProd, client) {
  let count = 0;
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if (isProd && client) {
    try {
      const { data: expiredBks } = await client
        .from("bookings")
        .select("*")
        .eq("status", "pending")
        .lt("created_at", cutoffTime);
      if (Array.isArray(expiredBks) && expiredBks.length > 0) {
        for (const bk of expiredBks) {
          await client.from("bookings").update({ status: "auto_cancelled", updated_at: new Date().toISOString() }).eq("booking_id", bk.booking_id);
          await client.from("booking_status_history").insert([{
            booking_id: bk.booking_id,
            previous_status: "pending",
            new_status: "auto_cancelled",
            changed_by: null,
            reason: "Hệ thống tự động hủy sau 24 giờ không có thợ nhận (FR-BOOK-007)"
          }]);
          const { data: cp } = await client.from("customer_profiles").select("user_id").eq("customer_id", bk.customer_id).maybeSingle();
          if (cp && cp.user_id) {
            await dispatchNotification(null, {
              user_id: cp.user_id,
              title: "Đơn đặt lịch đã hết hạn",
              body: `Đơn #${bk.booking_id} đã tự động hủy do chưa có thợ nhận sau 24h. Quý khách vui lòng thử lại vào khung giờ khác.`,
              type: "booking_cancelled",
              link: "#1.3",
              isProd: true,
              client
            });
          }
          count++;
        }
      }
    } catch (e) {
      console.warn("[autoExpire Prod Error]", e.message);
    }
  } else if (db && Array.isArray(db.bookings)) {
    const expiredBks = db.bookings.filter((b) => b.status === "pending" && b.created_at && b.created_at < cutoffTime);
    for (const bk of expiredBks) {
      bk.status = "auto_cancelled";
      bk.updated_at = new Date().toISOString();
      if (!Array.isArray(db.booking_status_history)) db.booking_status_history = [];
      const nextHistoryId = Math.max(5000, ...db.booking_status_history.map((h) => h.history_id || 0)) + 1;
      db.booking_status_history.unshift({
        history_id: nextHistoryId,
        booking_id: bk.booking_id,
        previous_status: "pending",
        new_status: "auto_cancelled",
        changed_by: "system-cron",
        reason: "Hệ thống tự động hủy sau 24 giờ không có thợ nhận (FR-BOOK-007)",
        created_at: new Date().toISOString()
      });
      const cp = (db.customer_profiles || []).find((c) => Number(c.customer_id) === Number(bk.customer_id));
      if (cp && cp.user_id) {
        dispatchNotification(db, {
          user_id: cp.user_id,
          title: "Đơn đặt lịch đã hết hạn",
          body: `Đơn #${bk.booking_id} đã tự động hủy do chưa có thợ nhận sau 24h. Quý khách vui lòng thử lại vào khung giờ khác.`,
          type: "booking_cancelled",
          link: "#1.3",
          isProd: false
        });
      }
      count++;
    }
    if (count > 0) {
      saveLocalDb(db);
    }
  }
  return count;
}

async function handleApiRequest(req, res, pathname, searchParams = new URLSearchParams()) {
  const method = req.method.toUpperCase();
  const isProd = isProductionMode(req, searchParams);
  const db = isProd ? null : ensureLocalDb();
  const { client, config, error: clientErr } = getSupabaseClient();

  // 4.1. GET /api/status — Kiểm tra cấu hình và kết nối
  if (method === "GET" && pathname === "/api/status") {
    let supabaseReachable = false;
    let supabaseMessage = "";

    if (client) {
      try {
        let testRes = await client.from("provinces").select("provinceId").limit(1);
        if (testRes.error) {
          testRes = await client.from("province").select("provinceId").limit(1);
        }
        const pingErr = testRes.error;
        if (!pingErr) {
          supabaseReachable = true;
          supabaseMessage = isProd
            ? "Đang chạy chế độ Production Mode (Zero Mock Data) — Kết nối trực tiếp Supabase PostgreSQL."
            : "Đã kết nối trực tiếp tới Supabase PostgreSQL qua @supabase/supabase-js.";
        } else {
          supabaseMessage = `Đã nhận khóa từ .env.local nhưng truy vấn bảng 'provinces'/'province' trả về: ${pingErr.message}`;
        }
      } catch (err) {
        supabaseMessage = `Lỗi kết nối tới Supabase: ${err.message}`;
      }
    } else {
      supabaseMessage = isProd
        ? "Production Mode yêu cầu cấu hình Supabase hợp lệ trong .env.local. Đã ngắt hoàn toàn nạp dữ liệu mẫu."
        : "Đang vận hành trên Persistent Local SQL Store (backend/data/local-db.json).";
    }

    const tableCounts = {};
    if (isProd && supabaseReachable) {
      try {
        const [pRes, wRes, uRes, bRes, rRes] = await Promise.all([
          client.from("provinces").select("provinceId", { count: "exact", head: true }),
          client.from("wards").select("ward_id", { count: "exact", head: true }),
          client.from("users").select("user_id", { count: "exact", head: true }),
          client.from("bookings").select("booking_id", { count: "exact", head: true }),
          client.from("reviews").select("review_id", { count: "exact", head: true })
        ]);
        tableCounts.province = pRes.count ?? (pRes.error ? 0 : 34);
        tableCounts.ward = wRes.count ?? (wRes.error ? 0 : 3321);
        tableCounts.users = uRes.count || 0;
        tableCounts.bookings = bRes.count || 0;
        tableCounts.reviews = rRes.count || 0;
      } catch (_) {}
    } else if (db) {
      tableCounts.province = (db.province || []).length;
      tableCounts.ward = (db.ward || []).length;
      tableCounts.users = (db.users || []).length;
      tableCounts.customer_profiles = (db.customer_profiles || []).length;
      tableCounts.provider_profiles = (db.provider_profiles || []).length;
      tableCounts.service_categories = (db.service_categories || []).length;
      tableCounts.services = (db.services || []).length;
      tableCounts.bookings = (db.bookings || []).length;
      tableCounts.reviews = (db.reviews || []).length;
      tableCounts.support_tickets = (db.support_tickets || []).length;
      tableCounts.customer_addresses = (db.customer_addresses || []).length;
      tableCounts.ticket_messages = (db.ticket_messages || []).length;
      tableCounts.notifications = (db.notifications || []).length;
      tableCounts.audit_logs = (db.audit_logs || []).length;
      tableCounts.ai_conversations = (db.ai_conversations || []).length;
      tableCounts.ai_messages = (db.ai_messages || []).length;
    }

    return sendJson(res, 200, {
      ok: true,
      mode: isProd ? "production" : (supabaseReachable ? "supabase" : "local_sql_store"),
      isProduction: isProd,
      envFile: ".env.local",
      hasSupabaseUrl: Boolean(config.supabaseUrl),
      hasAnonKey: Boolean(config.supabaseAnonKey),
      hasServiceRoleKey: Boolean(config.supabaseServiceKey),
      supabaseUrlPreview: config.supabaseUrl
        ? config.supabaseUrl.replace(/^(https?:\/\/[^.]+)\..*$/, "$1.supabase.co")
        : null,
      supabaseReachable,
      message: supabaseMessage,
      tableCounts
    });
  }

  // 4.2. GET /api/bootstrap — Tải 16 bảng + View provider_public_profiles
  if (method === "GET" && pathname === "/api/bootstrap") {
    const boot = await fetchBootstrapData(isProd);
    if (isProd && !boot.ok) {
      return sendJson(res, 503, boot);
    }
    return sendJson(res, 200, {
      ok: true,
      mode: boot.mode,
      isProduction: isProd,
      connected: boot.connected,
      db: boot.data
    });
  }

  // 4.3. POST /api/supabase/reset-local — Khôi phục dữ liệu mẫu chuẩn SQL (Chỉ cho Local)
  if (method === "POST" && pathname === "/api/supabase/reset-local") {
    if (isProd) {
      return sendJson(res, 403, {
        ok: false,
        error: "Không thể reset dữ liệu mẫu ở chế độ Production Mode (Zero Mock Data)."
      });
    }
    const fresh = createInitialDatabase();
    saveLocalDb(fresh);
    fresh.provider_public_profiles = computeProviderPublicProfiles(fresh);
    return sendJson(res, 200, {
      ok: true,
      message: "Đã khôi phục dữ liệu chuẩn SQL (16 bảng) về trạng thái mặc định.",
      db: fresh
    });
  }

  // 4.4. POST /api/auth/register — Đăng ký tài khoản mới (Hỗ trợ Cold Start)
  if (method === "POST" && pathname === "/api/auth/register") {
    const body = await parseBody(req);
    const fullName = String(body.full_name || "").trim();
    const phone = String(body.phone_number || "").trim();
    const email = String(body.email || "").trim();
    const password = String(body.password || "").trim();
    const role = body.role === "provider" ? "provider" : "customer";

    if (!fullName || !phone) {
      return sendJson(res, 400, { ok: false, error: "Họ tên và số điện thoại là bắt buộc." });
    }
    if (!password || password.length < 6) {
      return sendJson(res, 400, { ok: false, error: "Mật khẩu là bắt buộc và phải có tối thiểu 6 ký tự." });
    }

    if (isProd) {
      if (!client) {
        return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      }
      const { data: existingUser } = await client.from("users").select("user_id").eq("phone_number", phone).maybeSingle();
      if (existingUser) {
        return sendJson(res, 409, { ok: false, error: "Số điện thoại đã tồn tại trong cơ sở dữ liệu Supabase." });
      }

      const userEmail = email || `${phone}@giadinhxanh.vn`;
      let authUserId = null;

      // 1. Tạo auth user trên auth.users (Supabase Auth) để thỏa mãn khóa ngoại:
      // foreign key (user_id) references auth.users(id) ON DELETE CASCADE
      if (client.auth && client.auth.admin && config.supabaseServiceKey) {
        const { data: authData, error: authErr } = await client.auth.admin.createUser({
          email: userEmail,
          password: password,
          email_confirm: true,
          user_metadata: { full_name: fullName, phone_number: phone, role }
        });
        if (authErr) {
          if (authErr.message && authErr.message.toLowerCase().includes("already been registered")) {
            const { data: listData } = await client.auth.admin.listUsers();
            const found = listData && listData.users ? listData.users.find((u) => u.email === userEmail) : null;
            if (found) authUserId = found.id;
          }
          if (!authUserId) {
            return sendJson(res, 400, { ok: false, error: `Lỗi Supabase Auth: ${authErr.message}` });
          }
        } else if (authData && authData.user) {
          authUserId = authData.user.id;
        }
      } else if (client.auth && client.auth.signUp) {
        const { data: authData, error: authErr } = await client.auth.signUp({
          email: userEmail,
          password: password,
          options: { data: { full_name: fullName, phone_number: phone, role } }
        });
        if (authErr) {
          return sendJson(res, 400, { ok: false, error: `Lỗi Supabase Auth: ${authErr.message}` });
        }
        if (authData && authData.user) {
          authUserId = authData.user.id;
        }
      }

      if (!authUserId) {
        authUserId = crypto.randomUUID();
      }

      const nowIso = new Date().toISOString();
      // Bảng public.users trong 4. home_service_booking_supabase.sql:
      // (user_id UUID, full_name, phone_number, role, is_active, created_at, updated_at) - KHÔNG CÓ cột email
      const publicUserRow = {
        user_id: authUserId,
        full_name: fullName,
        phone_number: phone,
        role,
        is_active: true,
        created_at: nowIso,
        updated_at: nowIso
      };

      const { data: created, error: insErr } = await client.from("users").insert([publicUserRow]).select().single();
      if (insErr) {
        return sendJson(res, 500, { ok: false, error: `Lỗi tạo tài khoản Supabase: ${insErr.message}` });
      }

      return sendJson(res, 201, {
        ok: true,
        user: {
          ...(created || publicUserRow),
          email: userEmail
        }
      });
    }

    // Local mode
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
      password: password,
      role,
      is_active: true,
      created_at: nowIso,
      updated_at: nowIso
    };
    db.users.push(newUser);
    saveLocalDb(db);

    return sendJson(res, 201, {
      ok: true,
      user: {
        user_id: newUser.user_id,
        full_name: newUser.full_name,
        phone_number: newUser.phone_number,
        email: newUser.email,
        role: newUser.role,
        is_active: newUser.is_active,
        created_at: newUser.created_at,
        updated_at: newUser.updated_at
      }
    });
  }

  // 4.4b. POST /api/auth/login — Đăng nhập xác thực bằng SĐT/Email và Mật khẩu
  if (method === "POST" && pathname === "/api/auth/login") {
    const body = await parseBody(req);
    const identifier = String(body.identifier || "").trim();
    const password = String(body.password || "").trim();

    if (!identifier || !password) {
      return sendJson(res, 400, { ok: false, error: "Vui lòng nhập tài khoản (số điện thoại hoặc email) và mật khẩu." });
    }

    if (isProd) {
      if (!client) {
        return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      }

      let targetEmail = identifier.includes("@") ? identifier : null;
      let matchedUser = null;

      if (!targetEmail) {
        const { data: uByPhone } = await client
          .from("users")
          .select("*")
          .eq("phone_number", identifier)
          .maybeSingle();

        if (uByPhone) {
          matchedUser = uByPhone;
          if (client.auth && client.auth.admin && config.supabaseServiceKey) {
            try {
              const { data: authInfo } = await client.auth.admin.getUserById(uByPhone.user_id);
              if (authInfo && authInfo.user && authInfo.user.email) {
                targetEmail = authInfo.user.email;
              }
            } catch (_) {}
          }
          if (!targetEmail) {
            targetEmail = `${identifier}@giadinhxanh.vn`;
          }
        } else {
          targetEmail = `${identifier}@giadinhxanh.vn`;
        }
      }

      let authUser = null;
      let sessionData = null;

      if (client.auth && client.auth.signInWithPassword) {
        const { data: signData, error: signErr } = await client.auth.signInWithPassword({
          email: targetEmail,
          password
        });

        if (signErr) {
          let retryErr = signErr;
          if (!identifier.includes("@") && targetEmail !== `${identifier}@giadinhxanh.vn`) {
            const { data: retryData, error: rErr } = await client.auth.signInWithPassword({
              email: `${identifier}@giadinhxanh.vn`,
              password
            });
            if (!rErr && retryData && retryData.user) {
              authUser = retryData.user;
              sessionData = retryData.session;
              retryErr = null;
            }
          }

          if (retryErr) {
            return sendJson(res, 401, {
              ok: false,
              error: "Số điện thoại / email hoặc mật khẩu không chính xác."
            });
          }
        } else if (signData && signData.user) {
          authUser = signData.user;
          sessionData = signData.session;
        }
      }

      const userId = (authUser && authUser.id) || (matchedUser && matchedUser.user_id);
      if (!matchedUser && userId) {
        const { data: u } = await client.from("users").select("*").eq("user_id", userId).maybeSingle();
        matchedUser = u;
      }

      if (!matchedUser) {
        return sendJson(res, 404, { ok: false, error: "Không tìm thấy hồ sơ người dùng trong hệ thống." });
      }

      let customerProfile = null;
      let providerProfile = null;

      if (matchedUser.role === "customer") {
        const { data: cp } = await client.from("customer_profiles").select("*").eq("user_id", matchedUser.user_id).maybeSingle();
        customerProfile = cp;
      } else if (matchedUser.role === "provider") {
        const { data: pp } = await client.from("provider_profiles").select("*").eq("user_id", matchedUser.user_id).maybeSingle();
        providerProfile = pp;
      }

      return sendJson(res, 200, {
        ok: true,
        user: {
          ...matchedUser,
          email: (authUser && authUser.email) || targetEmail
        },
        session: sessionData,
        customer_profile: customerProfile,
        provider_profile: providerProfile
      });
    }

    // Local Mode
    const found = db.users.find((u) => u.phone_number === identifier || u.email === identifier);
    if (!found) {
      return sendJson(res, 404, { ok: false, error: "Tài khoản không tồn tại trên hệ thống. Vui lòng đăng ký mới." });
    }

    if (found.password && found.password !== password) {
      return sendJson(res, 401, { ok: false, error: "Mật khẩu không chính xác. Vui lòng kiểm tra lại." });
    }
    if (!found.password) {
      found.password = password;
      saveLocalDb(db);
    }

    const customerProfile = db.customer_profiles ? db.customer_profiles.find((c) => String(c.user_id) === String(found.user_id)) : null;
    const providerProfile = db.provider_profiles ? db.provider_profiles.find((p) => String(p.user_id) === String(found.user_id)) : null;

    return sendJson(res, 200, {
      ok: true,
      user: {
        user_id: found.user_id,
        full_name: found.full_name,
        phone_number: found.phone_number,
        email: found.email,
        role: found.role,
        is_active: found.is_active,
        created_at: found.created_at,
        updated_at: found.updated_at
      },
      customer_profile: customerProfile,
      provider_profile: providerProfile
    });
  }

  // 4.5. POST /api/onboarding/customer — Lưu hồ sơ khách hàng mới (Cold Start 0.2)
  if (method === "POST" && pathname === "/api/onboarding/customer") {
    const body = await parseBody(req);
    const userId = body.user_id || (db && db.session && db.session.customer_user_id) || "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    if (!userId) {
      return sendJson(res, 400, { ok: false, error: "user_id là bắt buộc trong luồng onboarding." });
    }

    if (isProd) {
      if (!client) {
        return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      }
      if (body.full_name || body.phone_number) {
        const updateFields = { updated_at: new Date().toISOString() };
        if (body.full_name) updateFields.full_name = String(body.full_name).trim();
        if (body.phone_number) updateFields.phone_number = String(body.phone_number).trim();
        await client.from("users").update(updateFields).eq("user_id", userId);
      }

      const { data: existingCp } = await client.from("customer_profiles").select("customer_id").eq("user_id", userId).maybeSingle();
      let cpRow;
      if (existingCp) {
        const { data: upd, error: updErr } = await client.from("customer_profiles").update({
          ward_id: String(body.ward_id || "27403"),
          default_address: String(body.default_address || "").trim(),
          latitude: Number(body.latitude) || 10.728912,
          longitude: Number(body.longitude) || 106.712405,
          updated_at: new Date().toISOString()
        }).eq("customer_id", existingCp.customer_id).select().single();
        if (updErr) return sendJson(res, 500, { ok: false, error: updErr.message });
        cpRow = upd;
      } else {
        const { data: ins, error: insErr } = await client.from("customer_profiles").insert([{
          user_id: userId,
          ward_id: String(body.ward_id || "27403"),
          default_address: String(body.default_address || "").trim(),
          latitude: Number(body.latitude) || 10.728912,
          longitude: Number(body.longitude) || 106.712405
        }]).select().single();
        if (insErr) return sendJson(res, 500, { ok: false, error: insErr.message });
        cpRow = ins;
      }
      return sendJson(res, 200, { ok: true, customer_profile: cpRow });
    }

    // Local mode
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
      const nextCid = Math.max(100, ...db.customer_profiles.map((c) => c.customer_id || 0)) + 1;
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

    if (isProd) {
      if (!client) {
        return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      }
      const userId = body.user_id;
      const { data: dup } = await client.from("provider_profiles").select("provider_id").eq("id_card_number", idCard).maybeSingle();
      if (dup && dup.user_id !== userId) {
        return sendJson(res, 409, { ok: false, error: "Số CCCD bị trùng với hồ sơ thợ khác trong Supabase." });
      }

      const { data: pp, error: ppErr } = await client.from("provider_profiles").upsert([{
        user_id: userId,
        id_card_number: idCard,
        info: String(body.info || "").trim(),
        avatar_url: String(body.avatar_url || "assets/provider-lan.jpg").trim(),
        verification_status: "pending",
        updated_at: new Date().toISOString()
      }]).select().single();

      if (ppErr) return sendJson(res, 500, { ok: false, error: ppErr.message });
      return sendJson(res, 200, { ok: true, provider_profile: pp });
    }

    // Local mode
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

  // 4.7. PUT /api/profile/customer — Cập nhật Hồ sơ cá nhân (1.5)
  if (method === "PUT" && (pathname === "/api/profile/customer" || pathname === "/api/customer/profile")) {
    const body = await parseBody(req);
    const customerId = Number(body.customer_id);
    const userId = body.user_id ? String(body.user_id) : null;

    if (isProd) {
      if (!client) return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });

      // Cập nhật bảng users nếu có đổi tên hoặc số điện thoại
      if (userId && (body.full_name || body.phone_number)) {
        const uFields = { updated_at: new Date().toISOString() };
        if (body.full_name) uFields.full_name = String(body.full_name).trim();
        if (body.phone_number) uFields.phone_number = String(body.phone_number).trim();
        await client.from("users").update(uFields).eq("user_id", userId);
      }

      const updateData = {
        ward_id: String(body.ward_id || "27403"),
        default_address: String(body.default_address || "").trim(),
        latitude: Number(body.latitude) || 10.728912,
        longitude: Number(body.longitude) || 106.712405,
        updated_at: new Date().toISOString()
      };

      let cpQuery = client.from("customer_profiles").update(updateData);
      if (customerId && !isNaN(customerId)) {
        cpQuery = cpQuery.eq("customer_id", customerId);
      } else if (userId) {
        cpQuery = cpQuery.eq("user_id", userId);
      } else {
        return sendJson(res, 400, { ok: false, error: "Cần cung cấp customer_id hoặc user_id." });
      }

      const { data: cp, error: cpErr } = await cpQuery.select().single();
      if (cpErr) return sendJson(res, 500, { ok: false, error: cpErr.message });
      return sendJson(res, 200, { ok: true, customer_profile: cp });
    }

    // Local mode
    let cp = customerId && !isNaN(customerId) ? db.customer_profiles.find((c) => c.customer_id === customerId) : null;
    if (!cp && userId) {
      cp = db.customer_profiles.find((c) => c.user_id === userId);
    }
    if (!cp) {
      cp = db.customer_profiles[0];
    }
    if (!cp) return sendJson(res, 404, { ok: false, error: "Không tìm thấy hồ sơ khách hàng." });

    const u = db.users.find((x) => x.user_id === cp.user_id || x.user_id === userId);
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

  // 4.7b. GET /api/geo/reverse — Reverse Geocoding tự động nhận diện địa chỉ từ GPS & Pin Drop
  if (method === "GET" && pathname === "/api/geo/reverse") {
    const rawLat = searchParams.get("lat");
    const rawLng = searchParams.get("lng");

    if (!rawLat || !rawLng) {
      return sendJson(res, 400, { ok: false, error: "Vĩ độ (lat) và kinh độ (lng) không được để trống." });
    }

    const lat = Number(rawLat);
    const lng = Number(rawLng);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return sendJson(res, 400, { ok: false, error: "Vĩ độ (lat) và kinh độ (lng) không hợp lệ." });
    }

    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (GEO_CACHE.has(cacheKey)) {
      return sendJson(res, 200, GEO_CACHE.get(cacheKey));
    }

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=vi`;
      const fetchRes = await fetch(url, {
        headers: {
          "User-Agent": "GiaDinhXanh/1.0 (contact@giadinhxanh.vn)"
        }
      });

      if (!fetchRes.ok) {
        throw new Error(`Nominatim HTTP ${fetchRes.status}`);
      }

      const data = await fetchRes.json();
      const addr = data.address || {};

      // 1. Số nhà & Tên đường / Địa danh cụ thể
      const placeName = addr.amenity || addr.building || addr.shop || addr.tourism || addr.office || addr.leisure || "";
      const houseNumber = addr.house_number || "";
      const road = addr.road || addr.street || addr.pedestrian || "";
      const residential = addr.residential || addr.neighbourhood || "";

      let detailedAddress = "";
      if (placeName && road) {
        detailedAddress = `${placeName}, Đường ${road.replace(/^Đường\s+/i, "")}`;
      } else if (placeName) {
        detailedAddress = placeName + (residential ? `, ${residential}` : "");
      } else if (houseNumber && road) {
        detailedAddress = `Số ${houseNumber} Đường ${road.replace(/^Đường\s+/i, "")}`;
      } else if (road) {
        detailedAddress = `Đường ${road.replace(/^Đường\s+/i, "")}`;
      } else if (residential) {
        detailedAddress = residential;
      } else {
        detailedAddress = data.name || (data.display_name ? data.display_name.split(",")[0] : "");
      }

      // 2. Phường / Xã / Thị trấn
      const wardName = addr.suburb || addr.quarter || addr.village || addr.town || addr.city_district || "";

      // 3. Quận / Huyện / Thị xã / TP trực thuộc
      const districtName = addr.city_district || addr.county || addr.district || "";

      // 4. Tỉnh / Thành phố
      const provinceName = addr.city || addr.province || addr.state || "";

      const result = {
        ok: true,
        detailed_address: detailedAddress.trim(),
        full_address: data.display_name || detailedAddress,
        ward_name: wardName,
        district_name: districtName,
        province_name: provinceName,
        lat,
        lng,
        raw: addr
      };

      GEO_CACHE.set(cacheKey, result);
      if (GEO_CACHE.size > 200) {
        const firstKey = GEO_CACHE.keys().next().value;
        GEO_CACHE.delete(firstKey);
      }

      return sendJson(res, 200, result);
    } catch (err) {
      console.warn("[Reverse Geocode Warning]", err.message);
      return sendJson(res, 200, {
        ok: false,
        error: err.message,
        detailed_address: "",
        lat,
        lng
      });
    }
  }

  // 4.8. PATCH /api/provider/online-gps — Component 2.5: Bật/tắt nhận việc & tọa độ
  if (method === "PATCH" && pathname === "/api/provider/online-gps") {
    const body = await parseBody(req);
    const providerId = Number(body.provider_id || 201);

    if (isProd) {
      if (!client) return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      const updates = { updated_at: new Date().toISOString() };
      if (typeof body.is_available_online === "boolean") updates.is_available_online = body.is_available_online;
      if (body.lattitude !== undefined) updates.lattitude = Number(body.lattitude);
      if (body.longtitude !== undefined) updates.longtitude = Number(body.longtitude);
      const { data: pp, error: err } = await client.from("provider_profiles").update(updates).eq("provider_id", providerId).select().single();
      if (err) return sendJson(res, 500, { ok: false, error: err.message });
      return sendJson(res, 200, { ok: true, provider_profile: pp });
    }

    const pp = db.provider_profiles.find((p) => p.provider_id === providerId);
    if (!pp) return sendJson(res, 404, { ok: false, error: "Không tìm thấy hồ sơ thợ." });
    if (typeof body.is_available_online === "boolean") pp.is_available_online = body.is_available_online;
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

    if (isProd) {
      if (!client) return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      if (Array.isArray(body.service_ids)) {
        await client.from("provider_services").delete().eq("provider_id", providerId);
        const pServices = body.service_ids.map((sid) => ({ provider_id: providerId, service_id: Number(sid) }));
        if (pServices.length > 0) await client.from("provider_services").insert(pServices);
      }
      if (Array.isArray(body.ward_ids)) {
        await client.from("provider_areas").delete().eq("provider_id", providerId);
        const pAreas = body.ward_ids.map((wid) => ({ provider_id: providerId, ward_id: String(wid) }));
        if (pAreas.length > 0) await client.from("provider_areas").insert(pAreas);
      }
      return sendJson(res, 200, { ok: true, message: "Đã cập nhật kỹ năng và khu vực vào Supabase." });
    }

    const pp = db.provider_profiles.find((p) => p.provider_id === providerId);
    if (!pp) return sendJson(res, 404, { ok: false, error: "Không tìm thấy hồ sơ thợ." });
    if (body.info !== undefined) pp.info = String(body.info).trim();
    if (body.avatar_url !== undefined) pp.avatar_url = String(body.avatar_url).trim();
    pp.updated_at = new Date().toISOString();

    if (Array.isArray(body.service_ids)) {
      db.provider_services = db.provider_services.filter((ps) => ps.provider_id !== providerId);
      body.service_ids.forEach((sid, idx) => {
        db.provider_services.push({ id_pro_ser: Date.now() + idx, provider_id: providerId, service_id: Number(sid) });
      });
    }
    if (Array.isArray(body.ward_ids)) {
      db.provider_areas = db.provider_areas.filter((pa) => pa.provider_id !== providerId);
      body.ward_ids.forEach((wid, idx) => {
        db.provider_areas.push({ area_id: Date.now() + idx, provider_id: providerId, ward_id: String(wid) });
      });
    }
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, provider_profile: pp });
  }

  // 4.10. POST /api/bookings — Màn hình 1.2: Tạo đơn đặt lịch mới (Cold Start an toàn)
  if (method === "POST" && pathname === "/api/bookings") {
    const body = await parseBody(req);
    const rawServiceId = body.service_id;
    const rawCustomerId = body.customer_id;
    const rawProviderId = body.provider_id;
    const address = String(body.address || "").trim();
    const wardId = String(body.ward_id || "27403").trim();

    const serviceId = rawServiceId !== undefined && rawServiceId !== null && String(rawServiceId).trim() !== ""
      ? (!isNaN(Number(rawServiceId)) ? Number(rawServiceId) : String(rawServiceId).trim())
      : null;

    const customerId = rawCustomerId !== undefined && rawCustomerId !== null && String(rawCustomerId).trim() !== ""
      ? (!isNaN(Number(rawCustomerId)) ? Number(rawCustomerId) : String(rawCustomerId).trim())
      : null;

    const isBroadcast = (rawProviderId === null || rawProviderId === undefined || rawProviderId === "broadcast" || String(rawProviderId).trim() === "");
    const providerId = isBroadcast
      ? null
      : (!isNaN(Number(rawProviderId)) ? Number(rawProviderId) : String(rawProviderId).trim());

    if (!serviceId || !wardId || !address || !customerId) {
      return sendJson(res, 400, { ok: false, error: "Vui lòng điền đầy đủ dịch vụ, khách hàng, phường/xã và địa chỉ." });
    }

    const isUuid = (val) => typeof val === "string" && val.includes("-");
    const useSupabase = Boolean(client) && (isProd || isUuid(serviceId) || isUuid(customerId));

    if (useSupabase) {
      const nowIso = new Date().toISOString();
      const targetProvId = isBroadcast ? null : providerId;

      // Kiểm tra trùng lịch và ngày nghỉ nếu đặt trực tiếp thợ
      if (targetProvId) {
        const reqDate = (body.scheduled_time || nowIso).slice(0, 10);
        const { data: exceptions } = await client
          .from("availability_exceptions")
          .select("*")
          .eq("provider_id", targetProvId)
          .eq("exception_date", reqDate);
        if (exceptions && exceptions.some(ex => ex.is_available !== true)) {
          return sendJson(res, 409, {
            ok: false,
            conflict: true,
            error: "Thợ đã đăng ký nghỉ làm hoặc bận vào ngày này. Vui lòng chọn ngày khác hoặc để hệ thống tìm thợ tự động."
          });
        }

        const reqTime = new Date(body.scheduled_time || nowIso).getTime();
        const { data: existingBks } = await client
          .from("bookings")
          .select("booking_id, scheduled_time, status")
          .eq("provider_id", targetProvId)
          .in("status", ["confirmed", "in_progress"]);
        if (existingBks && existingBks.length > 0) {
          const conflict = existingBks.some(b => {
            const bTime = new Date(b.scheduled_time).getTime();
            return Math.abs(reqTime - bTime) < 2 * 60 * 60 * 1000;
          });
          if (conflict) {
            return sendJson(res, 409, {
              ok: false,
              conflict: true,
              error: "Thợ đã có lịch hẹn trùng hoặc quá sát khung giờ này (cần cách tối thiểu 2 giờ). Vui lòng chọn giờ khác hoặc tìm thợ tự động."
            });
          }
        }
      }

      let finalProvId = targetProvId;
      if (!finalProvId) {
        const { data: anyProv } = await client.from("provider_profiles").select("provider_id").limit(1).maybeSingle();
        finalProvId = anyProv ? anyProv.provider_id : "00000000-0000-4000-8000-000000000200";
      }

      // Đảm bảo ward_id tồn tại trong bảng ward/wards của Supabase
      let validWardId = wardId;
      let wardTarget = "ward";
      let { data: wardList, error: wErr } = await client.from("ward").select("ward_id").eq("ward_id", validWardId).limit(1);
      if (wErr) {
        wardTarget = "wards";
        const wRes = await client.from("wards").select("ward_id").eq("ward_id", validWardId).limit(1);
        wardList = wRes.data;
      }
      if (!wardList || wardList.length === 0) {
        const { data: fallbackWards } = await client.from(wardTarget).select("ward_id").limit(1);
        if (fallbackWards && fallbackWards.length > 0) {
          validWardId = fallbackWards[0].ward_id;
        }
      }

      const newBk = {
        customer_id: customerId,
        provider_id: finalProvId,
        service_id: serviceId,
        scheduled_time: body.scheduled_time || nowIso,
        status: "pending",
        address,
        ward_id: validWardId,
        latitude: Number(body.latitude) || 10.728912,
        longitude: Number(body.longitude) || 106.712405,
        total_amount: Number(body.total_amount) || 180000,
        total_incidental: 0,
        notes: (isBroadcast ? "[BROADCAST_POOL] " : "") + String(body.notes || "Khách đặt lịch qua hệ thống.").trim(),
        payment_status: "unpaid"
      };

      const { data: createdBk, error: bkErr } = await client.from("bookings").insert([newBk]).select().single();
      if (bkErr) return sendJson(res, 500, { ok: false, error: `Lỗi tạo đơn Supabase: ${bkErr.message}` });

      if (isBroadcast && createdBk) {
        createdBk.provider_id = null;
        createdBk.dispatch_type = "broadcast";
      }

      await client.from("booking_status_history").insert([{
        booking_id: createdBk.booking_id,
        previous_status: null,
        new_status: "pending",
        changed_by: body.changed_by || null,
        reason: "Khách hàng tạo đơn đặt lịch"
      }]);

      const { data: cp } = await client.from("customer_profiles").select("user_id").eq("customer_id", customerId).maybeSingle();
      if (cp && cp.user_id) {
        await dispatchNotification(null, {
          user_id: cp.user_id,
          title: "Đặt lịch thành công!",
          body: `Đơn #${createdBk.booking_id} đã được tạo thành công. Hệ thống đang tiến hành điều phối thợ.`,
          type: "booking_created",
          link: "#1.3",
          isProd: true,
          client
        });
      }

      await logAudit(null, {
        actor_id: body.changed_by || customerId,
        action: "CREATE_BOOKING",
        target_entity: "bookings",
        target_id: createdBk.booking_id,
        details: { service_id: serviceId, provider_id: targetProvId, total_amount: newBk.total_amount },
        isProd: true,
        client
      });

      return sendJson(res, 201, { ok: true, booking: createdBk });
    }

    // Local mode
    const svc = db.services.find((s) => String(s.service_id) === String(serviceId));
    const nextId = Math.max(1040, ...db.bookings.map((b) => b.booking_id || 0)) + 1;
    const nowIso = new Date().toISOString();
    const chosenProviderId = isBroadcast ? null : providerId;

    // Kiểm tra trùng lịch và ngày nghỉ nếu đặt trực tiếp thợ
    if (chosenProviderId) {
      const reqDate = (body.scheduled_time || nowIso).slice(0, 10);
      const isDayOff = (db.availability_exceptions || []).some((ex) => {
        return String(ex.provider_id) === String(chosenProviderId) &&
          ex.exception_date === reqDate &&
          ex.is_available !== true;
      });
      if (isDayOff) {
        return sendJson(res, 409, {
          ok: false,
          conflict: true,
          error: "Thợ đã đăng ký nghỉ làm hoặc bận vào ngày này. Vui lòng chọn ngày khác hoặc để hệ thống tìm thợ tự động."
        });
      }

      const reqTime = new Date(body.scheduled_time || nowIso).getTime();
      const hasConflict = (db.bookings || []).some((b) => {
        if (String(b.provider_id) !== String(chosenProviderId)) return false;
        if (!["confirmed", "in_progress"].includes(b.status)) return false;
        const bTime = new Date(b.scheduled_time).getTime();
        return Math.abs(reqTime - bTime) < 2 * 60 * 60 * 1000;
      });
      if (hasConflict) {
        return sendJson(res, 409, {
          ok: false,
          conflict: true,
          error: "Thợ đã có lịch hẹn trùng hoặc quá sát khung giờ này (cần cách tối thiểu 2 giờ). Vui lòng chọn giờ khác hoặc tìm thợ tự động."
        });
      }
    }

    const newBooking = {
      booking_id: nextId,
      customer_id: customerId,
      provider_id: chosenProviderId,
      dispatch_type: isBroadcast ? "broadcast" : "direct",
      service_id: serviceId,
      scheduled_time: body.scheduled_time || nowIso,
      status: "pending",
      address,
      ward_id: wardId,
      latitude: Number(body.latitude) || 10.728912,
      longitude: Number(body.longitude) || 106.712405,
      total_amount: Number(body.total_amount) || (svc ? svc.price : 180000),
      total_incidental: 0,
      notes: (isBroadcast ? "[BROADCAST_POOL] " : "") + String(body.notes || "Khách đặt lịch qua Booking Wizard.").trim(),
      payment_status: "unpaid",
      created_at: nowIso,
      updated_at: nowIso
    };

    db.bookings.unshift(newBooking);
    const nextHistoryId = Math.max(5000, ...db.booking_status_history.map((h) => h.history_id || 0)) + 1;
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

    // Gửi thông báo đến khách hàng
    const cp = (db.customer_profiles || []).find((c) => String(c.customer_id) === String(customerId));
    if (cp && cp.user_id) {
      dispatchNotification(db, {
        user_id: cp.user_id,
        title: "Đặt lịch thành công!",
        body: `Đơn #${nextId} đã được tạo thành công. Hệ thống đang tiến hành điều phối thợ.`,
        type: "booking_created",
        link: "#1.3",
        isProd: false
      });
    }

    // Nếu đặt trực tiếp thợ, gửi thông báo cho thợ
    if (chosenProviderId) {
      const pp = (db.provider_profiles || []).find((p) => String(p.provider_id) === String(chosenProviderId));
      if (pp && pp.user_id) {
        dispatchNotification(db, {
          user_id: pp.user_id,
          title: "Đơn đặt lịch trực tiếp mới",
          body: `Khách hàng vừa đặt đơn #${nextId} trực tiếp với bạn vào ${newBooking.scheduled_time.slice(0, 16)}.`,
          type: "booking_created",
          link: "#2.2",
          isProd: false
        });
      }
    }

    logAudit(db, {
      actor_id: body.changed_by || customerId,
      action: "CREATE_BOOKING",
      target_entity: "bookings",
      target_id: nextId,
      details: { service_id: serviceId, provider_id: chosenProviderId, total_amount: newBooking.total_amount },
      isProd: false
    });

    saveLocalDb(db);
    return sendJson(res, 201, { ok: true, booking: newBooking, history: historyRow });
  }

  // 4.10b. POST /api/bookings/:id/accept — Đối tác Thợ nhận việc từ Hòm thư (Concurrency & Expired check)
  const acceptMatch = pathname.match(/^\/api\/bookings\/([^/]+)\/accept$/);
  if (method === "POST" && acceptMatch) {
    const rawBookingId = acceptMatch[1];
    const body = await parseBody(req);
    const providerId = body.provider_id;
    const actorUserId = body.user_id || body.changed_by;

    if (isProd) {
      if (!client) return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      const { data: curBk, error: fetchErr } = await client.from("bookings").select("*").eq("booking_id", rawBookingId).single();
      if (fetchErr || !curBk) {
        return sendJson(res, 404, { ok: false, error: "Không tìm thấy đơn hàng." });
      }
      if (curBk.status !== "pending") {
        return sendJson(res, 409, {
          ok: false,
          expired: true,
          error: "Rất tiếc! Đơn này vừa được một đối tác khác nhận trước hoặc đã hết hạn."
        });
      }
      const { data: updatedBk, error: updErr } = await client
        .from("bookings")
        .update({
          status: "confirmed",
          provider_id: providerId,
          updated_at: new Date().toISOString()
        })
        .eq("booking_id", rawBookingId)
        .eq("status", "pending")
        .select()
        .single();
      if (updErr || !updatedBk) {
        return sendJson(res, 409, {
          ok: false,
          expired: true,
          error: "Đơn hàng đã có người nhận trước hoặc không còn khả dụng."
        });
      }
      await client.from("booking_status_history").insert([{
        booking_id: rawBookingId,
        previous_status: "pending",
        new_status: "confirmed",
        changed_by: actorUserId,
        reason: "Đối tác đã nhận việc từ Hòm thư việc làm"
      }]);
      return sendJson(res, 200, { ok: true, booking: updatedBk });
    }

    // Local mode
    const bookingId = Number(rawBookingId);
    const bk = db.bookings.find((b) => b.booking_id === bookingId);
    if (!bk) return sendJson(res, 404, { ok: false, error: "Không tìm thấy đơn hàng." });

    if (bk.status !== "pending") {
      return sendJson(res, 409, {
        ok: false,
        expired: true,
        error: "Rất tiếc! Đơn này vừa được một đối tác khác nhận trước hoặc đã hết hạn."
      });
    }

    const oldStatus = bk.status;
    bk.status = "confirmed";
    bk.provider_id = Number(providerId);
    bk.dispatch_type = "direct";
    bk.updated_at = new Date().toISOString();

    const nextHistoryId = Math.max(5000, ...db.booking_status_history.map((h) => h.history_id || 0)) + 1;
    const pp = (db.provider_profiles || []).find((p) => p.provider_id === Number(providerId));
    const resolvedActor = (typeof actorUserId === "string" && /^[0-9a-f-]{36}$/i.test(actorUserId))
      ? actorUserId
      : ((pp && pp.user_id) || "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b21");
    const historyRow = {
      history_id: nextHistoryId,
      booking_id: bookingId,
      previous_status: oldStatus,
      new_status: "confirmed",
      changed_by: resolvedActor,
      reason: "Đối tác đã nhận việc từ Hòm thư việc làm",
      created_at: new Date().toISOString()
    };
    db.booking_status_history.unshift(historyRow);
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, booking: bk, history: historyRow });
  }

  // 4.11. POST /api/rpc/transition-status — Chuyển trạng thái đơn hàng
  if (method === "POST" && pathname === "/api/rpc/transition-status") {
    const body = await parseBody(req);
    const bookingId = Number(body.booking_id);
    const newStatus = String(body.new_status || "");
    const reason = String(body.reason || "Cập nhật trạng thái qua RPC").trim();
    const actorUserId = body.changed_by || null;

    if (isProd) {
      if (!client) return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      const { data: bk, error: bkErr } = await client.from("bookings").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("booking_id", bookingId).select().single();
      if (bkErr) return sendJson(res, 500, { ok: false, error: bkErr.message });
      await client.from("booking_status_history").insert([{
        booking_id: bookingId,
        new_status: newStatus,
        changed_by: actorUserId,
        reason
      }]);
      return sendJson(res, 200, { ok: true, booking: bk });
    }

    const bk = db.bookings.find((b) => b.booking_id === bookingId);
    if (!bk) return sendJson(res, 404, { ok: false, error: "Không tìm thấy đơn hàng." });

    const oldStatus = bk.status;
    bk.status = newStatus;
    bk.updated_at = new Date().toISOString();

    const nextHistoryId = Math.max(5000, ...db.booking_status_history.map((h) => h.history_id || 0)) + 1;
    const historyRow = {
      history_id: nextHistoryId,
      booking_id: bookingId,
      previous_status: oldStatus,
      new_status: newStatus,
      changed_by: actorUserId || "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      reason,
      created_at: new Date().toISOString()
    };
    db.booking_status_history.unshift(historyRow);
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, booking: bk, history: historyRow });
  }

  // 4.12. POST /api/rpc/update-incidental — Kê khai chi phí phát sinh
  if (method === "POST" && pathname === "/api/rpc/update-incidental") {
    const body = await parseBody(req);
    const bookingId = Number(body.booking_id);
    const incidental = Number(body.total_incidental);
    const notes = String(body.notes || "").trim();

    if (isProd) {
      if (!client) return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      const { data: curBk } = await client.from("bookings").select("total_amount, total_incidental").eq("booking_id", bookingId).single();
      const basePrice = curBk ? Math.max(0, curBk.total_amount - curBk.total_incidental) : 0;
      const { data: updatedBk, error: updErr } = await client.from("bookings").update({
        total_incidental: incidental,
        total_amount: basePrice + incidental,
        updated_at: new Date().toISOString()
      }).eq("booking_id", bookingId).select().single();
      if (updErr) return sendJson(res, 500, { ok: false, error: updErr.message });
      return sendJson(res, 200, { ok: true, booking: updatedBk });
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
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, booking: bk });
  }

  // 4.13. POST /api/rpc/confirm-payment & POST /api/bookings/:id/pay — Khách hàng xác nhận thanh toán (hỗ trợ VietQR)
  if (method === "POST" && (pathname === "/api/rpc/confirm-payment" || (pathname.startsWith("/api/bookings/") && pathname.endsWith("/pay")))) {
    const body = await parseBody(req);
    let bookingId = body.booking_id != null ? body.booking_id : null;
    if (!bookingId && pathname.startsWith("/api/bookings/")) {
      const parts = pathname.split("/");
      const bIdx = parts.indexOf("bookings");
      if (bIdx !== -1 && bIdx + 1 < parts.length) {
        bookingId = parts[bIdx + 1];
      }
    }
    if (typeof bookingId === "string" && /^\d+$/.test(bookingId)) {
      bookingId = Number(bookingId);
    }
    const methodType = body.method || "VIETQR_BANK_TRANSFER";
    const txId = body.transaction_id || `VCB-${Date.now().toString().slice(-8)}`;
    const nowIso = new Date().toISOString();

    if (isProd) {
      if (!client) return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      const { data: bk, error: bkErr } = await client.from("bookings").update({
        payment_status: "paid",
        updated_at: nowIso
      }).eq("booking_id", bookingId).select().single();
      if (bkErr) return sendJson(res, 500, { ok: false, error: bkErr.message });

      try {
        const actorId = (typeof body.changed_by === "string" && body.changed_by.length > 20) ? body.changed_by : "bcba1d58-caef-4122-a4be-e8819b459ef9";
        await client.from("booking_status_history").insert([{
          booking_id: bookingId,
          previous_status: bk ? bk.status : "in_progress",
          new_status: bk ? bk.status : "in_progress",
          changed_by: actorId,
          reason: `[THANH TOÁN THÀNH CÔNG] Đã thanh toán qua ${methodType === "VIETQR_BANK_TRANSFER" ? "VietQR Ngân hàng (Vietcombank)" : "Tiền mặt"} (Mã GD: ${txId})`,
          created_at: nowIso
        }]);
      } catch (_) {}

      return sendJson(res, 200, { ok: true, booking: bk, transaction_id: txId, payment_status: "paid", paid_at: nowIso });
    }

    let bk = db.bookings.find((b) => String(b.booking_id) === String(bookingId) || (Number(b.booking_id) && Number(b.booking_id) === Number(bookingId)));

    // Fallback hybrid: Nếu không thấy trong localDb và có kết nối client Supabase
    if (!bk && client) {
      try {
        const { data: remoteBk, error: remErr } = await client.from("bookings").update({
          payment_status: "paid",
          updated_at: nowIso
        }).eq("booking_id", bookingId).select().single();
        if (!remErr && remoteBk) {
          try {
            const actorId = (typeof body.changed_by === "string" && body.changed_by.length > 20) ? body.changed_by : "bcba1d58-caef-4122-a4be-e8819b459ef9";
            await client.from("booking_status_history").insert([{
              booking_id: bookingId,
              previous_status: remoteBk.status,
              new_status: remoteBk.status,
              changed_by: actorId,
              reason: `[THANH TOÁN THÀNH CÔNG] Đã thanh toán qua ${methodType === "VIETQR_BANK_TRANSFER" ? "VietQR Ngân hàng (Vietcombank)" : "Tiền mặt"} (Mã GD: ${txId})`,
              created_at: nowIso
            }]);
          } catch (_) {}
          return sendJson(res, 200, { ok: true, booking: remoteBk, transaction_id: txId, payment_status: "paid", paid_at: nowIso });
        }
      } catch (_) {}
    }

    if (!bk) return sendJson(res, 404, { ok: false, error: `Không tìm thấy đơn hàng #${bookingId}.` });
    bk.payment_status = "paid";
    bk.updated_at = nowIso;

    if (!Array.isArray(db.booking_status_history)) db.booking_status_history = [];
    const actorUuid = (typeof body.changed_by === "string" && /^[0-9a-f-]{36}$/i.test(body.changed_by))
      ? body.changed_by
      : "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    db.booking_status_history.unshift({
      history_id: Date.now(),
      booking_id: bookingId,
      previous_status: bk.status,
      new_status: bk.status,
      changed_by: actorUuid,
      reason: `[THANH TOÁN THÀNH CÔNG] Đã thanh toán qua ${methodType === "VIETQR_BANK_TRANSFER" ? "VietQR Ngân hàng (Vietcombank)" : "Tiền mặt"} (Mã GD: ${txId})`,
      created_at: nowIso
    });

    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, booking: bk, transaction_id: txId, payment_status: "paid", paid_at: nowIso });
  }

  // 4.14. POST /api/rpc/admin-adjust — Admin điều chỉnh đơn
  if (method === "POST" && pathname === "/api/rpc/admin-adjust") {
    const body = await parseBody(req);
    const bookingId = Number(body.booking_id);

    if (isProd) {
      if (!client) return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      const updates = { updated_at: new Date().toISOString() };
      if (body.provider_id !== undefined) updates.provider_id = Number(body.provider_id);
      if (body.status) updates.status = body.status;
      if (body.payment_status) updates.payment_status = body.payment_status;
      if (body.total_amount !== undefined) updates.total_amount = Number(body.total_amount);
      const { data: bk, error: err } = await client.from("bookings").update(updates).eq("booking_id", bookingId).select().single();
      if (err) return sendJson(res, 500, { ok: false, error: err.message });
      return sendJson(res, 200, { ok: true, booking: bk });
    }

    const bk = db.bookings.find((b) => b.booking_id === bookingId);
    if (!bk) return sendJson(res, 404, { ok: false, error: "Không tìm thấy đơn hàng." });
    if (body.provider_id !== undefined) bk.provider_id = Number(body.provider_id);
    if (body.status) bk.status = body.status;
    if (body.payment_status) bk.payment_status = body.payment_status;
    if (body.total_amount !== undefined) bk.total_amount = Number(body.total_amount);
    bk.updated_at = new Date().toISOString();
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, booking: bk });
  }

  // 4.15. POST /api/reviews — Đánh giá thợ
  if (method === "POST" && pathname === "/api/reviews") {
    const body = await parseBody(req);
    const bookingId = Number(body.booking_id);
    const rating = Math.min(5, Math.max(1, Number(body.rating) || 5));
    const comment = String(body.comment || "").trim();

    if (isProd) {
      if (!client) return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      const { data: bk } = await client.from("bookings").select("customer_id, provider_id").eq("booking_id", bookingId).single();
      const { data: rev, error: revErr } = await client.from("reviews").insert([{
        booking_id: bookingId,
        customer_id: bk ? bk.customer_id : body.customer_id,
        provider_id: bk ? bk.provider_id : body.provider_id,
        rating,
        comment: comment || "Khách hàng hài lòng với dịch vụ."
      }]).select().single();
      if (revErr) return sendJson(res, 500, { ok: false, error: revErr.message });
      return sendJson(res, 201, { ok: true, review: rev });
    }

    const bk = db.bookings.find((b) => b.booking_id === bookingId);
    const nextRevId = Math.max(800, ...db.reviews.map((r) => r.review_id || 0)) + 1;
    const rev = {
      review_id: nextRevId,
      booking_id: bookingId,
      customer_id: bk ? bk.customer_id : 101,
      provider_id: bk ? bk.provider_id : 201,
      rating,
      comment: comment || "Khách hàng hài lòng với chất lượng dịch vụ.",
      created_at: new Date().toISOString()
    };
    db.reviews.unshift(rev);
    if (bk && bk.provider_id) recomputeProviderRating(db, bk.provider_id);
    saveLocalDb(db);
    return sendJson(res, 201, { ok: true, review: rev });
  }

  // 4.16. POST /api/favorites/toggle — Lưu / Bỏ lưu dịch vụ hoặc thợ yêu thích (FR-FAV-001)
  if (method === "POST" && pathname === "/api/favorites/toggle") {
    const body = await parseBody(req);
    const customerId = Number(body.customer_id) || 101;
    const serviceId = body.service_id ? Number(body.service_id) : null;
    const providerId = body.provider_id ? Number(body.provider_id) : null;

    if (!serviceId && !providerId) {
      return sendJson(res, 400, { ok: false, error: "Cần truyền service_id hoặc provider_id để lưu yêu thích." });
    }

    if (isProd) {
      if (!client) return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      let query = client.from("favorites").select("favorite_id").eq("customer_id", customerId);
      if (serviceId) query = query.eq("service_id", serviceId);
      if (providerId) query = query.eq("provider_id", providerId);
      const { data: existing } = await query.maybeSingle();

      if (existing) {
        await client.from("favorites").delete().eq("favorite_id", existing.favorite_id);
        return sendJson(res, 200, { ok: true, added: false, type: serviceId ? "service" : "provider" });
      } else {
        const newRow = { customer_id: customerId };
        if (serviceId) newRow.service_id = serviceId;
        if (providerId) newRow.provider_id = providerId;
        await client.from("favorites").insert([newRow]);
        return sendJson(res, 200, { ok: true, added: true, type: serviceId ? "service" : "provider" });
      }
    }

    let idx = -1;
    if (serviceId) {
      idx = db.favorites.findIndex((f) => Number(f.customer_id) === customerId && Number(f.service_id) === serviceId);
    } else if (providerId) {
      idx = db.favorites.findIndex((f) => Number(f.customer_id) === customerId && Number(f.provider_id) === providerId);
    }

    let added = false;
    if (idx >= 0) {
      db.favorites.splice(idx, 1);
    } else {
      const favRow = {
        favorite_id: Date.now(),
        customer_id: customerId,
        service_id: serviceId,
        provider_id: providerId,
        created_at: new Date().toISOString()
      };
      db.favorites.push(favRow);
      added = true;
    }
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, added, type: serviceId ? "service" : "provider", favorites: db.favorites });
  }

  // 4.16b. GET /api/favorites — Lấy danh sách yêu thích
  if (method === "GET" && pathname === "/api/favorites") {
    const customerId = Number(searchParams.get("customer_id")) || 101;
    if (isProd && client) {
      const { data: favs } = await client.from("favorites").select("*").eq("customer_id", customerId);
      return sendJson(res, 200, { ok: true, favorites: favs || [] });
    }
    const favs = (db.favorites || []).filter((f) => Number(f.customer_id) === customerId);
    const serviceIds = favs.filter((f) => f.service_id).map((f) => Number(f.service_id));
    const providerIds = favs.filter((f) => f.provider_id).map((f) => Number(f.provider_id));
    const services = (db.services || []).filter((s) => serviceIds.includes(Number(s.service_id)));
    const providers = (db.provider_public_profiles || []).filter((p) => providerIds.includes(Number(p.provider_id)));
    return sendJson(res, 200, { ok: true, favorites: favs, services, providers });
  }

  // 4.17. POST /api/support-tickets — Gửi yêu cầu hỗ trợ (FR-TKT-001)
  if (method === "POST" && pathname === "/api/support-tickets") {
    const body = await parseBody(req);
    const nowIso = new Date().toISOString();

    if (isProd) {
      if (!client) return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      const { data: tk, error: tkErr } = await client.from("support_tickets").insert([{
        user_id: body.user_id,
        booking_id: body.booking_id ? Number(body.booking_id) : null,
        subject: String(body.subject || "Yêu cầu hỗ trợ").trim(),
        status: "open",
        priority: body.priority || "medium"
      }]).select().single();
      if (tkErr) return sendJson(res, 500, { ok: false, error: tkErr.message });
      return sendJson(res, 201, { ok: true, ticket: tk });
    }

    const nextId = Math.max(700, ...db.support_tickets.map((t) => t.ticket_id || 0)) + 1;
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

  // 4.17b. GET & POST /api/tickets/:id/messages — Trao đổi trong phiếu hỗ trợ & Ghi chú nội bộ (FR-TKT-005)
  const ticketMsgMatch = pathname.match(/^\/api\/tickets\/([^/]+)\/messages$/);
  if (method === "GET" && ticketMsgMatch) {
    const ticketId = Number(ticketMsgMatch[1]);
    const role = searchParams.get("role") || "customer";

    if (isProd && client) {
      let query = client.from("ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true });
      if (role !== "admin") {
        query = query.eq("visibility", "public");
      }
      const { data: msgs, error } = await query;
      if (error) return sendJson(res, 500, { ok: false, error: error.message });
      return sendJson(res, 200, { ok: true, messages: msgs || [] });
    }

    let msgs = (db.ticket_messages || []).filter((m) => Number(m.ticket_id) === ticketId);
    if (role !== "admin") {
      msgs = msgs.filter((m) => m.visibility === "public" || !m.visibility);
    }
    return sendJson(res, 200, { ok: true, messages: msgs });
  }

  if (method === "POST" && ticketMsgMatch) {
    const ticketId = Number(ticketMsgMatch[1]);
    const body = await parseBody(req);
    const content = String(body.content || "").trim();
    const visibility = body.visibility === "internal" ? "internal" : "public";
    const senderId = body.sender_id || "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const senderRole = body.sender_role || "customer";

    if (!content) {
      return sendJson(res, 400, { ok: false, error: "Nội dung phản hồi không được để trống." });
    }

    const nowIso = new Date().toISOString();
    const newMsg = {
      message_id: isProd ? crypto.randomUUID() : Math.max(900, ...(db.ticket_messages || []).map((m) => typeof m.message_id === "number" ? m.message_id : 0)) + 1,
      ticket_id: ticketId,
      sender_id: senderId,
      sender_role: senderRole,
      content,
      visibility,
      created_at: nowIso
    };

    if (isProd && client) {
      const { data: insMsg, error: insErr } = await client.from("ticket_messages").insert([newMsg]).select().single();
      if (insErr) return sendJson(res, 500, { ok: false, error: insErr.message });
      await client.from("support_tickets").update({ updated_at: nowIso }).eq("ticket_id", ticketId);
      return sendJson(res, 201, { ok: true, message: insMsg });
    }

    if (!Array.isArray(db.ticket_messages)) db.ticket_messages = [];
    db.ticket_messages.push(newMsg);
    const tk = (db.support_tickets || []).find((t) => Number(t.ticket_id) === ticketId);
    if (tk) {
      tk.updated_at = nowIso;
      if (senderRole === "admin" && visibility === "public" && tk.user_id) {
        dispatchNotification(db, {
          user_id: tk.user_id,
          title: `Phản hồi mới cho phiếu #${ticketId}`,
          body: `Admin đã phản hồi: "${content.slice(0, 80)}${content.length > 80 ? "..." : ""}"`,
          type: "ticket_reply",
          link: "#1.11",
          isProd: false
        });
      }
    }
    saveLocalDb(db);
    return sendJson(res, 201, { ok: true, message: newMsg });
  }

  // 4.17c. PATCH /api/tickets/:id/status — Cập nhật trạng thái phiếu hỗ trợ
  const ticketStatusMatch = pathname.match(/^\/api\/tickets\/([^/]+)\/status$/);
  if (method === "PATCH" && ticketStatusMatch) {
    const ticketId = Number(ticketStatusMatch[1]);
    const body = await parseBody(req);
    const newStatus = body.status;
    const newPriority = body.priority;
    const actorId = body.actor_id || "admin";

    if (isProd && client) {
      const updates = { updated_at: new Date().toISOString() };
      if (newStatus) updates.status = newStatus;
      if (newPriority) updates.priority = newPriority;
      const { data: updatedTk, error } = await client.from("support_tickets").update(updates).eq("ticket_id", ticketId).select().single();
      if (error) return sendJson(res, 500, { ok: false, error: error.message });
      await logAudit(null, {
        actor_id: actorId,
        action: "UPDATE_TICKET_STATUS",
        target_entity: "support_tickets",
        target_id: ticketId,
        details: updates,
        isProd: true,
        client
      });
      return sendJson(res, 200, { ok: true, ticket: updatedTk });
    }

    const tk = (db.support_tickets || []).find((t) => Number(t.ticket_id) === ticketId);
    if (!tk) return sendJson(res, 404, { ok: false, error: "Không tìm thấy phiếu hỗ trợ." });
    if (newStatus) tk.status = newStatus;
    if (newPriority) tk.priority = newPriority;
    tk.updated_at = new Date().toISOString();
    logAudit(db, {
      actor_id: actorId,
      action: "UPDATE_TICKET_STATUS",
      target_entity: "support_tickets",
      target_id: ticketId,
      details: { status: newStatus, priority: newPriority },
      isProd: false
    });
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, ticket: tk });
  }

  // 4.17d. Sổ địa chỉ khách hàng: GET, POST, PUT, DELETE /api/customer/addresses (FR-CUST-003)
  if (method === "GET" && pathname === "/api/customer/addresses") {
    const customerId = Number(searchParams.get("customer_id")) || 101;
    if (isProd && client) {
      const { data: addrs, error } = await client.from("customer_addresses").select("*").eq("customer_id", customerId);
      if (error) return sendJson(res, 500, { ok: false, error: error.message });
      return sendJson(res, 200, { ok: true, addresses: addrs || [] });
    }
    const addrs = (db.customer_addresses || []).filter((a) => Number(a.customer_id) === customerId);
    return sendJson(res, 200, { ok: true, addresses: addrs });
  }

  if (method === "POST" && pathname === "/api/customer/addresses") {
    const body = await parseBody(req);
    const customerId = Number(body.customer_id) || 101;
    const tag = String(body.tag || "Nhà riêng").trim();
    const streetAddress = String(body.street_address || "").trim();
    const wardId = String(body.ward_id || "27403");
    const isDefault = Boolean(body.is_default);

    if (!streetAddress) {
      return sendJson(res, 400, { ok: false, error: "Địa chỉ đường/phố là bắt buộc." });
    }

    const nowIso = new Date().toISOString();
    const nextId = isProd ? crypto.randomUUID() : Math.max(10, ...(db.customer_addresses || []).map((a) => typeof a.address_id === "number" ? a.address_id : 0)) + 1;
    const newAddr = {
      address_id: nextId,
      customer_id: customerId,
      tag,
      street_address: streetAddress,
      ward_id: wardId,
      latitude: Number(body.latitude) || 10.728912,
      longitude: Number(body.longitude) || 106.712405,
      is_default: isDefault,
      created_at: nowIso
    };

    if (isProd && client) {
      if (isDefault) {
        await client.from("customer_addresses").update({ is_default: false }).eq("customer_id", customerId);
      }
      const { data: created, error } = await client.from("customer_addresses").insert([newAddr]).select().single();
      if (error) return sendJson(res, 500, { ok: false, error: error.message });
      return sendJson(res, 201, { ok: true, address: created });
    }

    if (!Array.isArray(db.customer_addresses)) db.customer_addresses = [];
    if (isDefault) {
      db.customer_addresses.forEach((a) => {
        if (Number(a.customer_id) === customerId) a.is_default = false;
      });
    }
    db.customer_addresses.push(newAddr);
    saveLocalDb(db);
    return sendJson(res, 201, { ok: true, address: newAddr });
  }

  const addrMatch = pathname.match(/^\/api\/customer\/addresses\/([^/]+)$/);
  if (method === "PUT" && addrMatch) {
    const addressId = addrMatch[1];
    const body = await parseBody(req);
    const isDefault = Boolean(body.is_default);

    if (isProd && client) {
      const { data: cur } = await client.from("customer_addresses").select("customer_id").eq("address_id", addressId).single();
      if (isDefault && cur) {
        await client.from("customer_addresses").update({ is_default: false }).eq("customer_id", cur.customer_id);
      }
      const updates = {};
      if (body.tag) updates.tag = String(body.tag).trim();
      if (body.street_address) updates.street_address = String(body.street_address).trim();
      if (body.ward_id) updates.ward_id = String(body.ward_id);
      if (body.latitude) updates.latitude = Number(body.latitude);
      if (body.longitude) updates.longitude = Number(body.longitude);
      if (body.is_default !== undefined) updates.is_default = isDefault;
      const { data: upd, error } = await client.from("customer_addresses").update(updates).eq("address_id", addressId).select().single();
      if (error) return sendJson(res, 500, { ok: false, error: error.message });
      return sendJson(res, 200, { ok: true, address: upd });
    }

    const addr = (db.customer_addresses || []).find((a) => String(a.address_id) === String(addressId));
    if (!addr) return sendJson(res, 404, { ok: false, error: "Không tìm thấy địa chỉ." });
    if (isDefault) {
      (db.customer_addresses || []).forEach((a) => {
        if (Number(a.customer_id) === Number(addr.customer_id)) a.is_default = false;
      });
    }
    if (body.tag) addr.tag = String(body.tag).trim();
    if (body.street_address) addr.street_address = String(body.street_address).trim();
    if (body.ward_id) addr.ward_id = String(body.ward_id);
    if (body.latitude) addr.latitude = Number(body.latitude);
    if (body.longitude) addr.longitude = Number(body.longitude);
    if (body.is_default !== undefined) addr.is_default = isDefault;
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, address: addr });
  }

  if (method === "DELETE" && addrMatch) {
    const addressId = addrMatch[1];
    if (isProd && client) {
      const { error } = await client.from("customer_addresses").delete().eq("address_id", addressId);
      if (error) return sendJson(res, 500, { ok: false, error: error.message });
      return sendJson(res, 200, { ok: true, message: "Đã xóa địa chỉ." });
    }
    db.customer_addresses = (db.customer_addresses || []).filter((a) => String(a.address_id) !== String(addressId));
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, message: "Đã xóa địa chỉ." });
  }

  // 4.17e. Thông báo người dùng (FR-NOTIF-001)
  if (method === "GET" && pathname === "/api/notifications") {
    const userId = searchParams.get("user_id");
    if (isProd && client) {
      let q = client.from("notifications").select("*").order("created_at", { ascending: false });
      if (userId) q = q.eq("user_id", userId);
      const { data: notifs, error } = await q;
      if (error) return sendJson(res, 500, { ok: false, error: error.message });
      return sendJson(res, 200, { ok: true, notifications: notifs || [] });
    }
    let notifs = db.notifications || [];
    if (userId) {
      notifs = notifs.filter((n) => String(n.user_id) === String(userId));
    }
    return sendJson(res, 200, { ok: true, notifications: notifs });
  }

  const notifReadMatch = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if ((method === "POST" || method === "PATCH") && notifReadMatch) {
    const notifId = notifReadMatch[1];
    if (isProd && client) {
      await client.from("notifications").update({ is_read: true }).eq("notification_id", notifId);
      return sendJson(res, 200, { ok: true, message: "Đã đánh dấu đã đọc" });
    }
    const notif = (db.notifications || []).find((n) => String(n.notification_id) === String(notifId));
    if (notif) notif.is_read = true;
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, message: "Đã đánh dấu đã đọc" });
  }

  if (method === "POST" && pathname === "/api/notifications/read-all") {
    const body = await parseBody(req);
    const userId = body.user_id;
    if (isProd && client) {
      let q = client.from("notifications").update({ is_read: true });
      if (userId) q = q.eq("user_id", userId);
      await q;
      return sendJson(res, 200, { ok: true, message: "Đã đọc tất cả thông báo" });
    }
    (db.notifications || []).forEach((n) => {
      if (!userId || String(n.user_id) === String(userId)) {
        n.is_read = true;
      }
    });
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, message: "Đã đọc tất cả thông báo" });
  }

  // 4.18. Admin APIs (KYC, Services, Categories, Reviews, Audit)
  if (method === "PATCH" && pathname.startsWith("/api/admin/kyc/")) {
    const providerId = Number(pathname.split("/").pop());
    const body = await parseBody(req);
    const actorId = body.actor_id || "admin";

    if (isProd) {
      if (!client) return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      const { data: pp, error: err } = await client.from("provider_profiles").update({
        verification_status: body.verification_status,
        updated_at: new Date().toISOString()
      }).eq("provider_id", providerId).select().single();
      if (err) return sendJson(res, 500, { ok: false, error: err.message });
      await logAudit(null, {
        actor_id: actorId,
        action: "UPDATE_KYC_STATUS",
        target_entity: "provider_profiles",
        target_id: providerId,
        details: { status: body.verification_status },
        isProd: true,
        client
      });
      return sendJson(res, 200, { ok: true, provider_profile: pp });
    }

    const pp = db.provider_profiles.find((p) => p.provider_id === providerId);
    if (!pp) return sendJson(res, 404, { ok: false, error: "Không tìm thấy hồ sơ thợ." });
    if (body.verification_status) pp.verification_status = body.verification_status;
    pp.updated_at = new Date().toISOString();
    logAudit(db, {
      actor_id: actorId,
      action: "UPDATE_KYC_STATUS",
      target_entity: "provider_profiles",
      target_id: providerId,
      details: { status: body.verification_status },
      isProd: false
    });
    if (pp.user_id) {
      dispatchNotification(db, {
        user_id: pp.user_id,
        title: body.verification_status === "verified" ? "Hồ sơ đối tác đã được phê duyệt!" : "Cập nhật hồ sơ đối tác",
        body: body.verification_status === "verified" ? "Chúc mừng bạn đã hoàn tất xác thực CCCD và có thể nhận đơn ngay bây giờ." : `Hồ sơ xác thực của bạn chuyển sang trạng thái: ${body.verification_status}`,
        type: "kyc_update",
        link: "#2.1",
        isProd: false
      });
    }
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, provider_profile: pp });
  }

  // 4.18b. Kiểm duyệt đánh giá: PATCH /api/admin/reviews/:id/moderate & DELETE /api/admin/reviews/:id (FR-REV-005)
  const revModMatch = pathname.match(/^\/api\/admin\/reviews\/([^/]+)\/moderate$/);
  if (method === "PATCH" && revModMatch) {
    const reviewId = Number(revModMatch[1]);
    const body = await parseBody(req);
    const status = body.status === "hidden" ? "hidden" : "published";
    const reason = String(body.moderation_reason || "").trim();
    const actorId = body.actor_id || "admin";

    if (isProd && client) {
      const { data: rev, error } = await client.from("reviews").update({
        status,
        moderation_reason: reason
      }).eq("review_id", reviewId).select().single();
      if (error) return sendJson(res, 500, { ok: false, error: error.message });
      await logAudit(null, {
        actor_id: actorId,
        action: status === "hidden" ? "HIDE_REVIEW" : "UNHIDE_REVIEW",
        target_entity: "reviews",
        target_id: reviewId,
        details: { reason },
        isProd: true,
        client
      });
      return sendJson(res, 200, { ok: true, review: rev });
    }

    const rev = (db.reviews || []).find((r) => Number(r.review_id) === reviewId);
    if (!rev) return sendJson(res, 404, { ok: false, error: "Không tìm thấy đánh giá." });
    rev.status = status;
    rev.moderation_reason = reason;
    if (rev.provider_id) recomputeProviderRating(db, rev.provider_id);
    logAudit(db, {
      actor_id: actorId,
      action: status === "hidden" ? "HIDE_REVIEW" : "UNHIDE_REVIEW",
      target_entity: "reviews",
      target_id: reviewId,
      details: { reason },
      isProd: false
    });
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, review: rev });
  }

  const revDelMatch = pathname.match(/^\/api\/admin\/reviews\/([^/]+)$/);
  if (method === "DELETE" && revDelMatch) {
    const reviewId = Number(revDelMatch[1]);
    if (isProd && client) {
      await client.from("reviews").update({ status: "hidden", moderation_reason: "Gỡ bởi Admin" }).eq("review_id", reviewId);
      return sendJson(res, 200, { ok: true, message: "Đã gỡ bài đánh giá" });
    }
    const rev = (db.reviews || []).find((r) => Number(r.review_id) === reviewId);
    if (rev) {
      rev.status = "hidden";
      rev.moderation_reason = "Gỡ bởi Admin";
      if (rev.provider_id) recomputeProviderRating(db, rev.provider_id);
      saveLocalDb(db);
    }
    return sendJson(res, 200, { ok: true, message: "Đã gỡ bài đánh giá" });
  }

  // 4.18c. Khách hàng chỉnh sửa đánh giá: PUT /api/reviews/:id
  const revPutMatch = pathname.match(/^\/api\/reviews\/([^/]+)$/);
  if (method === "PUT" && revPutMatch) {
    const reviewId = Number(revPutMatch[1]);
    const body = await parseBody(req);
    const rating = Math.min(5, Math.max(1, Number(body.rating) || 5));
    const comment = String(body.comment || "").trim();

    if (isProd && client) {
      const { data: rev, error } = await client.from("reviews").update({ rating, comment }).eq("review_id", reviewId).select().single();
      if (error) return sendJson(res, 500, { ok: false, error: error.message });
      return sendJson(res, 200, { ok: true, review: rev });
    }

    const rev = (db.reviews || []).find((r) => Number(r.review_id) === reviewId);
    if (!rev) return sendJson(res, 404, { ok: false, error: "Không tìm thấy đánh giá." });
    rev.rating = rating;
    rev.comment = comment;
    if (rev.provider_id) recomputeProviderRating(db, rev.provider_id);
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, review: rev });
  }

  // 4.18d. Nhật ký quản trị: GET /api/admin/audit-logs (FR-ADMIN-009)
  if (method === "GET" && pathname === "/api/admin/audit-logs") {
    if (isProd && client) {
      const { data: logs, error } = await client.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) return sendJson(res, 500, { ok: false, error: error.message });
      return sendJson(res, 200, { ok: true, audit_logs: logs || [] });
    }
    return sendJson(res, 200, { ok: true, audit_logs: db.audit_logs || [] });
  }

  // 4.18e. Khóa / Mở khóa tài khoản người dùng: PATCH /api/admin/users/:id/toggle-active
  const userToggleMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/toggle-active$/);
  if (method === "PATCH" && userToggleMatch) {
    const userId = userToggleMatch[1];
    if (isProd && client) {
      const { data: u } = await client.from("users").select("is_active, full_name").eq("user_id", userId).single();
      if (!u) return sendJson(res, 404, { ok: false, error: "Không tìm thấy người dùng." });
      const nextActive = !u.is_active;
      await client.from("users").update({ is_active: nextActive }).eq("user_id", userId);
      await logAudit(null, {
        actor_id: "admin",
        action: nextActive ? "ACTIVATE_USER" : "DEACTIVATE_USER",
        target_entity: "users",
        target_id: userId,
        details: { user: u.full_name, is_active: nextActive },
        isProd: true,
        client
      });
      return sendJson(res, 200, { ok: true, is_active: nextActive });
    }

    const u = (db.users || []).find((x) => String(x.user_id) === String(userId));
    if (!u) return sendJson(res, 404, { ok: false, error: "Không tìm thấy người dùng." });
    u.is_active = !u.is_active;
    logAudit(db, {
      actor_id: "admin",
      action: u.is_active ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      target_entity: "users",
      target_id: userId,
      details: { user: u.full_name, is_active: u.is_active },
      isProd: false
    });
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, is_active: u.is_active });
  }

  // 4.18f. Mở / Ẩn bán dịch vụ: PATCH /api/admin/services/:id/toggle
  const svcToggleMatch = pathname.match(/^\/api\/admin\/services\/([^/]+)\/toggle$/);
  if ((method === "PATCH" || method === "POST") && svcToggleMatch) {
    const serviceId = Number(svcToggleMatch[1]);
    if (isProd && client) {
      const { data: s } = await client.from("services").select("is_active, title").eq("service_id", serviceId).single();
      if (!s) return sendJson(res, 404, { ok: false, error: "Không tìm thấy dịch vụ." });
      const nextActive = !s.is_active;
      await client.from("services").update({ is_active: nextActive }).eq("service_id", serviceId);
      await logAudit(null, {
        actor_id: "admin",
        action: nextActive ? "ACTIVATE_SERVICE" : "DEACTIVATE_SERVICE",
        target_entity: "services",
        target_id: serviceId,
        details: { service: s.title, is_active: nextActive },
        isProd: true,
        client
      });
      return sendJson(res, 200, { ok: true, is_active: nextActive });
    }

    const s = (db.services || []).find((x) => Number(x.service_id) === serviceId);
    if (!s) return sendJson(res, 404, { ok: false, error: "Không tìm thấy dịch vụ." });
    s.is_active = !s.is_active;
    logAudit(db, {
      actor_id: "admin",
      action: s.is_active ? "ACTIVATE_SERVICE" : "DEACTIVATE_SERVICE",
      target_entity: "services",
      target_id: serviceId,
      details: { service: s.title, is_active: s.is_active },
      isProd: false
    });
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, is_active: s.is_active });
  }

  // 4.18g. Thêm dịch vụ mới & Danh mục mới
  if (method === "POST" && pathname === "/api/admin/services") {
    const body = await parseBody(req);
    const title = String(body.title || "").trim();
    const price = Number(body.price) || 100000;
    const categoryId = Number(body.category_id) || 1;

    if (!title) return sendJson(res, 400, { ok: false, error: "Tên dịch vụ là bắt buộc." });

    if (isProd && client) {
      const { data: created, error } = await client.from("services").insert([{
        title,
        price,
        category_id: categoryId,
        duration_minutes: Number(body.duration_minutes) || 120,
        pricing_type: body.pricing_type || "hourly",
        description: body.description || "",
        image_url: body.image_url || "assets/cleaning-livingroom.jpg",
        is_active: true
      }]).select().single();
      if (error) return sendJson(res, 500, { ok: false, error: error.message });
      return sendJson(res, 201, { ok: true, service: created });
    }

    const nextId = Math.max(100, ...(db.services || []).map((s) => Number(s.service_id) || 0)) + 1;
    const newSvc = {
      service_id: nextId,
      category_id: categoryId,
      title,
      price,
      duration_minutes: Number(body.duration_minutes) || 120,
      pricing_type: body.pricing_type || "hourly",
      description: body.description || "",
      image_url: body.image_url || "assets/cleaning-livingroom.jpg",
      is_active: true
    };
    db.services.push(newSvc);
    saveLocalDb(db);
    return sendJson(res, 201, { ok: true, service: newSvc });
  }

  if (method === "POST" && pathname === "/api/admin/categories") {
    const body = await parseBody(req);
    const categoryName = String(body.category_name || "").trim();
    if (!categoryName) return sendJson(res, 400, { ok: false, error: "Tên danh mục là bắt buộc." });

    if (isProd && client) {
      const { data: created, error } = await client.from("service_categories").insert([{
        category_name: categoryName,
        slug: body.slug || categoryName.toLowerCase().replace(/\s+/g, "-"),
        description: body.description || "",
        status: true
      }]).select().single();
      if (error) return sendJson(res, 500, { ok: false, error: error.message });
      return sendJson(res, 201, { ok: true, category: created });
    }

    const nextId = Math.max(1, ...(db.service_categories || []).map((c) => Number(c.category_id) || 0)) + 1;
    const newCat = {
      category_id: nextId,
      category_name: categoryName,
      slug: body.slug || categoryName.toLowerCase().replace(/\s+/g, "-"),
      description: body.description || "",
      status: true
    };
    db.service_categories.push(newCat);
    saveLocalDb(db);
    return sendJson(res, 201, { ok: true, category: newCat });
  }

  // 4.18h. Các thao tác đơn đặt lịch: Hủy đơn, Bắt đầu làm, Hoàn thành, Phát sinh (FR-BOOK-008 -> 010)
  const bkCancelMatch = pathname.match(/^\/api\/bookings\/([^/]+)\/cancel$/);
  if (method === "POST" && bkCancelMatch) {
    const bookingId = Number(bkCancelMatch[1]);
    const body = await parseBody(req);
    const reason = String(body.reason || "Khách hàng yêu cầu hủy đơn").trim();
    const actorId = body.user_id || body.changed_by || null;

    if (isProd && client) {
      const { data: bk, error } = await client.from("bookings").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("booking_id", bookingId).select().single();
      if (error) return sendJson(res, 500, { ok: false, error: error.message });
      await client.from("booking_status_history").insert([{
        booking_id: bookingId,
        previous_status: bk ? bk.status : null,
        new_status: "cancelled",
        changed_by: actorId,
        reason
      }]);
      return sendJson(res, 200, { ok: true, booking: bk });
    }

    const bk = (db.bookings || []).find((b) => Number(b.booking_id) === bookingId);
    if (!bk) return sendJson(res, 404, { ok: false, error: "Không tìm thấy đơn hàng." });
    const oldStatus = bk.status;
    bk.status = "cancelled";
    bk.updated_at = new Date().toISOString();
    const nextHistoryId = Math.max(5000, ...db.booking_status_history.map((h) => h.history_id || 0)) + 1;
    db.booking_status_history.unshift({
      history_id: nextHistoryId,
      booking_id: bookingId,
      previous_status: oldStatus,
      new_status: "cancelled",
      changed_by: actorId || "customer",
      reason,
      created_at: new Date().toISOString()
    });
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, booking: bk });
  }

  const bkStartMatch = pathname.match(/^\/api\/bookings\/([^/]+)\/start$/);
  if (method === "POST" && bkStartMatch) {
    const bookingId = Number(bkStartMatch[1]);
    const body = await parseBody(req);
    const actorId = body.user_id || body.changed_by || null;

    if (isProd && client) {
      const { data: bk, error } = await client.from("bookings").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("booking_id", bookingId).select().single();
      if (error) return sendJson(res, 500, { ok: false, error: error.message });
      await client.from("booking_status_history").insert([{
        booking_id: bookingId,
        previous_status: "confirmed",
        new_status: "in_progress",
        changed_by: actorId,
        reason: "Thợ đã có mặt và bắt đầu công việc"
      }]);
      return sendJson(res, 200, { ok: true, booking: bk });
    }

    const bk = (db.bookings || []).find((b) => Number(b.booking_id) === bookingId);
    if (!bk) return sendJson(res, 404, { ok: false, error: "Không tìm thấy đơn hàng." });
    const oldStatus = bk.status;
    bk.status = "in_progress";
    bk.updated_at = new Date().toISOString();
    const nextHistoryId = Math.max(5000, ...db.booking_status_history.map((h) => h.history_id || 0)) + 1;
    db.booking_status_history.unshift({
      history_id: nextHistoryId,
      booking_id: bookingId,
      previous_status: oldStatus,
      new_status: "in_progress",
      changed_by: actorId || "provider",
      reason: "Thợ đã có mặt và bắt đầu công việc",
      created_at: new Date().toISOString()
    });
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, booking: bk });
  }

  const bkCompleteMatch = pathname.match(/^\/api\/bookings\/([^/]+)\/complete$/);
  if (method === "POST" && bkCompleteMatch) {
    const bookingId = Number(bkCompleteMatch[1]);
    const body = await parseBody(req);
    const actorId = body.user_id || body.changed_by || null;

    if (isProd && client) {
      const { data: bk, error } = await client.from("bookings").update({ status: "completed", updated_at: new Date().toISOString() }).eq("booking_id", bookingId).select().single();
      if (error) return sendJson(res, 500, { ok: false, error: error.message });
      await client.from("booking_status_history").insert([{
        booking_id: bookingId,
        previous_status: "in_progress",
        new_status: "completed",
        changed_by: actorId,
        reason: "Thợ hoàn thành công việc"
      }]);
      return sendJson(res, 200, { ok: true, booking: bk });
    }

    const bk = (db.bookings || []).find((b) => Number(b.booking_id) === bookingId);
    if (!bk) return sendJson(res, 404, { ok: false, error: "Không tìm thấy đơn hàng." });
    const oldStatus = bk.status;
    bk.status = "completed";
    bk.updated_at = new Date().toISOString();
    const nextHistoryId = Math.max(5000, ...db.booking_status_history.map((h) => h.history_id || 0)) + 1;
    db.booking_status_history.unshift({
      history_id: nextHistoryId,
      booking_id: bookingId,
      previous_status: oldStatus,
      new_status: "completed",
      changed_by: actorId || "provider",
      reason: "Thợ hoàn thành công việc",
      created_at: new Date().toISOString()
    });

    const cp = (db.customer_profiles || []).find((c) => Number(c.customer_id) === Number(bk.customer_id));
    if (cp && cp.user_id) {
      dispatchNotification(db, {
        user_id: cp.user_id,
        title: "Đơn hàng đã hoàn thành!",
        body: `Đơn #${bookingId} đã được hoàn tất. Hãy dành 30 giây để đánh giá chất lượng thợ nhé!`,
        type: "booking_completed",
        link: "#1.3",
        isProd: false
      });
    }
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, booking: bk });
  }

  const bkIncMatch = pathname.match(/^\/api\/bookings\/([^/]+)\/incidental$/);
  if (method === "POST" && bkIncMatch) {
    const bookingId = Number(bkIncMatch[1]);
    const body = await parseBody(req);
    const incidental = Number(body.total_incidental || body.incidental) || 0;
    const notes = String(body.notes || "").trim();

    const bk = (db.bookings || []).find((b) => Number(b.booking_id) === bookingId);
    if (!bk) return sendJson(res, 404, { ok: false, error: "Không tìm thấy đơn hàng." });
    const basePrice = Math.max(0, bk.total_amount - (bk.total_incidental || 0));
    bk.total_incidental = incidental;
    bk.total_amount = basePrice + incidental;
    if (notes) {
      bk.notes = (bk.notes ? bk.notes + "\n" : "") + `[Phát sinh: ${incidental.toLocaleString("vi-VN")} đ] ${notes}`;
    }
    bk.updated_at = new Date().toISOString();
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, booking: bk });
  }

  // 4.19. POST /api/ai/chat & /api/v1/ai/chat — Trợ lý AI Gia Đình Xanh (Grounded RAG Assistant) (FR-AI-001 -> 005)
  if (method === "POST" && (pathname === "/api/ai/chat" || pathname === "/api/v1/ai/chat")) {
    const body = await parseBody(req);
    const userMessage = String(body.message || "").trim();
    let conversationId = body.conversation_id ? String(body.conversation_id) : `conv_${Date.now()}`;
    const userId = body.user_id || "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    if (!userMessage) {
      return sendJson(res, 400, { ok: false, error: "Nội dung câu hỏi không được để trống." });
    }

    const availableServices = (db ? db.services : []).filter((s) => s.is_active);
    const availableProviders = (db ? db.provider_public_profiles : []).filter((p) => p.verification_status === "verified");

    const qLower = userMessage.toLowerCase();
    let reply = "";
    let recommendedServices = [];
    let recommendedProviders = [];
    let suggestions = [];

    if (qLower.includes("dọn dẹp") || qLower.includes("lau nhà") || qLower.includes("quét") || qLower.includes("vệ sinh") || qLower.includes("nhà bẩn") || qLower.includes("bụi") || qLower.includes("tết")) {
      recommendedServices = availableServices.filter((s) => s.title.toLowerCase().includes("dọn dẹp") || s.title.toLowerCase().includes("vệ sinh") || s.title.toLowerCase().includes("tổng"));
      recommendedProviders = availableProviders.filter((p) => p.info.toLowerCase().includes("dọn dẹp") || p.info.toLowerCase().includes("vệ sinh")).slice(0, 2);
      reply = `Chào bạn! Để không gian sống luôn tinh tươm và sạch bóng, Gia Đình Xanh gợi ý bạn dịch vụ **Dọn dẹp nhà theo giờ** (từ 75.000đ/giờ) hoặc **Tổng vệ sinh căn hộ chuyên sâu** (từ 180.000đ/lần). \n\n✨ **Cam kết chất lượng:** Thợ mang sẵn dụng cụ chuyên dụng, có lý lịch tư pháp rõ ràng, và được bảo hiểm tài sản lên đến 10 triệu đồng. Bạn có thể bấm chọn ngay gói dịch vụ bên dưới để đặt lịch thuận tiện!`;
      suggestions = ["Dọn dẹp 2 giờ", "Tổng vệ sinh căn hộ", "Tìm thợ dọn nhà 5 sao", "Xem bảng giá chi tiết"];
    } else if (qLower.includes("nấu") || qLower.includes("cơm") || qLower.includes("tiệc") || qLower.includes("ăn") || qLower.includes("món")) {
      recommendedServices = availableServices.filter((s) => s.title.toLowerCase().includes("nấu") || s.title.toLowerCase().includes("bếp"));
      recommendedProviders = availableProviders.filter((p) => p.info.toLowerCase().includes("nấu")).slice(0, 2);
      reply = `Dạ chào bạn! Nếu bạn cần chuẩn bị bữa cơm gia đình nóng hổi chuẩn vị hoặc chuẩn bị mâm cỗ đãi khách cuối tuần, dịch vụ **Nấu ăn gia đình theo giờ** (chỉ 60.000đ/giờ) và **Đầu bếp gia đình** là lựa chọn tuyệt vời. \n\n🍲 Đầu bếp đối tác của Gia Đình Xanh có chứng nhận vệ sinh an toàn thực phẩm, có thể hỗ trợ đi chợ theo thực đơn yêu cầu của gia đình.`;
      suggestions = ["Nấu ăn 3 món gia đình", "Chuẩn bị tiệc nhỏ cuối tuần", "Thợ Mai Lan nấu ăn", "Bảng giá nấu ăn"];
    } else if (qLower.includes("máy lạnh") || qLower.includes("điều hòa")) {
      recommendedServices = availableServices.filter((s) => s.title.toLowerCase().includes("máy lạnh") || s.title.toLowerCase().includes("điều hòa"));
      recommendedProviders = availableProviders.filter((p) => p.info.toLowerCase().includes("máy lạnh") || p.info.toLowerCase().includes("điện")).slice(0, 2);
      reply = `Dạ chào bạn! Để máy lạnh mát sâu, tiết kiệm điện và lọc sạch không khí, bạn nên vệ sinh định kỳ 3-4 tháng/lần. Gia Đình Xanh cung cấp gói **Vệ sinh máy lạnh treo tường** trọn gói chỉ 250.000đ/máy (bao gồm kiểm tra gas, vệ sinh dàn lạnh và dàn nóng).`;
      suggestions = ["Vệ sinh 1 bộ máy lạnh", "Vệ sinh 2 máy lạnh", "Bảo hành gas máy lạnh", "Đặt lịch thợ ngay"];
    } else if (qLower.includes("sofa") || qLower.includes("nệm") || qLower.includes("thảm") || qLower.includes("rèm")) {
      recommendedServices = availableServices.filter((s) => s.title.toLowerCase().includes("sofa") || s.title.toLowerCase().includes("nệm"));
      reply = `Chào bạn! Dịch vụ **Giặt ghế Sofa & Đệm ngủ bằng hơi nước nóng** của Gia Đình Xanh diệt khuẩn đến 99% mạt bụi và vi khuẩn gây dị ứng, sử dụng dung dịch sinh học an toàn cho trẻ nhỏ và thú cưng. Bạn có thể bấm đặt lịch ngay dưới đây!`;
      suggestions = ["Giặt bộ Sofa phòng khách", "Giặt nệm cao su 1m8", "Quy trình giặt hơi nước", "Xem giá trọn gói"];
    } else if (qLower.includes("giá") || qLower.includes("bảng giá") || qLower.includes("chi phí") || qLower.includes("bao nhiêu tiền")) {
      reply = `Bảng giá niêm yết minh bạch của Gia Đình Xanh:\n- 🧹 **Dọn dẹp nhà theo giờ**: 75.000 đ/giờ\n- 🍲 **Nấu ăn gia đình**: 60.000 đ/giờ\n- 🏠 **Tổng vệ sinh căn hộ**: 180.000 đ/lần\n- ❄️ **Vệ sinh máy lạnh**: 250.000 đ/bộ\n- 🛋️ **Giặt Sofa - Nệm hơi nước nóng**: từ 350.000 đ/bộ\n\nToàn bộ giá đã bao gồm dụng cụ, cam kết không phát sinh vô lý. Mọi chi phí phát sinh (nếu có) đều phải được khách hàng xác nhận trước qua hệ thống.`;
      recommendedServices = availableServices.slice(0, 3);
      suggestions = ["Đặt dọn dẹp nhà", "Đặt nấu ăn gia đình", "Chính sách thanh toán VietQR", "Chính sách bảo hành"];
    } else if (qLower.includes("bảo hành") || qLower.includes("hủy") || qLower.includes("đền bù") || qLower.includes("khiếu nại")) {
      reply = `Chính sách an tâm tuyệt đối tại Gia Đình Xanh:\n1. **Đổi thợ miễn phí**: Trong vòng 30 phút đầu nếu bạn thấy không hài lòng về phong cách làm việc của thợ.\n2. **Bảo hiểm tài sản**: Bồi thường lên đến 10.000.000 đ cho trường hợp xảy ra hư hại đổ vỡ có xác nhận.\n3. **Hủy đơn linh hoạt**: Miễn phí hủy đơn hoàn toàn trước giờ hẹn 2 tiếng.\n4. **Kênh hỗ trợ 24/7**: Mở phiếu khiếu nại trực tiếp tại mục Hỗ trợ để Admin giải quyết trong 15 phút.`;
      suggestions = ["Mở phiếu hỗ trợ", "Đọc quy chế dịch vụ", "Cách liên hệ hotline", "Đặt lịch ngay"];
    } else {
      recommendedServices = availableServices.slice(0, 2);
      recommendedProviders = availableProviders.slice(0, 2);
      reply = `Xin chào! Tôi là Trợ lý AI của Gia Đình Xanh. Tôi có thể giúp bạn:\n• Tư vấn gói dịch vụ phù hợp (Dọn dẹp, Nấu ăn, Vệ sinh máy lạnh, Giặt sofa).\n• Dự toán chi phí và tra cứu bảng giá niêm yết.\n• Tìm đối tác thợ được đánh giá cao nhất gần khu vực của bạn.\n• Giải đáp chính sách bảo hành, hoàn tiền và bảo hiểm tài sản.\n\nBạn đang cần hỗ trợ dịch vụ nào hôm nay?`;
      suggestions = ["Tư vấn dọn nhà theo giờ", "Tìm thợ nấu ăn gia đình", "Xem bảng giá dịch vụ", "Chính sách bảo hiểm"];
    }

    const nowIso = new Date().toISOString();
    const userMsgId = Date.now();
    const botMsgId = Date.now() + 1;

    if (isProd && client) {
      try {
        await client.from("ai_conversations").upsert([{
          conversation_id: conversationId,
          user_id: userId,
          title: userMessage.slice(0, 40),
          last_message_at: nowIso
        }]);
        await client.from("ai_messages").insert([
          { conversation_id: conversationId, role: "user", content: userMessage, created_at: nowIso },
          { conversation_id: conversationId, role: "assistant", content: reply, created_at: new Date(Date.now() + 200).toISOString() }
        ]);
      } catch (e) {
        console.warn("[AI Prod Save Warning]", e.message);
      }
    } else if (db) {
      if (!Array.isArray(db.ai_conversations)) db.ai_conversations = [];
      if (!Array.isArray(db.ai_messages)) db.ai_messages = [];

      let conv = db.ai_conversations.find((c) => c.conversation_id === conversationId);
      if (!conv) {
        conv = {
          conversation_id: conversationId,
          user_id: userId,
          title: userMessage.slice(0, 40),
          created_at: nowIso,
          last_message_at: nowIso
        };
        db.ai_conversations.push(conv);
      } else {
        conv.last_message_at = nowIso;
      }

      db.ai_messages.push({
        message_id: userMsgId,
        conversation_id: conversationId,
        role: "user",
        content: userMessage,
        created_at: nowIso
      });
      db.ai_messages.push({
        message_id: botMsgId,
        conversation_id: conversationId,
        role: "assistant",
        content: reply,
        created_at: new Date(Date.now() + 200).toISOString()
      });
      saveLocalDb(db);
    }

    return sendJson(res, 200, {
      ok: true,
      conversation_id: conversationId,
      reply,
      suggestions,
      recommended_services: recommendedServices,
      recommended_providers: recommendedProviders
    });
  }

  // 4.19b. Lịch sử hội thoại AI: GET /api/ai/history
  if (method === "GET" && pathname === "/api/ai/history") {
    const convId = searchParams.get("conversation_id");
    if (!convId) return sendJson(res, 400, { ok: false, error: "conversation_id là bắt buộc." });
    if (isProd && client) {
      const { data: msgs } = await client.from("ai_messages").select("*").eq("conversation_id", convId).order("created_at", { ascending: true });
      return sendJson(res, 200, { ok: true, messages: msgs || [] });
    }
    const msgs = (db.ai_messages || []).filter((m) => m.conversation_id === convId);
    return sendJson(res, 200, { ok: true, messages: msgs });
  }

  // 4.20. Tự động hủy đơn quá 24h: POST /api/rpc/auto-expire (FR-BOOK-007)
  if (method === "POST" && pathname === "/api/rpc/auto-expire") {
    const expiredCount = await autoExpirePendingBookings(db, isProd, client);
    return sendJson(res, 200, {
      ok: true,
      message: `Đã kiểm tra và tự động hủy ${expiredCount} đơn hàng pending quá 24h.`,
      expired_count: expiredCount
    });
  }

  return sendJson(res, 404, { ok: false, error: `Endpoint không tồn tại: ${method} ${pathname}` });
}

// ---------------------------------------------------------------------
// 5. STATIC FILE SERVER & PRE-WARM CACHE (Cho Vercel Serverless)
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

// Đọc trước các file tĩnh cốt lõi vào bộ nhớ để NFT (Node File Trace) đóng gói tự động trên Vercel
const STATIC_CACHE = {};
const CORE_FILES = ["index.html", "styles.css", "app.js", "db-mock.js"];
CORE_FILES.forEach((f) => {
  try {
    const p1 = path.join(ROOT_DIR, f);
    if (fs.existsSync(p1)) {
      STATIC_CACHE[f] = fs.readFileSync(p1);
    } else {
      const p2 = path.join(process.cwd(), f);
      if (fs.existsSync(p2)) {
        STATIC_CACHE[f] = fs.readFileSync(p2);
      }
    }
  } catch (_) {}
});

async function appHandler(req, res) {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname.startsWith("/api/")) {
      return await handleApiRequest(req, res, pathname, parsedUrl.searchParams);
    }

    let safePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");

    // 1. Phục vụ ngay từ bộ nhớ đệm (tránh lỗi 404 trên Vercel Serverless)
    if (STATIC_CACHE[safePath]) {
      const ext = path.extname(safePath).toLowerCase() || ".html";
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      return res.end(STATIC_CACHE[safePath]);
    }

    // 2. Tìm file trên ổ đĩa
    let filePath = path.normalize(path.join(ROOT_DIR, safePath));
    if (!fs.existsSync(filePath)) {
      filePath = path.normalize(path.join(process.cwd(), safePath));
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // 3. SPA Fallback: Nếu không có đuôi mở rộng, trả về index.html
    if (STATIC_CACHE["index.html"]) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(STATIC_CACHE["index.html"]);
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message });
  }
}

const server = http.createServer(appHandler);

process.on("uncaughtException", (err) => {
  console.error("[Server UncaughtException]", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Server UnhandledRejection]", reason);
});

server.on("error", (err) => {
  console.error("[Server Error]", err);
});

const { port, env } = loadEnvConfig();
if (env !== "production") {
  ensureLocalDb();
}

// Chỉ chạy background worker và listen khi chạy độc lập (không nằm trên Vercel Serverless)
if (!process.env.VERCEL) {
  // Background Cron Job: Tự động hủy đơn hàng pending quá 24h (FR-BOOK-007)
  setInterval(() => {
    try {
      const isProd = env === "production";
      const db = isProd ? null : ensureLocalDb();
      const { client } = getSupabaseClient();
      autoExpirePendingBookings(db, isProd, client);
    } catch (err) {
      console.warn("[Background Auto-Expire Cron Warning]", err.message);
    }
  }, 60 * 1000);

  server.listen(port, "0.0.0.0", () => {
    console.log(`[Gia Đình Xanh Server] Đang chạy tại http://localhost:${port} (Môi trường: ${env})`);
  });
}

// Xuất appHandler cho môi trường Vercel Serverless
module.exports = appHandler;
