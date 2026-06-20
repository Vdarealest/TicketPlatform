import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Event } from './entities/event.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
  ) {}

  findAll() {
    return this.eventRepository.find({
      relations: ['tickets'],
    });
  }

  findOne(id: number) {
    return this.eventRepository.findOne({
      where: { id },
      relations: ['tickets', 'tickets.seats'],
    });
  }
}