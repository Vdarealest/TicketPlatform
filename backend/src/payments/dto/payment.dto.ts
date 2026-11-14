import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { GuestTokenDto } from '../../reservations/dto/reservation.dto';

// Only for requests our own frontend sends. The VNPay / MoMo callbacks keep
// Record<string, string>: the gateway decides those fields (and may add new
// ones), and they are authenticated by signature, not by shape.

export class CreatePaymentDto extends GuestTokenDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  reservationIds: number[];
}

export class CreateMomoPaymentDto extends CreatePaymentDto {
  @IsOptional()
  @IsIn(['captureWallet', 'payWithATM'])
  requestType?: string;
}

export class ConfirmVietQRDto extends GuestTokenDto {
  @IsString()
  @MaxLength(64)
  orderId: string;
}
