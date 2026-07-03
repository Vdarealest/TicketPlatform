import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ContactService } from './contact.service';

@Controller('contact')
export class ContactController {
  constructor(private contactService: ContactService) {}

  @Post()
  create(@Body() body: { name: string; email: string; subject: string; message: string }) {
    return this.contactService.create(body);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  findAll() {
    return this.contactService.findAll();
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard, AdminGuard)
  markRead(@Param('id') id: string) {
    return this.contactService.markRead(Number(id));
  }

  @Post(':id/reply')
  @UseGuards(JwtAuthGuard, AdminGuard)
  reply(@Param('id') id: string, @Body() body: { message: string }) {
    return this.contactService.reply(Number(id), body.message);
  }
}
