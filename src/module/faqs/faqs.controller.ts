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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { FaqsService } from './faqs.service';
import { CreateFaqDto } from './dto/create-faq.req';
import { UpdateFaqDto } from './dto/update-faq.req';
import { QueryFaqDto } from './dto/query-faq.req';
import { CreateFaqCategoryDto } from './dto/create-faq-category.req';
import { UpdateFaqCategoryDto } from './dto/update-faq-category.req';
import { QueryFaqCategoryDto } from './dto/query-faq-category.req';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { CurrentUser } from '../../users/auth/decorators/current-user.decorator';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { Role } from '../../utils/role.enum';

@ApiTags('FAQs')
@Controller('faqs')
export class FaqsController {
  constructor(private readonly faqsService: FaqsService) {}

  // ─── PUBLIC ────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Public – get published FAQs list' })
  findPublic(@Query() query: QueryFaqDto) {
    return this.faqsService.findPublic(query);
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – get all FAQs (any status)' })
  findAdmin(@Query() query: QueryFaqDto) {
    return this.faqsService.findAll(query);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Public – get active FAQ categories' })
  findCategories(@Query() query: QueryFaqCategoryDto) {
    return this.faqsService.findCategories(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Public – get FAQ detail by id' })
  @ApiParam({ name: 'id', description: 'FAQ id' })
  findOne(@Param('id') id: string) {
    return this.faqsService.findOne(id);
  }

  // ─── ADMIN / EDITOR ────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – create FAQ' })
  create(@Body() dto: CreateFaqDto, @CurrentUser('id') userId: string) {
    return this.faqsService.create(userId, dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – update FAQ' })
  @ApiParam({ name: 'id', description: 'FAQ id' })
  @ApiBody({ type: UpdateFaqDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFaqDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.faqsService.update(id, userId, role, dto);
  }

  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – publish FAQ' })
  @ApiParam({ name: 'id', description: 'FAQ id' })
  publish(@Param('id') id: string) {
    return this.faqsService.publish(id);
  }

  @Patch(':id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – unpublish FAQ' })
  @ApiParam({ name: 'id', description: 'FAQ id' })
  unpublish(@Param('id') id: string) {
    return this.faqsService.unpublish(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – delete FAQ' })
  @ApiParam({ name: 'id', description: 'FAQ id' })
  delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.faqsService.delete(id, userId, role);
  }

  // ─── LIKES / DISLIKES (logged-in users) ───────────────────────────────────

  @Patch(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary: 'Logged-in user – toggle like on a FAQ (call again to unlike)',
  })
  @ApiParam({ name: 'id', description: 'FAQ id' })
  like(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.faqsService.like(id, userId);
  }

  @Patch(':id/dislike')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary:
      'Logged-in user – toggle dislike on a FAQ (call again to un-dislike)',
  })
  @ApiParam({ name: 'id', description: 'FAQ id' })
  dislike(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.faqsService.dislike(id, userId);
  }

  // ─── FAQ CATEGORIES ────────────────────────────────────────────────────────

  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – create FAQ category' })
  createCategory(@Body() dto: CreateFaqCategoryDto) {
    return this.faqsService.createCategory(dto);
  }

  @Put('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – update FAQ category' })
  @ApiParam({ name: 'id', description: 'FAQ Category id' })
  @ApiBody({ type: UpdateFaqCategoryDto })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateFaqCategoryDto) {
    return this.faqsService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – delete FAQ category' })
  @ApiParam({ name: 'id', description: 'FAQ Category id' })
  deleteCategory(@Param('id') id: string) {
    return this.faqsService.deleteCategory(id);
  }
}
