export default function PrivacyPage() {
  return (
    <main className="sp-root">
      <div className="sp-wrap sp-wrap--narrow">
        <div className="sp-header">
          <h1 className="sp-title">Chính sách bảo mật</h1>
          <p className="sp-subtitle">Cập nhật lần cuối: 27 tháng 6, 2026</p>
        </div>

        <div className="sp-prose">
          <h2>1. Thông tin chúng tôi thu thập</h2>
          <p>Khi bạn sử dụng Vietix, chúng tôi có thể thu thập các loại thông tin sau:</p>
          <ul>
            <li><strong>Thông tin tài khoản:</strong> Email, tên, số điện thoại, ảnh đại diện khi bạn đăng ký hoặc cập nhật hồ sơ</li>
            <li><strong>Thông tin giao dịch:</strong> Lịch sử mua vé, phương thức thanh toán (không bao gồm số thẻ), mã đơn hàng</li>
            <li><strong>Thông tin đăng nhập:</strong> Google ID nếu bạn đăng nhập qua Google</li>
            <li><strong>Dữ liệu sử dụng:</strong> Trang bạn truy cập, thời gian sử dụng, thiết bị và trình duyệt</li>
          </ul>

          <h2>2. Cách chúng tôi sử dụng thông tin</h2>
          <p>Thông tin của bạn được sử dụng để:</p>
          <ul>
            <li>Xử lý đơn đặt vé và giao dịch thanh toán</li>
            <li>Gửi email xác nhận vé kèm mã QR check-in</li>
            <li>Cung cấp hỗ trợ khách hàng</li>
            <li>Cải thiện trải nghiệm người dùng trên nền tảng</li>
            <li>Gửi thông báo về sự kiện bạn quan tâm (nếu bạn đồng ý)</li>
          </ul>

          <h2>3. Chia sẻ thông tin</h2>
          <p>Chúng tôi <strong>không bán</strong> thông tin cá nhân của bạn. Thông tin chỉ được chia sẻ trong các trường hợp:</p>
          <ul>
            <li><strong>Đối tác thanh toán:</strong> VNPay và MoMo nhận thông tin giao dịch cần thiết để xử lý thanh toán</li>
            <li><strong>Ban tổ chức sự kiện:</strong> Nhận danh sách người tham dự để phục vụ check-in</li>
            <li><strong>Yêu cầu pháp lý:</strong> Khi được yêu cầu bởi cơ quan nhà nước có thẩm quyền</li>
          </ul>

          <h2>4. Bảo mật dữ liệu</h2>
          <p>
            Chúng tôi áp dụng các biện pháp bảo mật kỹ thuật để bảo vệ thông tin của bạn, bao gồm
            mã hoá mật khẩu (bcrypt), kết nối HTTPS, và xác thực JWT. Thông tin thanh toán được xử lý
            hoàn toàn qua các cổng thanh toán có chứng chỉ bảo mật — Vietix không lưu trữ thông tin thẻ.
          </p>

          <h2>5. Cookie và bộ nhớ cục bộ</h2>
          <p>
            Vietix sử dụng localStorage để lưu trữ token đăng nhập và tuỳ chọn giao diện (sáng/tối).
            Chúng tôi không sử dụng cookie theo dõi quảng cáo của bên thứ ba.
          </p>

          <h2>6. Quyền của bạn</h2>
          <p>Bạn có quyền:</p>
          <ul>
            <li>Truy cập và chỉnh sửa thông tin cá nhân trong mục Hồ sơ</li>
            <li>Yêu cầu xoá tài khoản bằng cách liên hệ với chúng tôi</li>
            <li>Từ chối nhận email quảng cáo</li>
            <li>Yêu cầu xuất dữ liệu cá nhân</li>
          </ul>

          <h2>7. Lưu trữ dữ liệu</h2>
          <p>
            Dữ liệu của bạn được lưu trữ trên máy chủ tại Việt Nam. Thông tin giao dịch được giữ lại
            tối thiểu theo quy định pháp luật. Khi tài khoản bị xoá, dữ liệu cá nhân sẽ được xoá
            trong vòng 30 ngày, ngoại trừ dữ liệu giao dịch cần lưu trữ theo quy định.
          </p>

          <h2>8. Thay đổi chính sách</h2>
          <p>
            Chúng tôi có thể cập nhật chính sách bảo mật này. Mọi thay đổi quan trọng sẽ được thông báo
            qua email hoặc thông báo trên nền tảng.
          </p>

          <h2>9. Liên hệ</h2>
          <p>
            Nếu bạn có thắc mắc về chính sách bảo mật, vui lòng liên hệ qua email{' '}
            <strong>support@vietix.vn</strong> hoặc trang <a href="/contact">Liên hệ</a>.
          </p>
        </div>
      </div>
    </main>
  );
}
