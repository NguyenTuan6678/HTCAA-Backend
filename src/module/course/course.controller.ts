import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Patch,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
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

import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.req';
import { QueryCourseDto } from './dto/query-course.req';
import { CreateCourseCategoryDto } from './dto/create-course-category.req';
import { UpdateCourseCategoryDto } from './dto/update-course-category.req';
import { QueryCourseCategoryDto } from './dto/query-course-category.req';
import { Role } from '../../utils/role.enum';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { UpdateCourseDto } from './dto/update-course.req';
import { CurrentUser } from '../../users/auth/decorators/current-user.decorator';

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

@ApiTags('Course')
@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get()
  @ApiOperation({ summary: 'Get courses' })
  findAll(@Query() query: QueryCourseDto) {
    return this.courseService.findAll(query);
  }

  // ─── COURSE CATEGORIES ────────────────────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'Get course categories' })
  findCategories(@Query() query: QueryCourseCategoryDto) {
    return this.courseService.findCategories(query);
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor create course category' })
  createCategory(@Body() dto: CreateCourseCategoryDto) {
    return this.courseService.createCategory(dto);
  }

  @Patch('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor update course category' })
  @ApiParam({ name: 'id', description: 'Category id' })
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCourseCategoryDto,
  ) {
    return this.courseService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor delete course category' })
  @ApiParam({ name: 'id', description: 'Category id' })
  deleteCategory(@Param('id') id: string) {
    return this.courseService.deleteCategory(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor create course' })
  create(
    @Body() createCourseDto: CreateCourseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.courseService.create(userId, createCourseDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor update course' })
  @ApiParam({ name: 'id', description: 'Course id' })
  @ApiBody({ type: UpdateCourseDto })
  update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto) {
    return this.courseService.update(id, updateCourseDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor delete course' })
  @ApiParam({ name: 'id', description: 'Course id' })
  delete(@Param('id') id: string) {
    return this.courseService.delete(id);
  }

  @Post(':id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – Upload course image' })
  @ApiParam({ name: 'id', description: 'Course id' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: imageFileFilter,
    }),
  )
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng tải lên file ảnh khóa học.');
    }
    return this.courseService.uploadImage(id, file);
  }
}
