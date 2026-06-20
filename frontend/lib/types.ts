export type SeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED';

export interface Seat {
  id: number;
  row: number;
  col: number;
  label: string;
  status: SeatStatus;
}

export interface Ticket {
  id: number;
  type: string;
  price: number;
  quantity: number;
  seats?: Seat[];
}

export interface EventDetail {
  id: number;
  title: string;
  description?: string;
  location?: string;
  bannerUrl?: string;
  category?: string;
  startDate?: string;
  startTime?: string;
  tickets: Ticket[];
}
