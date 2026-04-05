export interface Event {
  id: string;
  title: string;
  date: string;
  price: number;
  location: string;
  image_url: string | null;
  description?: string | null;
  category?: string | null;
  start_time?: string | null;
  organizer_name?: string | null;
  total_tickets?: number | null;
  sales_end_date?: string | null;
  user_id?: string | null;
}

export interface TicketTier {
  id: string;
  event_id: string;
  name: string;
  price: number;
  quantity_available: number;
}

