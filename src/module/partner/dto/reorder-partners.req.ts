import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderItemDto {
  @ApiProperty({
    example: '60d5ec49f83f213b18cc2a91',
    description: 'ID của đối tác',
  })
  @IsMongoId()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    example: 1,
    description: 'Thứ tự hiển thị mới',
  })
  @IsInt()
  @Min(0)
  @IsNotEmpty()
  displayOrder: number;
}

export class ReorderPartnersDto {
  @ApiProperty({
    type: [ReorderItemDto],
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
