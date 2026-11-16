import {
  IsEmail,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ForgotPasswordDto {
  // Email or phone number.
  @IsString()
  @MaxLength(254)
  identifier: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6, { message: 'Mã OTP gồm 6 chữ số.' })
  otp: string;
}

export class ResetPasswordDto extends VerifyOtpDto {
  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự.' })
  @MaxLength(128)
  newPassword: string;
}

export class RefreshTokenDto {
  @IsString()
  @MaxLength(128)
  refresh_token: string;
}

export class OAuthExchangeDto {
  @IsString()
  @MaxLength(128)
  code: string;
}
