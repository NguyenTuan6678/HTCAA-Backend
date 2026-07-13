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
import { Response } from 'express';

import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.req';
import { UpdateDocumentDto } from './dto/update-document.req';
import { QueryDocumentDto } from './dto/query-document.req';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { CurrentUser } from '../../users/auth/decorators/current-user.decorator';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { Role } from '../../utils/role.enum';

const xlsxFileFilter = (req: any, file: Express.Multer.File, callback: any) => {
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  const allowedExtensions = ['.xlsx', '.xls'];
  const fileExt = extname(file.originalname).toLowerCase();

  const isValid =
    allowedMimeTypes.includes(file.mimetype) &&
    allowedExtensions.includes(fileExt);

  if (!isValid) {
    return callback(
      new BadRequestException('Only .xlsx and .xls files are allowed'),
      false,
    );
  }

  callback(null, true);
};

const uploadXlsxInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
  fileFilter: xlsxFileFilter,
});

@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // ─── PUBLIC ────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Public – get published documents list' })
  findPublic(@Query() query: QueryDocumentDto) {
    return this.documentsService.findPublic(query);
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – get all documents (any status)' })
  findAdmin(@Query() query: QueryDocumentDto) {
    return this.documentsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Public – get document detail by id' })
  @ApiParam({ name: 'id', description: 'Document id' })
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Public – download the .xlsx file' })
  @ApiParam({ name: 'id', description: 'Document id' })
  async download(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return this.documentsService.downloadFile(id, res);
  }

  // ─── ADMIN / EDITOR ────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – create document with .xlsx file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateDocumentDto })
  @UseInterceptors(uploadXlsxInterceptor)
  create(
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.create(userId, dto, file);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – update document metadata' })
  @ApiParam({ name: 'id', description: 'Document id' })
  @ApiBody({ type: UpdateDocumentDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.documentsService.update(id, userId, role, dto);
  }

  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – publish document' })
  @ApiParam({ name: 'id', description: 'Document id' })
  publish(@Param('id') id: string) {
    return this.documentsService.publish(id);
  }

  @Patch(':id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – unpublish document' })
  @ApiParam({ name: 'id', description: 'Document id' })
  unpublish(@Param('id') id: string) {
    return this.documentsService.unpublish(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – soft-delete document' })
  @ApiParam({ name: 'id', description: 'Document id' })
  delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.documentsService.delete(id, userId, role);
  }

  // ─── FILE REPLACE ──────────────────────────────────────────────────────────

  @Patch(':id/file')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – replace the .xlsx file' })
  @ApiParam({ name: 'id', description: 'Document id' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(uploadXlsxInterceptor)
  uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.documentsService.uploadFile(id, userId, role, file);
  }
}
