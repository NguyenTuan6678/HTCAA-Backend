import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { Role } from '../../utils/role/role';
import { RegistrationService } from './registration.service';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { CurrentUser } from '../../users/auth/decorators/current-user.decorator';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { CancelRegistrationDto } from './dto/cancel-registration.req';
import { QueryAdminRegistrationDto } from './dto/query-admin-registration.req';
import { RegisterCourseDto } from './dto/registration-course.req';

@ApiTags('Registration')
@Controller('registration')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Register for a course' })
  register(
    @Body() registerDto: RegisterCourseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.registrationService.register(userId, registerDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Get my course registrations' })
  me(@CurrentUser('id') userId: string) {
    return this.registrationService.me(userId);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Cancel my course registration' })
  @ApiParam({ name: 'id', description: 'Registration id' })
  cancel(
    @Param('id') id: string,
    @Body() cancelDto: CancelRegistrationDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.registrationService.cancel(id, userId, cancelDto);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin get all course registrations' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiQuery({ name: 'memberId', required: false })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  adminFindAll(@Query() query: QueryAdminRegistrationDto) {
    return this.registrationService.adminFindAll(query);
  }

  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin confirm a course registration' })
  @ApiParam({ name: 'id', description: 'Registration id' })
  confirm(@Param('id') id: string) {
    return this.registrationService.confirm(id);
  }
}
