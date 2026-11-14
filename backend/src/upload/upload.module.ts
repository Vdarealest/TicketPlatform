import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadController } from './upload.controller';
import { CloudinaryProvider } from './cloudinary.provider';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UploadController],
  providers: [CloudinaryProvider],
})
export class UploadModule {}
