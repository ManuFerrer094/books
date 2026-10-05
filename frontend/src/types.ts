export type ReadingStatus = 'pending' | 'reading' | 'read';
export interface Book {
  id: number;
  title: string;
  isbn: string | null;
  authors: { id: number; name: string }[];
  publisher: string | null;
  publication_date: string | null;
  pages: number | null;
  language: string | null;
  cover_url: string | null;
}
export interface LibraryBook {
  book_id: number;
  status: ReadingStatus;
  added_at: string;
  updated_at: string;
  book: Book;
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
] as const;
