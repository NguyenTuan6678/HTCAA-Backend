import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { Request } from 'express';

import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { Role } from '../../utils/role.enum';
import { UploadService } from './upload.service';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
  '.pdf',
  '.doc',
  '.docx',
];

const fileFilter = (req: any, file: Express.Multer.File, callback: any) => {
  const fileExt = extname(file.originalname).toLowerCase();
  const isValid =
    ALLOWED_MIME_TYPES.includes(file.mimetype) &&
    ALLOWED_EXTENSIONS.includes(fileExt);

  if (!isValid) {
    return callback(
      new BadRequestException(
        `File type not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`,
      ),
      false,
    );
  }

  callback(null, true);
};

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('file')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary:
      'Upload one or multiple files to MinIO, returns URL(s) for use in other APIs',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'category'],
      properties: {
        // multer key is 'file', FE sends one or more files under this key
        file: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        // category controls which MinIO folder the files land in
        category: {
          type: 'string',
          example: 'about-us',
          enum: ['about-us', 'news', 'legal-docs', 'general'],
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('file', 20, {
      // up to 20 files at once
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
      fileFilter,
    }),
  )
  uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    const category = (req.body as any).category;
    return this.uploadService.uploadFiles(files, category);
  }
}
