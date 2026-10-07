import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  Check,
  Download,
  Eye,
  Maximize,
  Minus,
  Moon,
  Palette,
  Plus,
  Redo2,
  Sun,
  Undo2,
  X,
} from 'lucide-react';
import {
  applyPreset,
  arrangeBooks,
  bookDimensions,
  bookItem,
  canPlace,
  cloneDesign,
  decorItem,
  dropItem,
  decorationUnit,
  decorationSpan,
  resizeDecoration,
  firstSpace,
  decorations,
  itemSize,
  materials,
  newBookcase,
  newShelf,
  placeItem,
  placedIds,
  presets,
  sceneGeometry,
  sceneId,
  shelfEntries,
  type BookMode,
  type BookshelfDesign,
  type SceneItem,
} from '../../src/library/bookshelf-design';
import { errorMessage } from './api';
import { Dialog } from './components';
import BookshelfScene, { DecorArt } from './BookshelfScene';
import { useBookshelfStudio } from './useBookshelfStudio';
import { exportBookshelf } from './bookshelf-export';
import { spineStyle } from './bookshelf-layout';
import { sortSceneBooks } from './bookshelf-organize';
import type { LibraryBook } from './types';
const BookAppearanceEditor = lazy(() => import('./BookAppearanceEditor'));
const BatchSpineCapture = lazy(() => import('./BatchSpineCapture'));

