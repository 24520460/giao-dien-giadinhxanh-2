-- =====================================================================
-- GIA ĐÌNH XANH - SUPABASE RPC & TRANSACTIONAL WORKFLOW FUNCTIONS
-- Bổ sung cho 4. home_service_booking_supabase.sql
-- Tác giả: Nhóm 10 (Home Service Booking System)
-- Mục đích:
--   1. Khắc phục lỗ hổng RLS ở bảng `bookings` (chặn sửa trực tiếp cột nhạy cảm)
--   2. Đảm bảo tính nguyên tử (Atomic Transaction) khi chuyển trạng thái
--      đơn hàng và tự động ghi vết vào `booking_status_history`
--   3. Quản lý kê khai chi phí phát sinh (`total_incidental`), thanh toán
--      (`payment_status`) và điều chỉnh/hoàn tiền của Admin.
-- =====================================================================

-- 1. Thu hồi quyền UPDATE trực tiếp toàn bảng bookings của authenticated,
--    buộc mọi thay đổi trạng thái & số tiền phải đi qua các hàm RPC kiểm soát chặt chẽ.
REVOKE UPDATE ON public.bookings FROM authenticated;
GRANT UPDATE (notes, address, scheduled_time, latitude, longitude) ON public.bookings TO authenticated;

-- =====================================================================
-- RPC 1: rpc_transition_booking_status
-- Xử lý chuyển đổi trạng thái đơn hàng an toàn theo Ma trận Phân quyền (Role State Machine)
-- Tự động INSERT bản ghi kiểm toán vào `booking_status_history`.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.rpc_transition_booking_status(
  p_booking_id BIGINT,
  p_new_status public.booking_status,
  p_reason     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_role          public.user_role;
  v_is_active     BOOLEAN;
  v_booking       public.bookings%ROWTYPE;
  v_cust_id       BIGINT;
  v_prov_id       BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Vui lòng đăng nhập để thực hiện thao tác.';
  END IF;

  SELECT role, is_active INTO v_role, v_is_active
  FROM public.users
  WHERE user_id = v_uid;

  IF NOT FOUND OR NOT v_is_active THEN
    RAISE EXCEPTION 'ACCOUNT_SUSPENDED: Tài khoản không tồn tại hoặc đã bị khóa.';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE booking_id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Không tìm thấy đơn hàng #%.', p_booking_id;
  END IF;

  IF v_booking.status = p_new_status THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: Đơn hàng đã ở trạng thái %.', p_new_status;
  END IF;

  -- Kiểm tra quyền và ma trận trạng thái hợp lệ theo từng Role
  IF v_role = 'customer' THEN
    v_cust_id := public.current_customer_id();
    IF v_booking.customer_id IS DISTINCT FROM v_cust_id THEN
      RAISE EXCEPTION 'FORBIDDEN: Bạn không sở hữu đơn hàng này.';
    END IF;

    -- Khách hàng chỉ được phép Hủy đơn khi đơn đang ở pending hoặc confirmed
    IF p_new_status = 'cancelled' AND v_booking.status IN ('pending', 'confirmed') THEN
      IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION 'REASON_REQUIRED: Vui lòng nhập lý do hủy lịch hẹn.';
      END IF;
    ELSE
      RAISE EXCEPTION 'INVALID_TRANSITION: Khách hàng không thể chuyển đơn từ % sang %.', v_booking.status, p_new_status;
    END IF;

  ELSIF v_role = 'provider' THEN
    v_prov_id := public.current_provider_id();
    IF v_booking.provider_id IS DISTINCT FROM v_prov_id THEN
      RAISE EXCEPTION 'FORBIDDEN: Đơn hàng này không thuộc phân công của bạn.';
    END IF;

    -- Thợ nhận việc: pending -> confirmed
    IF v_booking.status = 'pending' AND p_new_status = 'confirmed' THEN
      NULL;
    -- Thợ từ chối việc: pending -> rejected (bắt buộc có lý do)
    ELSIF v_booking.status = 'pending' AND p_new_status = 'rejected' THEN
      IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION 'REASON_REQUIRED: Vui lòng nhập lý do từ chối nhận đơn.';
      END IF;
    -- Thợ bắt đầu ca làm: confirmed -> in_progress
    ELSIF v_booking.status = 'confirmed' AND p_new_status = 'in_progress' THEN
      NULL;
    -- Thợ hoàn thành ca làm: in_progress -> completed
    ELSIF v_booking.status = 'in_progress' AND p_new_status = 'completed' THEN
      NULL;
    -- Thợ hủy ca khẩn cấp: confirmed/in_progress -> cancelled (bắt buộc có lý do)
    ELSIF v_booking.status IN ('confirmed', 'in_progress') AND p_new_status = 'cancelled' THEN
      IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION 'REASON_REQUIRED: Vui lòng nhập lý do hủy ca làm việc.';
      END IF;
    ELSE
      RAISE EXCEPTION 'INVALID_TRANSITION: Thợ không thể chuyển đơn từ % sang %.', v_booking.status, p_new_status;
    END IF;

  ELSIF v_role = 'admin' THEN
    -- Admin có toàn quyền điều phối nhưng bắt buộc ghi lý do vào Audit Log
    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
      p_reason := 'Quản trị viên điều phối trạng thái hệ thống';
    END IF;
  END IF;

  -- Cập nhật trạng thái đơn hàng
  UPDATE public.bookings
     SET status = p_new_status,
         updated_at = now()
   WHERE booking_id = p_booking_id;

  -- Ghi log vào bảng booking_status_history
  INSERT INTO public.booking_status_history (
    booking_id, previous_status, new_status, changed_by, reason
  ) VALUES (
    p_booking_id, v_booking.status::TEXT, p_new_status::TEXT, v_uid, COALESCE(p_reason, 'Chuyển trạng thái theo quy trình')
  );

  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'previous_status', v_booking.status,
    'new_status', p_new_status,
    'changed_by', v_uid,
    'updated_at', now()
  );
