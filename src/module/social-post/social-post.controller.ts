import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { extname } from 'path';

import { SocialPostService } from './social-post.service';
import { CreateSocialPostDto } from './dto/create-social-post.req';
import { UpdateSocialPostDto } from './dto/update-social-post.req';
import { PinSocialPostDto } from './dto/pin-social-post.req';
import { QuerySocialPostDto } from './dto/query-social-post.req';
import { Role } from '../../utils/role.enum';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';

const imageFileFilter = (
  req: any,
  file: Express.Multer.File,
  callback: any,
) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const fileExt = extname(file.originalname).toLowerCase();

  const isValid =
    allowedMimeTypes.includes(file.mimetype) &&
    allowedExtensions.includes(fileExt);

  if (!isValid) {
    return callback(
      new BadRequestException(
        'Chỉ cho phép tải lên hình ảnh định dạng JPG, JPEG, PNG hoặc WEBP',
      ),
      false,
    );
  }

  callback(null, true);
};

@ApiTags('SocialPost')
@Controller('social-posts')
export class SocialPostController {
  constructor(private readonly socialPostService: SocialPostService) {}

  // ─── PUBLIC  ────────────────────────────────────────────────────────────────

  @Get('homepage')
  @ApiOperation({ summary: 'Public – Get pinned social posts for homepage' })
  findHomepage() {
    return this.socialPostService.findHomepage();
  }

  // ─── ADMIN  ────────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – Create a new social post' })
  create(@Body() dto: CreateSocialPostDto) {
    return this.socialPostService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary: 'Admin/editor – List all social posts with pagination & filtering',
  })
  findAll(@Query() query: QuerySocialPostDto) {
    return this.socialPostService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – Get social post details' })
  @ApiParam({ name: 'id', description: 'Social post ID' })
  findOne(@Param('id') id: string) {
    return this.socialPostService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – Update social post content' })
  @ApiParam({ name: 'id', description: 'Social post ID' })
  update(@Param('id') id: string, @Body() dto: UpdateSocialPostDto) {
    return this.socialPostService.update(id, dto);
  }

  @Patch(':id/pin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – Pin/unpin a social post' })
  @ApiParam({ name: 'id', description: 'Social post ID' })
  pin(@Param('id') id: string, @Body() dto: PinSocialPostDto) {
    return this.socialPostService.pin(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – Soft delete a social post' })
  @ApiParam({ name: 'id', description: 'Social post ID' })
  delete(@Param('id') id: string) {
    return this.socialPostService.delete(id);
  }

  @Post(':id/thumbnail')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary: 'Admin/editor – Upload thumbnail for a social post',
  })
  @ApiParam({ name: 'id', description: 'Social post ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        thumbnail: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('thumbnail', {
      storage: memoryStorage(),
      limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
      fileFilter: imageFileFilter,
    }),
  )
  uploadThumbnail(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Vui lòng tải lên file hình ảnh thumbnail.',
      );
    }
    return this.socialPostService.uploadThumbnail(id, file);
  }
}
