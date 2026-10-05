import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator'

export class CreateNotificationDto {
  @IsUUID(undefined, { message: 'user_id phải là UUID hợp lệ' })
  user_id!: string

  @IsString({ message: 'message phải là chuỗi' })
  @MinLength(1, { message: 'message không được để trống' })
  @MaxLength(1000, { message: 'message tối đa 1000 ký tự' })
  message!: string

  @IsOptional()
  @IsIn(['SYSTEM', 'EMAIL'], { message: 'kind chỉ nhận SYSTEM hoặc EMAIL' })
  kind?: string
}
