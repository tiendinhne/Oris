import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator'

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

export class EventDto {
  @IsIn(['LIKE', 'REPLY', 'REPOST', 'FOLLOW', 'MENTION'], { message: 'type không hợp lệ' })
  type!: string

  @IsUUID(undefined, { message: 'recipient_id phải là UUID hợp lệ' })
  recipient_id!: string

  @IsUUID(undefined, { message: 'actor_id phải là UUID hợp lệ' })
  actor_id!: string

  @IsString() @MaxLength(50)
  actor_name!: string

  @IsOptional() @IsUUID(undefined, { message: 'post_id phải là UUID hợp lệ' })
  post_id?: string

  @IsOptional() @IsBoolean()
  remove?: boolean
}

export class UpdateSettingDto {
  @IsOptional() @IsBoolean({ message: 'enabled phải là true hoặc false' })
  enabled?: boolean

  @IsOptional() @IsIn(['EVERYONE', 'FOLLOWING'], { message: 'scope chỉ nhận EVERYONE hoặc FOLLOWING' })
  scope?: string
}
