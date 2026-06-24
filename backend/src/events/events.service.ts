import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Event } from './entities/event.entity';

export interface EventFilters {
  search?: string;
  category?: string;
  location?: string;
  dateFrom?: string;
  dateTo?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'soonest' | 'latest' | 'priceAsc' | 'priceDesc';
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
  ) {}

  async findAll(filters: EventFilters = {}) {
    const qb = this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.tickets', 'ticket');

    if (filters.search?.trim()) {
      qb.andWhere('LOWER(event.title) LIKE LOWER(:search)', {
        search: `%${filters.search.trim()}%`,
      });
    }

    if (filters.category?.trim()) {
      qb.andWhere('event.category = :category', {
        category: filters.category.trim(),
      });
    }

    if (filters.location?.trim()) {
      qb.andWhere('LOWER(event.location) LIKE LOWER(:location)', {
        location: `%${filters.location.trim()}%`,
      });
    }

    if (filters.dateFrom) {
      qb.andWhere('event.startTime >= :dateFrom', {
        dateFrom: new Date(filters.dateFrom),
      });
    }

    if (filters.dateTo) {
      // Bao trọn cả ngày kết thúc
      const dateTo = new Date(filters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      qb.andWhere('event.startTime <= :dateTo', { dateTo });
    }

    switch (filters.sort) {
      case 'latest':
        qb.orderBy('event.startTime', 'DESC');
        break;
      case 'soonest':
      default:
        qb.orderBy('event.startTime', 'ASC');
        break;
    }

    let events = await qb.getMany();

    // Lọc theo khoảng giá: event có ít nhất 1 hạng vé nằm trong khoảng.
    // Làm ở app vì giá là min của nhiều vé và dataset nhỏ (không phân trang).
    const hasMin =
      filters.minPrice !== undefined && !Number.isNaN(filters.minPrice);
    const hasMax =
      filters.maxPrice !== undefined && !Number.isNaN(filters.maxPrice);

    if (hasMin || hasMax) {
      events = events.filter((e) =>
        (e.tickets ?? []).some((t) => {
          const price = Number(t.price);
          if (hasMin && price < filters.minPrice!) return false;
          if (hasMax && price > filters.maxPrice!) return false;
          return true;
        }),
      );
    }

    // Sắp xếp theo giá (giá nhỏ nhất của event) — làm ở app vì là min của nhiều vé
    if (filters.sort === 'priceAsc' || filters.sort === 'priceDesc') {
      const minPriceOf = (e: Event) =>
        e.tickets?.length
          ? Math.min(...e.tickets.map((t) => Number(t.price)))
          : Number.MAX_SAFE_INTEGER;
      events.sort((a, b) =>
        filters.sort === 'priceAsc'
          ? minPriceOf(a) - minPriceOf(b)
          : minPriceOf(b) - minPriceOf(a),
      );
    }

    return events;
  }

  async getCategories(): Promise<string[]> {
    const rows = await this.eventRepository
      .createQueryBuilder('event')
      .select('DISTINCT event.category', 'category')
      .where('event.category IS NOT NULL')
      .orderBy('event.category', 'ASC')
      .getRawMany();
    return rows.map((r) => r.category).filter(Boolean);
  }

  findOne(id: number) {
    return this.eventRepository.findOne({
      where: { id },
      relations: ['tickets', 'tickets.seats'],
    });
  }
}
