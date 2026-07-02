export enum RegistrationStatus {
  PENDING = 'Pending', // vừa đăng ký, chờ xác nhận/thanh toán
  CONFIRMED = 'Confirmed', // đã xác nhận chỗ học
  CANCELLED = 'Cancelled', // hủy đăng ký
  ATTENDED = 'Attended', // đã tham dự / hoàn thành khóa học
  NO_SHOW = 'NoShow', // đăng ký nhưng không tham dự
}

export enum RegistrationPaymentStatus {
  UNPAID = 'Unpaid',
  PAID = 'Paid',
  REFUNDED = 'Refunded',
}
