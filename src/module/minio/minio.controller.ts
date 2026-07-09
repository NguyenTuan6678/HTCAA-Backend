import { Controller, Get, Req, Res, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { MinioService } from './minio.service';

@ApiTags('Media')
@Controller('media')
export class MinioController {
  constructor(private readonly minioService: MinioService) {}

  @Get('*path')
  @ApiOperation({
    summary: 'Get presigned URL for a MinIO object and redirect',
  })
  async getMedia(@Req() req: Request, @Res() res: Response) {
    // Use req.originalUrl which always contains the full, real request path.
    // Example: /api/media/general/1782444424623-113024832-11111.jpg?v=1
    const fullPath = (req.originalUrl || req.url).split('?')[0];
    const prefix = '/api/media/';
    const objectName = fullPath.startsWith(prefix)
      ? decodeURIComponent(fullPath.slice(prefix.length))
      : null;

    if (!objectName) {
      throw new NotFoundException('Object name not provided or invalid');
    }

    const url = await this.minioService.getRealPresignedUrl(objectName);
    if (!url) {
      throw new NotFoundException('File not found in storage');
    }

    return res.redirect(url);
  }
}
