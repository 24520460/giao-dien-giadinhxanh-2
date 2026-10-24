// =====================================================================
// GIA ĐÌNH XANH - PRODUCTION DATABASE STORE (1-1 POSTGRESQL SCHEMA)
// Bám sát 100% 16 bảng, 7 ENUMs, 1 View & 4 RPCs trong:
//   - 4. home_service_booking_supabase.sql
//   - supabase_rpc_functions.sql
// =====================================================================

window.GDX_DB = (() => {
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
      email: 'mailan.dieuduong@giadinhxanh.vn',
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
      default_address: 'Biệt thự B14, Khu Cảnh Đồi, Phú Mỹ Hưng',
      ward_id: '27403',
      latitude: 10.728912,
      longitude: 106.712405,
      created_at: '2026-08-12T08:16:00+07:00',
      updated_at: '2026-10-20T09:10:00+07:00',
    },
    {
      customer_id: 102,
      user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
      default_address: 'Căn hộ T2-1804, Masteri Thảo Điền, 159 Xa Lộ Hà Nội',
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
      info: 'Cử nhân Điều dưỡng ĐH Y Dược TP.HCM · 7 năm kinh nghiệm chăm sóc người cao tuổi sau tai biến, theo dõi sinh hiệu và phục hồi chức năng tại nhà.',
      id_card_number: '079188004512',
      avatar_url: 'assets/provider-lan.jpg',
      verification_status: 'verified',
      average_rating: 4.95,
      total_reviews: 42,
      lattitude: 10.731240,
      longtitude: 106.715890,
      is_available_online: true,
      created_at: '2026-06-10T07:35:00+07:00',
      updated_at: '2026-10-23T08:00:00+07:00',
    },
    {
      provider_id: 202,
      user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
      info: 'Chuyên viên Tổng vệ sinh công nghiệp & Khử khuẩn hơi nước nóng · 5 năm vận hành máy Karcher Đức, tỉ mỉ từng khe cửa và rèm vải.',
      id_card_number: '079092011834',
      avatar_url: 'assets/provider-tuan.jpg',
      verification_status: 'verified',
      average_rating: 4.85,
      total_reviews: 31,
      lattitude: 10.735410,
      longtitude: 106.720110,
      is_available_online: true,
      created_at: '2026-07-04T10:15:00+07:00',
      updated_at: '2026-10-23T07:45:00+07:00',
    },
    {
      provider_id: 203,
      user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b23',
      info: 'Đầu bếp gia đình & Chuyên gia dinh dưỡng thực dưỡng · Chuyên lên thực đơn giảm muối/đường cho người lớn tuổi và trẻ nhỏ.',
      id_card_number: '079191008291',
      avatar_url: 'assets/provider-ha.jpg',
      verification_status: 'verified',
      average_rating: 4.90,
      total_reviews: 27,
      lattitude: 10.789120,
      longtitude: 106.701450,
      is_available_online: true,
      created_at: '2026-07-20T09:10:00+07:00',
      updated_at: '2026-10-22T18:30:00+07:00',
    },
    {
      provider_id: 204,
      user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b24',
      info: 'Kỹ thuật viên bảo dưỡng điện lạnh & lọc nước RO gia đình · 4 năm kinh nghiệm tại Điện Máy Xanh.',
      id_card_number: '079095023419',
      avatar_url: 'assets/provider-mai.jpg',
      verification_status: 'pending',
      average_rating: 0.00,
      total_reviews: 0,
      lattitude: 10.751200,
      longtitude: 106.709800,
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
      average_rating: 0.00,
      total_reviews: 0,
      lattitude: 10.801100,
      longtitude: 106.711200,
      is_available_online: false,
      created_at: '2026-09-19T11:25:00+07:00',
      updated_at: '2026-10-15T15:00:00+07:00',
    },
  ];

  // -------------------------------------------------------------------
  // 4. service_categories (category_id INT, parent_id INT, category_name, slug, description, icon_url, status)
  // -------------------------------------------------------------------
  const service_categories = [
    {
      category_id: 1,
      parent_id: null,
      category_name: 'Chăm sóc Y tế & Người thân',
      slug: 'cham-soc-y-te-nguoi-than',
      description: 'Điều dưỡng viên có chứng chỉ hành nghề chăm sóc người cao tuổi, người bệnh và mẹ & bé tại nhà.',
      icon_url: 'heart-pulse',
      status: true,
    },
    {
      category_id: 2,
      parent_id: null,
      category_name: 'Chăm sóc Tổ ấm & Nội trợ',
      slug: 'cham-soc-to-am-noi-tro',
      description: 'Dọn dẹp tiêu chuẩn khách sạn, khử khuẩn hơi nước nóng, giặt ủi cao cấp và nấu ăn dinh dưỡng.',
      icon_url: 'home-sparkle',
      status: true,
    },
    {
      category_id: 3,
      parent_id: 1,
      category_name: 'Điều dưỡng Người cao tuổi',
      slug: 'dieu-duong-nguoi-cao-tuoi',
      description: 'Theo dõi huyết áp, đường huyết, hỗ trợ vận động và bầu bạn tâm lý tại gia.',
      icon_url: 'user-check',
      status: true,
    },
    {
      category_id: 4,
      parent_id: 1,
      category_name: 'Chăm sóc Mẹ & Bé sau sinh',
      slug: 'cham-soc-me-va-be',
      description: 'Tắm bé chuẩn y khoa, massage thông tắc tia sữa và chăm sóc giấc ngủ.',
      icon_url: 'baby',
      status: true,
    },
    {
      category_id: 5,
      parent_id: 2,
      category_name: 'Vệ sinh & Khử khuẩn chuyên sâu',
      slug: 've-sinh-khu-khuan-chuyen-sau',
      description: 'Làm sạch toàn diện căn hộ, biệt thự với hóa chất hữu cơ an toàn cho trẻ nhỏ.',
      icon_url: 'sparkles',
      status: true,
    },
    {
      category_id: 6,
      parent_id: 2,
      category_name: 'Đi chợ & Bếp gia đình',
      slug: 'di-cho-bep-gia-dinh',
      description: 'Tuyển chọn nguyên liệu tươi sống, sơ chế và nấu mâm cơm gia đình ấm cúng.',
      icon_url: 'utensils',
      status: true,
    },
  ];

  // -------------------------------------------------------------------
  // 5. services (service_id BIGINT, category_id INT, title, description, price, pricing_type, estimated_duration, is_active)
  // -------------------------------------------------------------------
  const services = [
    {
      service_id: 301,
      category_id: 3,
      title: 'Điều dưỡng chăm sóc người cao tuổi tại gia',
      description: 'Theo dõi chỉ số sinh tồn (huyết áp, SpO2, đường huyết), hỗ trợ tắm gội, tập vật lý trị liệu nhẹ và nhắc lịch uống thuốc theo toa bác sĩ.',
      price: 140000,
      pricing_type: 'hourly',
      estimated_duration: 240,
      is_active: true,
      image_url: 'assets/service-elderly.jpg',
      created_at: '2026-06-01T00:00:00+07:00',
      updated_at: '2026-10-01T00:00:00+07:00',
    },
    {
      service_id: 302,
      category_id: 5,
      title: 'Tổng vệ sinh & Khử khuẩn hơi nước nóng',
      description: 'Làm sạch sâu toàn bộ phòng khách, bếp, phòng ngủ và nhà vệ sinh bằng máy hơi nước nóng 140°C diệt 99.9% vi khuẩn, không dùng hóa chất độc hại.',
      price: 480000,
      pricing_type: 'fixed',
      estimated_duration: 180,
      is_active: true,
      image_url: 'assets/service-cleaning.jpg',
      created_at: '2026-06-01T00:00:00+07:00',
      updated_at: '2026-10-01T00:00:00+07:00',
    },
    {
      service_id: 303,
      category_id: 6,
      title: 'Đi chợ hữu cơ & Nấu mâm cơm gia đình (4–6 người)',
      description: 'Đi chợ theo thực đơn dinh dưỡng khách chọn, sơ chế sạch, nấu 4 món mặn/canh/xào và dọn rửa toàn bộ gian bếp gọn gàng sau khi nấu.',
      price: 320000,
      pricing_type: 'fixed',
      estimated_duration: 150,
      is_active: true,
      image_url: 'assets/service-cooking.jpg',
      created_at: '2026-06-01T00:00:00+07:00',
      updated_at: '2026-10-01T00:00:00+07:00',
    },
    {
      service_id: 304,
      category_id: 4,
      title: 'Chăm sóc trẻ sơ sinh & Tắm bé chuẩn Y khoa',
      description: 'Massage vận động sớm cho bé, tắm bé sơ sinh, vệ sinh rốn/mắt/mũi vô trùng và hơ lá trầu theo phương pháp điều dưỡng nhi khoa.',
      price: 150000,
      pricing_type: 'hourly',
      estimated_duration: 120,
      is_active: true,
      image_url: 'assets/service-baby.jpg',
      created_at: '2026-06-01T00:00:00+07:00',
      updated_at: '2026-10-01T00:00:00+07:00',
    },
    {
      service_id: 305,
      category_id: 5,
      title: 'Giặt hấp sofa, nệm & Rèm cửa sinh học tại nhà',
      description: 'Hút bụi mịn ký sinh trùng, phun dung dịch hữu cơ phân hủy vết bẩn và sấy khô tại chỗ cho bộ sofa hoặc nệm King-size.',
      price: 550000,
      pricing_type: 'fixed',
      estimated_duration: 150,
      is_active: true,
      image_url: 'assets/service-laundry.jpg',
      created_at: '2026-06-01T00:00:00+07:00',
      updated_at: '2026-10-01T00:00:00+07:00',
    },
    {
      service_id: 306,
      category_id: 3,
      title: 'Chăm sóc bệnh nhân phục hồi sau phẫu thuật (Ca đêm)',
      description: 'Túc trực ban đêm, hỗ trợ xoay trở chống loét, thay băng vết thương cơ bản và ghi biểu đồ theo dõi giấc ngủ.',
      price: 165000,
      pricing_type: 'hourly',
      estimated_duration: 480,
      is_active: false,
      image_url: 'assets/service-elderly.jpg',
      created_at: '2026-06-01T00:00:00+07:00',
      updated_at: '2026-10-01T00:00:00+07:00',
    },
  ];

  // -------------------------------------------------------------------
  // 6. provider_services (id_pro_ser BIGINT, provider_id BIGINT, service_id BIGINT)
  // -------------------------------------------------------------------
  const provider_services = [
    { id_pro_ser: 1, provider_id: 201, service_id: 301 },
    { id_pro_ser: 2, provider_id: 201, service_id: 304 },
    { id_pro_ser: 3, provider_id: 202, service_id: 302 },
    { id_pro_ser: 4, provider_id: 202, service_id: 305 },
    { id_pro_ser: 5, provider_id: 203, service_id: 303 },
    { id_pro_ser: 6, provider_id: 203, service_id: 302 },
    { id_pro_ser: 7, provider_id: 204, service_id: 302 },
    { id_pro_ser: 8, provider_id: 204, service_id: 305 },
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
      reason: 'Tham dự hội thảo cập nhật chứng chỉ Điều dưỡng lão khoa tại BV Đại học Y Dược',
      created_at: '2026-10-19T10:00:00+07:00',
    },
    {
      id: 2,
      provider_id: 202,
      exception_date: '2026-10-29',
      start_time: '08:00',
      end_time: '12:00',
      reason: 'Bảo trì định kỳ máy phun hơi nước Karcher tại trạm kỹ thuật Quận 7',
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
      address: 'Biệt thự B14, Khu Cảnh Đồi, Phú Mỹ Hưng',
      ward_id: '27403',
      latitude: 10.728912,
      longitude: 106.712405,
      total_incidental: 65000,
      total_amount: 625000, // 4h * 140k = 560k + 65k phát sinh (que thử đường huyết Accu-Chek)
      status: 'in_progress',
      payment_status: 'unpaid',
      notes: 'Bác trai 78 tuổi mới xuất viện tuần trước, cần đo huyết áp & đường huyết trước bữa xế.\n[Phát sinh: 65000đ] Mua thêm hộp que thử đường huyết Accu-Chek tại nhà thuốc Long Châu (có hóa đơn).',
      created_at: '2026-10-22T19:15:00+07:00',
      updated_at: '2026-10-23T14:35:00+07:00',
    },
    {
      booking_id: 1043,
      customer_id: 101,
      provider_id: 201,
      service_id: 304,
      scheduled_time: '2026-10-24T09:00:00+07:00',
      address: 'Biệt thự B14, Khu Cảnh Đồi, Phú Mỹ Hưng',
      ward_id: '27403',
      latitude: 10.728912,
      longitude: 106.712405,
      total_incidental: 0,
      total_amount: 300000, // 2h * 150k
      status: 'pending',
      payment_status: 'unpaid',
      notes: 'Bé sơ sinh 3 tuần tuổi, nhờ cô Lan mang theo đèn sưởi mini khi tắm bé.',
      created_at: '2026-10-23T10:12:00+07:00',
      updated_at: '2026-10-23T10:12:00+07:00',
    },
    {
      booking_id: 1044,
      customer_id: 102,
      provider_id: 202,
      service_id: 302,
      scheduled_time: '2026-10-24T13:30:00+07:00',
      address: 'Căn hộ T2-1804, Masteri Thảo Điền, 159 Xa Lộ Hà Nội',
      ward_id: '27088',
      latitude: 10.802145,
      longitude: 106.742118,
      total_incidental: 0,
      total_amount: 480000,
      status: 'pending',
      payment_status: 'unpaid',
      notes: 'Căn hộ 2PN 72m2, ưu tiên khử khuẩn kỹ khu vực ban công và sofa vải bố.',
      created_at: '2026-10-23T11:05:00+07:00',
      updated_at: '2026-10-23T11:05:00+07:00',
    },
    {
      booking_id: 1039,
      customer_id: 101,
      provider_id: 203,
      service_id: 303,
      scheduled_time: '2026-10-20T16:00:00+07:00',
      address: 'Biệt thự B14, Khu Cảnh Đồi, Phú Mỹ Hưng',
      ward_id: '27403',
      latitude: 10.728912,
      longitude: 106.712405,
      total_incidental: 185000,
      total_amount: 505000, // 320k + 185k tiền thực phẩm hữu cơ
      status: 'completed',
      payment_status: 'paid',
      notes: 'Thực đơn ít muối cho ông bà: Cá chẽm hấp Hồng Kông, canh rau củ hầm xương, đậu hũ non sốt nấm.',
      created_at: '2026-10-19T20:00:00+07:00',
      updated_at: '2026-10-20T18:45:00+07:00',
    },
    {
      booking_id: 1040,
      customer_id: 101,
      provider_id: 201,
      service_id: 301,
      scheduled_time: '2026-10-21T08:00:00+07:00',
      address: 'Biệt thự B14, Khu Cảnh Đồi, Phú Mỹ Hưng',
      ward_id: '27403',
      latitude: 10.728912,
      longitude: 106.712405,
      total_incidental: 0,
      total_amount: 560000,
      status: 'completed',
      payment_status: 'paid',
      notes: 'Ca sáng 4 tiếng chăm sóc định kỳ cho bác trai.',
      created_at: '2026-10-20T09:30:00+07:00',
      updated_at: '2026-10-21T12:10:00+07:00',
    },
    {
      booking_id: 1041,
      customer_id: 102,
      provider_id: 202,
      service_id: 305,
      scheduled_time: '2026-10-22T09:00:00+07:00',
      address: 'Căn hộ T2-1804, Masteri Thảo Điền, 159 Xa Lộ Hà Nội',
      ward_id: '27088',
      latitude: 10.802145,
      longitude: 106.742118,
      total_incidental: 0,
      total_amount: 550000,
      status: 'cancelled',
      payment_status: 'refunded',
      notes: 'Giặt hấp sofa chữ L và 2 bộ rèm phòng khách.',
      created_at: '2026-10-21T14:00:00+07:00',
      updated_at: '2026-10-22T07:30:00+07:00',
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
      reason: 'Khách hàng khởi tạo đơn đặt lịch mới qua Booking Wizard',
      created_at: '2026-10-22T19:15:00+07:00',
    },
    {
      history_id: 5002,
      booking_id: 1042,
      previous_status: 'pending',
      new_status: 'confirmed',
      changed_by: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b21',
      reason: 'Điều dưỡng Đặng Thị Mai Lan đã xác nhận nhận ca làm việc',
      created_at: '2026-10-22T19:42:00+07:00',
    },
    {
      history_id: 5003,
      booking_id: 1042,
      previous_status: 'confirmed',
      new_status: 'in_progress',
      changed_by: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b21',
      reason: 'Đã đến địa chỉ B14 Phú Mỹ Hưng, check-in GPS và bắt đầu bấm giờ ca làm',
      created_at: '2026-10-23T14:00:00+07:00',
    },
    {
      history_id: 5004,
      booking_id: 1042,
      previous_status: 'in_progress',
      new_status: 'in_progress',
      changed_by: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b21',
      reason: 'Cập nhật chi phí phát sinh: 65,000 VND -> Tổng mới: 625,000 VND. Lý do: Mua thêm hộp que thử đường huyết Accu-Chek tại nhà thuốc Long Châu',
      created_at: '2026-10-23T14:35:00+07:00',
    },
    {
      history_id: 5005,
      booking_id: 1041,
      previous_status: 'confirmed',
      new_status: 'cancelled',
      changed_by: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
      reason: 'Ban quản lý tòa nhà Masteri Thảo Điền tạm ngưng cấp nước bảo trì đường ống sáng ngày 22/10',
      created_at: '2026-10-22T07:15:00+07:00',
    },
    {
      history_id: 5006,
      booking_id: 1041,
      previous_status: 'cancelled',
      new_status: 'cancelled',
      changed_by: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c99',
      reason: '[ADMIN ADJUSTMENT] TT Thanh toán: paid -> refunded | Tổng tiền: 550,000 VND | Lý do: Hoàn tiền 100% do sự cố tòa nhà bất khả kháng',
      created_at: '2026-10-22T07:30:00+07:00',
    },
  ];

  // -------------------------------------------------------------------
  // 12. reviews (review_id BIGINT, booking_id UNIQUE, customer_id, provider_id, rating 1..5, comment, created_at)
  //     Lưu ý: Đơn #1039 đã có review; Đơn #1040 (completed) chưa có review để Khách hàng trải nghiệm nút "Đánh giá" (Modal 1.9)
  // -------------------------------------------------------------------
  const reviews = [
    {
      review_id: 801,
      booking_id: 1039,
      customer_id: 101,
      provider_id: 203,
      rating: 5,
      comment: 'Chị Thu Hà chọn cá chẽm và rau hữu cơ rất tươi, nêm nếm vừa miệng cho ông bà lớn tuổi. Gian bếp sau khi nấu xong sạch bóng không còn vết dầu mỡ.',
      created_at: '2026-10-20T20:10:00+07:00',
    },
  ];

  // -------------------------------------------------------------------
  // 13. favorites (favorite_id BIGINT, customer_id, service_id, created_at)
  // -------------------------------------------------------------------
  const favorites = [
    { favorite_id: 901, customer_id: 101, service_id: 301, created_at: '2026-09-10T10:00:00+07:00' },
    { favorite_id: 902, customer_id: 101, service_id: 302, created_at: '2026-09-14T16:20:00+07:00' },
    { favorite_id: 903, customer_id: 101, service_id: 303, created_at: '2026-10-02T09:15:00+07:00' },
  ];

  // -------------------------------------------------------------------
  // 14. support_tickets (ticket_id BIGINT, user_id UUID, booking_id BIGINT, subject VARCHAR(200), status, priority)
  // -------------------------------------------------------------------
  const support_tickets = [
    {
      ticket_id: 701,
      user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      booking_id: 1042,
      subject: 'Yêu cầu xuất hóa đơn VAT điện tử cho gói điều dưỡng tại gia #1042',
      status: 'open',
      priority: 'medium',
      created_at: '2026-10-23T14:40:00+07:00',
      updated_at: '2026-10-23T14:40:00+07:00',
    },
    {
      ticket_id: 702,
      user_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
      booking_id: 1041,
      subject: 'Khách báo hủy sát giờ do tòa nhà cúp nước, đề nghị hỗ trợ phụ phí xăng xe di chuyển',
      status: 'in_progress',
      priority: 'high',
      created_at: '2026-10-22T07:20:00+07:00',
      updated_at: '2026-10-22T08:05:00+07:00',
    },
    {
      ticket_id: 703,
      user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
      booking_id: 1041,
      subject: 'Xác nhận hoàn tiền đơn #1041 về ví thanh toán QR',
      status: 'resolved',
      priority: 'urgent',
      created_at: '2026-10-22T07:18:00+07:00',
      updated_at: '2026-10-22T07:35:00+07:00',
    },
  ];

  // -------------------------------------------------------------------
  // VIEW: provider_public_profiles (ẩn id_card_number, chỉ lấy verification_status = 'verified' & u.is_active = TRUE)
  // -------------------------------------------------------------------
  function getProviderPublicProfiles() {
    return provider_profiles
      .filter((p) => {
        const u = users.find((usr) => usr.user_id === p.user_id);
        return p.verification_status === 'verified' && u && u.is_active;
      })
      .map((p) => {
        const u = users.find((usr) => usr.user_id === p.user_id);
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
    const provReviews = reviews.filter((r) => r.provider_id === Number(providerId));
    const prov = provider_profiles.find((p) => p.provider_id === Number(providerId));
    if (!prov) return;
    prov.total_reviews = provReviews.length;
    if (provReviews.length === 0) {
      prov.average_rating = 0.0;
    } else {
      const avg = provReviews.reduce((acc, r) => acc + Number(r.rating), 0) / provReviews.length;
      prov.average_rating = Number(avg.toFixed(2));
    }
  }

  return {
    province,
    ward,
    users,
    customer_profiles,
    provider_profiles,
    service_categories,
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
    getProviderPublicProfiles,
    refreshProviderRating,
  };
})();
