import { Injectable } from '@nestjs/common';
import { MinioService } from '../minio/minio.service';
import { ERROR_INFO, ERROR_RES } from '../../constants/error.const';

// Allowed category values — maps to MinIO folder prefix
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
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'At least one file is required',
          content: null,
        };
      }

      // Resolve folder from category, fall back to general
      const folder =
        (category && CATEGORY_FOLDER_MAP[category]) ?? DEFAULT_FOLDER;

      // Upload all files in parallel
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const result = await this.minioService.uploadFile(file, folder);
          // Attach a presigned URL immediately so FE can use it right away
          const withUrl = await this.minioService.attachPresignedUrl(result);
          return {
            originalName: file.originalname,
            objectName: withUrl.objectName,
            mimeType: file.mimetype,
            size: file.size,
            url: withUrl.url, // presigned URL — paste this into any field
          };
        }),
      );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: `Uploaded ${uploaded.length} file(s) successfully`,
        content: {
          files: uploaded, // array — even for a single file
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while uploading files: ${error.message}`,
        content: null,
      };
    }
  }
}
