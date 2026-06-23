import { Controller, Get, Req, Res, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { MinioService } from './minio.service';

@Controller('media')
export class MinioController {
  constructor(private readonly minioService: MinioService) {}

  @Get('*path')
  async getMedia(@Req() req: Request, @Res() res: Response) {
    const objectName = req.params['path'];
    if (typeof objectName !== 'string') {
      throw new NotFoundException('Object name not provided or invalid');
    }
    const url = await this.minioService.getRealPresignedUrl(objectName);
    if (!url) {
      throw new NotFoundException('File not found');
    }
    return res.redirect(url);
  }
}
