import { ServiceUnavailableException } from '@nestjs/common';
import { isbnKeys } from './isbn.js';

export function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function text(value: unknown, limit: number): string | null {
  return typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().length <= limit
    ? value.trim()
    : null;
}

export function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : typeof value === 'string'
      ? [value]
      : [];
}

export function authorNames(value: unknown) {
  return [
    ...new Set(
      strings(value)
        .map((name) => text(name, 255))
        .filter((name): name is string => name !== null),
    ),
  ].map((name) => ({ name }));
}

export function matchesIsbn(value: unknown, isbn: string): boolean {
  return strings(value).some((candidate) => {
    try {
      return isbnKeys(candidate)[0] === isbnKeys(isbn)[0];
    } catch {
      return false;
    }
  });
}

export function pages(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 2147483647
    ? value
    : null;
}

export function imageUrl(value: unknown): string | null {
  const url = text(value, 1000);
  return url && /^https?:\/\//i.test(url)
    ? url.replace(/^http:/i, 'https:')
    : null;
}

export async function fetchObject(
  url: URL,
  provider: string,
): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BooksCollection/0.0.1',
      },
    });
    if (!response.ok) throw new Error('HTTP failure');
    const result = record(await response.json());
    if (!result) throw new Error('Invalid JSON payload');
    return result;
  } catch {
    // Never expose request URLs, which may contain an API key.
    throw new ServiceUnavailableException(`${provider} unavailable`);
  }
}
