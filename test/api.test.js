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
