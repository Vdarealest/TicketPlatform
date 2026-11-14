import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateContactDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên.' })
  @MaxLength(100)
  name: string;

  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tiêu đề.' })
  @MaxLength(200)
  subject: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung.' })
  @MaxLength(5000)
  message: string;
}

export class ReplyContactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;
}
