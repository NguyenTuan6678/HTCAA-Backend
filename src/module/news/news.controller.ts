import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { extname } from 'path';
import { memoryStorage } from 'multer';
import {
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';

import { NewsService } from './news.service';
import { Role } from '../../utils/role/role';

import { CreateNewsDto } from './dto/create-news.req';
import { UpdateNewsDto } from './dto/update-news.req';
import { QueryNewsDto } from './dto/query-news.req';
import { QueryAdminNewsDto } from './dto/query-admin-news.req';

import { CreateNewsCategoryDto } from './dto/create-news-category.req';
import { UpdateNewsCategoryDto } from './dto/update-news-category.req';
import { QueryNewsCategoryDto } from './dto/query-news-category.req';

import { CreateNewsCommentDto } from './dto/create-news-comment.req';
import { QueryNewsCommentDto } from './dto/query-news-comment.req';
import { UpdateNewsCommentDto } from './dto/update-news-comment.req';

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
        'Only JPG, JPEG, PNG and WEBP images are allowed',
      ),
      false,
    );
  }

  callback(null, true);
};

@ApiTags('News')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  @ApiOperation({ summary: 'Public get published news list' })
  findPublic(@Query() query: QueryNewsDto) {
    return this.newsService.findPublic(query);
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor get all news list' })
  findAdmin(@Query() query: QueryAdminNewsDto) {
    return this.newsService.findAdmin(query);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get news categories' })
  findCategories(@Query() query: QueryNewsCategoryDto) {
    return this.newsService.findCategories(query);
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor create news category' })
  createCategory(@Query() createNewsCategoryDto: CreateNewsCategoryDto) {
    return this.newsService.createCategory(createNewsCategoryDto);
  }

  @Put('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor update news category' })
  @ApiParam({ name: 'id', description: 'Category id' })
  @ApiBody({ type: UpdateNewsCategoryDto })
  updateCategory(
    @Param('id') id: string,
    @Body() updateNewsCategoryDto: UpdateNewsCategoryDto,
  ) {
    return this.newsService.updateCategory(id, updateNewsCategoryDto);
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor delete news category' })
  @ApiParam({ name: 'id', description: 'Category id' })
  deleteCategory(@Param('id') id: string) {
    return this.newsService.deleteCategory(id);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get comments by news id' })
  @ApiParam({ name: 'id', description: 'News id' })
  findCommentsByNewsId(
    @Param('id') id: string,
    @Query() query: QueryNewsCommentDto,
  ) {
    return this.newsService.findCommentsByNewsId(id, query);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Logged-in user comment on news' })
  @ApiParam({ name: 'id', description: 'News id' })
  createComment(
    @Param('id') id: string,
    @Query() createNewsCommentDto: CreateNewsCommentDto,
    @Req() request: Request,
  ) {
    const userId = (request as any).user.id;
    return this.newsService.createComment(id, userId, createNewsCommentDto);
  }

  @Put('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Update own comment' })
  @ApiParam({ name: 'commentId', description: 'Comment id' })
  @ApiBody({ type: UpdateNewsCommentDto })
  updateComment(
    @Param('commentId') commentId: string,
    @Body() updateNewsCommentDto: UpdateNewsCommentDto,
    @Req() request: Request,
  ) {
    const userId = (request as any).user.id;
    const role = (request as any).user.role;

    return this.newsService.updateComment(
      commentId,
      userId,
      role,
      updateNewsCommentDto,
    );
  }

  @Delete('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Delete own comment' })
  @ApiParam({ name: 'commentId', description: 'Comment id' })
  deleteComment(
    @Param('commentId') commentId: string,
    @Req() request: Request,
  ) {
    const userId = (request as any).user.id;
    const role = (request as any).user.role;

    return this.newsService.deleteComment(commentId, userId, role);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor create news' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['categoryId', 'title'],
      properties: {
        categoryId: { type: 'string', example: '665f1e8d7c1b2a0012a12345' },
        title: { type: 'string', example: 'Cập nhật chính sách thuế 2026' },
        summary: { type: 'string', example: 'Tóm tắt ngắn...' },
        content: { type: 'string', example: '<p>Nội dung bài viết...</p>' },
        tags: { type: 'array', items: { type: 'string' } },
        isFeatured: { type: 'boolean' },
        thumbnail: { type: 'string', format: 'binary' },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'thumbnail', maxCount: 1 },
        { name: 'images', maxCount: 10 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: imageFileFilter,
      },
    ),
  )
  create(
    @Body() createNewsDto: CreateNewsDto,
    @UploadedFiles()
    files: {
      thumbnail?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
    @Req() request: Request,
  ) {
    const userId = (request as any).user.id;
    const thumbnail = files?.thumbnail?.[0];
    const images = files?.images;
    return this.newsService.create(userId, createNewsDto, thumbnail, images);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor update news' })
  @ApiParam({ name: 'id', description: 'News id' })
  @ApiBody({ type: UpdateNewsDto })
  update(
    @Param('id') id: string,
    @Body() updateNewsDto: UpdateNewsDto,
    @Req() request: Request,
  ) {
    const userId = (request as any).user.id;
    const role = (request as any).user.role;

    return this.newsService.update(id, userId, role, updateNewsDto);
  }

  @Patch(':id/thumbnail')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor upload news thumbnail to MinIO' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'News id' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        thumbnail: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['thumbnail'],
    },
  })
  @UseInterceptors(
    FileInterceptor('thumbnail', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: imageFileFilter,
    }),
  )
  uploadThumbnail(
    @Param('id') id: string,
    @UploadedFile() thumbnail: Express.Multer.File,
    @Req() request: Request,
  ) {
    const userId = (request as any).user.id;
    const role = (request as any).user.role;

    return this.newsService.uploadThumbnail(id, userId, role, thumbnail);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor upload news images to MinIO' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'News id' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
      required: ['images'],
    },
  })
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: imageFileFilter,
    }),
  )
  uploadImages(
    @Param('id') id: string,
    @UploadedFiles() images: Express.Multer.File[],
    @Req() request: Request,
  ) {
    const userId = (request as any).user.id;
    const role = (request as any).user.role;

    return this.newsService.uploadImages(id, userId, role, images);
  }

  @Delete(':id/thumbnail')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor delete news thumbnail from MinIO' })
  @ApiParam({ name: 'id', description: 'News id' })
  deleteThumbnail(@Param('id') id: string, @Req() request: Request) {
    const userId = (request as any).user.id;
    const role = (request as any).user.role;

    return this.newsService.deleteThumbnail(id, userId, role);
  }

  @Delete(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor delete news image from MinIO' })
  @ApiParam({ name: 'id', description: 'News id' })
  @ApiQuery({
    name: 'objectName',
    required: true,
    example: 'news/images/1770000000-123456-image.jpg',
  })
  deleteImage(
    @Param('id') id: string,
    @Query('objectName') objectName: string,
    @Req() request: Request,
  ) {
    const userId = (request as any).user.id;
    const role = (request as any).user.role;

    return this.newsService.deleteImage(id, userId, role, objectName);
  }

  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor publish news' })
  @ApiParam({ name: 'id', description: 'News id' })
  publish(@Param('id') id: string) {
    return this.newsService.publish(id);
  }

  @Patch(':id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor unpublish news' })
  @ApiParam({ name: 'id', description: 'News id' })
  unpublish(@Param('id') id: string) {
    return this.newsService.unpublish(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor delete news' })
  @ApiParam({ name: 'id', description: 'News id' })
  delete(@Param('id') id: string, @Req() request: Request) {
    const userId = (request as any).user.id;
    const role = (request as any).user.role;

    return this.newsService.delete(id, userId, role);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Public get published news detail by slug' })
  @ApiParam({ name: 'slug', example: 'cap-nhat-chinh-sach-thue-2026' })
  findBySlug(@Param('slug') slug: string) {
    return this.newsService.findBySlug(slug);
  }
}
