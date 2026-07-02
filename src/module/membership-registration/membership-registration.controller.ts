import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { Role } from '../../utils/role/role';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';

import { MembershipRegistrationService } from './membership-registration.service';
import { CreateMembershipRegistrationDto } from './dto/create-membership-registration.req';
import { QueryMembershipRegistrationDto } from './dto/query-membership-registration.req';

@ApiTags('Membership Registration')
@Controller('membership-registrations')
export class MembershipRegistrationController {
  constructor(
    private readonly membershipRegistrationService: MembershipRegistrationService,
  ) {}

  // Public — không cần đăng nhập, ai cũng điền được
  @Post()
  @ApiOperation({ summary: 'Public: submit membership registration form' })
  create(@Body() dto: CreateMembershipRegistrationDto) {
    return this.membershipRegistrationService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary: 'Admin/editor: get list of membership registrations',
  })
  findAll(@Query() query: QueryMembershipRegistrationDto) {
    return this.membershipRegistrationService.findAll(query);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary: 'Admin/editor: remove a membership registration entry',
  })
  @ApiParam({ name: 'id', description: 'Membership registration id' })
  delete(@Param('id') id: string) {
    return this.membershipRegistrationService.delete(id);
  }
}