END;
$$;

-- =====================================================================
-- RPC 2: rpc_update_incidental_cost
-- Cho phép Thợ đang thực hiện ca làm (`confirmed` hoặc `in_progress`) kê khai
-- chi phí vật tư phát sinh (`total_incidental`), tự động tính lại `total_amount`
-- và lưu vết minh bạch vào `booking_status_history`.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.rpc_update_incidental_cost(
  p_booking_id       BIGINT,
  p_incidental_cost  DECIMAL(10,2),
  p_incidental_note  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_prov_id    BIGINT := public.current_provider_id();
  v_booking    public.bookings%ROWTYPE;
  v_base_price DECIMAL(10,2);
  v_new_total  DECIMAL(10,2);
BEGIN
  IF p_incidental_cost < 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Chi phí phát sinh phải lớn hơn hoặc bằng 0.';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE booking_id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Không tìm thấy đơn hàng #%.', p_booking_id;
  END IF;

  IF NOT public.is_admin() AND v_booking.provider_id IS DISTINCT FROM v_prov_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Chỉ thợ phụ trách ca làm hoặc Admin mới được kê khai chi phí phát sinh.';
  END IF;

  IF v_booking.status NOT IN ('confirmed', 'in_progress') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'INVALID_STATE: Chỉ được kê khai chi phí phát sinh khi ca làm đang diễn ra.';
  END IF;

  -- Tính giá dịch vụ gốc = total_amount hiện tại trừ đi total_incidental cũ
  v_base_price := GREATEST(0, v_booking.total_amount - v_booking.total_incidental);
  v_new_total  := v_base_price + p_incidental_cost;

  UPDATE public.bookings
     SET total_incidental = p_incidental_cost,
         total_amount     = v_new_total,
         notes            = CASE
                              WHEN p_incidental_note IS NOT NULL AND btrim(p_incidental_note) <> ''
                              THEN COALESCE(notes || E'\n', '') || '[Phát sinh: ' || p_incidental_cost || 'đ] ' || p_incidental_note
                              ELSE notes
                            END,
         updated_at       = now()
   WHERE booking_id = p_booking_id;

  INSERT INTO public.booking_status_history (
    booking_id, previous_status, new_status, changed_by, reason
  ) VALUES (
    p_booking_id,
    v_booking.status::TEXT,
    v_booking.status::TEXT,
    v_uid,
    format('Cập nhật chi phí phát sinh: %s VND -> Tổng mới: %s VND. Lý do: %s',
           p_incidental_cost, v_new_total, COALESCE(p_incidental_note, 'Mua vật tư phụ'))
  );

  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'total_incidental', p_incidental_cost,
    'total_amount', v_new_total
  );
