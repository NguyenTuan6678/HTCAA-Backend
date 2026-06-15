import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { Role } from '../../utils/role/role';
import { AboutUsService } from './about.service';
import { UpdateAboutUsDto } from './dto/update-excutve-board.req';

@ApiTags('About Us')
@Controller('about-us')
export class AboutUsController {
  constructor(private readonly aboutUsService: AboutUsService) {}

  @Get()
  findPublic() {
    return this.aboutUsService.findPublic();
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('authorization')
  @Patch()
  update(@Body() dto: UpdateAboutUsDto) {
    return this.aboutUsService.update(dto);
  }
}
