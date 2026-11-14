import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @IsInt({ message: 'Đánh giá phải từ 1 đến 5 sao.' })
  @Min(1, { message: 'Đánh giá phải từ 1 đến 5 sao.' })
  @Max(5, { message: 'Đánh giá phải từ 1 đến 5 sao.' })
  rating: number;

  // Emptiness and the 1000-char limit are checked (on the trimmed text) by
  // ReviewsService; this only stops absurd payloads early.
  @IsString()
  @MaxLength(5000)
  comment: string;
}
