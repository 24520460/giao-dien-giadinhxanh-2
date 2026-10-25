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
        "support_tickets"
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
        "support_tickets"
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
    const serviceId = Number(body.service_id);
    const providerId = body.provider_id ? Number(body.provider_id) : null;
    const wardId = String(body.ward_id || "27403");
    const customerId = Number(body.customer_id);
    const address = String(body.address || "").trim();

    if (!serviceId || !wardId || !address || !customerId) {
      return sendJson(res, 400, { ok: false, error: "Vui lòng điền đầy đủ dịch vụ, khách hàng, phường/xã và địa chỉ." });
    }

    if (isProd) {
      if (!client) return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      const nowIso = new Date().toISOString();
      const isBroadcast = (body.provider_id === null || body.provider_id === undefined || body.provider_id === "broadcast");
      const newBk = {
        customer_id: customerId,
        provider_id: isBroadcast ? null : (Number(body.provider_id) || body.provider_id),
        service_id: serviceId,
        scheduled_time: body.scheduled_time || nowIso,
        status: "pending",
        address,
        ward_id: wardId,
        latitude: Number(body.latitude) || 10.728912,
        longitude: Number(body.longitude) || 106.712405,
        total_amount: Number(body.total_amount) || 180000,
        total_incidental: 0,
        notes: (isBroadcast ? "[BROADCAST_POOL] " : "") + String(body.notes || "Khách đặt lịch qua hệ thống.").trim(),
        payment_status: "unpaid"
      };

      const { data: createdBk, error: bkErr } = await client.from("bookings").insert([newBk]).select().single();
      if (bkErr) return sendJson(res, 500, { ok: false, error: `Lỗi tạo đơn Supabase: ${bkErr.message}` });

      await client.from("booking_status_history").insert([{
        booking_id: createdBk.booking_id,
        previous_status: null,
        new_status: "pending",
        changed_by: body.changed_by || null,
        reason: "Khách hàng tạo đơn đặt lịch"
      }]);

      return sendJson(res, 201, { ok: true, booking: createdBk });
    }

    // Local mode
    const svc = db.services.find((s) => s.service_id === serviceId);
    const nextId = Math.max(1040, ...db.bookings.map((b) => b.booking_id || 0)) + 1;
    const nowIso = new Date().toISOString();
    const isBroadcast = (body.provider_id === null || body.provider_id === undefined || body.provider_id === "broadcast");
    const chosenProviderId = isBroadcast ? null : Number(body.provider_id);

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

  // 4.16. POST /api/favorites/toggle — Lưu / Bỏ lưu dịch vụ yêu thích
  if (method === "POST" && pathname === "/api/favorites/toggle") {
    const body = await parseBody(req);
    const customerId = Number(body.customer_id);
    const serviceId = Number(body.service_id);

    if (isProd) {
      if (!client) return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      const { data: existing } = await client.from("favorites").select("favorite_id").eq("customer_id", customerId).eq("service_id", serviceId).maybeSingle();
      if (existing) {
        await client.from("favorites").delete().eq("favorite_id", existing.favorite_id);
        return sendJson(res, 200, { ok: true, added: false });
      } else {
        await client.from("favorites").insert([{ customer_id: customerId, service_id: serviceId }]);
        return sendJson(res, 200, { ok: true, added: true });
      }
    }

    const targetCid = customerId || 101;
    const idx = db.favorites.findIndex((f) => f.customer_id === targetCid && f.service_id === serviceId);
    let added = false;
    if (idx >= 0) {
      db.favorites.splice(idx, 1);
    } else {
      db.favorites.push({
        favorite_id: Date.now(),
        customer_id: targetCid,
        service_id: serviceId,
        created_at: new Date().toISOString()
      });
      added = true;
    }
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, added, favorites: db.favorites });
  }

  // 4.17. POST /api/support-tickets — Gửi yêu cầu hỗ trợ
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

  // 4.18. Admin APIs (KYC, Services, Categories)
  if (method === "PATCH" && pathname.startsWith("/api/admin/kyc/")) {
    const providerId = Number(pathname.split("/").pop());
    const body = await parseBody(req);

    if (isProd) {
      if (!client) return sendJson(res, 503, { ok: false, error: "Không có kết nối Supabase ở Production Mode." });
      const { data: pp, error: err } = await client.from("provider_profiles").update({
        verification_status: body.verification_status,
        updated_at: new Date().toISOString()
      }).eq("provider_id", providerId).select().single();
      if (err) return sendJson(res, 500, { ok: false, error: err.message });
      return sendJson(res, 200, { ok: true, provider_profile: pp });
    }

    const pp = db.provider_profiles.find((p) => p.provider_id === providerId);
    if (!pp) return sendJson(res, 404, { ok: false, error: "Không tìm thấy hồ sơ thợ." });
    if (body.verification_status) pp.verification_status = body.verification_status;
    pp.updated_at = new Date().toISOString();
    saveLocalDb(db);
    return sendJson(res, 200, { ok: true, provider_profile: pp });
  }

  return sendJson(res, 404, { ok: false, error: `Endpoint không tồn tại: ${method} ${pathname}` });
}

// ---------------------------------------------------------------------
// 5. STATIC FILE SERVER
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
      return await handleApiRequest(req, res, pathname, parsedUrl.searchParams);
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
server.listen(port, "0.0.0.0", () => {
  console.log(`[Gia Đình Xanh Server] Đang chạy tại http://localhost:${port} (Môi trường: ${env})`);
});
