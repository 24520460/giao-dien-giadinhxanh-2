const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const dbMock = require('../db-mock.js');

describe('Gia Đình Xanh - Database Mock & Schema Verification', () => {
  test('db-mock exports createInitialStore and initializes 16 required tables', () => {
    assert.strictEqual(typeof dbMock.createInitialStore, 'function');
    const store = dbMock.createInitialStore();
    
    const requiredTables = [
      'province',
      'ward',
      'users',
      'customer_profiles',
      'provider_profiles',
      'service_categories',
      'services',
      'provider_services',
      'provider_areas',
      'availability_schedules',
      'availability_exceptions',
      'bookings',
      'booking_status_history',
      'reviews',
      'favorites',
      'support_tickets'
    ];

    for (const table of requiredTables) {
      assert.ok(Array.isArray(store[table]), `Table ${table} should be an array in store`);
      assert.ok(store[table].length > 0, `Table ${table} should have initial seed data`);
    }

    assert.ok(store.session, 'Store should contain session configuration');
  });

  test('db-mock maintains referential relationships between users and profiles', () => {
    const store = dbMock.createInitialStore();
    const customerUsers = store.users.filter(u => u.role === 'customer');
    const providerUsers = store.users.filter(u => u.role === 'provider');

    assert.ok(customerUsers.length >= 2, 'Should have at least 2 customer users');
    assert.ok(providerUsers.length >= 4, 'Should have at least 4 provider users');

    for (const cp of store.customer_profiles) {
      const u = store.users.find(x => x.user_id === cp.user_id);
      assert.ok(u, `Customer profile ${cp.customer_id} references valid user_id ${cp.user_id}`);
    }

    for (const pp of store.provider_profiles) {
      const u = store.users.find(x => x.user_id === pp.user_id);
      assert.ok(u, `Provider profile ${pp.provider_id} references valid user_id ${pp.user_id}`);
    }
  });
});

