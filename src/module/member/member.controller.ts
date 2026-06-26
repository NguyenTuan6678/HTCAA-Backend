import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { Role } from '../../utils/role/role';
import { MemberService } from './member.service';
import { RegisterMemberDto } from './dto/register-member.req';
import { UpdateMemberDto } from './dto/update-member.req';
import { QueryMemberDirectoryDto } from './dto/query-member-directory.req';
import { RejectMemberDto } from './dto/reject-member.req';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { CurrentUser } from '../../users/auth/decorators/current-user.decorator';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { QueryAdminMemberDto } from './dto/query-admin-member.req';

const memberUploadDir = join(process.cwd(), 'uploads', 'members');

if (!fs.existsSync(memberUploadDir)) {
  fs.mkdirSync(memberUploadDir, { recursive: true });
}

const pdfFileFilter = (
  req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  const isPdf =
    file.mimetype === 'application/pdf' ||
    extname(file.originalname).toLowerCase() === '.pdf';

  if (!isPdf) {
    return callback(
      new BadRequestException('Only PDF files are allowed') as any,
      false,
    );
  }

  callback(null, true);
};

@ApiTags('Member')
@Controller('member')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Register member profile' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Nguyễn Văn An' },
        dateOfBirth: { type: 'string', example: '1998-01-01' },
        email: { type: 'string', example: 'user@example.com' },
        phone: { type: 'string', example: '0900000000' },
        certificateNumber: { type: 'string', example: 'ĐLTCC-0001/TCT' },
        workplace: { type: 'string', example: 'Công ty ABC' },
        district: { type: 'string', example: 'Quận 1' },
        memberType: {
          type: 'string',
          enum: ['individual', 'organization'],
          example: 'individual',
        },
        paymentMethod: {
          type: 'string',
          enum: ['vnpay', 'bank'],
          example: 'bank',
        },
        organizationName: {
          type: 'string',
          example: 'Công ty TNHH Tư vấn Thuế ABC',
        },
        organizationTaxCode: {
          type: 'string',
          example: '0123456789',
        },
        organizationEmployeeScale: {
          type: 'string',
          example: '2–5 người',
        },
        profileFile: {
          type: 'string',
          format: 'binary',
          description: 'Optional PDF file, max 5MB',
        },
      },
      required: [
        'name',
        'dateOfBirth',
        'email',
        'phone',
        'certificateNumber',
        'memberType',
        'paymentMethod',
      ],
    },
  })
  @UseInterceptors(
    FileInterceptor('profileFile', {
      storage: diskStorage({
        destination: memberUploadDir,
        filename: (req, file, callback) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(
            Math.random() * 1e9,
          )}`;

          callback(null, `member-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: pdfFileFilter,
    }),
  )
  register(
    @Body() registerMemberDto: RegisterMemberDto,
    @UploadedFile() profileFile: Express.Multer.File | undefined,
    @CurrentUser('id') userId: string,
  ) {
    return this.memberService.register(userId, registerMemberDto, profileFile);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Get my member profile' })
  me(@CurrentUser('id') userId: string) {
    return this.memberService.me(userId);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Update my member profile' })
  updateMe(
    @Body() updateMemberDto: UpdateMemberDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.memberService.updateMe(userId, updateMemberDto);
  }

  @Get('directory')
  @ApiOperation({ summary: 'Get member directory' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'district', required: false })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  directory(@Query() query: QueryMemberDirectoryDto) {
    return this.memberService.directory(query);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin get all member profiles' })
  adminFindAll(@Query() query: QueryAdminMemberDto) {
    return this.memberService.adminFindAll(query);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Approve member profile' })
  @ApiParam({ name: 'id', description: 'Member id' })
  approve(@Param('id') id: string, @CurrentUser('id') adminId: string) {
    return this.memberService.approve(id, adminId);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Reject member profile' })
  @ApiParam({ name: 'id', description: 'Member id' })
  @ApiBody({ type: RejectMemberDto })
  reject(
    @Param('id') id: string,
    @Body() rejectMemberDto: RejectMemberDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.memberService.reject(id, adminId, rejectMemberDto);
  }

  @Patch(':id/expire')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Expire member profile' })
  @ApiParam({ name: 'id', description: 'Member id' })
  expire(@Param('id') id: string) {
    return this.memberService.expire(id);
  }
}
