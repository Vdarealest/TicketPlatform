import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async getProfile(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });
    if (!user) throw new BadRequestException('User not found');
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      phone: user.phone ?? null,
      avatarUrl: user.avatarUrl ?? null,
      googleId: user.googleId ?? null,
      role: user.role,
      createdAt: user.createdAt,
      hasPassword: !!user.password,
    };
  }

  async updateProfile(
    userId: number,
    data: { name?: string; phone?: string; avatarUrl?: string },
  ) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    if (data.phone && data.phone !== user.phone) {
      const exists = await this.usersRepository.findOne({
        where: { phone: data.phone },
      });
      if (exists && exists.id !== userId) {
        throw new BadRequestException('Số điện thoại đã được sử dụng.');
      }
    }

    if (data.name !== undefined) user.name = data.name || '';
    // phone is UNIQUE: an empty string would collide with the next user who
    // also clears it, so "no phone" must be stored as NULL.
    if (data.phone !== undefined) user.phone = data.phone || (null as any);
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl || '';

    await this.usersRepository.save(user);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      googleId: user.googleId,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    if (!user.password) {
      throw new BadRequestException(
        'Tài khoản đăng nhập qua Google. Không thể đổi mật khẩu.',
      );
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng.');
    }

    if (newPassword.length < 6) {
      throw new BadRequestException('Mật khẩu mới phải có ít nhất 6 ký tự.');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.save(user);

    return { message: 'Đổi mật khẩu thành công.' };
  }
}
