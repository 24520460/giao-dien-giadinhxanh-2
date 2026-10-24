# CẤU TRÚC ĐỊNH TUYẾN NEXT.JS APP ROUTER & MIDDLEWARE PHÂN QUYỀN
## DỰ ÁN: GIA ĐÌNH XANH (HOME SERVICE BOOKING)
**Tương thích Next.js 15+ (App Router), Supabase SSR `@supabase/ssr`, TypeScript**

---

### 1. CẤU TRÚC THƯ MỤC DỰ ÁN (PROJECT DIRECTORY TREE)

```text
my-home-service-app/
├── app/
│   ├── (auth)/                          # PHÂN HỆ 0: DÙNG CHUNG & XÁC THỰC
│   │   ├── layout.tsx                   # Auth layout (centered, clean)
│   │   ├── login/
│   │   │   └── page.tsx                 # [0.1] Đăng nhập / Đăng ký / Quên MK
│   │   ├── onboarding/
│   │   │   ├── customer/
│   │   │   │   └── page.tsx             # [0.2] Thiết lập hồ sơ khách hàng (ward_id, phone)
│   │   │   └── provider/
│   │   │       └── page.tsx             # [0.3] Đăng ký hành nghề thợ (CCCD, avatar, kỹ năng)
│   │   ├── provider-status/
│   │   │   └── page.tsx                 # [0.4] Trạng thái duyệt hồ sơ thợ (pending / rejected)
│   │   └── suspended/
│   │       └── page.tsx                 # [0.5] Thông báo tài khoản bị khóa (is_active = FALSE)
│   │
│   ├── (customer)/                      # PHÂN HỆ 1: GIAO DIỆN KHÁCH HÀNG
│   │   ├── layout.tsx                   # Customer navigation & stationery shell
│   │   ├── page.tsx                     # [1.1] Trang chủ & Khám phá dịch vụ
│   │   ├── booking/
│   │   │   └── configure/
│   │   │       └── page.tsx             # [1.2] Cấu hình đặt lịch (Booking Wizard)
│   │   ├── tracking/
│   │   │   └── [id]/
│   │   │       └── page.tsx             # [1.3] Theo dõi đơn hàng trực tiếp (Live Tracking)
│   │   ├── bookings/
│   │   │   └── page.tsx                 # [1.4] Quản lý lịch hẹn dịch vụ
│   │   ├── profile/
│   │   │   └── page.tsx                 # [1.5] Hồ sơ cá nhân & Sổ địa chỉ
│   │   └── favorites/
│   │       └── page.tsx                 # [1.6] Danh sách Dịch vụ yêu thích
│   │
│   ├── (provider)/                      # PHÂN HỆ 2: GIAO DIỆN ĐỐI TÁC / THỢ
│   │   ├── layout.tsx                   # Provider sidebar + Header 2.5 (Online & GPS Toggle)
│   │   ├── job-board/
│   │   │   └── page.tsx                 # [2.1] Sàn nhận việc làm (Job Board)
│   │   ├── live-timer/
│   │   │   └── [id]/
│   │   │       └── page.tsx             # [2.2] Ca làm việc hiện tại (Live Timer & GPS)
│   │   ├── wallet/
│   │   │   └── page.tsx                 # [2.3] Ví thu nhập & Lịch ca làm việc
│   │   └── settings/
│   │       └── page.tsx                 # [2.4] Cấu hình Kỹ năng (provider_services) & Khu vực (provider_areas)
│   │
│   ├── (admin)/                         # PHÂN HỆ 3: GIAO DIỆN QUẢN TRỊ VIÊN
│   │   ├── layout.tsx                   # Admin Framed-Sheet L-frame layout
│   │   ├── dashboard/
│   │   │   └── page.tsx                 # [3.1] Dashboard Tổng quan & Điều phối
│   │   ├── pricing/
│   │   │   └── page.tsx                 # [3.2] Quản lý Danh mục & Biểu giá Dịch vụ
│   │   ├── kyc-review/
│   │   │   └── page.tsx                 # [3.3] Xét duyệt Hồ sơ Đối tác Thợ
│   │   └── management/
│   │       └── page.tsx                 # [3.4] Quản lý Users (is_active), Tickets & Reviews
│   │
│   ├── api/                             # API ROUTES / SUPABASE RPC WRAPPERS
│   │   ├── rpc/
│   │   │   ├── transition-status/route.ts
│   │   │   ├── update-incidental/route.ts
│   │   │   ├── confirm-payment/route.ts
│   │   │   └── admin-adjust/route.ts
│   │   └── auth/callback/route.ts
│   │
│   ├── globals.css                      # Unified design tokens (taste-skill + impeccable)
│   └── layout.tsx                       # Root HTML & Fonts (IBM Plex Sans, STIX Two Text)
│
├── components/
│   ├── modals/                          # 15 HỘP THOẠI & NGĂN KÉO (MODALS / DRAWERS)
│   │   ├── ProviderPublicProfileModal.tsx # [1.7] Hồ sơ công khai của Thợ
│   │   ├── CheckoutModal.tsx              # [1.8] Cổng thanh toán hóa đơn VietQR / SePay
│   │   ├── ReviewModal.tsx                # [1.9] Đánh giá & Chấm điểm Thợ
│   │   ├── CancelBookingModal.tsx         # [1.10] Xác nhận hủy lịch hẹn
│   │   ├── SupportTicketDrawer.tsx        # [1.11] Trung tâm hỗ trợ & Gửi khiếu nại
│   │   ├── ProviderHeaderWidget.tsx       # [2.5] Header toggle Nhận việc & GPS
│   │   ├── AvailabilityScheduleModal.tsx  # [2.6] Thiết lập lịch cố định & Báo nghỉ phép
│   │   ├── IncidentalCostModal.tsx        # [2.7] Kê khai chi phí phát sinh
│   │   ├── RejectJobModal.tsx             # [2.8] Từ chối đơn / Hủy ca
│   │   ├── EmergencyReportDrawer.tsx      # [2.9] Báo cáo sự cố khẩn cấp
│   │   ├── AuditLogDrawer.tsx             # [3.5] Chi tiết đơn & Lịch sử kiểm toán
│   │   ├── RefundPaymentModal.tsx         # [3.6] Hoàn tiền & Điều chỉnh thanh toán
│   │   ├── TicketDetailDrawer.tsx         # [3.7] Xử lý & Cập nhật phiếu hỗ trợ
│   │   ├── ServiceModal.tsx               # [3.8] Thêm/Sửa danh mục & Dịch vụ
│   │   └── AdministrativeModal.tsx        # [3.9] Quản lý Tỉnh/Phường
│   └── ui/                                # Primitives: Button, Table, Badge, Inputs
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                    # createBrowserClient
│   │   ├── server.ts                    # createServerClient
│   │   └── middleware.ts                # createServerClient in middleware
│   └── types/
│       └── database.types.ts            # Type definitions generated from Supabase schema
│
└── middleware.ts                        # MIDDLEWARE PHÂN QUYỀN TRUNG TÂM
```

