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
import { CreateLegalDocDto } from './dto/create-legal-docs.req';
import { QueryLegalDocDto } from './dto/query-legal-docs.req';
import { UpdateLegalDocDto } from './dto/update-legal.docs.req';

// Accept PDF, DOC, DOCX only
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

  @Get(':id')
  @ApiOperation({ summary: 'Public – get legal doc detail by id' })
  @ApiParam({ name: 'id', description: 'Legal doc id' })
  findOne(@Param('id') id: string) {
    return this.legalDocsService.findOne(id);
  }

  /**
   * Preview endpoint – streams the file inline so browsers can render it
   * without downloading (e.g. PDF viewer, Google Docs Viewer fallback).
   */
  @Get(':id/preview')
  @ApiOperation({ summary: 'Public – preview (inline) the attached file' })
  @ApiParam({ name: 'id', description: 'Legal doc id' })
  async preview(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | object> {
    return this.legalDocsService.streamFile(id, 'inline', res);
  }

  /**
   * Download endpoint – streams the file as an attachment so the browser
   * triggers a Save-As dialog.
   */
  @Get(':id/download')
  @ApiOperation({ summary: 'Public – download the attached file' })
  @ApiParam({ name: 'id', description: 'Legal doc id' })
  async download(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | object> {
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
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'type'],
      properties: {
        title: { type: 'string', example: 'Hợp đồng lao động 2026' },
        type: { type: 'string', example: 'Hợp đồng' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: docFileFilter,
    }),
  )
  create(
    @Body() dto: CreateLegalDocDto,
    @UploadedFile() file: Express.Multer.File, // ← new
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    return this.legalDocsService.create(userId, dto, file); // ← pass file
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
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const role = (req as any).user.role;
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
  delete(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user.id;
    const role = (req as any).user.role;
    return this.legalDocsService.delete(id, userId, role);
  }

  // ─── FILE MANAGEMENT ───────────────────────────────────────────────────────

  @Patch(':id/file')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary:
      'Admin/editor – upload (or replace) the document file (PDF/DOC/DOCX)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Legal doc id' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(uploadDocInterceptor)
  uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const role = (req as any).user.role;
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
  deleteFile(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user.id;
    const role = (req as any).user.role;
    return this.legalDocsService.deleteFile(id, userId, role);
  }
}