END;
$$;

-- =====================================================================
-- RPC 3: rpc_confirm_booking_payment
-- Xác nhận thanh toán hóa đơn (`unpaid` -> `paid`) dành cho Khách hàng hoặc Admin
-- =====================================================================
CREATE OR REPLACE FUNCTION public.rpc_confirm_booking_payment(
  p_booking_id     BIGINT,
  p_payment_method TEXT DEFAULT 'QR_SEPAY'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_cust_id BIGINT := public.current_customer_id();
  v_booking public.bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE booking_id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Không tìm thấy đơn hàng #%.', p_booking_id;
  END IF;

  IF NOT public.is_admin() AND v_booking.customer_id IS DISTINCT FROM v_cust_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Bạn không có quyền thanh toán đơn hàng này.';
  END IF;

  IF v_booking.payment_status = 'paid' THEN
    RAISE EXCEPTION 'ALREADY_PAID: Đơn hàng đã được thanh toán trước đó.';
  END IF;

  UPDATE public.bookings
     SET payment_status = 'paid',
         updated_at     = now()
   WHERE booking_id = p_booking_id;

  INSERT INTO public.booking_status_history (
    booking_id, previous_status, new_status, changed_by, reason
  ) VALUES (
    p_booking_id,
    v_booking.status::TEXT,
    v_booking.status::TEXT,
    v_uid,
    format('Thanh toán thành công %s VND qua phương thức %s', v_booking.total_amount, p_payment_method)
  );

  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'payment_status', 'paid',
    'total_amount', v_booking.total_amount
  );
END;
$$;

-- =====================================================================
-- RPC 4: rpc_admin_adjust_payment_and_refund
-- Dành riêng cho Admin (Màn hình 3.6): Xử lý hoàn tiền (`refunded`),
-- điều chỉnh chi phí phát sinh, tổng tiền hoặc đổi thợ điều phối (`provider_id`).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.rpc_admin_adjust_payment_and_refund(
  p_booking_id       BIGINT,
  p_total_incidental DECIMAL(10,2),
  p_total_amount     DECIMAL(10,2),
  p_payment_status   public.payment_status,
  p_booking_status   public.booking_status,
  p_reason           TEXT,
  p_new_provider_id  BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_booking public.bookings%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: Chỉ Quản trị viên (Admin) mới có quyền thực thi nghiệp vụ này.';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'REASON_REQUIRED: Bắt buộc ghi rõ lý do hoàn tiền/điều chỉnh để lưu vết kiểm toán.';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE booking_id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Không tìm thấy đơn hàng #%.', p_booking_id;
  END IF;

  UPDATE public.bookings
     SET total_incidental = COALESCE(p_total_incidental, total_incidental),
         total_amount     = COALESCE(p_total_amount, total_amount),
         payment_status   = COALESCE(p_payment_status, payment_status),
         status           = COALESCE(p_booking_status, status),
         provider_id      = COALESCE(p_new_provider_id, provider_id),
         updated_at       = now()
   WHERE booking_id = p_booking_id;

  INSERT INTO public.booking_status_history (
    booking_id, previous_status, new_status, changed_by, reason
  ) VALUES (
    p_booking_id,
    v_booking.status::TEXT,
    COALESCE(p_booking_status, v_booking.status)::TEXT,
    v_uid,
    format('[ADMIN ADJUSTMENT] TT Thanh toán: %s -> %s | Tổng tiền: %s VND | Lý do: %s',
           v_booking.payment_status, p_payment_status, p_total_amount, p_reason)
  );

  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'status', COALESCE(p_booking_status, v_booking.status),
    'payment_status', COALESCE(p_payment_status, v_booking.payment_status),
    'total_amount', COALESCE(p_total_amount, v_booking.total_amount)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_transition_booking_status(BIGINT, public.booking_status, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_update_incidental_cost(BIGINT, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_booking_payment(BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_adjust_payment_and_refund(BIGINT, DECIMAL, DECIMAL, public.payment_status, public.booking_status, TEXT, BIGINT) TO authenticated;
