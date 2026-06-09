import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectMemberDto {
  @ApiProperty({
    example: 'Hồ sơ chưa hợp lệ hoặc thiếu chứng chỉ hành nghề.',
    description: 'Reason for rejecting member profile',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
