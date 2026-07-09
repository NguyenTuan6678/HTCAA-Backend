import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.req';
import { QueryContactDto } from './dto/query-contact.req';
import { UpdateContactStatusDto } from './dto/update-contact-status.req';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { Role } from '../../utils/role.enum';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // ─── PUBLIC ────────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Public – submit a contact inquiry form' })
  @ApiBody({ type: CreateContactDto })
  submit(@Body() dto: CreateContactDto) {
    return this.contactService.submit(dto);
  }

  // ─── ADMIN / EDITOR ────────────────────────────────────────────────────────

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary: 'Admin/editor – list contact inquiries (paginated)',
  })
  findAll(@Query() query: QueryContactDto) {
    return this.contactService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – get inquiry details by ID' })
  @ApiParam({ name: 'id', description: 'Inquiry ID' })
  findOne(@Param('id') id: string) {
    return this.contactService.findOne(id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – update inquiry status' })
  @ApiParam({ name: 'id', description: 'Inquiry ID' })
  @ApiBody({ type: UpdateContactStatusDto })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateContactStatusDto) {
    return this.contactService.updateStatus(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – delete contact inquiry' })
  @ApiParam({ name: 'id', description: 'Inquiry ID' })
  delete(@Param('id') id: string) {
    return this.contactService.delete(id);
  }
}
