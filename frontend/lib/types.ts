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

export interface Venue {
  id: number;
  name: string;
  address?: string;
  capacity?: number;
  layout?: any;
  createdAt?: string;
}

export interface LayoutSection {
  id: string;
  ticketId?: number | null;
  label: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  rows: number;
  seatsPerRow: number;
  rotation: number;
  curve: number;
  curveDir?: 'down' | 'up' | 'left' | 'right';
  startLabel: string;
  color: string;
}

export interface SeatLayout {
  sections: LayoutSection[];
  stage?: { x: number; y: number; w: number; h: number };
}

export interface EventDetail {
  id: number;
  title: string;
  description?: string;
  location?: string;
  bannerUrl?: string;
  bannerFocusX?: number;
  bannerFocusY?: number;
  category?: string;
  startDate?: string;
  startTime?: string;
  endTime?: string;
  tickets: Ticket[];
  seatLayout?: SeatLayout | null;
  venue?: Venue | null;
}
