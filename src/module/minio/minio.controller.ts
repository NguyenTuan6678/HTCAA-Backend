import { Controller, Get, Req, Res, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { MinioService } from './minio.service';

// Prefix to strip from the raw URL: '/api/media/'
const MEDIA_PREFIX = '/api/media/';

@Controller('media')
export class MinioController {
  constructor(private readonly minioService: MinioService) {}

  @Get('*path')
  async getMedia(@Req() req: Request, @Res() res: Response) {
    // req.url may include a query string (e.g. /api/media/folder/file.jpg?foo=bar)
    // We strip both the prefix and any query string to get the bare object name.
    const rawUrl = req.url.split('?')[0]; // remove query string
    const objectName = rawUrl.startsWith(MEDIA_PREFIX)
      ? rawUrl.slice(MEDIA_PREFIX.length)
      : rawUrl.replace(/^\/+/, ''); // fallback: strip leading slashes

    if (!objectName) {
      throw new NotFoundException('Object name not provided or invalid');
    }

    const url = await this.minioService.getRealPresignedUrl(objectName);
    if (!url) {
      throw new NotFoundException('File not found');
    }

    return res.redirect(url);
  }
}
