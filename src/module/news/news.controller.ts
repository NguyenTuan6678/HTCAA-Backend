import {
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

import { NewsService } from './news.service';

import { Role } from '../../utils/role/role';

import { CreateNewsDto } from './dto/create-news.req';
import { UpdateNewsDto } from './dto/update-news.req';
import { QueryNewsDto } from './dto/query-news.req';
import { QueryAdminNewsDto } from './dto/query-admin-news.req';

import { CreateNewsCategoryDto } from './dto/create-news-category.req';
import { UpdateNewsCategoryDto } from './dto/update-news-category.req';
import { QueryNewsCategoryDto } from './dto/query-news-category.req';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';

@ApiTags('News')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  // =========================
  // PUBLIC NEWS
  // =========================

  @Get()
  @ApiOperation({ summary: 'Public get published news list' })
  findPublic(@Query() query: QueryNewsDto) {
    return this.newsService.findPublic(query);
  }

  // =========================
  // ADMIN NEWS LIST
  // =========================

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor get all news list' })
  findAdmin(@Query() query: QueryAdminNewsDto) {
    return this.newsService.findAdmin(query);
  }

  // =========================
  // NEWS CATEGORIES
  // Đặt trước @Get(':slug')
  // =========================

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
  @ApiBody({ type: CreateNewsCategoryDto })
  createCategory(@Body() createCategoryDto: CreateNewsCategoryDto) {
    return this.newsService.createCategory(createCategoryDto);
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
    @Body() updateCategoryDto: UpdateNewsCategoryDto,
  ) {
    return this.newsService.updateCategory(id, updateCategoryDto);
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

  // =========================
  // NEWS DETAIL
  // Đặt sau /categories và /admin
  // =========================

  @Get(':slug')
  @ApiOperation({ summary: 'Public get published news detail by slug' })
  @ApiParam({ name: 'slug', example: 'cap-nhat-chinh-sach-thue-2026' })
  findBySlug(@Param('slug') slug: string) {
    return this.newsService.findBySlug(slug);
  }

  // =========================
  // ADMIN / EDITOR NEWS ACTIONS
  // =========================

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor create news' })
  @ApiBody({ type: CreateNewsDto })
  create(@Body() createNewsDto: CreateNewsDto, @Req() request: Request) {
    const userId = (request as any).user.id;
    return this.newsService.create(userId, createNewsDto);
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
}
