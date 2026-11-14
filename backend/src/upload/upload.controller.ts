import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { v2 as cloudinary } from 'cloudinary';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('upload')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UploadController {
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      // Giữ file trong RAM thay vì ghi ra đĩa (đĩa Render là ephemeral).
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        // SVG intentionally excluded: it can carry <script> and become stored
        // XSS when served directly.
        const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
        if (!allowed.test(extname(file.originalname))) {
          return cb(
            new BadRequestException(
              'Chỉ cho phép tải lên hình ảnh (jpg, png, gif, webp).',
            ),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Không có file nào được tải lên.');

    // Stream buffer từ memory thẳng lên Cloudinary.
    const result = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'vietix' },
          (error, uploaded) => {
            if (error) return reject(new Error(error.message));
            resolve(uploaded as { secure_url: string; public_id: string });
          },
        );
        uploadStream.end(file.buffer);
      },
    );

    return {
      url: result.secure_url, // URL vĩnh viễn của Cloudinary
      filename: result.public_id,
      size: file.size,
    };
  }
}
