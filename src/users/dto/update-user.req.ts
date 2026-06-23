import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../utils/role/role';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'Nguyễn Văn B',
    description: 'Name of the user',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'nguyenvanb@example.com',
    description: 'Email address of the user',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: 'newpassword123',
    description: 'New password of the user (min 6 characters)',
    minLength: 6,
  })
  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({
    enum: Role,
    example: Role.MEMBER,
    description: 'System access role',
  })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({
    example: 'member',
    description: 'Custom member type tag',
  })
  @IsString()
  @IsOptional()
  memberType?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Account active status',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
