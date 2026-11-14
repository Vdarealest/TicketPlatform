import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Shape only. Business rules (sale status, stock, seat availability, guest
// email format) live in ReservationsService, which owns the error messages.

const SEAT_RANGE = 'Chọn từ 1 đến 10 ghế.';

export class ReserveSeatsDto {
  @IsArray()
  @ArrayMinSize(1, { message: SEAT_RANGE })
  @ArrayMaxSize(10, { message: SEAT_RANGE })
  @IsInt({ each: true })
  seatIds: number[];

  @IsOptional()
  @IsString()
  @MaxLength(254)
  guestEmail?: string;
}

export class ReserveGeneralDto {
  @IsInt({ message: 'Chọn từ 1 đến 10 vé.' })
  @Min(1, { message: 'Chọn từ 1 đến 10 vé.' })
  @Max(10, { message: 'Chọn từ 1 đến 10 vé.' })
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  guestEmail?: string;
}

export class GuestTokenDto {
  // Guests prove ownership with the token handed out when they reserved;
  // logged-in users send nothing (or null) and are identified by the JWT.
  @IsOptional()
  @IsString()
  @MaxLength(128)
  guestToken?: string;
}

export class ReservationIdsDto extends GuestTokenDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  ids: number[];
}
