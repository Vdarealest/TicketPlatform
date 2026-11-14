// The JSON the admin seat designer saves (event.seatLayout / venue.layout,
// mirrored by SeatLayout in frontend/lib/types.ts). Only the fields the
// backend reads are spelled out; the designer's other fields (shapes,
// colours, positions) are not typed here but are stored and returned
// untouched (jsonb).

export interface LayoutSection {
  id?: string;
  label?: string;
  ticketId?: number;
  rows?: number;
  seatsPerRow?: number;
  startLabel?: string;
  rotation?: number;
}

export interface SeatLayout {
  sections?: LayoutSection[];
}
