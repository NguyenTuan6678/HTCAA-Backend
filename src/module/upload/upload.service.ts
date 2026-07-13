import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import { MinioService } from '../minio/minio.service';
import { ERROR_INFO, ERROR_RES } from '../../constants/error.const';

const CATEGORY_FOLDER_MAP: Record<string, string> = {
  'about-us': 'about-us/images',
  news: 'news/images',
  'legal-docs': 'legal-docs/files',
  general: 'general',
};

const DEFAULT_FOLDER = 'general';

@Injectable()
export class UploadService {
  constructor(private readonly minioService: MinioService) {}

  async uploadFiles(files: Express.Multer.File[], category?: string) {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException('At least one file is required');
      }

      const folder =
        (category && CATEGORY_FOLDER_MAP[category]) ?? DEFAULT_FOLDER;

      const uploaded = await Promise.all(
        files.map(async (file) => {
          const result = await this.minioService.uploadFile(file, folder);
          const withUrl = await this.minioService.attachPresignedUrl(result);
          return {
            originalName: file.originalname,
            objectName: withUrl.objectName,
            mimeType: file.mimetype,
            size: file.size,
            url: withUrl.url,
          };
        }),
      );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: `Uploaded ${uploaded.length} file(s) successfully`,
        content: {
          files: uploaded,
        },
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `There is a problem while uploading files: ${error.message}`,
      );
    }
  }
}
