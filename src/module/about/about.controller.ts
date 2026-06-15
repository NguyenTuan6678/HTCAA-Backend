import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AboutService } from './about.service';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { Role } from '../../utils/role/role';
import { CreateExecutiveBoardDto } from './dto/create-excutive-board.req';
import { UpdateExecutiveBoardDto } from './dto/update-excutve-board.req';
import { UpdateIntroductionDto } from './dto/update-introduction.req';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../users/auth/decorators/roles.decorator';

@ApiTags('About')
@Controller('about')
export class AboutController {
  constructor(private readonly aboutService: AboutService) {}

  @Get()
  findPublic() {
    return this.aboutService.findPublic();
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('authorization')
  @Patch('introduction')
  updateIntroduction(@Body() dto: UpdateIntroductionDto) {
    return this.aboutService.updateIntroduction(dto);
  }
  @Roles(Role.ADMIN, Role.EDITOR)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('authorization')
  @Post('executive-board')
  createExecutiveBoard(@Body() dto: CreateExecutiveBoardDto) {
    return this.aboutService.createExecutiveBoard(dto);
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('authorization')
  @Patch('executive-board/:id')
  updateExecutiveBoard(
    @Param('id') id: string,
    @Body() dto: UpdateExecutiveBoardDto,
  ) {
    return this.aboutService.updateExecutiveBoard(id, dto);
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('authorization')
  @Delete('executive-board/:id')
  deleteExecutiveBoard(@Param('id') id: string) {
    return this.aboutService.deleteExecutiveBoard(id);
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('authorization')
  @UseInterceptors(FileInterceptor('avatar'))
  @Patch('executive-board/:id/avatar')
  uploadAvatar(
    @Param('id') id: string,

    @UploadedFile()
    file: Express.Multer.File,
  ) {
    return this.aboutService.uploadAvatar(id, file);
  }
}
