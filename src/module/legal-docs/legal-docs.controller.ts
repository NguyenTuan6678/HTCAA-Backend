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
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { Request, Response } from 'express';
import { LegalDocsService } from './legal-docs.service';
import { Role } from '../../utils/role/role';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { CurrentUser } from '../../users/auth/decorators/current-user.decorator';
import { CreateLegalDocDto } from './dto/create-legal-docs.req';
import { QueryLegalDocDto } from './dto/query-legal-docs.req';
import { UpdateLegalDocDto } from './dto/update-legal.docs.req';
import { CreateLegalDocCategoryDto } from './dto/create-legal-docs-category.req';
import { UpdateLegalDocCategoryDto } from './dto/update-legal-docs-category.req';
import { QueryLegalDocCategoryDto } from './dto/query-legal-docs-category.req';
import { UpdateTypeCategoryDto } from './dto/update-type-category.req';
import { QueryTypeCategoryDto } from './dto/query-type-category.req';
import { CreateTypeCategoryDto } from './dto/create-type-category.req';

const docFileFilter = (req: any, file: Express.Multer.File, callback: any) => {
  const allowedMimeTypes = ['application/pdf'];
  const allowedExtensions = ['.pdf'];
  const fileExt = extname(file.originalname).toLowerCase();

  const isValid =
    allowedMimeTypes.includes(file.mimetype) &&
    allowedExtensions.includes(fileExt);

  if (!isValid) {
    return callback(
      new BadRequestException('Only PDF files are allowed'),
      false,
    );
  }

  callback(null, true);
};

const uploadDocInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: docFileFilter,
});

@ApiTags('Legal Docs')
@Controller('legal-docs')
export class LegalDocsController {
  constructor(private readonly legalDocsService: LegalDocsService) {}

  // ─── PUBLIC ────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Public – get published legal docs list' })
  findPublic(@Query() query: QueryLegalDocDto) {
    return this.legalDocsService.findPublic(query);
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – get all legal docs (any status)' })
  findAdmin(@Query() query: QueryLegalDocDto) {
    return this.legalDocsService.findAll(query);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get legal doc categories' })
  findCategories(@Query() query: QueryLegalDocCategoryDto) {
    return this.legalDocsService.findCategories(query);
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor create legal doc category' })
  createCategory(
    @Body() createLegalDocCategoryDto: CreateLegalDocCategoryDto,
  ) {
    return this.legalDocsService.createCategory(createLegalDocCategoryDto);
  }

  @Put('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor update legal doc category' })
  @ApiParam({ name: 'id', description: 'Category id' })
  @ApiBody({ type: UpdateLegalDocCategoryDto })
  updateCategory(
    @Param('id') id: string,
    @Body() updateLegalDocCategoryDto: UpdateLegalDocCategoryDto,
  ) {
    return this.legalDocsService.updateCategory(id, updateLegalDocCategoryDto);
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor delete legal doc category' })
  @ApiParam({ name: 'id', description: 'Category id' })
  deleteCategory(@Param('id') id: string) {
    return this.legalDocsService.deleteCategory(id);
  }

  // ─── TYPE ────────────────────────────────────────────────────────────────

  @Get('type-categories')
  @ApiOperation({ summary: 'Get legal doc categories' })
  findTypeCategories(@Query() query: QueryTypeCategoryDto) {
    return this.legalDocsService.findTypeCategories(query);
  }

  @Post('type-categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor create legal doc category' })
  createTypeCategory(@Body() createTypeCategoryDto: CreateTypeCategoryDto) {
    return this.legalDocsService.createTypeCategory(createTypeCategoryDto);
  }

  @Put('type-categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor update legal doc category' })
  @ApiParam({ name: 'id', description: 'Category id' })
  @ApiBody({ type: UpdateLegalDocCategoryDto })
  updateTypeCategory(
    @Param('id') id: string,
    @Body() updateTypeCategoryDto: UpdateTypeCategoryDto,
  ) {
    return this.legalDocsService.updateTypeCategory(id, updateTypeCategoryDto);
  }

  @Delete('type-categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor delete type category' })
  @ApiParam({ name: 'id', description: 'Type category id' })
  deleteTypeCategory(@Param('id') id: string) {
    return this.legalDocsService.deleteTypeCategory(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Public – get legal doc detail by id' })
  @ApiParam({ name: 'id', description: 'Legal doc id' })
  findOne(@Param('id') id: string) {
    return this.legalDocsService.findOne(id);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Public – preview (inline) the attached file' })
  @ApiParam({ name: 'id', description: 'Legal doc id' })
  async preview(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return this.legalDocsService.streamFile(id, 'inline', res);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Public – download the attached file' })
  @ApiParam({ name: 'id', description: 'Legal doc id' })
  async download(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return this.legalDocsService.streamFile(id, 'attachment', res);
  }

  // ─── ADMIN / EDITOR ────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary: 'Admin/editor – create legal doc with optional file',
  })
  @ApiBody({ type: CreateLegalDocDto })
  create(
    @Body() dto: CreateLegalDocDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.legalDocsService.create(userId, dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – update legal doc metadata' })
  @ApiParam({ name: 'id', description: 'Legal doc id' })
  @ApiBody({ type: UpdateLegalDocDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLegalDocDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.legalDocsService.update(id, userId, role, dto);
  }

  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – publish a legal doc' })
  @ApiParam({ name: 'id', description: 'Legal doc id' })
  publish(@Param('id') id: string) {
    return this.legalDocsService.publish(id);
  }

  @Patch(':id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – unpublish a legal doc' })
  @ApiParam({ name: 'id', description: 'Legal doc id' })
  unpublish(@Param('id') id: string) {
    return this.legalDocsService.unpublish(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – soft-delete a legal doc' })
  @ApiParam({ name: 'id', description: 'Legal doc id' })
  delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.legalDocsService.delete(id, userId, role);
  }

  // ─── FILE MANAGEMENT ───────────────────────────────────────────────────────

  @Patch(':id/file')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary:
      'Admin/editor – replace the document file (PDF/DOC/DOCX)',
  })
  @ApiParam({ name: 'id', description: 'Legal doc id' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'object',
          properties: {
            objectName: { type: 'string' },
            originalName: { type: 'string' },
            mimeType: { type: 'string' },
            size: { type: 'number' },
          },
        },
      },
    },
  })
  uploadFile(
    @Param('id') id: string,
    @Body('file') file: any,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.legalDocsService.uploadFile(id, userId, role, file);
  }

  @Delete(':id/file')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary: 'Admin/editor – remove the attached file from MinIO',
  })
  @ApiParam({ name: 'id', description: 'Legal doc id' })
  deleteFile(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.legalDocsService.deleteFile(id, userId, role);
  }
}
