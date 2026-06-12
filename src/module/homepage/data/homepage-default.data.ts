export const DEFAULT_HOMEPAGE_SETTING = {
  key: 'homepage',

  seo: {
    title: 'HTCAA — Hội Tư vấn và Đại lý Thuế TP.HCM',
    description:
      'Cầu nối tin cậy giữa cơ quan thuế và cộng đồng doanh nghiệp TP.HCM. Tổ chức xã hội – nghề nghiệp đầu tiên trong cả nước có vai trò kép vừa tư vấn vừa đại lý thuế.',
    keywords: [
      'HTCAA',
      'Hội Tư vấn và Đại lý Thuế TP.HCM',
      'đại lý thuế',
      'tư vấn thuế',
      'đào tạo thuế',
    ],
  },

  topbar: {
    address: '311 Điện Biên Phủ, Q.3, TP.HCM',
    phone: '070 768 9966',
    links: [
      {
        label: 'Hỏi đáp',
        href: '/hoi-dap',
      },
      {
        label: 'Tuyển dụng',
        href: '/tuyen-dung',
      },
    ],
    languages: ['VI', 'EN'],
    defaultLanguage: 'VI',
  },

  header: {
    logoText: 'HTCAA',
    logoTagline: 'Hội Tư vấn & Đại lý Thuế TP.HCM',
    logoMark: 'H',
    navItems: [
      {
        label: 'Trang chủ',
        href: '/',
      },
      {
        label: 'Giới thiệu',
        href: '/gioi-thieu',
      },
      {
        label: 'Tin tức',
        href: '/tin-tuc',
      },
      {
        label: 'Đào tạo',
        href: '/dao-tao',
      },
      {
        label: 'Danh bạ',
        href: '/danh-ba',
      },
      {
        label: 'Văn bản',
        href: '/van-ban',
      },
      {
        label: 'Liên hệ',
        href: '/lien-he',
      },
    ],
    actions: [
      {
        label: 'Đăng nhập',
        href: '/dang-nhap',
        variant: 'ghost',
      },
      {
        label: 'Tìm đại lý thuế',
        href: '/danh-ba',
        variant: 'gold',
      },
    ],
  },

  hero: {
    eyebrow: 'Tổ chức xã hội – nghề nghiệp',
    title: 'Cầu nối tin cậy giữa cơ quan thuế và cộng đồng doanh nghiệp',
    accentText: 'cơ quan thuế',
    description:
      'HTCAA là tổ chức đầu tiên trong cả nước có vai trò kép vừa tư vấn vừa đại lý thuế, hoạt động dưới sự quản lý nhà nước của Cục Thuế TP.HCM.',
    visual: {
      crest: 'H',
      title: 'Hội Tư vấn và Đại lý Thuế TP.HCM',
      subtitle: '— HTCAA —',
      sinceLabel: 'Thành lập',
      sinceYear: '2022',
      image: null,
    },
  },

  heroStats: [
    {
      value: '4+',
      label: 'năm hoạt động',
    },
    {
      value: '200+',
      label: 'hội viên tổ chức',
    },
    {
      value: '10K+',
      label: 'DN được hỗ trợ/năm',
    },
  ],

  ctaCards: [
    {
      key: 'member',
      title: 'Dành cho hội viên',
      description: 'Đăng ký lớp 20h+4h, tra cứu giờ tích lũy, tài liệu nội bộ',
      buttonText: 'Đăng nhập hội viên',
      href: '/dang-nhap',
      icon: 'user',
      variant: 'member',
      isActive: true,
      order: 1,
    },
    {
      key: 'business',
      title: 'Dành cho doanh nghiệp',
      description: 'Tìm đại lý thuế uy tín theo lĩnh vực và khu vực tại TP.HCM',
      buttonText: 'Tra cứu danh bạ',
      href: '/danh-ba',
      icon: 'building',
      variant: 'business',
      isActive: true,
      order: 2,
    },
  ],

  trustStrip: [
    {
      label: 'Theo QĐ 4308/QĐ-UBND',
      icon: 'shield',
      isActive: true,
      order: 1,
    },
    {
      label: 'Trực thuộc Cục Thuế TP.HCM',
      icon: 'building',
      isActive: true,
      order: 2,
    },
    {
      label: 'Tư cách pháp nhân đầy đủ',
      icon: 'check',
      isActive: true,
      order: 3,
    },
  ],

  quickServices: [
    {
      title: 'Lịch lớp đào tạo',
      description: '20h thuế + 4h kế toán',
      href: '/dao-tao',
      icon: 'calendar',
      isActive: true,
      order: 1,
    },
    {
      title: 'Văn bản pháp luật',
      description: 'Luật – NĐ – TT cập nhật',
      href: '/van-ban',
      icon: 'document',
      isActive: true,
      order: 2,
    },
    {
      title: 'FAQ thuế',
      description: 'Câu hỏi thường gặp',
      href: '/faq',
      icon: 'info',
      isActive: true,
      order: 3,
    },
    {
      title: 'Hỏi đáp chuyên gia',
      description: 'Tư vấn từ hội viên',
      href: '/hoi-dap',
      icon: 'chat',
      isActive: true,
      order: 4,
    },
  ],

  presidentQuote: {
    eyebrow: 'Thông điệp từ Chủ tịch',
    quote:
      'HTCAA cam kết tiếp tục đổi mới cả nội dung lẫn phương thức hoạt động, tập trung nâng cao năng lực hội viên và đồng hành sâu sát cùng cộng đồng kinh doanh trong quá trình hội nhập quốc tế.',
    name: 'Bà Lê Thị Thu Hương',
    role: 'Chủ tịch HTCAA · Nguyên Phó Cục trưởng Cục Thuế TP.HCM',
    avatarText: 'LTH',
    avatar: null,
  },

  socialHub: {
    eyebrow: 'Cộng đồng đa kênh',
    title: 'Theo dõi HTCAA trên mạng xã hội',
    channels: [
      {
        key: 'facebook',
        title: 'Facebook Page',
        followersText: '12.4k người theo dõi',
        buttonText: 'Theo dõi',
        href: '#',
        variant: 'fb',
        posts: [
          {
            title:
              'Thông báo lớp cập nhật kiến thức tháng 6 – đăng ký mở từ 01/06',
            meta: '2 giờ trước · 👍 89',
            thumbnail: null,
          },
          {
            title:
              'Hội nghị sinh hoạt hội viên T03/2026 – nhìn lại những điểm nổi bật',
            meta: '1 ngày · 👍 134',
            thumbnail: null,
          },
          {
            title: 'Cập nhật chính sách: NĐ mới về thuế TNDN cho DN nhỏ và vừa',
            meta: '3 ngày · 👍 256',
            thumbnail: null,
          },
        ],
      },
      {
        key: 'youtube',
        title: 'YouTube Channel',
        followersText: '3.8k người đăng ký',
        buttonText: 'Đăng ký',
        href: '#',
        variant: 'yt',
        posts: [
          {
            title: 'Webinar: Quyết toán thuế TNCN 2025 – Đầy đủ A-Z',
            meta: '⏱ 42 phút · 1.2k views',
            thumbnail: null,
          },
          {
            title: 'Playlist: Hóa đơn điện tử – Hướng dẫn áp dụng (8 video)',
            meta: 'Cập nhật T05/2026',
            thumbnail: null,
          },
          {
            title:
              'Talkshow: Chuyển hộ kinh doanh sang kê khai – Chuyên gia trả lời',
            meta: '⏱ 28 phút · 890 views',
            thumbnail: null,
          },
        ],
      },
      {
        key: 'zalo',
        title: 'Zalo Official Account',
        followersText: '8.7k người quan tâm',
        buttonText: 'Quan tâm',
        href: '#',
        variant: 'zalo',
        qrCode: null,
        highlights: [
          {
            icon: '📢',
            title: 'Thông báo lớp học & deadline cập nhật giờ',
          },
          {
            icon: '🤖',
            title: 'Chatbot FAQ trả lời tự động 24/7',
          },
        ],
      },
    ],
  },

  finalCta: {
    eyebrow: 'Trở thành một phần của HTCAA',
    title: 'Đăng ký thành viên Hội',
    description:
      'Tham gia mạng lưới hơn 200 đại lý thuế và doanh nghiệp tư vấn hàng đầu TP.HCM. Cập nhật chính sách kịp thời, nâng cao chuyên môn và kết nối nghề nghiệp.',
    buttons: [
      {
        label: 'Đăng ký hội viên',
        href: '/dang-ky-hoi-vien',
        variant: 'gold',
      },
      {
        label: 'Tìm hiểu thêm về Hội',
        href: '/gioi-thieu',
        variant: 'outline',
      },
    ],
  },

  footer: {
    aboutTitle: 'Về HTCAA',
    aboutDescription:
      'Hội Tư vấn và Đại lý Thuế TP.HCM – tổ chức xã hội nghề nghiệp dưới sự quản lý nhà nước của Cục Thuế TP.HCM.',
    contact: {
      address: '311 Điện Biên Phủ (P.704, tầng 7), Phường 04, Quận 3, TP.HCM',
      phone: '070 768 9966',
      email: 'vanphong@htcaa.vn',
    },
    columns: [
      {
        title: 'Khám phá',
        links: [
          {
            label: 'Giới thiệu Hội',
            href: '/gioi-thieu',
          },
          {
            label: 'Tin tức & sự kiện',
            href: '/tin-tuc',
          },
          {
            label: 'Đào tạo',
            href: '/dao-tao',
          },
          {
            label: 'Danh bạ hội viên',
            href: '/danh-ba',
          },
          {
            label: 'Văn bản pháp luật',
            href: '/van-ban',
          },
          {
            label: 'FAQ thuế',
            href: '/faq',
          },
        ],
      },
      {
        title: 'Hội viên',
        links: [
          {
            label: 'Đăng ký hội viên',
            href: '/dang-ky-hoi-vien',
          },
          {
            label: 'Quyền lợi hội viên',
            href: '/quyen-loi-hoi-vien',
          },
          {
            label: 'Đăng nhập',
            href: '/dang-nhap',
          },
          {
            label: 'Tra cứu giờ tích lũy',
            href: '/tra-cuu-gio-tich-luy',
          },
          {
            label: 'Tài liệu nội bộ',
            href: '/tai-lieu-noi-bo',
          },
        ],
      },
    ],
    newsletter: {
      title: 'Theo dõi & nhận tin',
      description: 'Đăng ký nhận bản tin chính sách thuế hàng tuần.',
      placeholder: 'Email của bạn',
      buttonText: 'Đăng ký',
    },
    socials: [
      {
        key: 'facebook',
        href: '#',
      },
      {
        key: 'youtube',
        href: '#',
      },
      {
        key: 'zalo',
        href: '#',
      },
    ],
    copyright: '© 2026 HTCAA · Hội Tư vấn và Đại lý Thuế TP.HCM',
    bottomLinks: [
      {
        label: 'Chính sách bảo mật',
        href: '/chinh-sach-bao-mat',
      },
      {
        label: 'Điều khoản sử dụng',
        href: '/dieu-khoan-su-dung',
      },
      {
        label: 'Cookie',
        href: '/cookie',
      },
    ],
  },

  isActive: true,
};