interface Props {
  ownerId: string;
  books: LibraryBook[];
  allBooks: LibraryBook[];
  canOrganize: boolean;
  onSelect: (id: number) => void;
  onAdd: () => void;
  onReload: () => void;
  onUpdated?: (book: LibraryBook) => void;
  preserveVisibleOrder?: boolean;
}
const materialNames = {
  oak: 'Roble',
  walnut: 'Nogal',
  birch: 'Madera clara',
  white: 'Blanco',
  black: 'Negro',
};
const tabs = [
  ['ambience', 'Ambientes'],
  ['furniture', 'Muebles'],
  ['decor', 'Objetos'],
  ['books', 'Libros'],
] as const;
export default function Bookshelf({
  ownerId,
  books,
  allBooks,
  onSelect,
  onAdd,
  onReload,
  onUpdated,
  preserveVisibleOrder,
}: Props) {
  const studio = useBookshelfStudio(ownerId, allBooks),
    design = studio.design;
  const [designing, setDesigning] = useState(false),
    [tab, setTab] = useState<string>('ambience');
  const [selected, setSelected] = useState<string[]>([]),
    [chosenBooks, setChosenBooks] = useState<number[]>([]);
  const [caseId, setCaseId] = useState(''),
    [shelfId, setShelfId] = useState('');
  const [zoom, setZoom] = useState(1),
    [viewportWidth, setViewportWidth] = useState(700);
  const [message, setMessage] = useState(''),
    [batch, setBatch] = useState(false);
  const [appearanceId, setAppearanceId] = useState<number | null>(null),
    [appearanceBusy, setAppearanceBusy] = useState(false);
  const [presetId, setPresetId] = useState<string | null>(null),
    [arrangement, setArrangement] = useState<BookshelfDesign | null>(null);
  const [format, setFormat] = useState<'original' | 'square' | 'portrait'>(
      'original',
    ),
    [exportCase, setExportCase] = useState(''),
    [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState<{
    item: SceneItem;
    shelf_id: string;
    x: number;
    valid: boolean;
    candidate?: BookshelfDesign;
    design?: BookshelfDesign;
  } | null>(null);
  const root = useRef<HTMLDivElement>(null),
    viewport = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null),
    exportSvg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    item: SceneItem;
    startX: number;
    startY: number;
    offsetX: number;
    pointer: number;
    active: boolean;
    additive: boolean;
  } | null>(null);
  const suppressClick = useRef(0);
  const pan = useRef<{ pointer: number; x: number; y: number } | null>(null);
  const previewRef = useRef<typeof preview>(null);
  const reloadRevision = useRef<number | null>(null);
  const focusAfterMove = useRef<string | null>(null);
  useEffect(() => {
    const remote = studio.remote;
    if (
      remote &&
      remote.revision !== reloadRevision.current &&
      [...remote.book_ids].sort((a, b) => a - b).join(',') !==
        allBooks
          .map((book) => book.book_id)
          .sort((a, b) => a - b)
          .join(',')
    ) {
      reloadRevision.current = remote.revision;
      onReload();
    }
  }, [studio.remote, allBooks, onReload]);
  useEffect(() => {
    if (focusAfterMove.current) {
      root.current
        ?.querySelector<SVGElement>(
          `[data-item-id="${focusAfterMove.current}"]`,
        )
        ?.focus({ preventScroll: true });
      focusAfterMove.current = null;
    }
  }, [design]);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setViewportWidth(entry.contentRect.width),
    );
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [!!design]);
  const currentCase =
    design?.bookcases.find((c) => c.id === caseId) ?? design?.bookcases[0];
  const currentShelf =
    currentCase?.shelves.find((s) => s.id === shelfId) ??
    currentCase?.shelves[0];
  const selectedItem = design?.items.find((item) => item.id === selected[0]);
  const selectedIds = [
    ...new Set([
      ...chosenBooks,
      ...(design?.items
        .filter((item) => selected.includes(item.id))
        .flatMap((item) => item.book_ids) ?? []),
    ]),
  ];
  const bookMap = new Map(allBooks.map((book) => [book.book_id, book]));
  const decorUnit = decorationUnit(allBooks);
  const placed = new Set(design ? placedIds(design) : []);
  const unplaced = allBooks.filter((book) => !placed.has(book.book_id));
  const filtering = books.length !== allBooks.length || preserveVisibleOrder;
  const appearance = allBooks.find((book) => book.book_id === appearanceId);
  const geometry = design ? sceneGeometry(design) : null;
  const editable = (next: BookshelfDesign, action = '') => {
    studio.commit(next, action);
    setMessage('');
  };
  const changed = (change: (next: BookshelfDesign) => void, action = '') => {
    if (!design) return;
    const next = cloneDesign(design);
    change(next);
    editable(next, action);
  };
  function selectItem(item: SceneItem, additive: boolean) {
    if (Date.now() < suppressClick.current) return;
    setSelected((old) =>
      additive
        ? old.includes(item.id)
          ? old.filter((id) => id !== item.id)
          : [...old, item.id]
        : [item.id],
    );
    if (!additive) setChosenBooks([]);
    const entry =
      design &&
      shelfEntries(design).find(({ shelf }) => shelf.id === item.shelf_id);
    if (entry) {
      setCaseId(entry.bookcase.id);
      setShelfId(entry.shelf.id);
    }
    setTab(item.kind === 'decor' ? 'decor' : 'books');
  }
  function put(item: SceneItem, preferred = currentShelf?.id) {
    if (!design) return;
    const next =
      item.kind === 'decor' && preferred
        ? dropItem(
            design,
            item,
            preferred,
            firstSpace(design, item, preferred) ?? 8,
          )
        : placeItem(design, item, preferred);
    if (next) {
      editable(next);
      setSelected([item.id]);
    } else
      setMessage(
        'No cabe en esta balda. Elige otra balda o añade una; los libros siguen en «Por colocar».',
      );
  }
  function updateItem(patch: Partial<SceneItem>, action = '') {
    if (!design || !selectedItem) return;
    const item = { ...selectedItem, ...patch };
    const next = dropItem(design, item, item.shelf_id, item.x);
    if (next) editable(next, action);
    else
      setMessage(
        'Ese tamaño o posición no cabe. Haz espacio o elige otra balda.',
      );
  }
  function move(
    direction: 'left' | 'right' | 'up' | 'down',
    explicitItem = selectedItem,
  ) {
    if (!design || !explicitItem) return;
    let next: BookshelfDesign | null = null;
    if (direction === 'left' || direction === 'right') {
      next = placeItem(
        design,
        explicitItem,
        explicitItem.shelf_id,
        explicitItem.x + (direction === 'left' ? -4 : 4),
      );
      if (!next) {
        const neighbors = design.items
          .filter(
            (item) =>
              item.shelf_id === explicitItem.shelf_id && item.kind !== 'decor',
          )
          .sort((a, b) => a.x - b.x);
        const center = explicitItem.x + itemSize(explicitItem).width / 2;
        const neighbor =
          explicitItem.kind === 'decor'
            ? direction === 'left'
              ? neighbors
                  .filter((item) => item.x + itemSize(item).width / 2 < center)
                  .at(-1)
              : neighbors.find(
                  (item) => item.x + itemSize(item).width / 2 > center,
                )
            : neighbors[
                neighbors.findIndex((item) => item.id === explicitItem.id) +
                  (direction === 'left' ? -1 : 1)
              ];
        if (neighbor)
          next = dropItem(
            design,
            explicitItem,
            explicitItem.shelf_id,
            neighbor.x +
              itemSize(neighbor).width / 2 -
              itemSize(explicitItem).width / 2 +
              (direction === 'left' ? -1 : 1),
          );
      }
    } else {
      const entries = shelfEntries(design),
        index = entries.findIndex(
          ({ shelf }) => shelf.id === explicitItem.shelf_id,
        );
      const target = entries[index + (direction === 'up' ? -1 : 1)];
      if (target)
        next =
          explicitItem.kind === 'decor'
            ? dropItem(design, explicitItem, target.shelf.id, explicitItem.x)
            : placeItem(design, explicitItem, target.shelf.id);
    }
    if (next) editable(next);
    else setMessage('No hay espacio en esa dirección.');
  }
  function point(event: { clientX: number; clientY: number }) {
    const matrix = svg.current?.getScreenCTM();
    return matrix
      ? new DOMPoint(event.clientX, event.clientY).matrixTransform(
          matrix.inverse(),
        )
      : null;
  }
  function startDrag(event: PointerEvent<SVGGElement>, item: SceneItem) {
    if (!designing || event.button !== 0 || !geometry || arrangement) return;
    const p = point(event),
      shelf = geometry.shelves.find((s) => s.shelf.id === item.shelf_id);
    if (!p || !shelf) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    svg.current?.setPointerCapture(event.pointerId);
    drag.current = {
      item,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: p.x - shelf.x - item.x,
      pointer: event.pointerId,
      active: false,
      additive: event.shiftKey || event.ctrlKey || event.metaKey,
    };
  }
  function dragMove(event: PointerEvent<HTMLDivElement>) {
    if (pan.current?.pointer === event.pointerId) {
      const previous = pan.current;
      event.currentTarget.scrollLeft += previous.x - event.clientX;
      event.currentTarget.scrollTop += previous.y - event.clientY;
      pan.current = {
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      return;
    }
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId || !design || !geometry)
      return;
    if (
      !current.active &&
      Math.hypot(
        event.clientX - current.startX,
        event.clientY - current.startY,
      ) < 6
    )
      return;
    current.active = true;
    const p = point(event);
    if (!p) return;
    const target = geometry.shelves.find(
      (s) =>
        p.x >= s.x &&
        p.x <= s.x + s.bookcase.width &&
        p.y >= s.y &&
        p.y <= s.bottom + 24,
    );
    if (!target) {
      previewRef.current = null;
      setPreview(null);
      return;
    }
    const x =
      Math.round(
        Math.max(
          8,
          Math.min(
            target.bookcase.width - itemSize(current.item).width - 8,
            p.x - target.x - current.offsetX,
          ),
        ) / 4,
      ) * 4;
    const candidate = dropItem(design, current.item, target.shelf.id, x);
    const placement = candidate?.items.find(
      (item) => item.id === current.item.id,
    );
    const nextPreview = {
      item: current.item,
      shelf_id: target.shelf.id,
      x: placement?.x ?? x,
      valid: !!candidate,
      candidate: candidate ?? undefined,
      design: candidate
        ? {
            ...candidate,
            items: candidate.items.filter(
              (item) => item.id !== current.item.id,
            ),
          }
        : undefined,
    };
    previewRef.current = nextPreview;
    setPreview(nextPreview);
    const rect = viewport.current?.getBoundingClientRect();
    if (rect && event.clientX > rect.right - 40)
      viewport.current!.scrollLeft += 12;
    if (rect && event.clientX < rect.left + 40)
      viewport.current!.scrollLeft -= 12;
    if (rect && event.clientY > rect.bottom - 40)
      viewport.current!.scrollTop += 14;
    if (rect && event.clientY < rect.top + 40)
      viewport.current!.scrollTop -= 14;
  }
  function finishDrag(cancel = false) {
    pan.current = null;
    const current = drag.current;
    const proposed = previewRef.current;
    previewRef.current = null;
    drag.current = null;
    if (current?.active) {
      suppressClick.current = Date.now() + 300;
      if (!cancel && proposed?.valid && design) {
        const next =
          proposed.candidate ??
          placeItem(design, current.item, proposed.shelf_id, proposed.x);
        if (next) {
          editable(next);
          setSelected([current.item.id]);
          focusAfterMove.current = current.item.id;
        }
      } else if (!cancel)
        setMessage(
          'No hay espacio en esa posición. Puedes mover el objeto con los controles o elegir otra balda.',
        );
    } else if (current && !cancel) {
      selectItem(current.item, current.additive);
      suppressClick.current = Date.now() + 300;
    }
    setPreview(null);
  }
  function removeSelectedBooks(next: BookshelfDesign) {
    const ids = new Set(selectedIds);
    next.items = next.items
      .map((item) => ({
        ...item,
        book_ids: item.book_ids.filter((id) => !ids.has(id)),
      }))
      .filter((item) => item.kind === 'decor' || item.book_ids.length);
  }
  function stackBooks() {
    if (!design || selectedIds.length < 2 || selectedIds.length > 12) {
      setMessage('Selecciona entre 2 y 12 libros para crear una pila.');
      return;
    }
    const entries = selectedIds.map((id) => bookMap.get(id)!).filter(Boolean),
      next = cloneDesign(design);
    removeSelectedBooks(next);
    const item: SceneItem = {
      ...bookItem(entries[0]),
      id: sceneId('stack'),
      kind: 'stack',
      book_ids: selectedIds,
      width: Math.max(...entries.map((b) => bookDimensions(b).height)),
      height: entries.reduce((sum, b) => sum + bookDimensions(b).width, 0),
    };
    const result = placeItem(next, item, currentShelf?.id);
    if (!result) {
      setMessage(
        'La pila no cabe. Prueba con menos libros o una balda más alta.',
      );
      return;
    }
    editable(result);
    setChosenBooks([]);
    setSelected([item.id]);
  }
  async function download() {
    if (!exportSvg.current) return;
    setExporting(true);
    setMessage('Preparando tu imagen…');
    try {
      const warning = await exportBookshelf(
        exportSvg.current,
        format,
        'mi-estanteria-entre-paginas',
      );
      setMessage(warning || 'Tu estantería está lista para compartir.');
    } catch (cause) {
      setMessage(errorMessage(cause));
    } finally {
      setExporting(false);
    }
  }
  if (studio.loading)
    return (
      <div className="bookshelf-loading" role="status">
        Preparando tu refugio de historias…
        <div className="shelf-loading-wood" />
      </div>
    );
  if (!design || !currentCase || !currentShelf || !geometry)
    return (
      <div className="empty-state" role="alert">
        <p>{studio.error}</p>
        <button className="button secondary" onClick={studio.retry}>
          Volver a intentar
        </button>
      </div>
    );
  const scale = Math.max(0.08, (viewportWidth || 700) / geometry.width) * zoom;
  return (
    <div
      className={`bookshelf-studio ${designing ? 'is-designing' : ''}`}
      ref={root}
    >
      <div className="studio-topbar">
        <div>
          <span className="eyebrow">TU BIBLIOTECA, A TU MANERA</span>
          <h3>Un lugar para tus historias.</h3>
        </div>
        <div className="studio-mode segmented">
          <button
            aria-pressed={!designing}
            onClick={() => {
              setDesigning(false);
              setSelected([]);
            }}
          >
            <Eye size={15} /> Ver
          </button>
          <button aria-pressed={designing} onClick={() => setDesigning(true)}>
            <Palette size={15} /> Diseñar
          </button>
        </div>
      </div>
      <div className="studio-actions">
        <button
          className="icon-button"
          aria-label="Deshacer"
          disabled={!studio.canUndo || !!arrangement}
          onClick={studio.undo}
        >
          <Undo2 size={18} />
        </button>
        <button
          className="icon-button"
          aria-label="Rehacer"
          disabled={!studio.canRedo || !!arrangement}
          onClick={studio.redo}
        >
          <Redo2 size={18} />
        </button>
        <span className="studio-save" role="status">
          <Check size={13} />
          {studio.status}
        </span>
        <button
          className="icon-button"
          aria-label="Reducir zoom"
          disabled={zoom <= 1}
          onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
        >
          <Minus size={17} />
        </button>
        <button
          className="text-button"
          onClick={() => {
            setZoom(1);
            viewport.current?.scrollTo(0, 0);
          }}
        >
          Encuadrar
        </button>
        <button
          className="icon-button"
          aria-label="Ampliar zoom"
          disabled={zoom >= 5}
          onClick={() => setZoom((z) => Math.min(5, z + 0.5))}
        >
          <Plus size={17} />
        </button>
        <button
          className="icon-button"
          aria-label="Pantalla completa"
          onClick={() => {
            const operation = document.fullscreenElement
              ? document.exitFullscreen()
              : root.current?.requestFullscreen();
            void operation?.catch(() =>
              setMessage(
                'Este navegador no admite pantalla completa. Puedes usar el zoom.',
              ),
            );
          }}
        >
          <Maximize size={17} />
        </button>
      </div>
      {studio.error && (
        <div className="shelf-error" role="alert">
          <p>{studio.error}</p>
          {!studio.remote && (
            <button className="button secondary" onClick={studio.retry}>
              Reintentar guardado
            </button>
          )}
        </div>
      )}
      {studio.remote && (
        <div className="studio-conflict">
          <p>
            Otra sesión tiene una versión distinta. Compara ambas antes de
            elegir.
          </p>
          <div className="studio-comparison">
            <div>
              <strong>Tu borrador</strong>
              <BookshelfScene design={design} books={allBooks} />
            </div>
            <div>
              <strong>Versión guardada</strong>
              {studio.remote.design && (
                <BookshelfScene
                  design={studio.remote.design}
                  books={allBooks}
                />
              )}
            </div>
          </div>
          <button
            className="button primary"
            onClick={() => studio.resolve(true)}
          >
            Guardar mi borrador sobre la versión actual
          </button>
          <button
            className="button secondary"
            onClick={() => studio.resolve(false)}
          >
            Usar la versión guardada
          </button>
        </div>
      )}
      <div className="studio-workspace">
        <div className="studio-stage">
          <div
            className="studio-viewport"
            ref={viewport}
            onPointerDown={(event) => {
              if (
                designing &&
                event.pointerType === 'touch' &&
                !(event.target as Element).closest('[data-item-id]')
              ) {
                pan.current = {
                  pointer: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }
            }}
            onPointerMove={dragMove}
            onPointerUp={() => finishDrag()}
            onPointerCancel={() => finishDrag(true)}
            onLostPointerCapture={() => finishDrag(true)}
            onKeyDown={(event) => {
              if (
                !designing ||
                !(event.target as Element).closest('[data-item-id]')
              )
                return;
              const directions: Record<
                string,
                'left' | 'right' | 'up' | 'down'
              > = {
                ArrowLeft: 'left',
                ArrowRight: 'right',
                ArrowUp: 'up',
                ArrowDown: 'down',
              };
              if (event.key === 'Escape') finishDrag(true);
              if (directions[event.key]) {
                event.preventDefault();
                const id = (event.target as Element)
                  .closest('[data-item-id]')
                  ?.getAttribute('data-item-id');
                setSelected(id ? [id] : []);
                focusAfterMove.current = id ?? null;
                move(
                  directions[event.key],
                  design.items.find((i) => i.id === id),
                );
              }
            }}
          >
            <div
              className="studio-scene-wrap"
              style={{
                width: geometry.width * scale,
                height: geometry.height * scale,
              }}
            >
              <BookshelfScene
                design={preview?.design ?? arrangement ?? design}
                books={allBooks}
                svgRef={svg}
                selected={selected}
                highlighted={
                  filtering
                    ? new Set(books.map((book) => book.book_id))
                    : undefined
                }
                designing={designing && !arrangement}
                onSelect={arrangement ? undefined : selectItem}
                onOpen={arrangement ? undefined : onSelect}
                onPointerDown={startDrag}
                preview={preview}
              />
            </div>
          </div>
          {!allBooks.length && (
            <div className="studio-empty">
              <p>
                Tu refugio empieza con una historia. Elige un ambiente y añade
                tu primer libro.
              </p>
              <button className="button primary" onClick={onAdd}>
                <Plus size={16} /> Añadir mi primer libro
              </button>
            </div>
          )}
          <div className="studio-caption">
            <span>
              {designing
                ? 'Toca un objeto para editarlo. Arrastra para cambiarlo de lugar.'
                : 'Cada lomo, una historia. Cada historia, su lugar.'}
            </span>
            <span>
              {allBooks.length} libros · {design.bookcases.length}{' '}
              {design.bookcases.length === 1 ? 'estantería' : 'estanterías'}
            </span>
          </div>
          {unplaced.length > 0 && (
            <div className="studio-unplaced">
              <span>
                Por colocar: <strong>{unplaced.length}</strong>{' '}
                {unplaced.length === 1 ? 'libro' : 'libros'}.
              </span>
              <button
                className="button secondary"
                onClick={() => {
                  setDesigning(true);
                  setTab('books');
                }}
              >
                Colocar mis libros
              </button>
              <div>
                {unplaced.slice(0, 6).map((book) => (
                  <button
                    key={book.book_id}
                    className="text-button"
                    onClick={() => onSelect(book.book_id)}
                  >
                    {book.book.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          {filtering && (
            <div className="studio-results">
              <strong>{books.length} coincidencias</strong>
              {books.map((book) => (
                <button
                  key={book.book_id}
                  className="text-button"
                  onClick={() => {
                    const item = design.items.find((entry) =>
                      entry.book_ids.includes(book.book_id),
                    );
                    if (item) {
                      setSelected([item.id]);
                      root.current
                        ?.querySelector(`[data-item-id="${item.id}"]`)
                        ?.scrollIntoView({ block: 'center', inline: 'center' });
                    } else onSelect(book.book_id);
                  }}
                >
                  {book.book.title}
                </button>
              ))}
            </div>
          )}
          <details className="studio-export">
            <summary>
              <Download size={15} /> Compartir una imagen de mi estantería
            </summary>
            <div>
              <label className="field">
                Encuadre
                <select
                  aria-label="Encuadre"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as typeof format)}
                >
                  <option value="original">Original</option>
                  <option value="square">Cuadrado</option>
                  <option value="portrait">Vertical · 9:16</option>
                </select>
              </label>
              <label className="field">
                Contenido
                <select
                  aria-label="Contenido"
                  value={exportCase}
                  onChange={(e) => setExportCase(e.target.value)}
                >
                  <option value="">Toda la biblioteca</option>
                  {design.bookcases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button secondary"
                disabled={exporting}
                onClick={() => void download()}
              >
                {exporting ? 'Preparando…' : 'Descargar PNG'}
              </button>
            </div>
          </details>
        </div>
        {designing && (
          <aside className="studio-panel" aria-label="Herramientas de diseño">
            <div
              className="studio-tabs"
              role="tablist"
              aria-label="Personalización"
            >
              {tabs.map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  aria-controls={`studio-tab-${id}`}
                  id={`studio-label-${id}`}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              className="studio-tab-content"
              role="tabpanel"
              id={`studio-tab-${tab}`}
              aria-labelledby={`studio-label-${tab}`}
            >
              <fieldset disabled={!!arrangement}>
                {tab === 'ambience' && (
                  <>
                    <p className="studio-panel-intro">
                      Un ambiente que se parezca a ti.
                    </p>
                    <div className="studio-presets">
                      {presets.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => setPresetId(preset.id)}
                        >
                          <span
                            className={`preset-art preset-${preset.id}`}
                            style={{ background: preset.color }}
                          >
                            <span />
                            <span />
                            <span />
                            <svg viewBox="0 0 140 200">
                              <DecorArt
                                asset={preset.assets[0]}
                                color="#809271"
                              />
                            </svg>
                          </span>
                          <strong>{preset.name}</strong>
                        </button>
                      ))}
                    </div>
                    <label className="field">
                      Fondo
                      <select
                        aria-label="Fondo"
                        value={design.background}
                        onChange={(e) =>
                          changed((next) => {
                            next.background = e.target
                              .value as BookshelfDesign['background'];
                          })
                        }
                      >
                        <option value="plain">Liso</option>
                        <option value="wall">Pared con paneles</option>
                        <option value="wallpaper">Papel decorativo</option>
                      </select>
                    </label>
                    <label className="field">
                      Color de la pared
                      <input
                        type="color"
                        aria-label="Color de la pared"
                        value={design.background_color}
                        onChange={(e) =>
                          changed((next) => {
                            next.background_color = e.target.value;
                          }, 'wall-color')
                        }
                      />
                    </label>
                    <button
                      className="button secondary"
                      aria-pressed={design.night}
                      onClick={() =>
                        changed((next) => {
                          next.night = !next.night;
                        })
                      }
                    >
                      {design.night ? <Sun size={16} /> : <Moon size={16} />}{' '}
                      {design.night ? 'Pasar al día' : 'Encender la noche'}
                    </button>
                  </>
                )}
                {tab !== 'ambience' && (
                  <div className="studio-location">
                    <label className="field">
                      Estantería
                      <select
                        aria-label="Estantería"
                        value={currentCase.id}
                        onChange={(e) => {
                          setCaseId(e.target.value);
                          setShelfId('');
                        }}
                      >
                        {design.bookcases.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      Balda
                      <select
                        aria-label="Balda"
                        value={currentShelf.id}
                        onChange={(e) => setShelfId(e.target.value)}
                      >
                        {currentCase.shelves.map((s, i) => (
                          <option key={s.id} value={s.id}>
                            Balda {i + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                {tab === 'furniture' && (
                  <>
                    <label className="field">
                      Nombre
                      <input
                        key={`${currentCase.id}-name`}
                        defaultValue={currentCase.name}
                        maxLength={80}
                        onBlur={(e) => {
                          const name = e.target.value.trim();
                          if (name)
                            changed((next) => {
                              next.bookcases.find(
                                (c) => c.id === currentCase.id,
                              )!.name = name;
                            });
                        }}
                      />
                    </label>
                    <label className="field">
                      Material
                      <select
                        aria-label="Material"
                        value={currentCase.material}
                        onChange={(e) =>
                          changed((next) => {
                            next.bookcases.find(
                              (c) => c.id === currentCase.id,
                            )!.material = e.target
                              .value as typeof currentCase.material;
                          })
                        }
                      >
                        {materials.map((material) => (
                          <option key={material} value={material}>
                            {materialNames[material]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      Anchura · {currentCase.width}
                      <input
                        type="range"
                        min="320"
                        max="1600"
                        step="20"
                        aria-label="Anchura de estantería"
                        value={currentCase.width}
                        onChange={(e) => {
                          const next = cloneDesign(design);
                          next.bookcases.find(
                            (c) => c.id === currentCase.id,
                          )!.width = Number(e.target.value);
                          if (
                            next.items.every((item) =>
                              canPlace(next, item, item.shelf_id, item.x),
                            )
                          )
                            editable(next, 'case-width');
                          else
                            setMessage(
                              'Mueve los objetos del extremo antes de reducir la anchura.',
                            );
                        }}
                      />
                    </label>
                    <label className="field">
                      Altura de balda · {currentShelf.height}
                      <input
                        type="range"
                        min="160"
                        max="600"
                        step="10"
                        aria-label="Altura de balda"
                        value={currentShelf.height}
                        onChange={(e) => {
                          const next = cloneDesign(design);
                          next.bookcases
                            .find((c) => c.id === currentCase.id)!
                            .shelves.find(
                              (s) => s.id === currentShelf.id,
                            )!.height = Number(e.target.value);
                          if (
                            next.items.every((item) =>
                              canPlace(next, item, item.shelf_id, item.x),
                            )
                          )
                            editable(next, 'shelf-height');
                          else
                            setMessage(
                              'Los objetos son más altos que esa balda. Elige otra altura.',
                            );
                        }}
                      />
                    </label>
                    <label className="field">
                      Color de la luz
                      <input
                        type="color"
                        aria-label="Color de la luz"
                        value={currentShelf.light.color}
                        onChange={(e) =>
                          changed((next) => {
                            next.bookcases
                              .find((c) => c.id === currentCase.id)!
                              .shelves.find(
                                (s) => s.id === currentShelf.id,
                              )!.light.color = e.target.value;
                          }, 'light-color')
                        }
                      />
                    </label>
                    <label className="field">
                      Intensidad
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        aria-label="Intensidad de luz"
                        value={currentShelf.light.intensity}
                        onChange={(e) =>
                          changed((next) => {
                            next.bookcases
                              .find((c) => c.id === currentCase.id)!
                              .shelves.find(
                                (s) => s.id === currentShelf.id,
                              )!.light.intensity = Number(e.target.value);
                          }, 'light-intensity')
                        }
                      />
                    </label>
                    <label className="studio-checkbox">
                      <input
                        type="checkbox"
                        checked={currentShelf.light.garland}
                        onChange={(e) =>
                          changed((next) => {
                            next.bookcases
                              .find((c) => c.id === currentCase.id)!
                              .shelves.find(
                                (s) => s.id === currentShelf.id,
                              )!.light.garland = e.target.checked;
                          })
                        }
                      />{' '}
                      Guirnalda de luces
                    </label>
                    <div className="studio-button-row">
                      <button
                        className="button secondary"
                        disabled={currentCase.shelves.length >= 100}
                        onClick={() =>
                          changed((next) => {
                            const shelf = newShelf();
                            next.bookcases
                              .find((c) => c.id === currentCase.id)!
                              .shelves.push(shelf);
                            setShelfId(shelf.id);
                          })
                        }
                      >
                        <Plus size={14} /> Añadir balda
                      </button>
                      <button
                        className="text-button"
                        disabled={currentCase.shelves.length === 1}
                        onClick={() => {
                          changed((next) => {
                            next.bookcases.find(
                              (c) => c.id === currentCase.id,
                            )!.shelves = currentCase.shelves.filter(
                              (s) => s.id !== currentShelf.id,
                            );
                            next.items = next.items.filter(
                              (item) => item.shelf_id !== currentShelf.id,
                            );
                          });
                          setShelfId('');
                          setMessage(
                            'Los libros de esa balda están en «Por colocar».',
                          );
                        }}
                      >
                        Eliminar balda
                      </button>
                    </div>
                    <button
                      className="button secondary"
                      disabled={design.bookcases.length >= 20}
                      onClick={() =>
                        changed((next) => {
                          const c = newBookcase();
                          c.name = `Estantería ${next.bookcases.length + 1}`;
                          next.bookcases.push(c);
                          setCaseId(c.id);
                        })
                      }
                    >
                      <Plus size={14} /> Crear estantería
                    </button>
                    <button
                      className="text-button"
                      disabled={design.bookcases.length === 1}
                      onClick={() => {
                        changed((next) => {
                          next.bookcases = next.bookcases.filter(
                            (c) => c.id !== currentCase.id,
                          );
                          next.items = next.items.filter(
                            (item) =>
                              !currentCase.shelves.some(
                                (s) => s.id === item.shelf_id,
                              ),
                          );
                        });
                        setCaseId('');
                        setMessage(
                          'Los libros del mueble están en «Por colocar».',
                        );
                      }}
                    >
                      Eliminar este mueble
                    </button>
                  </>
                )}
                {selectedItem && (tab === 'decor' || tab === 'books') && (
                  <section
                    className="studio-inspector"
                    aria-label="Objeto seleccionado"
                  >
                    <div className="studio-inspector-title">
                      <strong>
                        {selectedItem.kind === 'decor'
                          ? decorations.find(
                              (a) => a[0] === selectedItem.asset,
                            )?.[1]
                          : selectedItem.book_ids
                              .map((id) => bookMap.get(id)?.book.title)
                              .join(' · ')}
                      </strong>
                      <button
                        className="icon-button"
                        aria-label="Quitar selección"
                        onClick={() => setSelected([])}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="studio-move-controls">
                      <button
                        className="icon-button"
                        aria-label="Mover a la izquierda"
                        onClick={() => move('left')}
                      >
                        <ArrowLeft size={17} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Mover a la derecha"
                        onClick={() => move('right')}
                      >
                        <ArrowRight size={17} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Mover a la balda anterior"
                        onClick={() => move('up')}
                      >
                        <ArrowUp size={17} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Mover a la balda siguiente"
                        onClick={() => move('down')}
                      >
                        <ArrowDown size={17} />
                      </button>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => put(selectedItem, currentShelf.id)}
                    >
                      Mover a la balda elegida
                    </button>
                    {selectedItem.kind === 'decor' ? (
                      <>
                        <label className="field">
                          Color del objeto
                          <input
                            type="color"
                            aria-label="Color del objeto"
                            value={selectedItem.color}
                            onChange={(e) =>
                              updateItem(
                                { color: e.target.value },
                                'decor-color',
                              )
                            }
                          />
                        </label>
                        <label className="field">
                          Espacio que ocupa
                          <select
                            aria-label="Tamaño del objeto"
                            value={decorationSpan(selectedItem, decorUnit)}
                            onChange={(e) =>
                              updateItem(
                                resizeDecoration(
                                  selectedItem,
                                  Number(e.target.value) as 1 | 2 | 3,
                                  decorUnit,
                                ),
                                'decor-size',
                              )
                            }
                          >
                            <option value="1">1 libro</option>
                            <option value="2">2 libros</option>
                            <option value="3">3 libros</option>
                          </select>
                        </label>
                        <label className="field">
                          Orientación
                          <input
                            type="range"
                            min="-20"
                            max="20"
                            aria-label="Orientación del objeto"
                            value={selectedItem.rotation}
                            onChange={(e) =>
                              updateItem(
                                { rotation: Number(e.target.value) },
                                'decor-rotation',
                              )
                            }
                          />
                        </label>
                        <button
                          className="text-button"
                          onClick={() =>
                            put({ ...selectedItem, id: sceneId('decor') })
                          }
                        >
                          Duplicar objeto
                        </button>
                      </>
                    ) : selectedItem.kind === 'book' ? (
                      <>
                        <label className="field">
                          Colocación
                          <select
                            aria-label="Colocación"
                            value={selectedItem.mode}
                            onChange={(e) => {
                              const item = bookItem(
                                bookMap.get(selectedItem.book_ids[0])!,
                                e.target.value as BookMode,
                              );
                              updateItem({
                                mode: item.mode,
                                width: item.width,
                                height: item.height,
                              });
                            }}
                          >
                            <option value="upright">De pie</option>
                            <option value="lean">Inclinado</option>
                            <option value="cover">Mostrar portada</option>
                          </select>
                        </label>
                        <label className="field">
                          Estilo del lomo
                          <select
                            aria-label="Estilo del lomo"
                            value={selectedItem.asset || 'classic'}
                            onChange={(e) =>
                              updateItem({ asset: e.target.value })
                            }
                          >
                            <option value="classic">Clásico</option>
                            <option value="modern">Contemporáneo</option>
                            <option value="ornate">Editorial</option>
                          </select>
                        </label>
                        <button
                          className="button secondary"
                          onClick={() =>
                            setAppearanceId(selectedItem.book_ids[0])
                          }
                        >
                          Personalizar lomo
                        </button>
                        <button
                          className="text-button"
                          onClick={() => onSelect(selectedItem.book_ids[0])}
                        >
                          Abrir ficha del libro
                        </button>
                      </>
                    ) : (
                      <button
                        className="text-button"
                        onClick={() => {
                          changed((next) => {
                            next.items = next.items.filter(
                              (item) => item.id !== selectedItem.id,
                            );
                          });
                          setSelected([]);
                          setMessage(
                            'Los libros de la pila están en «Por colocar».',
                          );
                        }}
                      >
                        Deshacer pila
                      </button>
                    )}
                    <button
                      className="text-button studio-remove"
                      onClick={() => {
                        changed((next) => {
                          next.items = next.items.filter(
                            (item) => !selected.includes(item.id),
                          );
                        });
                        setSelected([]);
                      }}
                    >
                      {selectedItem.kind === 'decor'
                        ? 'Quitar decoración'
                        : 'Dejar en «Por colocar»'}
                    </button>
                  </section>
                )}
                {tab === 'decor' && (
                  <>
                    <p className="studio-panel-intro">
                      Pequeños detalles que hacen hogar.
                    </p>
                    <div className="studio-decor-grid">
                      {decorations.map(([asset, label]) => (
                        <button
                          key={asset}
                          title={label}
                          onClick={() =>
                            put(decorItem(asset, undefined, decorUnit))
                          }
                        >
                          <DecorArt
                            asset={asset}
                            color={
                              asset === 'fern' || asset === 'monstera'
                                ? '#758969'
                                : '#b48c64'
                            }
                          />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {tab === 'books' && (
                  <>
                    <button
                      className="button secondary"
                      onClick={() => setBatch(true)}
                    >
                      <Camera size={16} /> Capturar varios lomos
                    </button>
                    <p className="studio-panel-intro">
                      {unplaced.length
                        ? `${unplaced.length} libros por colocar. Selecciónalos y elige una balda.`
                        : 'Todos tus libros tienen su lugar.'}
                    </p>
                    <div className="studio-inventory">
                      {allBooks.map((book) => (
                        <div
                          key={book.book_id}
                          className="studio-inventory-book"
                        >
                          <label>
                            <input
                              type="checkbox"
                              aria-label={`Seleccionar ${book.book.title}`}
                              checked={selectedIds.includes(book.book_id)}
                              onChange={(e) => {
                                setSelected([]);
                                setChosenBooks(
                                  e.target.checked
                                    ? [
                                        ...new Set([
                                          ...selectedIds,
                                          book.book_id,
                                        ]),
                                      ]
                                    : selectedIds.filter(
                                        (id) => id !== book.book_id,
                                      ),
                                );
                              }}
                            />
                            <span
                              className="inventory-spine"
                              style={{ background: spineStyle(book).color }}
                            />
                            <span>
                              {book.book.title}
                              <small>
                                {placed.has(book.book_id)
                                  ? 'En la estantería'
                                  : 'Por colocar'}
                              </small>
                            </span>
                          </label>
                          <button
                            className="icon-button"
                            aria-label={`Colocar ${book.book.title}`}
                            disabled={placed.has(book.book_id)}
                            onClick={() => put(bookItem(book))}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {selectedIds.length > 0 && (
                      <div className="studio-multi">
                        <strong>
                          {selectedIds.length} libros seleccionados
                        </strong>
                        <button
                          className="button secondary"
                          onClick={() => {
                            let next = cloneDesign(design);
                            removeSelectedBooks(next);
                            for (const id of selectedIds)
                              next =
                                placeItem(
                                  next,
                                  bookItem(bookMap.get(id)!),
                                  currentShelf.id,
                                ) ?? next;
                            editable(next);
                            setChosenBooks([]);
                            setSelected([]);
                            setMessage(
                              'Colocación aplicada. Los libros que no caben siguen en «Por colocar».',
                            );
                          }}
                        >
                          Colocar en esta balda
                        </button>
                        <button
                          className="button secondary"
                          onClick={stackBooks}
                        >
                          Crear pila horizontal
                        </button>
                        <label className="field">
                          Organizar selección
                          <select
                            aria-label="Organizar selección"
                            defaultValue=""
                            onChange={(e) => {
                              const entries = selectedIds
                                  .map((id) => bookMap.get(id)!)
                                  .filter(Boolean),
                                sort = e.target.value;
                              const ordered = sortSceneBooks(entries, sort);
                              setArrangement(arrangeBooks(design, ordered));
                              e.target.value = '';
                            }}
                          >
                            <option value="" disabled>
                              Previsualizar por…
                            </option>
                            <option value="title">Título</option>
                            <option value="author">Autor</option>
                            <option value="color">Color</option>
                            <option value="status">Estado de lectura</option>
                          </select>
                        </label>
                      </div>
                    )}
                  </>
                )}
              </fieldset>
            </div>
          </aside>
        )}
      </div>
      {arrangement && (
        <div className="studio-preview-bar" role="status">
          <p>
            Esta es la propuesta de organización. La decoración conserva su
            lugar.
          </p>
          <button
            className="button primary"
            onClick={() => {
              editable(arrangement);
              setArrangement(null);
            }}
          >
            Aplicar organización
          </button>
          <button
            className="button secondary"
            onClick={() => setArrangement(null)}
          >
            Cancelar
          </button>
        </div>
      )}
      {message && (
        <p className="studio-message" role="status">
          {message}
        </p>
      )}
      <div className="studio-export-source" aria-hidden="true">
        <BookshelfScene
          svgRef={exportSvg}
          design={design}
          books={allBooks}
          caseId={exportCase || undefined}
        />
      </div>
      {presetId && (
        <Dialog
          title="Un nuevo ambiente para tu biblioteca"
          onClose={() => setPresetId(null)}
        >
          <p className="dialog-intro">
            Aplicar «{presets.find((p) => p.id === presetId)?.name}» sustituye
            los muebles y decoraciones. Conserva tus libros y fotos; puedes
            deshacer el cambio.
          </p>
          <div className="studio-preset-preview">
            <BookshelfScene
              design={applyPreset(allBooks, presetId)}
              books={allBooks}
            />
          </div>
          <button
            className="button primary"
            onClick={() => {
              editable(applyPreset(allBooks, presetId));
              setPresetId(null);
              setSelected([]);
              setChosenBooks([]);
            }}
          >
            Aplicar ambiente
          </button>
          <button
            className="button secondary"
            onClick={() => setPresetId(null)}
          >
            Conservar mi diseño
          </button>
        </Dialog>
      )}
      <Suspense fallback={<p role="status">Preparando el editor de fotos…</p>}>
        {appearance && (
          <Dialog
            title="Personalizar lomo"
            onClose={() => {
              if (!appearanceBusy) setAppearanceId(null);
            }}
            busy={appearanceBusy}
          >
            <BookAppearanceEditor
              ownerId={ownerId}
              entry={appearance}
              onBusy={setAppearanceBusy}
              onClose={() => setAppearanceId(null)}
              onUpdated={(next) => {
                onUpdated?.(next);
                if (!onUpdated) onReload();
              }}
            />
          </Dialog>
        )}
        {batch && (
          <BatchSpineCapture
            ownerId={ownerId}
            books={allBooks}
            onClose={() => setBatch(false)}
            onUpdated={(next) => {
              onUpdated?.(next);
              if (!onUpdated) onReload();
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
