import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ContactStatus } from '../../../schema/contact.schema';

export class UpdateContactStatusDto {
  @ApiProperty({
    enum: ContactStatus,
    example: ContactStatus.REVIEWED,
    description: 'Updated status of the inquiry',
  })
  @IsEnum(ContactStatus)
  @IsNotEmpty()
  status: ContactStatus;
}
