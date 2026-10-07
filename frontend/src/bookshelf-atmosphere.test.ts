import { describe, expect, it } from 'vitest';
import {
  atmosphereForScene,
  atmosphereScenes,
  defaultAtmosphere,
  readAtmosphere,
  soundLayers,
  validAtmosphere,
} from '../../src/library/bookshelf-atmosphere';
import {
  arrangeBooks,
  cloneDesign,
  migrateDesign,
  reconcileDesign,
  validateDesign,
} from '../../src/library/bookshelf-design';
import { safeMix } from './library-sound';
import { readingMinutes, remainingTime } from './library-session';
const fixtureBooks = () => [1, 2, 3].map((book_id) => ({ book_id }));

describe('portable library atmosphere', () => {
  it.each(atmosphereScenes)(
    '$name is a complete, safe scene with all 14 layers',
    (scene) => {
      const value = atmosphereForScene(scene.id);
      expect(validAtmosphere(value)).toBe(true);
      expect(Object.keys(value.sound.layers)).toHaveLength(14);
      expect(value.lighting.enabled).toBe(true);
      expect('playing' in value.sound).toBe(false);
      expect('timer' in value).toBe(false);
    },
  );
  it('keeps legacy appearance intact and creates independent settings', () => {
    expect(readAtmosphere(undefined).lighting.enabled).toBe(false);
    expect(readAtmosphere(null, true).lighting.color).toBe('#9abbe4');
    const first = defaultAtmosphere();
    first.sound.layers.rain = 1;
    expect(defaultAtmosphere().sound.layers.rain).toBe(0);
  });
  it.each([
    (v: ReturnType<typeof defaultAtmosphere>) => {
      v.lighting.color = 'url(https://remote)';
    },
    (v: ReturnType<typeof defaultAtmosphere>) => {
      v.lighting.ambient = 1.01;
    },
    (v: ReturnType<typeof defaultAtmosphere>) => {
      v.lighting.angle = -61;
    },
    (v: ReturnType<typeof defaultAtmosphere>) => {
      v.sound.master = Number.NaN;
    },
    (v: ReturnType<typeof defaultAtmosphere>) => {
      v.sound.layers.rain = -0.1;
    },
    (v: ReturnType<typeof defaultAtmosphere>) => {
      delete (v.sound.layers as Partial<typeof v.sound.layers>).clock;
    },
    (v: ReturnType<typeof defaultAtmosphere>) => {
      Object.assign(v.sound.layers, { remote: 0.5 });
    },
    (v: ReturnType<typeof defaultAtmosphere>) => {
      Object.assign(v.lighting, { motion: 'true' });
    },
  ])('rejects malformed lighting and sound (%#)', (corrupt) => {
    const value = defaultAtmosphere();
    corrupt(value);
    expect(validAtmosphere(value)).toBe(false);
    const books = fixtureBooks(),
      design = migrateDesign(books);
    design.atmosphere = value;
    expect(() =>
      validateDesign(
        design,
        books.map((b) => b.book_id),
      ),
    ).toThrow();
  });
  it('preserves atmosphere through legacy reordering, membership changes and cloning', () => {
    const books = fixtureBooks(),
      original = migrateDesign(books);
    original.atmosphere = atmosphereForScene('enchanted');
    const reordered = arrangeBooks(original, [...books].reverse());
    expect(reordered.atmosphere).toEqual(original.atmosphere);
    const reconciled = reconcileDesign(
      original,
      books.slice(1).map((book) => book.book_id),
    );
    expect(reconciled.atmosphere).toEqual(original.atmosphere);
    expect(reconciled.items.flatMap((item) => item.book_ids)).not.toContain(
      books[0].book_id,
    );
    const copy = cloneDesign(original);
    copy.atmosphere!.sound.layers.pages = 1;
    expect(original.atmosphere.sound.layers.pages).toBe(0.14);
  });
  it('bounds actual audio gain independently of untrusted input', () => {
    const mix = defaultAtmosphere().sound;
    mix.master = Infinity;
    mix.width = -2;
    mix.layers.fire = NaN;
    mix.layers.rain = 50;
    const safe = safeMix(mix);
    expect(safe.master).toBe(0);
    expect(safe.width).toBe(0);
    expect(safe.layers.fire).toBe(0);
    expect(safe.layers.rain).toBe(1);
    expect(soundLayers.every(([id]) => Number.isFinite(safe.layers[id]))).toBe(
      true,
    );
  });
  it('times sessions using elapsed wall time, including suspended tabs', () => {
    expect(remainingTime(60000, 0)).toBe('01:00');
    expect(remainingTime(60000, 59100)).toBe('00:01');
    expect(remainingTime(60000, 80000)).toBe('00:00');
    expect(remainingTime(180 * 60000, 0)).toBe('180:00');
    expect(readingMinutes(NaN)).toBe(25);
    expect(readingMinutes(1000)).toBe(180);
    expect(readingMinutes(0)).toBe(1);
  });
});
