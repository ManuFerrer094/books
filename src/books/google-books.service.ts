import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateBookDto } from './dto/create-book.dto.js';
import { normalizePublicationDate } from './book-metadata.js';
import {
  authorNames,
  fetchObject,
  imageUrl,
  matchesIsbn,
  pages,
  record,
  text,
} from './provider-utils.js';

@Injectable()
export class GoogleBooksService {
  constructor(private readonly config: ConfigService) {}

  async findByIsbn(isbn: string): Promise<CreateBookDto | null> {
    const key = this.config.get<string>('GOOGLE_BOOKS_API_KEY')?.trim();
    // Google requires an application key. Skip when not configured; never use
    // shared anonymous quotas or silently enable a paid service.
    if (!key) return null;
    const url = new URL('https://www.googleapis.com/books/v1/volumes');
    url.search = new URLSearchParams({
      q: `isbn:${isbn}`,
      maxResults: '40',
      printType: 'books',
    }).toString();
    url.searchParams.set('key', key);
    const payload = await fetchObject(url, 'Google Books');
    if (payload.totalItems === 0 && payload.items === undefined) return null;
    if (!Array.isArray(payload.items))
      throw new ServiceUnavailableException('Invalid Google Books response');
    for (const item of payload.items) {
      const info = record(record(item)?.volumeInfo);
      const identifiers = info?.industryIdentifiers;
      if (!info || !Array.isArray(identifiers)) continue;
      const isbns = identifiers.flatMap((identifier) => {
        const entry = record(identifier);
        return entry?.type === 'ISBN_10' || entry?.type === 'ISBN_13'
          ? [entry.identifier]
          : [];
      });
      if (!matchesIsbn(isbns, isbn)) continue;
      const title = text(info.title, 500);
      if (!title)
        throw new ServiceUnavailableException('Invalid Google Books book');
      const language = text(info.language, 50)?.toLowerCase();
      const images = record(info.imageLinks);
      return {
        isbn,
        title,
        authors: authorNames(info.authors),
        publisher: text(info.publisher, 255),
        publication_date: normalizePublicationDate(info.publishedDate),
        pages: pages(info.pageCount),
        language:
          language && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(language)
            ? language
            : null,
        cover_url: imageUrl(images?.thumbnail ?? images?.smallThumbnail),
      };
    }
    return null;
  }
}
