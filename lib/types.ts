export interface Event {
  id: string;
  title: string;
  date: string;
  price: number;
  location: string;
  image_url: string | null;
  description?: string | null;
}

