import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateNewsCommentDto {
  @ApiProperty({
    example: 'Mình đã chỉnh lại nội dung comment.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;
}
