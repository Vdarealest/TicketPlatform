'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';

const FAQ_VI = [
  { q: 'Làm thế nào để mua vé trên Vietix?', a: 'Bạn chỉ cần tạo tài khoản, chọn sự kiện yêu thích, chọn loại vé và ghế ngồi (nếu có), sau đó thanh toán qua VNPay hoặc MoMo. Vé sẽ được gửi qua email kèm mã QR để check-in tại sự kiện.' },
  { q: 'Tôi có thể thanh toán bằng những phương thức nào?', a: 'Hiện tại Vietix hỗ trợ thanh toán qua VNPay (thẻ ATM/Visa/MasterCard) và MoMo. Chúng tôi sẽ mở rộng thêm các phương thức thanh toán khác trong tương lai.' },
  { q: 'Sau khi mua vé, tôi nhận vé ở đâu?', a: 'Vé điện tử kèm mã QR sẽ được gửi đến email đăng ký của bạn ngay sau khi thanh toán thành công. Bạn cũng có thể xem vé trong mục "Vé của tôi" trên website.' },
  { q: 'Tôi có thể huỷ vé hoặc hoàn tiền không?', a: 'Chính sách huỷ vé và hoàn tiền phụ thuộc vào từng sự kiện và ban tổ chức. Vui lòng liên hệ với chúng tôi qua trang Liên hệ để được hỗ trợ.' },
  { q: 'Mã QR trên vé dùng để làm gì?', a: 'Mã QR là vé điện tử của bạn. Khi đến sự kiện, bạn chỉ cần xuất trình mã QR (trên điện thoại hoặc in ra) để ban tổ chức quét và check-in. Mỗi mã QR chỉ sử dụng được một lần.' },
  { q: 'Tôi quên mật khẩu, phải làm sao?', a: 'Trên trang đăng nhập, nhấn "Quên mật khẩu" và nhập email hoặc số điện thoại đã đăng ký. Hệ thống sẽ gửi mã OTP đến email để bạn đặt lại mật khẩu mới.' },
  { q: 'Tôi có thể mua nhiều vé cùng lúc không?', a: 'Có, bạn có thể chọn nhiều ghế (tối đa 10 ghế) cho cùng một loại vé và thanh toán một lần.' },
  { q: 'Vé có thể chuyển nhượng cho người khác không?', a: 'Hiện tại Vietix chưa hỗ trợ tính năng chuyển nhượng vé. Mỗi vé gắn với tài khoản người mua.' },
];

const FAQ_EN = [
  { q: 'How do I buy tickets on Vietix?', a: 'Simply create an account, choose your favorite event, select the ticket type and seat (if available), then pay via VNPay or MoMo. Your e-ticket with QR code will be sent to your email for event check-in.' },
  { q: 'What payment methods are supported?', a: 'Vietix currently supports VNPay (ATM/Visa/MasterCard) and MoMo. We plan to add more payment options in the future.' },
  { q: 'Where do I find my tickets after purchase?', a: 'Your e-ticket with QR code is sent to your registered email immediately after successful payment. You can also view your tickets under "My Tickets" on the website.' },
  { q: 'Can I cancel or get a refund?', a: 'Cancellation and refund policies depend on each event and its organizer. Please contact us through the Contact page for assistance.' },
  { q: 'What is the QR code on my ticket for?', a: 'The QR code is your electronic ticket. At the event, simply present your QR code (on your phone or printed) for the organizer to scan and check you in. Each QR code can only be used once.' },
  { q: 'I forgot my password. What should I do?', a: 'On the login page, click "Forgot Password" and enter your registered email or phone number. The system will send an OTP to your email to reset your password.' },
  { q: 'Can I buy multiple tickets at once?', a: 'Yes, you can select multiple seats (up to 10) for the same ticket type and pay in one transaction.' },
  { q: 'Can I transfer tickets to someone else?', a: 'Vietix does not currently support ticket transfers. Each ticket is tied to the buyer\'s account.' },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`sp-faq-item ${open ? 'sp-faq-item--open' : ''}`}>
      <button className="sp-faq-q" onClick={() => setOpen(!open)}>
        <span>{q}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="sp-faq-chevron">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <p className="sp-faq-a">{a}</p>}
    </div>
  );
}

export default function FaqPage() {
  const { t, lang } = useTranslation();
  const data = lang === 'en' ? FAQ_EN : FAQ_VI;

  return (
    <main className="sp-root">
      <div className="sp-wrap">
        <div className="sp-header">
          <h1 className="sp-title">{t.faq_title}</h1>
          <p className="sp-subtitle">{t.faq_subtitle}</p>
        </div>
        <div className="sp-faq-list">
          {data.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </div>
    </main>
  );
}
