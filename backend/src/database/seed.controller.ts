import { Controller, Post, UseGuards } from '@nestjs/common';
import { SeedService } from './seed.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

// Seeding rewrites demo data — admin only, never public.
@Controller('seed')
@UseGuards(JwtAuthGuard, AdminGuard)
export class SeedController {
  constructor(private seedService: SeedService) {}

  @Post()
  async seed() {
    return this.seedService.seed();
  }
}
