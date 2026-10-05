import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CreateBookDto } from './dto/create-book.dto.js';
import { normalizePublicationDate } from './book-metadata.js';
import {
  authorNames,
  fetchObject,
  imageUrl,
  matchesIsbn,
  pages,
  record,
  strings,
  text,
} from './provider-utils.js';

// Only edition language claims: the original language of a work may differ.
const LANGUAGES: Record<string, string> = {
  'wd:Q1321': 'es',
  'wd:Q1860': 'en',
  'wd:Q150': 'fr',
  'wd:Q188': 'de',
  'wd:Q652': 'it',
  'wd:Q5146': 'pt',
  'wd:Q7026': 'ca',
  'wd:Q9307': 'gl',
  'wd:Q8752': 'eu',
  'wd:Q7411': 'nl',
  'wd:Q7737': 'ru',
  'wd:Q5287': 'ja',
};

@Injectable()
export class InventaireService {
  private async entities(uris: string[]): Promise<Record<string, unknown>> {
    const url = new URL('https://inventaire.io/api/entities/by-uris');
    url.search = new URLSearchParams({
      uris: uris.join('|'),
      autocreate: 'false',
    }).toString();
    const payload = await fetchObject(url, 'Inventaire');
    const entities = record(payload.entities);
    if (!entities)
      throw new ServiceUnavailableException('Invalid Inventaire response');
    return entities;
  }

  async findByIsbn(isbn: string): Promise<CreateBookDto | null> {
    const entities = await this.entities([`isbn:${isbn}`]);
    const edition = Object.values(entities)
      .map(record)
      .find((entity) => {
        const claims = record(entity?.claims);
        return (
          entity?.type === 'edition' &&
          matchesIsbn(
            [
              ...strings(claims?.['wdt:P212']),
              ...strings(claims?.['wdt:P957']),
            ],
            isbn,
          )
        );
      });
    if (!edition) return null;
    const claims = record(edition.claims) ?? {};
    const title = text(strings(claims['wdt:P1476'])[0], 500);
    if (!title)
      throw new ServiceUnavailableException('Invalid Inventaire edition');
    const works = strings(claims['wdt:P629'])
      .filter((uri) => /^(wd:Q\d+|inv:[a-f0-9]+)$/.test(uri))
      .slice(0, 5);
    const workEntities = works.length ? await this.entities(works) : {};
    const authors = [
      ...strings(claims['wdt:P50']),
      ...Object.values(workEntities).flatMap((entity) =>
        strings(record(record(entity)?.claims)?.['wdt:P50']),
      ),
    ];
    const publishers = strings(claims['wdt:P123']);
    const refs = [...new Set([...authors, ...publishers])]
      .filter((uri) => /^(wd:Q\d+|inv:[a-f0-9]+)$/.test(uri))
      .slice(0, 20);
    const related = refs.length ? await this.entities(refs) : {};
    const label = (uri: string) => {
      const labels = record(record(related[uri])?.labels);
      return text(
        labels?.es ??
          labels?.en ??
          labels?.fromclaims ??
          Object.values(labels ?? {})[0],
        255,
      );
    };
    const image = record(edition.image)?.url;
    const cover =
      typeof image === 'string' && image.startsWith('/img/entities/')
        ? `https://inventaire.io${image}`
        : image;
    const count =
      strings(claims['wdt:P1104'])[0] ??
      (Array.isArray(claims['wdt:P1104']) ? claims['wdt:P1104'][0] : null);
    return {
      isbn,
      title,
      authors: authorNames(authors.map(label).filter(Boolean)),
      publisher: publishers.map(label).find(Boolean) ?? null,
      publication_date: normalizePublicationDate(
        strings(claims['wdt:P577'])[0],
      ),
      language: LANGUAGES[strings(claims['wdt:P407'])[0]] ?? null,
      pages: pages(
        count === null || count === undefined ? null : Number(count),
      ),
      cover_url: imageUrl(cover),
    };
  }
}
