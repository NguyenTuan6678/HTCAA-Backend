import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ConfirmPaymentDto {
  @ApiProperty({ enum: ['bank_transfer', 'cash'], example: 'bank_transfer' })
  @IsEnum(['bank_transfer', 'cash'])
  @IsNotEmpty()
  paymentMethod: string;

  @ApiProperty({ example: 1200000 })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amountPaid: number;

  @ApiProperty({ example: 'Đã nhận đủ tiền chuyển khoản', required: false })
  @IsString()
  @IsOptional()
  note?: string;
}
