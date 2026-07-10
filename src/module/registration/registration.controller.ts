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

import { Role } from '../../utils/role.enum';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { CurrentUser } from '../../users/auth/decorators/current-user.decorator';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { CancelRegistrationDto } from './dto/cancel-registration.req';
import { QueryAdminRegistrationDto } from './dto/query-admin-registration.req';
import { RegisterCourseDto } from './dto/registration-course.req';
import { RegistrationService } from './registration.service';
import { GuestRegisterCourseDto } from './dto/guest-registration-course.req';
import { VerifyMembershipDto } from './dto/verify-membership.req';

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

  // Public — không cần đăng nhập, dành cho khách vãng lai
  @Post('guest-register')
  @ApiOperation({ summary: 'Public: register for a course as a guest' })
  guestRegister(@Body() guestRegisterDto: GuestRegisterCourseDto) {
    return this.registrationService.guestRegister(guestRegisterDto);
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
  @ApiQuery({ name: 'membershipVerified', required: false })
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

  @Patch(':id/verify-membership')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary:
      "Admin: verify a guest registration's claimed membership status and compute price",
  })
  @ApiParam({ name: 'id', description: 'Registration id' })
  verifyMembership(
    @Param('id') id: string,
    @Body() verifyMembershipDto: VerifyMembershipDto,
  ) {
    return this.registrationService.verifyMembership(id, verifyMembershipDto);
  }

  @Patch(':id/approve-guest')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary:
      'Admin: verify membership claim and confirm a guest registration in one step (PENDING -> CONFIRMED)',
  })
  @ApiParam({ name: 'id', description: 'Registration id' })
  approveGuestRegistration(
    @Param('id') id: string,
    @Body() verifyMembershipDto: VerifyMembershipDto,
  ) {
    return this.registrationService.approveGuestRegistration(
      id,
      verifyMembershipDto,
    );
  }
}
