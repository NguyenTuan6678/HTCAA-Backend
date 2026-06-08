import { ApiProperty } from '@nestjs/swagger';
// import { Role } from '@utils/role.enum';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class CreateUsersDTO {
  @ApiProperty({ example: 'username', description: 'username' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'password', description: 'password' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
