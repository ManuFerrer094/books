import { describe, expect, it } from 'vitest';
import {
  arrangeBooks,
  cloneDesign,
  decorItem,
  emptyDesign,
  placeItem,
  reconcileDesign,
  validateDesign,
} from '../../src/library/bookshelf-design';
import {
  decorAction,
  interactDecoration,
  shelfPowered,
} from '../../src/library/bookshelf-craft';

describe('furniture switches and decoration states', () => {
  it('defaults legacy lighting to on and keeps the independent shelf dimmer', () => {
    const c = emptyDesign().bookcases[0],
      s = c.shelves[0];
    expect(shelfPowered(c, s)).toBe(true);
    s.light.intensity = 0.65;
    c.lights_on = false;
    expect(shelfPowered(c, s)).toBe(false);
    expect(s.light.intensity).toBe(0.65);
    c.lights_on = true;
    s.light.enabled = false;
    expect(shelfPowered(c, s)).toBe(false);
  });
  it('cycles each frame separately and toggles lamps independently of plants', () => {
    let lamp = decorItem('lamp'),
      plant = decorItem('fern'),
      frame = decorItem('portrait');
    expect(decorAction(lamp)).toBe('Apagar');
    lamp = interactDecoration(lamp);
    expect(lamp.active).toBe(false);
    expect(interactDecoration(lamp).active).toBe(true);
    plant = interactDecoration(plant);
    expect(plant.active).toBe(true);
    for (let i = 0; i < 4; i++) frame = interactDecoration(frame);
    expect(frame.artwork).toBe(0);
    expect(decorAction(decorItem('vase'))).toBeNull();
  });
  it('preserves carpentry and object states through old order writes and book removal', () => {
    const books = [
      { book_id: 1, book: { title: 'One' } },
      { book_id: 2, book: { title: 'Two' } },
    ];
    let d = emptyDesign();
    d.bookcases[0].style = 'gilded';
    d.bookcases[0].lights_on = false;
    d.bookcases[0].shelves[0].light.type = 'neon';
    d = placeItem(d, { ...decorItem('portrait'), active: true, artwork: 3 })!;
    d = arrangeBooks(d, books, true);
    validateDesign(d, [1, 2]);
    const art = cloneDesign(d).items.find((i) => i.kind === 'decor');
    const sorted = arrangeBooks(d, [...books].reverse());
    expect(sorted.items.find((i) => i.kind === 'decor')).toEqual(art);
    expect(reconcileDesign(sorted, []).items).toEqual([art]);
    expect(sorted.bookcases).toEqual(d.bookcases);
  });
  it.each([
    (d: any) => (d.bookcases[0].style = 'remote'),
    (d: any) => (d.bookcases[0].lights_on = 'true'),
    (d: any) => (d.bookcases[0].shelves[0].light.type = 'laser'),
    (d: any) => (d.bookcases[0].shelves[0].light.enabled = null),
    (d: any) => (d.items[0].active = 1),
    (d: any) => (d.items[0].artwork = 4),
    (d: any) => (d.items[0].artwork = 0.5),
  ])('rejects malformed optional states before saving', (mutate) => {
    const d = placeItem(emptyDesign(), decorItem('portrait'))!;
    mutate(d);
    expect(() => validateDesign(d, [])).toThrow();
  });
});
