import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityRedirectMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const url = req.originalUrl || req.url;
    const acceptHeader = req.headers['accept'] || '';
    const isProduction = process.env.NODE_ENV === 'production';
    const redirectUrl = 'https://youtu.be/dQw4w9WgXcQ?si=ErbTfdLufAIS0Mzl'; // Rickroll YouTube link

    // 1. Chuyển hướng Swagger Docs ở môi trường production
    const isSwaggerPath = url.startsWith('/api/docs') || url === '/api/docs-json';
    const isGenericDocsPath = url === '/docs' || url === '/docs/';

    if (isProduction && (isSwaggerPath || isGenericDocsPath)) {
      return res.redirect(redirectUrl);
    }

    if (!isProduction && isGenericDocsPath) {
      // Ở môi trường dev, chuyển hướng /docs về /api/docs cho tiện sử dụng
      return res.redirect('/api/docs');
    }

    // 2. Chuyển hướng các đường dẫn honeypot / web scanners phổ biến
    const honeypotPatterns = [
      /wp-admin/i,
      /wp-login/i,
      /xmlrpc/i,
      /phpmyadmin/i,
      /\.env/i,
      /\.git/i,
      /config/i,
      /actuator/i,
      /setup\.php/i,
      /install\.php/i,
    ];

    const isHoneypot = honeypotPatterns.some((pattern) => pattern.test(url));
    if (isHoneypot) {
      return res.redirect(redirectUrl);
    }

    // 3. Nếu truy cập trực tiếp bằng trình duyệt (Accept: text/html)
    // nhưng không phải là Swagger Docs (khi ở dev) và không phải tài nguyên tĩnh
    const isHtmlRequest = acceptHeader.includes('text/html');
    const isStaticAsset = url.startsWith('/uploads');

    if (isHtmlRequest && !isSwaggerPath && !isStaticAsset) {
      return res.redirect(redirectUrl);
    }

    next();
  }
}
