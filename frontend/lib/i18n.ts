const translations = {
  vi: {
    // Navbar
    nav_events: 'Sự kiện',
    nav_my_tickets: 'Vé của tôi',
    nav_search: 'Tìm sự kiện...',
    nav_login: 'Đăng nhập',
    nav_contact: 'Liên hệ',
    nav_profile: 'Hồ sơ của tôi',
    nav_tickets: 'Vé của tôi',
    nav_admin: 'Quản trị Admin',
    nav_logout: 'Đăng xuất',
    nav_login_with: 'Đăng nhập với',

    // Home
    home_on_sale: 'Đang mở bán',
    home_buy_now: 'Mua vé ngay',
    home_price_from: 'Giá từ',
    home_featured: 'Sự kiện nổi bật',
    home_view_all: 'Xem tất cả →',
    home_on_sale_section: 'Đang mở bán',

    // Events page
    events_title: 'Tất cả sự kiện',
    events_category: 'Thể loại',
    events_all: 'Tất cả',
    events_location: 'Địa điểm',
    events_location_ph: 'Nhập địa điểm...',
    events_date_from: 'Từ ngày',
    events_date_to: 'Đến ngày',
    events_price_from: 'Giá từ',
    events_price_to: 'Giá đến',
    events_sort: 'Sắp xếp',
    events_sort_soonest: 'Sắp diễn ra',
    events_sort_latest: 'Mới nhất',
    events_sort_price_asc: 'Giá tăng dần',
    events_sort_price_desc: 'Giá giảm dần',
    events_empty_title: 'Không tìm thấy sự kiện',
    events_empty_text: 'Thử thay đổi bộ lọc hoặc từ khoá tìm kiếm',
    events_clear_filters: 'Xóa bộ lọc',
    events_from: 'Từ',

    // Event detail
    edp_about: 'Giới thiệu sự kiện',
    edp_ticket_info: 'Thông tin vé',
    edp_price_from: 'Giá từ',
    edp_select_ticket: 'Chọn vé',
    edp_coming_soon: 'Vé sẽ được mở bán sớm.',
    edp_secure_note: 'Thanh toán bảo mật · Hoàn tiền trong 24h',
    edp_reviews_title: 'Đánh giá & Bình luận',
    edp_reviews_count: 'đánh giá',
    edp_review_share: 'Chia sẻ trải nghiệm của bạn',
    edp_review_placeholder: 'Viết nhận xét về sự kiện...',
    edp_review_submit: 'Gửi đánh giá',
    edp_review_submitting: 'Đang gửi...',
    edp_review_select_star: 'Vui lòng chọn số sao.',
    edp_review_enter_comment: 'Vui lòng nhập bình luận.',
    edp_review_thanks: 'Cảm ơn bạn đã đánh giá!',
    edp_review_fail: 'Gửi đánh giá thất bại.',
    edp_review_after: 'Đánh giá sẽ mở sau khi sự kiện kết thúc.',
    edp_review_login: 'để viết đánh giá.',
    edp_review_already: 'Bạn đã đánh giá sự kiện này.',
    edp_review_delete: 'Xoá đánh giá',
    edp_review_empty: 'Chưa có đánh giá nào. Hãy là người đầu tiên!',
    edp_review_just_now: 'Vừa xong',
    edp_review_mins_ago: 'phút trước',
    edp_review_hours_ago: 'giờ trước',
    edp_review_days_ago: 'ngày trước',

    // My tickets
    mt_title: 'Vé của tôi',
    mt_profile: 'Hồ sơ',
    mt_tab_active: 'Đang có hiệu lực',
    mt_tab_history: 'Lịch sử',
    mt_empty_active: 'Không có vé đang có hiệu lực',
    mt_empty_history: 'Chưa có sự kiện nào đã kết thúc',
    mt_empty_cta: 'Khám phá các sự kiện và đặt vé ngay!',
    mt_view_events: 'Xem sự kiện',
    mt_seat: 'Ghế',

    // Profile
    pp_edit_profile: 'Chỉnh sửa hồ sơ',
    pp_recent: 'Đặt chỗ gần đây',
    pp_view_all: 'Xem tất cả',
    pp_no_reservation: 'Chưa có đặt chỗ nào',
    pp_explore: 'Khám phá sự kiện',
    pp_account_info: 'Thông tin tài khoản',
    pp_name: 'Tên',
    pp_email: 'Email',
    pp_phone: 'Số điện thoại',
    pp_login_via: 'Đăng nhập qua',
    pp_permission: 'Quyền',
    pp_joined: 'Ngày tham gia',
    pp_security: 'Bảo mật',
    pp_password: 'Mật khẩu',
    pp_change_password: 'Đổi mật khẩu',
    pp_logout: 'Đăng xuất',
    pp_reservation: 'Đặt chỗ',
    pp_joined_from: 'Tham gia từ',
    pp_rank: 'Hạng',
    pp_edit_title: 'Chỉnh sửa hồ sơ',
    pp_avatar_hint: 'Nhấn để thay đổi ảnh đại diện',
    pp_display_name: 'Tên hiển thị',
    pp_display_name_ph: 'Nhập tên của bạn',
    pp_phone_ph: '0912 345 678',
    pp_email_readonly: 'Email không thể thay đổi',
    pp_cancel: 'Huỷ',
    pp_save: 'Lưu thay đổi',
    pp_saving: 'Đang lưu...',
    pp_save_success: 'Cập nhật thành công!',
    pp_save_fail: 'Cập nhật thất bại.',
    pp_upload_fail: 'Upload ảnh thất bại.',
    pp_upload_max: 'Ảnh không được vượt quá 2MB.',
    pp_pw_title: 'Đổi mật khẩu',
    pp_pw_current: 'Mật khẩu hiện tại',
    pp_pw_current_ph: 'Nhập mật khẩu hiện tại',
    pp_pw_new: 'Mật khẩu mới',
    pp_pw_new_ph: 'Tối thiểu 6 ký tự',
    pp_pw_confirm: 'Xác nhận mật khẩu mới',
    pp_pw_confirm_ph: 'Nhập lại mật khẩu mới',
    pp_pw_enter_current: 'Nhập mật khẩu hiện tại.',
    pp_pw_min: 'Mật khẩu mới phải có ít nhất 6 ký tự.',
    pp_pw_mismatch: 'Xác nhận mật khẩu không khớp.',
    pp_pw_success: 'Đổi mật khẩu thành công!',
    pp_pw_fail: 'Đổi mật khẩu thất bại.',

    // Login
    login_title: 'Đăng nhập',
    login_subtitle: 'Chào mừng bạn trở lại',
    login_email: 'Email',
    login_email_ph: 'you@example.com',
    login_password: 'Mật khẩu',
    login_password_ph: 'Nhập mật khẩu',
    login_forgot: 'Quên mật khẩu?',
    login_btn: 'Đăng nhập',
    login_logging: 'Đang đăng nhập...',
    login_or: 'hoặc',
    login_google: 'Đăng nhập với Google',
    login_no_account: 'Chưa có tài khoản?',
    login_register: 'Đăng ký',

    // Register
    register_title: 'Tạo tài khoản',
    register_subtitle: 'Đăng ký để bắt đầu đặt vé',
    register_email: 'Email',
    register_password: 'Mật khẩu',
    register_phone: 'Số điện thoại',
    register_phone_ph: 'Không bắt buộc',
    register_btn: 'Tạo tài khoản',
    register_creating: 'Đang tạo...',
    register_has_account: 'Đã có tài khoản?',
    register_login: 'Đăng nhập',

    // Contact
    contact_title: 'Liên hệ với chúng tôi',
    contact_subtitle: 'Có câu hỏi hoặc cần hỗ trợ? Chúng tôi luôn sẵn sàng giúp bạn',
    contact_email: 'Email',
    contact_hotline: 'Hotline',
    contact_hours: 'T2 - T7, 8:00 - 18:00',
    contact_office: 'Văn phòng',
    contact_address: 'TP. Hồ Chí Minh, Việt Nam',
    contact_name: 'Họ tên',
    contact_name_ph: 'Nguyễn Văn A',
    contact_email_ph: 'email@example.com',
    contact_subject: 'Chủ đề',
    contact_subject_ph: 'Hỗ trợ đặt vé, hoàn tiền...',
    contact_message: 'Nội dung',
    contact_message_ph: 'Mô tả chi tiết vấn đề của bạn...',
    contact_send: 'Gửi tin nhắn',
    contact_sending: 'Đang gửi...',
    contact_success_title: 'Gửi thành công!',
    contact_success_text: 'Chúng tôi sẽ phản hồi trong thời gian sớm nhất.',
    contact_send_another: 'Gửi tin nhắn khác',
    contact_fail: 'Gửi thất bại. Vui lòng thử lại.',

    // FAQ
    faq_title: 'Câu hỏi thường gặp',
    faq_subtitle: 'Tìm câu trả lời cho các thắc mắc phổ biến về Vietix',

    // Footer
    footer_desc: 'Nền tảng đặt vé sự kiện với cập nhật số lượng thời gian thực. Tìm kiếm, đặt vé và trải nghiệm những khoảnh khắc đáng nhớ.',
    footer_navigate: 'Điều hướng',
    footer_support: 'Hỗ trợ',
    footer_home: 'Trang chủ',
    footer_rights: 'Tất cả quyền được bảo lưu.',
    footer_made: 'Được tạo với',
    footer_for: 'cho trải nghiệm trực tiếp',

    // Status
    status_hold: 'Đang giữ',
    status_confirmed: 'Đã xác nhận',
    status_paid: 'Đã thanh toán',
    status_expired: 'Hết hạn',
    status_cancelled: 'Đã huỷ',

    // Common
    loading: 'Đang tải...',
    event: 'Sự kiện',
    close: 'Đóng',
  },
  en: {
    // Navbar
    nav_events: 'Events',
    nav_my_tickets: 'My Tickets',
    nav_search: 'Search events...',
    nav_login: 'Login',
    nav_contact: 'Contact',
    nav_profile: 'My Profile',
    nav_tickets: 'My Tickets',
    nav_admin: 'Admin Dashboard',
    nav_logout: 'Log out',
    nav_login_with: 'Logged in as',

    // Home
    home_on_sale: 'On Sale Now',
    home_buy_now: 'Buy Tickets',
    home_price_from: 'From',
    home_featured: 'Featured Events',
    home_view_all: 'View all →',
    home_on_sale_section: 'On Sale',

    // Events page
    events_title: 'All Events',
    events_category: 'Category',
    events_all: 'All',
    events_location: 'Location',
    events_location_ph: 'Enter location...',
    events_date_from: 'From date',
    events_date_to: 'To date',
    events_price_from: 'Min price',
    events_price_to: 'Max price',
    events_sort: 'Sort by',
    events_sort_soonest: 'Soonest',
    events_sort_latest: 'Latest',
    events_sort_price_asc: 'Price: Low to High',
    events_sort_price_desc: 'Price: High to Low',
    events_empty_title: 'No events found',
    events_empty_text: 'Try changing filters or search keywords',
    events_clear_filters: 'Clear filters',
    events_from: 'From',

    // Event detail
    edp_about: 'About this event',
    edp_ticket_info: 'Ticket Info',
    edp_price_from: 'From',
    edp_select_ticket: 'Select Tickets',
    edp_coming_soon: 'Tickets coming soon.',
    edp_secure_note: 'Secure payment · 24h refund',
    edp_reviews_title: 'Reviews & Comments',
    edp_reviews_count: 'reviews',
    edp_review_share: 'Share your experience',
    edp_review_placeholder: 'Write a review about this event...',
    edp_review_submit: 'Submit Review',
    edp_review_submitting: 'Submitting...',
    edp_review_select_star: 'Please select a rating.',
    edp_review_enter_comment: 'Please enter a comment.',
    edp_review_thanks: 'Thank you for your review!',
    edp_review_fail: 'Failed to submit review.',
    edp_review_after: 'Reviews open after the event ends.',
    edp_review_login: 'to write a review.',
    edp_review_already: 'You have already reviewed this event.',
    edp_review_delete: 'Delete review',
    edp_review_empty: 'No reviews yet. Be the first!',
    edp_review_just_now: 'Just now',
    edp_review_mins_ago: 'min ago',
    edp_review_hours_ago: 'hr ago',
    edp_review_days_ago: 'days ago',

    // My tickets
    mt_title: 'My Tickets',
    mt_profile: 'Profile',
    mt_tab_active: 'Active',
    mt_tab_history: 'History',
    mt_empty_active: 'No active tickets',
    mt_empty_history: 'No past events yet',
    mt_empty_cta: 'Explore events and book your tickets!',
    mt_view_events: 'View Events',
    mt_seat: 'Seat',

    // Profile
    pp_edit_profile: 'Edit Profile',
    pp_recent: 'Recent Reservations',
    pp_view_all: 'View all',
    pp_no_reservation: 'No reservations yet',
    pp_explore: 'Explore Events',
    pp_account_info: 'Account Info',
    pp_name: 'Name',
    pp_email: 'Email',
    pp_phone: 'Phone',
    pp_login_via: 'Login via',
    pp_permission: 'Role',
    pp_joined: 'Joined',
    pp_security: 'Security',
    pp_password: 'Password',
    pp_change_password: 'Change Password',
    pp_logout: 'Log out',
    pp_reservation: 'Reservations',
    pp_joined_from: 'Joined',
    pp_rank: 'Rank',
    pp_edit_title: 'Edit Profile',
    pp_avatar_hint: 'Click to change avatar',
    pp_display_name: 'Display Name',
    pp_display_name_ph: 'Enter your name',
    pp_phone_ph: '0912 345 678',
    pp_email_readonly: 'Email cannot be changed',
    pp_cancel: 'Cancel',
    pp_save: 'Save Changes',
    pp_saving: 'Saving...',
    pp_save_success: 'Updated successfully!',
    pp_save_fail: 'Update failed.',
    pp_upload_fail: 'Upload failed.',
    pp_upload_max: 'Image must not exceed 2MB.',
    pp_pw_title: 'Change Password',
    pp_pw_current: 'Current Password',
    pp_pw_current_ph: 'Enter current password',
    pp_pw_new: 'New Password',
    pp_pw_new_ph: 'At least 6 characters',
    pp_pw_confirm: 'Confirm New Password',
    pp_pw_confirm_ph: 'Re-enter new password',
    pp_pw_enter_current: 'Enter current password.',
    pp_pw_min: 'New password must be at least 6 characters.',
    pp_pw_mismatch: 'Passwords do not match.',
    pp_pw_success: 'Password changed successfully!',
    pp_pw_fail: 'Failed to change password.',

    // Login
    login_title: 'Login',
    login_subtitle: 'Welcome back',
    login_email: 'Email',
    login_email_ph: 'you@example.com',
    login_password: 'Password',
    login_password_ph: 'Enter password',
    login_forgot: 'Forgot password?',
    login_btn: 'Login',
    login_logging: 'Logging in...',
    login_or: 'or',
    login_google: 'Login with Google',
    login_no_account: "Don't have an account?",
    login_register: 'Register',

    // Register
    register_title: 'Create Account',
    register_subtitle: 'Sign up to start booking tickets',
    register_email: 'Email',
    register_password: 'Password',
    register_phone: 'Phone Number',
    register_phone_ph: 'Optional',
    register_btn: 'Create Account',
    register_creating: 'Creating...',
    register_has_account: 'Already have an account?',
    register_login: 'Login',

    // Contact
    contact_title: 'Contact Us',
    contact_subtitle: 'Have questions or need help? We are always ready to assist you',
    contact_email: 'Email',
    contact_hotline: 'Hotline',
    contact_hours: 'Mon - Sat, 8:00 - 18:00',
    contact_office: 'Office',
    contact_address: 'Ho Chi Minh City, Vietnam',
    contact_name: 'Full Name',
    contact_name_ph: 'John Doe',
    contact_email_ph: 'email@example.com',
    contact_subject: 'Subject',
    contact_subject_ph: 'Ticket support, refund...',
    contact_message: 'Message',
    contact_message_ph: 'Describe your issue in detail...',
    contact_send: 'Send Message',
    contact_sending: 'Sending...',
    contact_success_title: 'Sent Successfully!',
    contact_success_text: 'We will respond as soon as possible.',
    contact_send_another: 'Send another message',
    contact_fail: 'Failed to send. Please try again.',

    // FAQ
    faq_title: 'Frequently Asked Questions',
    faq_subtitle: 'Find answers to common questions about Vietix',

    // Footer
    footer_desc: 'Event ticket booking platform with realtime inventory updates. Find, book, and experience the moments that matter.',
    footer_navigate: 'Navigate',
    footer_support: 'Support',
    footer_home: 'Home',
    footer_rights: 'All rights reserved.',
    footer_made: 'Made with',
    footer_for: 'for live experiences',

    // Status
    status_hold: 'On Hold',
    status_confirmed: 'Confirmed',
    status_paid: 'Paid',
    status_expired: 'Expired',
    status_cancelled: 'Cancelled',

    // Common
    loading: 'Loading...',
    event: 'Event',
    close: 'Close',
  },
} as const;

