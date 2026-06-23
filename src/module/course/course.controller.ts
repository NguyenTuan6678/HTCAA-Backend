import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.req';
import { QueryCourseDto } from './dto/query-course.req';

import { Role } from '../../utils/role/role';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { UpdateCourseDto } from './dto/update-course.req';

@ApiTags('Course')
@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get()
  @ApiOperation({ summary: 'Get courses' })
  findAll(@Query() query: QueryCourseDto) {
    return this.courseService.findAll(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor create course' })
  create(@Query() createCourseDto: CreateCourseDto, @Req() request: Request) {
    const userId = (request as any).user.id;
    return this.courseService.create(userId, createCourseDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor update course' })
  @ApiParam({ name: 'id', description: 'Course id' })
  @ApiBody({ type: UpdateCourseDto })
  update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto) {
    return this.courseService.update(id, updateCourseDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor delete course' })
  @ApiParam({ name: 'id', description: 'Course id' })
  delete(@Param('id') id: string) {
    return this.courseService.delete(id);
  }
}
