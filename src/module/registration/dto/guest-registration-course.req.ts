import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class GuestRegisterCourseDto {
  @ApiProperty({
    example: '665f1a2b3c4d5e6f7a8b9c0d',
    description: 'Course id to register',
  })
  @IsMongoId()
  @IsNotEmpty()
  courseId: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'nguyenvana@gmail.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '1990-05-20' })
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    example: 'CPA-000123',
    description: 'Số chứng chỉ hành nghề',
  })
  @IsString()
  @IsNotEmpty()
  taxCodeActive: string;

  @ApiProperty({ example: '2020-03-10' })
  @IsDateString()
  @IsNotEmpty()
  taxCodeActiveDate: string;

  @ApiProperty({
    example: true,
    description:
      'Khách tự khai mình có phải hội viên không. Admin sẽ đối chiếu và xác thực lại trước khi tính giá.',
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsNotEmpty()
  claimedIsMember: boolean;

  @ApiProperty({ example: 'Công ty TNHH Kế toán ABC' })
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiProperty({
    example: '0312345678',
    description: 'Mã số thuế công ty',
  })
  @IsString()
  @IsNotEmpty()
  taxId: string;

  @ApiProperty({ example: '123 Nguyễn Huệ, Quận 1, TP.HCM' })
  @IsString()
  @IsNotEmpty()
  addressExportBill: string;

  @ApiProperty({ example: 'billing@abc-accounting.vn' })
  @IsEmail()
  @IsNotEmpty()
  emailExportBill: string;

  @ApiPropertyOptional({
    example: 'Đăng ký thay cho đồng nghiệp trong công ty',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
