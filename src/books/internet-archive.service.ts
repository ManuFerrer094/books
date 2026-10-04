import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CreateBookDto } from './dto/create-book.dto';
import { normalizeLanguage, normalizePublicationDate } from './book-metadata';
import {
  authorNames,
  fetchObject,
  matchesIsbn,
  pages,
  record,
  strings,
  text,
} from './provider-utils';
import { isbnKeys } from './isbn';

@Injectable()
export class InternetArchiveService {
  async findByIsbn(isbn: string): Promise<CreateBookDto | null> {
    const url = new URL('https://archive.org/advancedsearch.php');
    url.search = new URLSearchParams({
      q: `mediatype:texts AND (${isbnKeys(isbn)
        .map((key) => `isbn:${key}`)
        .join(' OR ')})`,
      output: 'json',
      rows: '20',
    }).toString();
    for (const field of [
      'identifier',
      'isbn',
      'title',
      'creator',
      'publisher',
      'date',
      'language',
      'number_of_pages',
    ])
      url.searchParams.append('fl[]', field);
    const payload = await fetchObject(url, 'Internet Archive');
    const response = record(payload.response);
    if (!Array.isArray(response?.docs))
      throw new ServiceUnavailableException(
        'Invalid Internet Archive response',
      );
    for (const value of response.docs) {
      const book = record(value);
      if (!book || !matchesIsbn(book.isbn, isbn)) continue;
      const title = text(strings(book.title)[0], 500);
      if (!title)
        throw new ServiceUnavailableException('Invalid Internet Archive book');
      const identifier = text(book.identifier, 255);
      const language = normalizeLanguage(
        strings(book.language).map((code) => ({ key: `/languages/${code}` })),
      );
      const date = strings(book.date)[0]?.replace(/T00:00:00Z$/, '');
      return {
        isbn,
        title,
        authors: authorNames(book.creator),
        publisher: text(strings(book.publisher)[0], 255),
        publication_date: normalizePublicationDate(date),
        language,
        pages: pages(book.number_of_pages),
        cover_url: identifier
          ? `https://archive.org/services/img/${encodeURIComponent(identifier)}`
          : null,
      };
    }
    return null;
  }
}
