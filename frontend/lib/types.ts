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
  type?: 'rect' | 'arc';
  x: number;
  y: number;
  w?: number;
  h?: number;
  rows: number;
  seatsPerRow: number;
  rotation: number;
  curve: number;
  curveDir?: 'down' | 'up' | 'left' | 'right';
  // Arc/wedge geometry (only when type === 'arc') — a ring segment around
  // (centerX, centerY), spanning startAngle..endAngle degrees (0°=+X axis,
  // clockwise, since SVG y grows downward) between innerRadius..outerRadius.
  centerX?: number;
  centerY?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
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
  status?: 'DRAFT' | 'UPCOMING' | 'ON_SALE';
  saleOpenAt?: string | null;
}
