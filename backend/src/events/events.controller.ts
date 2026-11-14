import { Controller, Get, Param, Query } from '@nestjs/common';

import { EventsService, type EventFilters } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('location') location?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sort') sort?: string,
  ) {
    return this.eventsService.findAll({
      search,
      category,
      location,
      dateFrom,
      dateTo,
      minPrice: minPrice !== undefined ? Number(minPrice) : undefined,
      maxPrice: maxPrice !== undefined ? Number(maxPrice) : undefined,
      sort: sort as EventFilters['sort'],
    });
  }

  @Get('categories')
  getCategories() {
    return this.eventsService.getCategories();
  }

  // Must stay above ':id' so "featured" isn't parsed as an event id.
  @Get('featured')
  findFeatured() {
    return this.eventsService.findFeatured();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(Number(id));
  }
}
