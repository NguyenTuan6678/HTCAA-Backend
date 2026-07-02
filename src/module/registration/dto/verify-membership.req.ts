import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class VerifyMembershipDto {
  @ApiProperty({
    example: true,
    description:
      'Kết quả admin đối chiếu: guest có thực sự là hội viên hay không',
  })
  @IsBoolean()
  @IsNotEmpty()
  isMember: boolean;
}