describe('Gia Đình Xanh - Full-Stack REST API & RPC Verification', () => {
  let targetPort = 3000;
  let serverProcess = null;
  let createdBookingId = null;

  function pingServer(port) {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/api/status`, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(500, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  function makeRequest(method, reqPath, body = null) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: targetPort,
          path: reqPath,
          method,
          headers: {
            'Content-Type': 'application/json'
          }
        },
        (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve({ statusCode: res.statusCode, data: parsed });
            } catch (e) {
              resolve({ statusCode: res.statusCode, raw: data });
            }
          });
        }
      );
      req.on('error', reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  before(async () => {
    // Check if port 3000 is active
    const isRunning = await pingServer(3000);
    if (isRunning) {
      targetPort = 3000;
      return;
    }

    // Otherwise spawn server
    const { spawn } = require('node:child_process');
    serverProcess = spawn(process.execPath, ['server.js'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe'
    });

    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 200));
      if (await pingServer(3000)) break;
    }
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  test('GET /api/status returns 200 with mode and table counts', async () => {
    const res = await makeRequest('GET', '/api/status');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.ok, true);
    assert.ok(res.data.mode === 'local_sql_store' || res.data.mode === 'supabase');
    assert.ok(res.data.tableCounts, 'Status response contains table counts');
    assert.ok(res.data.tableCounts.bookings > 0);
  });

  test('GET /api/bootstrap loads 16 tables + provider_public_profiles view', async () => {
    const res = await makeRequest('GET', '/api/bootstrap');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.ok, true);
    assert.ok(res.data.db.provider_public_profiles, 'Computed view provider_public_profiles exists');
    assert.ok(Array.isArray(res.data.db.services), 'Services array exists');
  });

  test('POST /api/bookings creates a new booking with history record', async () => {
    const payload = {
      customer_id: 101,
      provider_id: 201,
      service_id: 1,
      ward_id: '27403',
      address: '123 Đường Nguyễn Thị Thập, Phường Tân Phú, Quận 7',
      total_amount: 180000,
      notes: 'Unit test booking creation'
    };
    const res = await makeRequest('POST', '/api/bookings', payload);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.data.ok, true);
    assert.ok(res.data.booking.booking_id, 'New booking has booking_id');
    assert.strictEqual(res.data.booking.status, 'pending');
    assert.strictEqual(res.data.history.new_status, 'pending');
    createdBookingId = res.data.booking.booking_id;
  });

  test('POST /api/rpc/transition-status updates booking status and logs audit trail', async () => {
    const targetBookingId = createdBookingId || 1040;
    const payload = {
      booking_id: targetBookingId,
      new_status: 'confirmed',
      reason: 'Unit test transition',
      changed_by: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b21'
    };
    const res = await makeRequest('POST', '/api/rpc/transition-status', payload);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.ok, true);
    assert.strictEqual(res.data.booking.status, 'confirmed');
  });

  test('POST /api/supabase/reset-local resets persistent store to pristine seed data', async () => {
    const res = await makeRequest('POST', '/api/supabase/reset-local');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.ok, true);
    assert.ok(res.data.message.includes('Đã khôi phục dữ liệu'));
  });

  test('POST /api/onboarding/customer saves spatial GPS coordinates (latitude, longitude)', async () => {
    const payload = {
      user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      full_name: 'Nguyễn Văn Test GPS',
      phone_number: '0988776655',
      ward_id: '27403',
      default_address: 'Tòa nhà Landmark 81, Phường 22, Bình Thạnh',
      latitude: 10.795123,
      longitude: 106.721845
    };
    const res = await makeRequest('POST', '/api/onboarding/customer', payload);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.ok, true);
    assert.ok(res.data.customer_profile, 'Returns customer_profile');
    assert.strictEqual(Number(res.data.customer_profile.latitude), 10.795123);
    assert.strictEqual(Number(res.data.customer_profile.longitude), 106.721845);
    assert.strictEqual(res.data.customer_profile.ward_id, '27403');
  });

  test('PUT /api/profile/customer updates default address and ward seamlessly', async () => {
    const payload = {
      customer_id: 101,
      user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      full_name: 'Nguyễn Minh Thảo Cập Nhật',
      phone_number: '0901234567',
      ward_id: '26734',
      default_address: 'Số 45 Đường Lê Duẩn, Phường Bến Nghé, Quận 1',
      latitude: 10.779123,
      longitude: 106.699876
    };
    const res = await makeRequest('PUT', '/api/profile/customer', payload);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.ok, true);
    assert.ok(res.data.customer_profile);
    assert.strictEqual(res.data.customer_profile.ward_id, '26734');
    assert.strictEqual(res.data.customer_profile.default_address, 'Số 45 Đường Lê Duẩn, Phường Bến Nghé, Quận 1');
  });

  test('GET /api/geo/reverse validates coordinates and returns Vietnamese reverse geocoding info', async () => {
    // 1. Missing coordinates validation
    const invalidRes = await makeRequest('GET', '/api/geo/reverse');
    assert.strictEqual(invalidRes.statusCode, 400);
    assert.strictEqual(invalidRes.data.ok, false);

    // 2. Valid coordinates lookup (with caching)
    const validRes = await makeRequest('GET', '/api/geo/reverse?lat=10.8798&lng=106.8068');
    assert.strictEqual(validRes.statusCode, 200);
    assert.strictEqual(validRes.data.ok, true);
    assert.ok(typeof validRes.data.detailed_address === 'string' && validRes.data.detailed_address.length > 0);
    assert.ok(typeof validRes.data.full_address === 'string');
    assert.ok(validRes.data.province_name);
    assert.strictEqual(validRes.data.lat, 10.8798);
    assert.strictEqual(validRes.data.lng, 106.8068);
  });

  test('POST /api/auth/register enforces password requirement and allows login verification', async () => {
    const testPhone = '0936' + Math.floor(100000 + Math.random() * 900000);
    
    // 1. Missing or short password fails with 400
    const shortPwRes = await makeRequest('POST', '/api/auth/register', {
      full_name: 'Nguyễn Văn Test',
      phone_number: testPhone,
      email: 'test@giadinhxanh.vn',
      password: '123'
    });
    assert.strictEqual(shortPwRes.statusCode, 400);
    assert.strictEqual(shortPwRes.data.ok, false);

    // 2. Valid registration with password
    const regRes = await makeRequest('POST', '/api/auth/register', {
      full_name: 'Nguyễn Văn Test',
      phone_number: testPhone,
      email: `${testPhone}@test.vn`,
      password: 'StrongPassword123',
      role: 'customer'
    });
    assert.strictEqual(regRes.statusCode, 201);
    assert.strictEqual(regRes.data.ok, true);
    assert.strictEqual(regRes.data.user.phone_number, testPhone);

    // 3. Login with wrong password returns 401
    const wrongLoginRes = await makeRequest('POST', '/api/auth/login', {
      identifier: testPhone,
      password: 'WrongPassword'
    });
    assert.strictEqual(wrongLoginRes.statusCode, 401);
    assert.strictEqual(wrongLoginRes.data.ok, false);

    // 4. Login with correct password returns 200 and user info
    const correctLoginRes = await makeRequest('POST', '/api/auth/login', {
      identifier: testPhone,
      password: 'StrongPassword123'
    });
    assert.strictEqual(correctLoginRes.statusCode, 200);
    assert.strictEqual(correctLoginRes.data.ok, true);
    assert.strictEqual(correctLoginRes.data.user.phone_number, testPhone);
  });

  test('Job Dispatch Inbox & Concurrency: POST /api/bookings supports broadcast pool and /accept prevents double-booking (expired lock)', async () => {
    // 1. Create a broadcast order (provider_id = null)
    const broadcastPayload = {
      customer_id: 101,
      provider_id: null,
      service_id: 301,
      ward_id: '27403',
      address: 'KTX Khu A ĐHQG, Tạ Quang Bửu, Phường Linh Trung',
      total_amount: 170000,
      notes: 'Đơn broadcast gửi tới toàn bộ thợ'
    };
    const createRes = await makeRequest('POST', '/api/bookings', broadcastPayload);
    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.data.ok, true);
    const bkId = createRes.data.booking.booking_id;
    assert.strictEqual(createRes.data.booking.dispatch_type, 'broadcast');

    // 2. First provider accepts job successfully
    const acceptRes1 = await makeRequest('POST', `/api/bookings/${bkId}/accept`, {
      provider_id: 201,
      user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b21'
    });
    assert.strictEqual(acceptRes1.statusCode, 200);
    assert.strictEqual(acceptRes1.data.ok, true);
    assert.strictEqual(acceptRes1.data.booking.status, 'confirmed');
    assert.strictEqual(acceptRes1.data.booking.provider_id, 201);

    // 3. Second provider attempts to accept the same job -> returns 409 Expired
    const acceptRes2 = await makeRequest('POST', `/api/bookings/${bkId}/accept`, {
      provider_id: 202,
      user_id: 5
    });
    assert.strictEqual(acceptRes2.statusCode, 409);
    assert.strictEqual(acceptRes2.data.ok, false);
    assert.strictEqual(acceptRes2.data.expired, true);
  });

  test('VietQR Payment: POST /api/bookings/:id/pay confirms transaction and records paid state in database', async () => {
    // 1. Get an existing booking from bootstrap
    const boot1 = await makeRequest('GET', '/api/bootstrap');
    assert.strictEqual(boot1.statusCode, 200);
    const targetBooking = boot1.data.db.bookings[0];
    assert.ok(targetBooking, 'Should have at least one booking');
    const targetId = targetBooking.booking_id;

    // 2. Pay for target booking via VietQR
    const payRes = await makeRequest('POST', `/api/bookings/${targetId}/pay`, {
      booking_id: targetId,
      method: 'VIETQR_BANK_TRANSFER',
      transaction_id: 'VCB-QR-TEST-9988',
      amount: 240000,
      changed_by: 1
    });
    assert.strictEqual(payRes.statusCode, 200);
    assert.strictEqual(payRes.data.ok, true);
    assert.strictEqual(payRes.data.booking.payment_status, 'paid');
    assert.strictEqual(payRes.data.transaction_id, 'VCB-QR-TEST-9988');

    // 3. Verify via bootstrap that the database persisted payment_status and history
    const boot2 = await makeRequest('GET', '/api/bootstrap');
    assert.strictEqual(boot2.statusCode, 200);
    const bk = boot2.data.db.bookings.find((b) => b.booking_id === targetId);
    assert.ok(bk);
    assert.strictEqual(bk.payment_status, 'paid');
    const hist = (boot2.data.db.booking_status_history || []).find((h) => h.booking_id === targetId && (h.reason || '').includes('VCB-QR-TEST-9988'));
    assert.ok(hist, 'Status history should log VietQR transaction');
  });

  test('Production Mode: /api/status?mode=production activates zero-mock production state', async () => {
    const res = await makeRequest('GET', '/api/status?mode=production');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.isProduction, true);
    assert.strictEqual(res.data.mode, 'production');
  });

  test('Production Mode: POST /api/supabase/reset-local?mode=production is blocked with 403 Forbidden', async () => {
    const res = await makeRequest('POST', '/api/supabase/reset-local?mode=production');
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.data.ok, false);
    assert.ok(res.data.error.includes('Production Mode'));
  });
});
