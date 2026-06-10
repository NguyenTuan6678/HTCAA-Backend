import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateNewsCommentDto {
  @ApiProperty({
    example: 'Bài viết rất hữu ích, cảm ơn admin.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;
}
