import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CreateBookDto } from './dto/create-book.dto';
import { normalizeLanguage, normalizePublicationDate } from './book-metadata';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, limit: number): string | null {
  return typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().length <= limit
    ? value.trim()
    : null;
}

function names(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => text(record(item)?.name, 255))
        .filter((name): name is string => name !== null),
    ),
  ];
}

@Injectable()
export class OpenLibraryService {
  async findByIsbn(isbn: string): Promise<CreateBookDto | null> {
    try {
      const url = new URL('https://openlibrary.org/api/books');
      url.search = new URLSearchParams({
        bibkeys: `ISBN:${isbn}`,
        jscmd: 'data',
        format: 'json',
      }).toString();
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'BooksCollection/0.0.1',
        },
      });
      if (!response.ok) throw new Error('Provider HTTP failure');
      const payload = record(await response.json());
      if (!payload) throw new Error('Invalid provider response');
      const value = payload[`ISBN:${isbn}`];
      if (value === undefined) return null;
      const book = record(value);
      const title = text(book?.title, 500);
      if (!book || !title) throw new Error('Invalid provider book');
      const editionResponse = await fetch(
        `https://openlibrary.org/isbn/${isbn}.json`,
        {
          signal: AbortSignal.timeout(5000),
          headers: {
            Accept: 'application/json',
            'User-Agent': 'BooksCollection/0.0.1',
          },
        },
      );
      let edition: Record<string, unknown> | null = null;
      if (editionResponse.status !== 404) {
        if (!editionResponse.ok) throw new Error('Edition HTTP failure');
        edition = record(await editionResponse.json());
        if (!edition) throw new Error('Invalid edition response');
      }
      const publicationDate =
        normalizePublicationDate(edition?.publish_date) ??
        normalizePublicationDate(book.publish_date);
      const cover = record(book.cover);
      const coverUrl = text(
        cover?.large ?? cover?.medium ?? cover?.small,
        1000,
      );
      return {
        isbn,
        title,
        authors: names(book.authors).map((name) => ({ name })),
        publisher: names(book.publishers)[0] ?? null,
        publication_date: publicationDate,
        pages:
          typeof book.number_of_pages === 'number' &&
          Number.isInteger(book.number_of_pages) &&
          book.number_of_pages > 0 &&
          book.number_of_pages <= 2147483647
            ? book.number_of_pages
            : null,
        language: normalizeLanguage(edition?.languages),
        cover_url:
          coverUrl && /^https?:\/\//i.test(coverUrl)
            ? coverUrl.replace(/^http:/i, 'https:')
            : null,
      };
    } catch {
      throw new ServiceUnavailableException('Book provider unavailable');
    }
  }
}
