const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  enero: 1,
  february: 2,
  feb: 2,
  febrero: 2,
  march: 3,
  mar: 3,
  marzo: 3,
  april: 4,
  apr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  june: 6,
  jun: 6,
  junio: 6,
  july: 7,
  jul: 7,
  julio: 7,
  august: 8,
  aug: 8,
  agosto: 8,
  september: 9,
  sep: 9,
  sept: 9,
  septiembre: 9,
  october: 10,
  oct: 10,
  octubre: 10,
  november: 11,
  nov: 11,
  noviembre: 11,
  december: 12,
  dec: 12,
  diciembre: 12,
};

/** Only full, unambiguous dates; never supply missing days or months. */
export function normalizePublicationDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const date = value
    .trim()
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/\./g, '')
    .replace(/\s+de\s+/g, ' ')
    .replace(/\s+/g, ' ');
  let year: string;
  let month: number;
  let day: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date);
  const monthFirst = /^([a-z]+) (\d{1,2}) (\d{4})$/.exec(date);
  const dayFirst = /^(\d{1,2}) ([a-z]+) (\d{4})$/.exec(date);
  if (iso) {
    year = iso[1];
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (monthFirst) {
    year = monthFirst[3];
    month = MONTHS[monthFirst[1]];
    day = Number(monthFirst[2]);
  } else if (dayFirst) {
    year = dayFirst[3];
    month = MONTHS[dayFirst[2]];
    day = Number(dayFirst[1]);
  } else return null;
  if (!month || month > 12 || day < 1 || day > 31 || Number(year) < 1)
    return null;
  const result = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(result);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === result
    ? result
    : null;
}

const LANGUAGES: Record<string, string> = {
  spa: 'es',
  eng: 'en',
  fre: 'fr',
  fra: 'fr',
  ger: 'de',
  deu: 'de',
  ita: 'it',
  por: 'pt',
  cat: 'ca',
  glg: 'gl',
  baq: 'eu',
  eus: 'eu',
  dut: 'nl',
  nld: 'nl',
  rus: 'ru',
  ara: 'ar',
  chi: 'zh',
  zho: 'zh',
  jpn: 'ja',
  kor: 'ko',
  lat: 'la',
  mul: 'mul',
  und: 'und',
};

export function normalizeLanguage(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    const key =
      item && typeof item === 'object' ? (item as { key?: unknown }).key : null;
    if (typeof key !== 'string') continue;
    const match = /^\/languages\/([a-z]{2,3})$/i.exec(key);
    if (match) {
      const code = match[1].toLowerCase();
      return LANGUAGES[code] ?? code;
    }
  }
  return null;
}
