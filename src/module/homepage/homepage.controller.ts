import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
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

import { HomepageService } from './homepage.service';
import { UpdateHomepageSettingDto } from './dto/update-homepage-setting.req';

import { Role } from '../../utils/role/role';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';

const imageFileFilter = (file: Express.Multer.File, callback: any) => {
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

@ApiTags('Homepage')
@Controller('homepage')
export class HomepageController {
  constructor(private readonly homepageService: HomepageService) {}

  @Get()
  @ApiOperation({ summary: 'Public get homepage data' })
  findPublic() {
    return this.homepageService.findPublic();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor get homepage setting' })
  findAdmin() {
    return this.homepageService.findAdmin();
  }

  @Post('seed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin seed homepage default setting' })
  seedHomepageSetting() {
    return this.homepageService.seedHomepageSetting();
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor update homepage setting' })
  @ApiBody({ type: UpdateHomepageSettingDto })
  update(@Body() updateHomepageSettingDto: UpdateHomepageSettingDto) {
    return this.homepageService.update(updateHomepageSettingDto);
  }

  @Patch('reset')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin reset homepage setting to default' })
  resetToDefault() {
    return this.homepageService.resetToDefault();
  }

  @Patch(':section')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor update homepage section' })
  @ApiParam({
    name: 'section',
    example: 'hero',
  })
  updateSection(
    @Body() data: Record<string, any>,
    @Param('section') section: string,
  ) {
    return this.homepageService.updateSection(section, data);
  }

  @Patch('media/hero-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor upload homepage hero image' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'object',
          properties: {
            objectName: { type: 'string' },
            originalName: { type: 'string' },
            mimeType: { type: 'string' },
            size: { type: 'number' },
          },
        },
      },
      required: ['image'],
    },
  })
  uploadHeroImage(@Body('image') image: any) {
    return this.homepageService.uploadHeroImage(image);
  }

  @Patch('media/president-avatar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor upload president avatar' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'object',
          properties: {
            objectName: { type: 'string' },
            originalName: { type: 'string' },
            mimeType: { type: 'string' },
            size: { type: 'number' },
          },
        },
      },
      required: ['image'],
    },
  })
  uploadPresidentAvatar(@Body('image') image: any) {
    return this.homepageService.uploadPresidentAvatar(image);
  }

  @Patch('media/zalo-qr')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor upload Zalo QR image' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'object',
          properties: {
            objectName: { type: 'string' },
            originalName: { type: 'string' },
            mimeType: { type: 'string' },
            size: { type: 'number' },
          },
        },
      },
      required: ['image'],
    },
  })
  uploadZaloQr(@Body('image') image: any) {
    return this.homepageService.uploadZaloQr(image);
  }
}
