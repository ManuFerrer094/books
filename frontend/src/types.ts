export type ReadingStatus = 'pending' | 'reading' | 'read';
export interface Book {
  id: number;
  title: string;
  isbn: string | null;
  authors: { id?: number; name: string }[];
  publisher: string | null;
  publication_date: string | null;
  pages: number | null;
  language: string | null;
  cover_url: string | null;
  cover_image_path?: string | null;
}
export interface LibraryBook {
  is_lent?: boolean;
  lent_to?: string | null;
  notes?: string | null;
  rating?: number | null;
  customized?: boolean;
  spine?: SpineAppearance | null;
  book_id: number;
  status: ReadingStatus;
  added_at: string;
  updated_at: string;
  book: Book;
}
export interface WishlistBook {
  book_id: number;
  added_at: string;
  book: Book;
}
export interface CatalogPage {
  books: Book[];
  total: number;
  page: number;
  page_size: number;
}
export interface SpineAppearance {
  color: string | null;
  width: number | null;
  height: number | null;
  image_path: string | null;
}
export interface BookshelfLayout {
  book_ids: number[];
  revision: number;
  design?: import('../../src/library/bookshelf-design').BookshelfDesign;
}
export const shelves = [
  {
    id: 'all',
    label: 'Todos mis libros',
    description: 'Cada historia tiene su lugar.',
  },
  {
    id: 'pending',
    label: 'Por leer',
    description: 'Historias que todavía están por empezar.',
  },
  {
    id: 'reading',
    label: 'Leyendo',
    description: 'Las historias que te acompañan ahora.',
  },
  {
    id: 'read',
    label: 'Leídos',
    description: 'Un pequeño recuerdo de cada viaje.',
  },
  {
    id: 'lent',
    label: 'Prestados',
    description: 'Historias que has dejado en otras manos.',
  },
  {
    id: 'wishlist',
    label: 'Lista de deseos',
    description: 'Historias que quieres tener cerca algún día.',
  },
] as const;
