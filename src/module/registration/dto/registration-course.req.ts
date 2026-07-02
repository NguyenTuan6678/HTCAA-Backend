import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterCourseDto {
  @ApiProperty({
    example: '665f1a2b3c4d5e6f7a8b9c0d',
    description: 'Course id to register',
  })
  @IsMongoId()
  @IsNotEmpty()
  courseId: string;

  @ApiPropertyOptional({
    example: 'Đăng ký thay cho đồng nghiệp trong công ty',
    description: 'Optional note from member',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