export type Lang = keyof typeof translations;
export type TranslationKey = keyof typeof translations['vi'];

// Event categories are stored in the DB in Vietnamese (a fixed vocabulary),
// so they can be mapped to English for display without touching the data.
const CATEGORY_EN: Record<string, string> = {
  'Âm nhạc': 'Music',
  'Thể thao': 'Sports',
  'Sân khấu': 'Theater',
  'Hội thảo': 'Conference',
  'Triển lãm': 'Exhibition',
  'Ẩm thực': 'Food',
  'Khác': 'Other',
};

export function translateCategory(category?: string | null, lang?: string): string {
  if (!category) return '';
  if (lang === 'en') return CATEGORY_EN[category] || category;
  return category;
}

export function getTranslations(lang?: string) {
  const l = lang || (typeof window !== 'undefined' ? localStorage.getItem('lang') : null) || 'vi';
  return translations[l as Lang] || translations.vi;
}

import { useState, useEffect } from 'react';

export function useTranslation() {
  const [lang, setLang] = useState<Lang>('vi');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('lang') as Lang;
    if (stored && translations[stored]) setLang(stored);
    setMounted(true);

    const onLangChanged = () => {
      const l = localStorage.getItem('lang') as Lang;
      if (l && translations[l]) setLang(l);
    };
    window.addEventListener('lang-changed', onLangChanged);
    return () => window.removeEventListener('lang-changed', onLangChanged);
  }, []);

  const t = translations[lang];
  return { t, lang, mounted };
}
