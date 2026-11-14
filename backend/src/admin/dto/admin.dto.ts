import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// Shape only. Date parsing, seat reconciliation and admin-password checks are
// done (with their own messages) in AdminService.

const SALE_STATUSES = ['DRAFT', 'UPCOMING', 'ON_SALE'] as const;
const SEATING = ['SEATED', 'GENERAL'] as const;
const ROLES = ['USER', 'ADMIN'] as const;

// ─── Tickets ───────────────────────────────────────────────────────────────

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên loại vé không được để trống.' })
  @MaxLength(100)
  type: string;

  @IsInt({ message: 'Giá vé không hợp lệ.' })
  @Min(0, { message: 'Giá vé không hợp lệ.' })
  price: number;

  @IsInt({ message: 'Số lượng vé phải là số nguyên không âm.' })
  @Min(0, { message: 'Số lượng vé phải là số nguyên không âm.' })
  @Max(100_000)
  quantity: number;

  @IsOptional()
  @IsIn(SEATING)
  seating?: (typeof SEATING)[number];
}

// Seating is fixed once a tier exists (switching would orphan seats/holds).
export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  @IsOptional()
  @IsInt({ message: 'Giá vé không hợp lệ.' })
  @Min(0, { message: 'Giá vé không hợp lệ.' })
  price?: number;

  @IsOptional()
  @IsInt({ message: 'Số lượng vé phải là số nguyên không âm.' })
  @Min(0, { message: 'Số lượng vé phải là số nguyên không âm.' })
  @Max(100_000)
  quantity?: number;
}

// ─── Events ────────────────────────────────────────────────────────────────

export class UpdateEventDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MaxLength(20_000)
  description?: string;

  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(300)
  location?: string;

  @IsOptional() @IsString() @MaxLength(50)
  category?: string;

  @IsOptional() @IsString() @MaxLength(500)
  bannerUrl?: string;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  bannerFocusX?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  bannerFocusY?: number;

  // ISO strings; AdminService.parseDate rejects invalid ones in Vietnamese.
  @IsOptional() @IsString()
  startTime?: string;

  @IsOptional() @IsString()
  endTime?: string;

  // null = detach from venue.
  @IsOptional() @IsInt()
  venueId?: number | null;

  @IsOptional() @IsBoolean()
  featured?: boolean;

  @IsOptional() @IsInt() @Min(0)
  featuredOrder?: number;

  @IsOptional() @IsIn(SALE_STATUSES)
  status?: (typeof SALE_STATUSES)[number];

  // null = no automatic sale opening.
  @IsOptional() @IsString()
  saleOpenAt?: string | null;
}

// Not `extends UpdateEventDto`: class-validator inherits the parent's
// @IsOptional, which would make the required fields below optional too.
export class CreateEventDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  title: string;

  @IsString() @MaxLength(20_000)
  description: string;

  @IsString() @IsNotEmpty() @MaxLength(300)
  location: string;

  @IsOptional() @IsString() @MaxLength(50)
  category?: string;

  @IsString() @MaxLength(500)
  bannerUrl: string;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  bannerFocusX?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  bannerFocusY?: number;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsOptional() @IsInt()
  venueId?: number | null;

  @IsOptional() @IsBoolean()
  featured?: boolean;

  @IsOptional() @IsInt() @Min(0)
  featuredOrder?: number;

  @IsOptional() @IsIn(SALE_STATUSES)
  status?: (typeof SALE_STATUSES)[number];

  @IsOptional() @IsString()
  saleOpenAt?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTicketDto)
  tickets?: CreateTicketDto[];
}

// ─── Venues ────────────────────────────────────────────────────────────────

export class UpdateVenueDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() @MaxLength(300)
  address?: string;

  @IsOptional() @IsInt() @Min(0)
  capacity?: number;
}

export class CreateVenueDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  name: string;

  @IsOptional() @IsString() @MaxLength(300)
  address?: string;

  @IsOptional() @IsInt() @Min(0)
  capacity?: number;
}

// ─── Users ─────────────────────────────────────────────────────────────────

export class AdminPasswordDto {
  // Re-authentication for sensitive actions on admin accounts.
  @IsOptional() @IsString() @MaxLength(128)
  adminPassword?: string;
}

export class RequiredAdminPasswordDto {
  @IsString() @IsNotEmpty() @MaxLength(128)
  adminPassword: string;
}

export class UpdateUserDto extends AdminPasswordDto {
  @IsOptional() @IsEmail()
  email?: string;

  // "" clears the phone number.
  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @IsOptional() @IsIn(ROLES)
  role?: (typeof ROLES)[number];

  @IsOptional() @IsString() @MinLength(6) @MaxLength(128)
  password?: string;
}

export class CreateUserDto extends AdminPasswordDto {
  @IsEmail()
  email: string;

  @IsString() @MinLength(6) @MaxLength(128)
  password: string;

  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @IsIn(ROLES)
  role: (typeof ROLES)[number];
}