---

### 2. SOURCE CODE: `middleware.ts` (PHÂN QUYỀN 4 PHÂN HỆ)

```typescript
// middleware.ts
import { NextResponse, type NextRequest } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 1. Kiểm tra phiên đăng nhập
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Cho phép truy cập công khai vào trang chủ và màn hình đăng nhập
  const isAuthPath = path.startsWith('/login') || path.startsWith('/auth');
  const isPublicHome = path === '/';

  if (!user) {
    if (!isAuthPath && !isPublicHome) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return response;
  }

  // 2. Truy vấn hồ sơ người dùng trong public.users
  const { data: profile } = await supabase
    .from('users')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  // 3. Chặn tài khoản bị khóa (Màn 0.5)
  if (profile && !profile.is_active && path !== '/suspended') {
    return NextResponse.redirect(new URL('/suspended', request.url));
  }

  // 4. Phân luồng vai trò (Role-based Access Control)
  const role = profile?.role; // 'customer' | 'provider' | 'admin'

  // Bảo vệ phân hệ Quản trị (Admin Portal)
  if (path.startsWith('/dashboard') || path.startsWith('/pricing') || path.startsWith('/kyc-review') || path.startsWith('/management')) {
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Bảo vệ phân hệ Đối tác Thợ (Provider Portal)
  if (path.startsWith('/job-board') || path.startsWith('/live-timer') || path.startsWith('/wallet')) {
    if (role !== 'provider') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Kiểm tra verification_status của Thợ
    const { data: provProfile } = await supabase
      .from('provider_profiles')
      .select('verification_status')
      .eq('user_id', user.id)
      .single();

    if (provProfile?.verification_status !== 'verified' && path !== '/provider-status') {
      return NextResponse.redirect(new URL('/provider-status', request.url));
    }
  }

  // Bảo vệ phân hệ Khách hàng (Customer Onboarding Check)
  if (path.startsWith('/booking') || path.startsWith('/tracking') || path.startsWith('/bookings') || path.startsWith('/favorites')) {
    if (role !== 'customer') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Kiểm tra đã hoàn thành Customer Onboarding (đã có ward_id) chưa
    const { data: custProfile } = await supabase
      .from('customer_profiles')
      .select('ward_id')
      .eq('user_id', user.id)
      .single();

    if (!custProfile?.ward_id && path !== '/onboarding/customer') {
      return NextResponse.redirect(new URL('/onboarding/customer', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```
