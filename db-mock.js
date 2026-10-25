// =====================================================================
// GIA ĐÌNH XANH - PRODUCTION DATABASE STORE & SEED (1-1 POSTGRESQL SCHEMA)
// Bám sát 100% 16 bảng, 7 ENUMs, 1 View & 4 RPCs trong:
//   - 4. home_service_booking_supabase.sql
//   - supabase_rpc_functions.sql
// Nội dung dữ liệu thực tế đúng phạm vi năng lực dự án Đặt lịch Dịch vụ Gia đình
// =====================================================================

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GDX_DB = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function createInitialStore() {
    // -------------------------------------------------------------------
    // 16. province ("provinceId" VARCHAR(2), name VARCHAR(150))
    // -------------------------------------------------------------------
    const province = [
      { provinceId: '79', name: 'Thành phố Hồ Chí Minh' },
      { provinceId: '01', name: 'Thành phố Hà Nội' }, // taste-skill-ignore: province code
      { provinceId: '48', name: 'Thành phố Đà Nẵng' },
    ];

    // -------------------------------------------------------------------
    // 15. ward (ward_id VARCHAR(8), name VARCHAR(150), "provinceId" VARCHAR(2))
    // -------------------------------------------------------------------
    const ward = [
      { ward_id: '27403', name: 'Phường Tân Phong, Quận 7', provinceId: '79' },
      { ward_id: '27406', name: 'Phường Tân Phú, Quận 7', provinceId: '79' },
      { ward_id: '26734', name: 'Phường Bến Nghé, Quận 1', provinceId: '79' },
      { ward_id: '27088', name: 'Phường Thảo Điền, TP. Thủ Đức', provinceId: '79' },
      { ward_id: '26890', name: 'Phường Võ Thị Sáu, Quận 3', provinceId: '79' },
      { ward_id: '26944', name: 'Phường 25, Quận Bình Thạnh', provinceId: '79' },
      { ward_id: '00112', name: 'Phường Dịch Vọng Hậu, Cầu Giấy', provinceId: '01' }, // taste-skill-ignore: province code
      { ward_id: '20203', name: 'Phường Hải Châu I, Hải Châu', provinceId: '48' },
    ];

    // -------------------------------------------------------------------
    // 1. users (user_id UUID, full_name, phone_number, role, is_active, created_at, updated_at)
    // -------------------------------------------------------------------
    const users = [
      {
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        full_name: 'Nguyễn Minh Thảo',
        phone_number: '0908341289',
        email: 'minhthao.q7@gmail.com',
        role: 'customer',
        is_active: true,
        created_at: '2026-08-12T08:15:00+07:00',
        updated_at: '2026-10-20T09:10:00+07:00',
      },
      {
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
        full_name: 'Trần Quốc Bảo',
        phone_number: '0912883401',
        email: 'quocbao.thuduc@gmail.com',
        role: 'customer',
        is_active: true,
        created_at: '2026-09-01T14:22:00+07:00',
        updated_at: '2026-10-18T11:05:00+07:00',
      },
      {
        user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b21',
        full_name: 'Đặng Thị Mai Lan',
        phone_number: '0938772190',
        email: 'mailan.ve-sinh@giadinhxanh.vn',
        role: 'provider',
        is_active: true,
        created_at: '2026-06-10T07:30:00+07:00',
        updated_at: '2026-10-23T08:00:00+07:00',
      },
      {
        user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
        full_name: 'Lê Hoàng Tuấn',
        phone_number: '0974115902',
        email: 'hoangtuan.kythuat@giadinhxanh.vn',
        role: 'provider',
        is_active: true,
        created_at: '2026-07-04T10:12:00+07:00',
        updated_at: '2026-10-23T07:45:00+07:00',
      },
      {
        user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b23',
        full_name: 'Phạm Thu Hà',
        phone_number: '0989440218',
        email: 'thuha.noitro@giadinhxanh.vn',
        role: 'provider',
        is_active: true,
        created_at: '2026-07-20T09:00:00+07:00',
        updated_at: '2026-10-22T18:30:00+07:00',
      },
      {
        user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b24',
        full_name: 'Võ Văn Khải',
        phone_number: '0903667124',
        email: 'vankhai.apply@gmail.com',
        role: 'provider',
        is_active: true,
        created_at: '2026-10-22T16:40:00+07:00',
        updated_at: '2026-10-22T16:40:00+07:00',
      },
      {
        user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b25',
        full_name: 'Ngô Minh Đức',
        phone_number: '0966509311',
        email: 'minhduc.rejected@gmail.com',
        role: 'provider',
        is_active: false,
        created_at: '2026-09-19T11:20:00+07:00',
        updated_at: '2026-10-15T15:00:00+07:00',
      },
      {
        user_id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c99',
        full_name: 'Nguyễn Quang Hào (Admin)',
        phone_number: '0901999888',
        email: 'admin@giadinhxanh.vn',
        role: 'admin',
        is_active: true,
        created_at: '2026-05-01T00:00:00+07:00',
        updated_at: '2026-10-23T08:00:00+07:00',
      },
    ];

    // -------------------------------------------------------------------
    // 2. customer_profiles (customer_id BIGINT, user_id UUID, default_address, ward_id, latitude, longitude)
    // -------------------------------------------------------------------
    const customer_profiles = [
      {
        customer_id: 101,
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        default_address: 'Số 14 Đường Nội Khu Cảnh Đồi, Phú Mỹ Hưng',
        ward_id: '27403',
        latitude: 10.728912,
        longitude: 106.712405,
        created_at: '2026-08-12T08:16:00+07:00',
        updated_at: '2026-10-20T09:10:00+07:00',
      },
      {
        customer_id: 102,
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
        default_address: 'Căn hộ T2-1804, Chung cư Thảo Điền, 159 Xa Lộ Hà Nội',
        ward_id: '27088',
        latitude: 10.802145,
        longitude: 106.742118,
        created_at: '2026-09-01T14:25:00+07:00',
        updated_at: '2026-10-18T11:05:00+07:00',
      },
    ];

    // -------------------------------------------------------------------
    // 3. provider_profiles (provider_id BIGINT, user_id UUID, info, id_card_number, avatar_url,
    //    verification_status, average_rating, total_reviews, lattitude, longtitude, is_available_online)
    //    *Chú ý chính tả cột trong SQL gốc: `lattitude`, `longtitude`
    // -------------------------------------------------------------------
    const provider_profiles = [
      {
        provider_id: 201,
        user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b21',
        info: '5 năm kinh nghiệm dọn dẹp nhà cửa theo giờ, ủi quần áo và sắp xếp tủ đồ gia đình tại khu vực Quận 7 và Quận 1.',
        id_card_number: '079188004512',
        avatar_url: 'assets/provider-lan.jpg',
        verification_status: 'verified',
        average_rating: 4.95,
        total_reviews: 42,
        lattitude: 10.73124,
        longtitude: 106.71589,
        is_available_online: true,
        created_at: '2026-06-10T07:35:00+07:00',
        updated_at: '2026-10-23T08:00:00+07:00',
      },
      {
        provider_id: 202,
        user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
        info: 'Thợ dọn dẹp chuyên sâu, tổng vệ sinh căn hộ và khử khuẩn không gian sống gia đình tại Quận 7 và TP. Thủ Đức.',
        id_card_number: '079092011834',
        avatar_url: 'assets/provider-tuan.jpg',
        verification_status: 'verified',
        average_rating: 4.85,
        total_reviews: 31,
        lattitude: 10.73541,
        longtitude: 106.72011,
        is_available_online: true,
        created_at: '2026-07-04T10:15:00+07:00',
        updated_at: '2026-10-23T07:45:00+07:00',
      },
      {
        provider_id: 203,
        user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b23',
        info: 'Nhận nấu ăn gia đình theo buổi, sơ chế thực phẩm và dọn dẹp gian bếp gọn gàng tại Quận 1, Quận 3, Quận 7.',
        id_card_number: '079191008291',
        avatar_url: 'assets/provider-ha.jpg',
        verification_status: 'verified',
        average_rating: 4.9,
        total_reviews: 27,
        lattitude: 10.78912,
        longtitude: 106.70145,
        is_available_online: true,
        created_at: '2026-07-20T09:10:00+07:00',
        updated_at: '2026-10-22T18:30:00+07:00',
      },
      {
        provider_id: 204,
        user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b24',
        info: 'Chuyên viên dọn dẹp nhà cửa và tổng vệ sinh căn hộ · 4 năm kinh nghiệm làm việc tại TP.HCM.',
        id_card_number: '079095023419',
        avatar_url: 'assets/provider-mai.jpg',
        verification_status: 'pending',
        average_rating: 0.0,
        total_reviews: 0,
        lattitude: 10.7512,
        longtitude: 106.7098,
        is_available_online: false,
        created_at: '2026-10-22T16:45:00+07:00',
        updated_at: '2026-10-22T16:45:00+07:00',
      },
      {
        provider_id: 205,
        user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b25',
        info: 'Nhận dọn nhà theo giờ khu vực Bình Thạnh, Quận 1.',
        id_card_number: '079097009182',
        avatar_url: 'assets/provider-tuan.jpg',
        verification_status: 'rejected',
        average_rating: 0.0,
        total_reviews: 0,
        lattitude: 10.8011,
        longtitude: 106.7112,
        is_available_online: false,
        created_at: '2026-09-19T11:25:00+07:00',
        updated_at: '2026-10-15T15:00:00+07:00',
      },
    ];

    // -------------------------------------------------------------------
    // 4. service_categories (category_id INT, parent_id INT, category_name, slug, description, icon_url, status)
    // Gia Đình Xanh chuyên biệt 2 dịch vụ cốt lõi: Home Cleaning & Nấu ăn tại nhà
    // -------------------------------------------------------------------
    const service_categories = [
      {
        category_id: 1,
        parent_id: null,
        category_name: 'Dọn dẹp nhà cửa (Home Cleaning)',
        slug: 'don-dep-nha-cua',
        description: 'Dọn dẹp phòng khách, phòng ngủ, khu vực bếp, nhà vệ sinh và tổng vệ sinh căn hộ chuyên sâu.',
        icon_url: 'home-clean',
        status: true,
      },
      {
        category_id: 2,
        parent_id: null,
        category_name: 'Nấu ăn tại nhà (Home Cooking)',
        slug: 'nau-an-tai-nha',
        description: 'Đầu bếp sơ chế thực phẩm sạch, nấu mâm cơm gia đình ấm cúng chuẩn vị và dọn sạch gian bếp.',
        icon_url: 'kitchen-utensils',
        status: true,
      },
    ];

    // -------------------------------------------------------------------
    // 5. services (service_id BIGINT, category_id INT, title, description, price, pricing_type, estimated_duration, is_active)
    // -------------------------------------------------------------------
    const services = [
      {
        service_id: 301,
        category_id: 1,
        title: 'Dọn dẹp nhà cửa theo giờ tiêu chuẩn',
        description: 'Lau dọn phòng khách, phòng ngủ, lau chùi bàn ghế, hút bụi sàn nhà, vệ sinh nhà tắm và thu gom rác sinh hoạt.',
        price: 85000,
        pricing_type: 'hourly',
        estimated_duration: 180,
        is_active: true,
        image_url: 'assets/cleaning-livingroom.jpg',
        created_at: '2026-06-01T00:00:00+07:00',
        updated_at: '2026-10-01T00:00:00+07:00',
      },
      {
        service_id: 302,
        category_id: 1,
        title: 'Tổng vệ sinh căn hộ chuyên sâu (Deep Cleaning)',
        description: 'Làm sạch sâu toàn diện từ trần đến sàn, khử khuẩn bề mặt, lau kính mặt trong và xử lý vết ố nhà bếp, phòng tắm.',
        price: 450000,
        pricing_type: 'fixed',
        estimated_duration: 240,
        is_active: true,
        image_url: 'assets/cleaning-deep.jpg',
        created_at: '2026-06-01T00:00:00+07:00',
        updated_at: '2026-10-01T00:00:00+07:00',
      },
      {
        service_id: 303,
        category_id: 2,
        title: 'Nấu bữa cơm gia đình theo buổi (3–4 món)',
        description: 'Sơ chế thực phẩm tươi sạch, nấu 3–4 món ăn nóng hổi theo khẩu vị gia đình (canh, món mặn, món xào) và dọn rửa sạch bếp.',
        price: 220000,
        pricing_type: 'fixed',
        estimated_duration: 120,
        is_active: true,
        image_url: 'assets/cooking-family-meal.jpg',
        created_at: '2026-06-01T00:00:00+07:00',
        updated_at: '2026-10-01T00:00:00+07:00',
      },
      {
        service_id: 304,
        category_id: 2,
        title: 'Đầu bếp gia đình theo giờ (Home Cooking & Tiệc nhỏ)',
        description: 'Lên thực đơn dinh dưỡng theo yêu cầu, nấu các món ăn chu đáo cho gia đình hoặc tiệc ấm cúng, trình bày đẹp mắt và vệ sinh bếp.',
        price: 110000,
        pricing_type: 'hourly',
        estimated_duration: 180,
        is_active: true,
        image_url: 'assets/cooking-chef-prep.jpg',
        created_at: '2026-06-01T00:00:00+07:00',
        updated_at: '2026-10-01T00:00:00+07:00',
      },
      {
        service_id: 305,
        category_id: 1,
        title: 'Giặt vệ sinh bộ ghế Sofa vải hoặc Nệm ngủ',
        description: 'Hút bụi bề mặt, chà vết bẩn bằng dung dịch giặt chuyên dụng và hút khô nước bẩn cho 1 bộ ghế sofa hoặc 1 tấm nệm.',
        price: 380000,
        pricing_type: 'fixed',
        estimated_duration: 120,
        is_active: false,
        image_url: 'assets/cleaning-detail.jpg',
        created_at: '2026-06-01T00:00:00+07:00',
        updated_at: '2026-10-01T00:00:00+07:00',
      },
      {
        service_id: 306,
        category_id: 2,
        title: 'Ủi quần áo & Sắp xếp tủ đồ theo giờ',
        description: 'Ủi phẳng quần áo công sở, trang phục gia đình và gấp xếp gọn gàng vào tủ theo phân loại của chủ nhà.',
        price: 90000,
        pricing_type: 'hourly',
        estimated_duration: 120,
        is_active: false,
        image_url: 'assets/home-kitchen-clean.jpg',
        created_at: '2026-06-01T00:00:00+07:00',
        updated_at: '2026-10-01T00:00:00+07:00',
      },
    ];

    // -------------------------------------------------------------------
    // 6. provider_services (id_pro_ser BIGINT, provider_id BIGINT, service_id BIGINT)
    // -------------------------------------------------------------------
    const provider_services = [
      { id_pro_ser: 1, provider_id: 201, service_id: 301 },
      { id_pro_ser: 2, provider_id: 201, service_id: 302 },
      { id_pro_ser: 3, provider_id: 202, service_id: 301 },
      { id_pro_ser: 4, provider_id: 202, service_id: 302 },
      { id_pro_ser: 5, provider_id: 203, service_id: 303 },
      { id_pro_ser: 6, provider_id: 203, service_id: 304 },
      { id_pro_ser: 7, provider_id: 204, service_id: 301 },
    ];

    // -------------------------------------------------------------------
    // 7. provider_areas (area_id BIGINT, provider_id BIGINT, ward_id VARCHAR(8))
    // -------------------------------------------------------------------
    const provider_areas = [
      { area_id: 1, provider_id: 201, ward_id: '27403' },
      { area_id: 2, provider_id: 201, ward_id: '27406' },
      { area_id: 3, provider_id: 201, ward_id: '26734' },
      { area_id: 4, provider_id: 202, ward_id: '27403' },
      { area_id: 5, provider_id: 202, ward_id: '27406' },
      { area_id: 6, provider_id: 202, ward_id: '27088' },
      { area_id: 7, provider_id: 203, ward_id: '27403' },
      { area_id: 8, provider_id: 203, ward_id: '26734' },
      { area_id: 9, provider_id: 203, ward_id: '26890' },
      { area_id: 10, provider_id: 204, ward_id: '26944' },
    ];

    // -------------------------------------------------------------------
    // 8. availability_schedules (id BIGINT, provider_id BIGINT, day_of_week SMALLINT 0..6, start_time, end_time)
    // -------------------------------------------------------------------
    const availability_schedules = [
      { id: 1, provider_id: 201, day_of_week: 1, start_time: '07:30', end_time: '18:00', updated_at: '2026-10-01T08:00:00+07:00' },
      { id: 2, provider_id: 201, day_of_week: 2, start_time: '07:30', end_time: '18:00', updated_at: '2026-10-01T08:00:00+07:00' },
      { id: 3, provider_id: 201, day_of_week: 3, start_time: '07:30', end_time: '18:00', updated_at: '2026-10-01T08:00:00+07:00' },
      { id: 4, provider_id: 201, day_of_week: 4, start_time: '07:30', end_time: '18:00', updated_at: '2026-10-01T08:00:00+07:00' },
      { id: 5, provider_id: 201, day_of_week: 5, start_time: '07:30', end_time: '18:00', updated_at: '2026-10-01T08:00:00+07:00' },
      { id: 6, provider_id: 201, day_of_week: 6, start_time: '08:00', end_time: '16:00', updated_at: '2026-10-01T08:00:00+07:00' },
      { id: 7, provider_id: 202, day_of_week: 1, start_time: '08:00', end_time: '19:00', updated_at: '2026-10-01T08:00:00+07:00' },
      { id: 8, provider_id: 202, day_of_week: 3, start_time: '08:00', end_time: '19:00', updated_at: '2026-10-01T08:00:00+07:00' },
      { id: 9, provider_id: 202, day_of_week: 5, start_time: '08:00', end_time: '19:00', updated_at: '2026-10-01T08:00:00+07:00' },
      { id: 10, provider_id: 202, day_of_week: 6, start_time: '08:00', end_time: '19:00', updated_at: '2026-10-01T08:00:00+07:00' },
      { id: 11, provider_id: 203, day_of_week: 2, start_time: '08:00', end_time: '20:00', updated_at: '2026-10-01T08:00:00+07:00' },
      { id: 12, provider_id: 203, day_of_week: 4, start_time: '08:00', end_time: '20:00', updated_at: '2026-10-01T08:00:00+07:00' },
      { id: 13, provider_id: 203, day_of_week: 0, start_time: '08:00', end_time: '17:00', updated_at: '2026-10-01T08:00:00+07:00' },
    ];

    // -------------------------------------------------------------------
    // 9. availability_exceptions (id BIGINT, provider_id BIGINT, exception_date DATE, start_time, end_time, reason)
    // -------------------------------------------------------------------
    const availability_exceptions = [
      {
        id: 1,
        provider_id: 201,
        exception_date: '2026-10-27',
        start_time: '13:00',
        end_time: '17:30',
        reason: 'Bận việc gia đình buổi chiều, tạm ngưng nhận lịch Quận 7',
        created_at: '2026-10-19T10:00:00+07:00',
      },
      {
        id: 2,
        provider_id: 202,
        exception_date: '2026-10-29',
        start_time: '08:00',
        end_time: '12:00',
        reason: 'Bảo dưỡng máy bơm xịt rửa máy lạnh và máy hút giặt sofa',
        created_at: '2026-10-20T15:30:00+07:00',
      },
    ];

    // -------------------------------------------------------------------
    // 10. bookings (booking_id BIGINT, customer_id, provider_id, service_id, scheduled_time,
    //     address, ward_id, latitude, longitude, total_incidental, total_amount, status, payment_status, notes)
    // -------------------------------------------------------------------
    const bookings = [
      {
        booking_id: 1042,
        customer_id: 101,
        provider_id: 201,
        service_id: 301,
        scheduled_time: '2026-10-23T14:00:00+07:00',
        address: 'Số 14 Đường Nội Khu Cảnh Đồi, Phú Mỹ Hưng',
        ward_id: '27403',
        latitude: 10.728912,
        longitude: 106.712405,
        total_incidental: 35000,
        total_amount: 290000, // 3h * 85k = 255k + 35k phụ phí mua thêm túi rác & nước lau kính
        status: 'in_progress',
        payment_status: 'unpaid',
        notes: 'Lau dọn kỹ khu vực phòng khách và gian bếp tầng trệt.\n[Phát sinh: 35.000 đ] Mua bổ sung cuộn túi rác phân loại và chai nước lau kính theo yêu cầu chủ nhà.',
        created_at: '2026-10-22T19:15:00+07:00',
        updated_at: '2026-10-23T14:35:00+07:00',
      },
      {
        booking_id: 1043,
        customer_id: 101,
        provider_id: 201,
        service_id: 302,
        scheduled_time: '2026-10-24T09:00:00+07:00',
        address: 'Số 14 Đường Nội Khu Cảnh Đồi, Phú Mỹ Hưng',
        ward_id: '27403',
        latitude: 10.728912,
        longitude: 106.712405,
        total_incidental: 0,
        total_amount: 450000,
        status: 'pending',
        payment_status: 'unpaid',
        notes: 'Tổng vệ sinh tầng 2, chú ý lau sạch bụi kệ sách và cửa sổ ban công.',
        created_at: '2026-10-23T10:12:00+07:00',
        updated_at: '2026-10-23T10:12:00+07:00',
      },
      {
        booking_id: 1044,
        customer_id: 102,
        provider_id: 202,
        service_id: 304,
        scheduled_time: '2026-10-24T13:30:00+07:00',
        address: 'Căn hộ T2-1804, Chung cư Thảo Điền, 159 Xa Lộ Hà Nội',
        ward_id: '27088',
        latitude: 10.802145,
        longitude: 106.742118,
        total_incidental: 0,
        total_amount: 300000, // 2h * 150k
        status: 'pending',
        payment_status: 'unpaid',
        notes: 'Nấu bữa trưa cuối tuần cho gia đình 4 người, đăng ký thẻ ra vào sảnh T2.',
        created_at: '2026-10-23T11:05:00+07:00',
        updated_at: '2026-10-23T11:05:00+07:00',
      },
      {
        booking_id: 1039,
        customer_id: 101,
        provider_id: 203,
        service_id: 303,
        scheduled_time: '2026-10-20T16:00:00+07:00',
        address: 'Số 14 Đường Nội Khu Cảnh Đồi, Phú Mỹ Hưng',
        ward_id: '27403',
        latitude: 10.728912,
        longitude: 106.712405,
        total_incidental: 120000,
        total_amount: 340000, // 220k + 120k tiền mua hộ rau củ & gia vị
        status: 'completed',
        payment_status: 'paid',
        notes: 'Nấu bữa tối 4 món gia đình, nhờ mua thêm rau cải và hành ngò tại cửa hàng tiện lợi.',
        created_at: '2026-10-19T20:00:00+07:00',
        updated_at: '2026-10-20T18:45:00+07:00',
      },
      {
        booking_id: 1040,
        customer_id: 101,
        provider_id: 201,
        service_id: 301,
        scheduled_time: '2026-10-21T08:00:00+07:00',
        address: 'Số 14 Đường Nội Khu Cảnh Đồi, Phú Mỹ Hưng',
        ward_id: '27403',
        latitude: 10.728912,
        longitude: 106.712405,
        total_incidental: 0,
        total_amount: 255000, // 3h * 85k
        status: 'completed',
        payment_status: 'paid',
        notes: 'Ca sáng 3 giờ dọn dẹp định kỳ phòng khách và bếp.',
        created_at: '2026-10-20T09:30:00+07:00',
        updated_at: '2026-10-21T12:10:00+07:00',
      },
      {
        booking_id: 1041,
        customer_id: 102,
        provider_id: 202,
        service_id: 305,
        scheduled_time: '2026-10-22T09:00:00+07:00',
        address: 'Căn hộ T2-1804, Chung cư Thảo Điền, 159 Xa Lộ Hà Nội',
        ward_id: '27088',
        latitude: 10.802145,
        longitude: 106.742118,
        total_incidental: 0,
        total_amount: 380000,
        status: 'cancelled',
        payment_status: 'refunded',
        notes: 'Giặt bộ ghế sofa vải chữ L phòng khách.',
        created_at: '2026-10-21T14:00:00+07:00',
        updated_at: '2026-10-22T07:30:00+07:00',
      },
      {
        booking_id: 1038,
        customer_id: 102,
        provider_id: 202,
        service_id: 304,
        scheduled_time: '2026-10-18T14:00:00+07:00',
        address: 'Căn hộ T2-1804, Chung cư Thảo Điền, 159 Xa Lộ Hà Nội',
        ward_id: '27088',
        latitude: 10.802145,
        longitude: 106.742118,
        total_incidental: 0,
        total_amount: 300000,
        status: 'completed',
        payment_status: 'paid',
        notes: 'Nấu tiệc nhỏ ấm cúng sinh nhật bé, thực đơn 4 món dinh dưỡng.',
        created_at: '2026-10-17T09:00:00+07:00',
        updated_at: '2026-10-18T16:10:00+07:00',
      },
      {
        booking_id: 1037,
        customer_id: 101,
        provider_id: 201,
        service_id: 302,
        scheduled_time: '2026-10-15T08:30:00+07:00',
        address: 'Số 14 Đường Nội Khu Cảnh Đồi, Phú Mỹ Hưng',
        ward_id: '27403',
        latitude: 10.728912,
        longitude: 106.712405,
        total_incidental: 0,
        total_amount: 450000,
        status: 'completed',
        payment_status: 'paid',
        notes: 'Tổng vệ sinh căn hộ định kỳ cuối tuần.',
        created_at: '2026-10-14T11:20:00+07:00',
        updated_at: '2026-10-15T12:00:00+07:00',
      },
      {
        booking_id: 1036,
        customer_id: 101,
        provider_id: 204,
        service_id: 301,
        scheduled_time: '2026-10-10T09:00:00+07:00',
        address: 'Số 14 Đường Nội Khu Cảnh Đồi, Phú Mỹ Hưng',
        ward_id: '27403',
        latitude: 10.728912,
        longitude: 106.712405,
        total_incidental: 0,
        total_amount: 180000,
        status: 'auto_cancelled',
        payment_status: 'unpaid',
        notes: 'Đơn yêu cầu hỗ trợ dọn dẹp nhà (Hệ thống tự động hủy sau 24h không có thợ nhận).',
        created_at: '2026-10-09T08:00:00+07:00',
        updated_at: '2026-10-10T08:00:00+07:00',
      },
    ];

    // -------------------------------------------------------------------
    // 11. booking_status_history (history_id BIGINT, booking_id, previous_status, new_status, changed_by UUID, reason, created_at)
    // -------------------------------------------------------------------
    const booking_status_history = [
      {
        history_id: 5001,
        booking_id: 1042,
        previous_status: null,
        new_status: 'pending',
        changed_by: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        reason: 'Khách hàng tạo đơn đặt lịch mới qua Booking Wizard',
        created_at: '2026-10-22T19:15:00+07:00',
      },
      {
        history_id: 5002,
        booking_id: 1042,
        previous_status: 'pending',
        new_status: 'confirmed',
        changed_by: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b21',
        reason: 'Thợ Đặng Thị Mai Lan đã xác nhận nhận ca làm việc',
        created_at: '2026-10-22T19:42:00+07:00',
      },
      {
        history_id: 5003,
        booking_id: 1042,
        previous_status: 'confirmed',
        new_status: 'in_progress',
        changed_by: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b21',
        reason: 'Thợ đã đến địa chỉ của khách hàng và bắt đầu thực hiện công việc',
        created_at: '2026-10-23T14:00:00+07:00',
      },
      {
        history_id: 5004,
        booking_id: 1042,
        previous_status: 'in_progress',
        new_status: 'in_progress',
        changed_by: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b21',
        reason: 'Cập nhật chi phí phát sinh: 35.000 đ -> Tổng mới: 290.000 đ. Lý do: Mua bổ sung túi rác và nước lau kính theo yêu cầu chủ nhà',
        created_at: '2026-10-23T14:35:00+07:00',
      },
      {
        history_id: 5005,
        booking_id: 1041,
        previous_status: 'confirmed',
        new_status: 'cancelled',
        changed_by: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
        reason: 'Tòa nhà chung cư tạm ngưng cấp nước bảo trì đường ống sáng ngày 22/10',
        created_at: '2026-10-22T07:15:00+07:00',
      },
      {
        history_id: 5006,
        booking_id: 1041,
        previous_status: 'cancelled',
        new_status: 'cancelled',
        changed_by: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c99',
        reason: '[ADMIN ADJUSTMENT] TT Thanh toán: paid -> refunded | Tổng tiền: 380.000 đ | Lý do: Cập nhật trạng thái hoàn tiền do lịch hẹn hủy trước giờ làm',
        created_at: '2026-10-22T07:30:00+07:00',
      },
      {
        history_id: 5007,
        booking_id: 1036,
        previous_status: 'pending',
        new_status: 'auto_cancelled',
        changed_by: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c99',
        reason: 'Hệ thống tự động hủy đơn sau 24 giờ không có đối tác nhận việc',
        created_at: '2026-10-10T08:00:00+07:00',
      },
    ];

    // -------------------------------------------------------------------
    // 12. reviews (review_id BIGINT, booking_id UNIQUE, customer_id, provider_id, rating 1..5, comment, status, moderation_reason, created_at, updated_at)
    // -------------------------------------------------------------------
    const reviews = [
      {
        review_id: 801,
        booking_id: 1039,
        customer_id: 101,
        provider_id: 203,
        rating: 5,
        comment: 'Chị Thu Hà đến đúng giờ, sơ chế sạch sẽ và nấu các món gia đình vừa miệng. Khu vực bếp được lau dọn gọn gàng sau khi nấu xong.',
        status: 'published',
        moderation_reason: null,
        created_at: '2026-10-20T20:10:00+07:00',
        updated_at: '2026-10-20T20:10:00+07:00',
      },
      {
        review_id: 802,
        booking_id: 1037,
        customer_id: 101,
        provider_id: 201,
        rating: 5,
        comment: 'Chị Mai Lan làm việc rất tỉ mỉ, lau sạch toàn bộ kệ sách, ban công và sắp xếp lại đồ đạc phòng khách rất ngăn nắp.',
        status: 'published',
        moderation_reason: null,
        created_at: '2026-10-15T14:20:00+07:00',
        updated_at: '2026-10-15T14:20:00+07:00',
      },
      {
        review_id: 803,
        booking_id: 1038,
        customer_id: 102,
        provider_id: 202,
        rating: 5,
        comment: 'Anh Hoàng Tuấn mang đầy đủ bạt che nước và máy xịt áp lực, vệ sinh 2 máy lạnh rất kỹ, không làm bắn nước ra sàn gỗ.',
        status: 'published',
        moderation_reason: null,
        created_at: '2026-10-18T17:30:00+07:00',
        updated_at: '2026-10-18T17:30:00+07:00',
      },
    ];

    // -------------------------------------------------------------------
    // 13. favorites (favorite_id BIGINT, customer_id, service_id, provider_id, created_at)
    // -------------------------------------------------------------------
    const favorites = [
      { favorite_id: 901, customer_id: 101, service_id: 301, provider_id: null, created_at: '2026-09-10T10:00:00+07:00' },
      { favorite_id: 902, customer_id: 101, service_id: 302, provider_id: null, created_at: '2026-09-14T16:20:00+07:00' },
      { favorite_id: 903, customer_id: 101, service_id: 303, provider_id: null, created_at: '2026-10-02T09:15:00+07:00' },
      { favorite_id: 904, customer_id: 101, service_id: null, provider_id: 201, created_at: '2026-10-21T08:00:00+07:00' },
    ];

    // -------------------------------------------------------------------
    // 14. support_tickets (ticket_id BIGINT, user_id UUID, booking_id BIGINT, subject VARCHAR(200), status, priority)
    // -------------------------------------------------------------------
    const support_tickets = [
      {
        ticket_id: 701,
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        booking_id: 1042,
        subject: 'Nhờ kiểm tra lại khoản phụ phí mua vật tư phát sinh trong đơn #1042',
        status: 'open',
        priority: 'medium',
        created_at: '2026-10-23T14:40:00+07:00',
        updated_at: '2026-10-23T14:40:00+07:00',
      },
      {
        ticket_id: 702,
        user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
        booking_id: 1041,
        subject: 'Khách báo hủy lịch sát giờ hẹn do tòa nhà cúp nước, nhờ Admin ghi nhận lý do hủy ca',
        status: 'in_progress',
        priority: 'high',
        created_at: '2026-10-22T07:20:00+07:00',
        updated_at: '2026-10-22T08:05:00+07:00',
      },
      {
        ticket_id: 703,
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
        booking_id: 1041,
        subject: 'Đề nghị cập nhật trạng thái hoàn tiền cho đơn đặt lịch #1041 đã hủy',
        status: 'resolved',
        priority: 'urgent',
        created_at: '2026-10-22T07:18:00+07:00',
        updated_at: '2026-10-22T07:35:00+07:00',
      },
    ];

    // -------------------------------------------------------------------
    // 17. customer_addresses (address_id, customer_id, label, recipient_name, phone, street_address, ward_id, is_default)
    // -------------------------------------------------------------------
    const customer_addresses = [
      {
        address_id: 'd101-addr-1',
        customer_id: 101,
        label: 'Nhà riêng',
        recipient_name: 'Nguyễn Minh Thảo',
        phone: '0908341289',
        street_address: 'Số 14 Đường Nội Khu Cảnh Đồi, Phú Mỹ Hưng',
        ward_id: '27403',
        latitude: 10.728912,
        longitude: 106.712405,
        is_default: true,
        created_at: '2026-08-12T08:16:00+07:00',
        updated_at: '2026-10-20T09:10:00+07:00',
      },
      {
        address_id: 'd101-addr-2',
        customer_id: 101,
        label: 'Văn phòng',
        recipient_name: 'Nguyễn Minh Thảo',
        phone: '0908341289',
        street_address: 'Tòa nhà Saigon Centre, 65 Lê Lợi, Bến Nghé, Quận 1',
        ward_id: '26734',
        latitude: 10.773821,
        longitude: 106.700412,
        is_default: false,
        created_at: '2026-09-01T10:00:00+07:00',
        updated_at: '2026-09-01T10:00:00+07:00',
      },
      {
        address_id: 'd102-addr-1',
        customer_id: 102,
        label: 'Căn hộ chung cư',
        recipient_name: 'Trần Quốc Bảo',
        phone: '0912883401',
        street_address: 'Căn hộ T2-1804, Chung cư Thảo Điền, 159 Xa Lộ Hà Nội',
        ward_id: '27088',
        latitude: 10.802145,
        longitude: 106.742118,
        is_default: true,
        created_at: '2026-09-01T14:25:00+07:00',
        updated_at: '2026-10-18T11:05:00+07:00',
      },
    ];

    // -------------------------------------------------------------------
    // 18. ticket_messages (message_id, ticket_id, sender_id, message_body, visibility, created_at)
    // -------------------------------------------------------------------
    const ticket_messages = [
      {
        message_id: 7001,
        ticket_id: 701,
        sender_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        message_body: 'Chào ban quản trị, hóa đơn đơn #1042 thợ có kê khai phụ phí 50.000đ nhưng tôi thấy trong ứng dụng tính tổng 230.000đ, nhờ kiểm tra giúp tôi hóa đơn mua vật tư.',
        visibility: 'public',
        created_at: '2026-10-23T14:40:00+07:00',
      },
      {
        message_id: 7002,
        ticket_id: 701,
        sender_id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c99',
        message_body: 'Ghi chú kiểm tra nội bộ: Đã đối soát phiếu thu vật tư van khóa của thợ Lê Hoàng Tuấn, phụ phí hợp lệ.',
        visibility: 'internal',
        created_at: '2026-10-23T15:00:00+07:00',
      },
      {
        message_id: 7003,
        ticket_id: 701,
        sender_id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c99',
        message_body: 'Dạ chào anh Thảo, Ban quản trị đã đối soát hóa đơn vật tư thay van khóa ống nước của đối tác kỹ thuật, chi phí 50.000đ hoàn toàn chính xác theo giá niêm yết.',
        visibility: 'public',
        created_at: '2026-10-23T15:15:00+07:00',
      },
    ];

    // -------------------------------------------------------------------
    // 19. notifications (notification_id, user_id, type, title, body, related_entity_type, related_entity_id, is_read, created_at)
    // -------------------------------------------------------------------
    const notifications = [
      {
        notification_id: 9001,
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        type: 'booking_accepted',
        title: 'Đối tác đã nhận việc',
        body: 'Đơn đặt lịch #1043 vệ sinh máy lạnh đã được đối tác Lê Hoàng Tuấn tiếp nhận.',
        related_entity_type: 'booking',
        related_entity_id: 1043,
        is_read: false,
        created_at: '2026-10-23T08:15:00+07:00',
      },
      {
        notification_id: 9002,
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        type: 'payment_success',
        title: 'Thanh toán thành công',
        body: 'Đơn đặt lịch #1039 đã được xác nhận thanh toán qua VietQR.',
        related_entity_type: 'booking',
        related_entity_id: 1039,
        is_read: true,
        created_at: '2026-10-20T20:05:00+07:00',
      },
      {
        notification_id: 9003,
        user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b21',
        type: 'booking_request',
        title: 'Có yêu cầu đặt lịch mới',
        body: 'Khách hàng vừa đặt lịch dịch vụ Tổng vệ sinh căn hộ tại Phường Tân Phong, Quận 7.',
        related_entity_type: 'booking',
        related_entity_id: 1040,
        is_read: true,
        created_at: '2026-10-23T07:45:00+07:00',
      },
    ];

    // -------------------------------------------------------------------
    // 20. audit_logs (audit_id, actor_id, action, entity_type, entity_id, reason, metadata, created_at)
    // -------------------------------------------------------------------
    const audit_logs = [
      {
        audit_id: 8001,
        actor_id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c99',
        action: 'APPROVE_KYC',
        entity_type: 'provider_profiles',
        entity_id: '201',
        reason: 'Hồ sơ CCCD đối tác Đặng Thị Mai Lan hợp lệ, đã xác minh thực địa',
        metadata: { verification_status: 'verified' },
        created_at: '2026-06-12T09:00:00+07:00',
      },
      {
        audit_id: 8002,
        actor_id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c99',
        action: 'SUSPEND_USER',
        entity_type: 'users',
        entity_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b25',
        reason: 'Tạm ngưng tài khoản thợ Ngô Minh Đức do hồ sơ CCCD mờ và không đạt bài kiểm tra chuyên môn',
        metadata: { is_active: false },
        created_at: '2026-10-15T15:00:00+07:00',
      },
      {
        audit_id: 8003,
        actor_id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c99',
        action: 'ADJUST_BOOKING',
        entity_type: 'bookings',
        entity_id: '1041',
        reason: 'Admin điều phối duyệt hoàn tiền đơn hàng do khách báo hủy sát giờ vì sự cố bất khả kháng',
        metadata: { payment_status: 'refunded', status: 'cancelled' },
        created_at: '2026-10-22T07:30:00+07:00',
      },
    ];

    // -------------------------------------------------------------------
    // 21. ai_conversations & ai_messages (Lịch sử hội thoại Chatbot AI)
    // -------------------------------------------------------------------
    const ai_conversations = [
      {
        conversation_id: 'a100-conv-001',
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        title: 'Tư vấn dịch vụ dọn nhà đón Tết',
        created_at: '2026-10-22T09:00:00+07:00',
        updated_at: '2026-10-22T09:05:00+07:00',
      },
    ];

    const ai_messages = [
      {
        message_id: 9501,
        conversation_id: 'a100-conv-001',
        role: 'user',
        content: 'Nhà mình 3 phòng ngủ ở Quận 7, cần tổng vệ sinh sâu cuối tuần này thì nên đặt dịch vụ nào?',
        created_at: '2026-10-22T09:00:00+07:00',
      },
      {
        message_id: 9502,
        conversation_id: 'a100-conv-001',
        role: 'assistant',
        content: 'Chào bạn! Với căn hộ 3 phòng ngủ tại Quận 7, Gia Đình Xanh đề xuất bạn chọn dịch vụ "Tổng vệ sinh căn hộ chuyên sâu (Deep Clean)" thời lượng khoảng 4 giờ với mức giá 360.000đ. Đội ngũ đối tác có chị Mai Lan (4.9 sao) đang hoạt động tại Phường Tân Phong rất phù hợp với nhu cầu của bạn.',
        created_at: '2026-10-22T09:01:00+07:00',
      },
    ];

    // -------------------------------------------------------------------
    // VIEW: provider_public_profiles (ẩn id_card_number, chỉ lấy verification_status = 'verified' & u.is_active = TRUE)
    // -------------------------------------------------------------------
    function getProviderPublicProfiles() {
      return store.provider_profiles
        .filter((p) => {
          const u = store.users.find((usr) => usr.user_id === p.user_id);
          return p.verification_status === 'verified' && u && u.is_active;
        })
        .map((p) => {
          const u = store.users.find((usr) => usr.user_id === p.user_id);
          return {
            provider_id: p.provider_id,
            full_name: u.full_name,
            info: p.info,
            avatar_url: p.avatar_url,
            average_rating: p.average_rating,
            total_reviews: p.total_reviews,
            is_available_online: p.is_available_online,
            lattitude: p.lattitude,
            longtitude: p.longtitude,
          };
        });
    }

    // Trigger simulation: trg_reviews_refresh_rating
    function refreshProviderRating(providerId) {
      const provReviews = store.reviews.filter((r) => r.provider_id === Number(providerId));
      const prov = store.provider_profiles.find((p) => p.provider_id === Number(providerId));
      if (!prov) return;
      prov.total_reviews = provReviews.length;
      if (provReviews.length === 0) {
        prov.average_rating = 0.0;
      } else {
        const avg = provReviews.reduce((acc, r) => acc + Number(r.rating), 0) / provReviews.length;
        prov.average_rating = Number(avg.toFixed(2));
      }
    }

    const session = {
      customer_user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      customer_id: 101,
      provider_user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b21',
      provider_id: 201,
      admin_user_id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c99'
    };

    const store = {
      session,
      province,
      ward,
      provinces: province,
      wards: ward,
      users,
      customer_profiles,
      provider_profiles,
      service_categories: service_categories.map((c) => ({ ...c, name: c.category_name })),
      services,
      provider_services,
      provider_areas,
      availability_schedules,
      availability_exceptions,
      bookings,
      booking_status_history,
      reviews,
      favorites,
      support_tickets,
      customer_addresses,
      ticket_messages,
      notifications,
      audit_logs,
      ai_conversations,
      ai_messages,
      getProviderPublicProfiles,
      get provider_public_profiles() {
        return getProviderPublicProfiles();
      },
      set provider_public_profiles(_val) {
        // computed from provider_profiles
      },
      refreshProviderRating,
      createInitialStore,
      createInitialDatabase: createInitialStore,
    };

    return store;
  }

  return createInitialStore();
});
