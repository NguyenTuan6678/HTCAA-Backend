import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.req';
import { QueryCourseDto } from './dto/query-course.req';
import { CreateCourseCategoryDto } from './dto/create-course-category.req';
import { UpdateCourseCategoryDto } from './dto/update-course-category.req';
import { QueryCourseCategoryDto } from './dto/query-course-category.req';

import { Role } from '../../utils/role/role';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { UpdateCourseDto } from './dto/update-course.req';
import { CurrentUser } from '../../users/auth/decorators/current-user.decorator';

@ApiTags('Course')
@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get()
  @ApiOperation({ summary: 'Get courses' })
  findAll(@Query() query: QueryCourseDto) {
    return this.courseService.findAll(query);
  }

  // ==========================================
  // COURSE CATEGORY ENDPOINTS
  // ==========================================

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
}
