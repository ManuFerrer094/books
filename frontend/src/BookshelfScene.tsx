import {
  useEffect,
  useId,
  useMemo,
  useState,
  type PointerEvent,
  type Ref,
  type CSSProperties,
} from 'react';
import {
  sceneGeometry,
  itemSize,
  decorations,
  type BookshelfDesign,
  type SceneItem,
} from '../../src/library/bookshelf-design';
import { spineStyle, textColor } from './bookshelf-layout';
import { supabase } from './supabase';
import type { LibraryBook } from './types';
import {
  decorationAssets,
  decorationColor,
  decorationTintMatrix,
} from './bookshelf-decor';

const woods = {
  oak: ['#c59b66', '#8b613c', '#e3c493'],
  walnut: ['#765138', '#35271f', '#a07850'],
  birch: ['#dfcba4', '#aa9169', '#f3e5c5'],
  white: ['#f5f1e8', '#bebbb2', '#ffffff'],
  black: ['#373d3b', '#171c1d', '#59605a'],
};
function useScenePhotos(books: LibraryBook[]) {
  const paths = useMemo(
    () =>
      ['book-spines', 'book-covers'].map((bucket) => ({
        bucket,
        paths: [
          ...new Set(
            books
              .map((book) =>
                bucket === 'book-spines'
                  ? book.spine?.image_path
                  : book.book.cover_image_path,
              )
              .filter((p): p is string => !!p),
          ),
        ],
      })),
    [books],
  );
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    setPhotos({});
    setReady(false);
    const refresh = async () => {
      const result: Record<string, string> = {};
      await Promise.all(
        paths.map(async ({ bucket, paths: files }) => {
          if (!supabase || !files.length) return;
          for (let offset = 0; offset < files.length; offset += 100) {
            const { data } = await supabase.storage
              .from(bucket)
              .createSignedUrls(files.slice(offset, offset + 100), 3600);
            data?.forEach((entry) => {
              if (entry.path && entry.signedUrl)
                result[`${bucket}/${entry.path}`] = entry.signedUrl;
            });
          }
        }),
      );
      if (active) {
        setPhotos(result);
        setReady(true);
      }
    };
    void refresh().catch(() => {
      if (active) setReady(true);
    });
    const interval = window.setInterval(
      () => void refresh().catch(() => {}),
      50 * 60 * 1000,
    );
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [paths]);
  return { photos, ready };
}

export function DecorArt({
  asset,
  color,
  thumbnail = false,
}: {
  asset: string;
  color: string;
  thumbnail?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const [failedAsset, setFailedAsset] = useState<string | null>(null);
  const resource = decorationAssets[asset];
  const failed = failedAsset === asset || !resource;
  const tint = decorationColor(asset, color);
  const recolored =
    !thumbnail && resource && tint.toLowerCase() !== resource.naturalColor;
  const src = resource && (thumbnail ? resource.thumbnail : resource.src);
  const width = failed ? 140 : resource.width;
  const height = failed ? 200 : resource.height;
  const onError = () => setFailedAsset(asset);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      data-decor-art={asset}
      data-decoration-unavailable={failed ? 'true' : undefined}
    >
      {!failed && recolored && (
        <defs>
          <mask
            id={`${id}-material`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={width}
            height={height}
            style={{ maskType: 'alpha' }}
          >
            <image
              href={resource.mask}
              width={width}
              height={height}
              preserveAspectRatio="xMidYMax meet"
              onError={onError}
            />
          </mask>
          <filter
            id={`${id}-tint`}
            colorInterpolationFilters="sRGB"
            x="0"
            y="0"
            width="100%"
            height="100%"
          >
            <feColorMatrix
              type="matrix"
              values={decorationTintMatrix(tint, resource.naturalColor)}
            />
          </filter>
        </defs>
      )}
      <g data-decor-fallback="true" display={failed ? 'inline' : 'none'}>
        <FallbackDecorArt asset={asset} color={tint} />
      </g>
      {!failed && (
        <g data-decor-resource="true">
          <image
            href={src}
            width={width}
            height={height}
            preserveAspectRatio="xMidYMax meet"
            onError={onError}
          />
          {recolored && (
            <image
              href={src}
              width={width}
              height={height}
              preserveAspectRatio="xMidYMax meet"
              filter={`url(#${id}-tint)`}
              mask={`url(#${id}-material)`}
              onError={onError}
            />
          )}
        </g>
      )}
    </svg>
  );
}

function FallbackDecorArt({ asset, color }: { asset: string; color: string }) {
  const category = decorations.find((entry) => entry[0] === asset)?.[2];
  const plant = category === 'plant';
  return (
    <svg
      viewBox="0 0 140 200"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    >
      {plant && (
        <>
          {asset === 'cactus' ? (
            <g fill={color} stroke="#384d35" strokeWidth="3">
              <path d="M58 144V45Q58 20 77 20Q96 20 96 45V144Z" />
              <path d="M59 100H39Q22 100 22 80V58Q22 44 35 44Q48 44 48 58V78H61M96 114H109Q128 114 128 95V72Q128 59 115 59Q102 59 102 72V92H94" />
              <path d="M70 35V141M83 35V141" stroke="#ffffff40" />
            </g>
          ) : (
            <g stroke="#506648" strokeWidth="3" fill={color}>
              <path
                d="M70 151Q65 73 79 24M71 113Q29 80 24 42M71 100Q111 70 121 31M71 140Q42 124 16 91M72 133Q106 125 132 94"
                fill="none"
              />
              {[
                [-22, 9, -35],
                [21, 4, 35],
                [-34, 47, -55],
                [36, 47, 55],
                [-40, 78, -65],
                [44, 80, 65],
              ].map(([dx, dy, angle], i) => (
                <g
                  key={i}
                  transform={`translate(${70 + dx} ${35 + dy}) rotate(${angle})`}
                >
                  <ellipse
                    rx={asset === 'fern' ? 12 : 20}
                    ry={asset === 'flowers' ? 17 : 32}
                    fill={
                      asset === 'flowers'
                        ? ['#d79397', '#e4c976', '#cfb0c7'][i % 3]
                        : color
                    }
                  />
                  <path d="M0 -24V26" stroke="#ffffff30" strokeWidth="1.5" />
                  {asset === 'monstera' && (
                    <path
                      d="M-17 -8L-3 -2M18 7L3 13"
                      stroke="#344e34"
                      strokeWidth="4"
                    />
                  )}
                </g>
              ))}
            </g>
          )}
          <path
            d="M42 146H103L95 195H51Z"
            fill={asset === 'bonsai' ? '#59636a' : '#bf8c69'}
          />
          <path d="M43 148H103V159H43Z" fill="#dda884" />
          <path d="M51 161H60L65 191H56Z" fill="#ffffff1c" />
        </>
      )}
      {(category === 'pot' || category === 'vase') && (
        <g fill={color} stroke="#00000018" strokeWidth="2">
          <path
            d={
              category === 'pot'
                ? 'M20 91H120L105 194H35Z'
                : asset === 'round-vase'
                  ? 'M52 54H88V85Q131 109 123 150Q116 194 70 195Q24 194 17 150Q10 109 52 85Z'
                  : 'M49 29H91L87 78Q112 124 109 157Q107 191 95 195H45Q33 191 31 157Q28 124 53 78Z'
            }
          />
          <path
            d="M46 103Q32 158 48 180"
            fill="none"
            stroke="#ffffff40"
            strokeWidth="9"
          />
          <ellipse
            cx="70"
            cy={category === 'pot' ? 91 : asset === 'round-vase' ? 54 : 29}
            rx={category === 'pot' ? 50 : 21}
            ry="6"
            fill="#00000030"
          />
        </g>
      )}
      {category === 'candle' &&
        (asset === 'candles' ? [28, 69, 107] : [70]).map((x, i) => (
          <g key={x} transform={`translate(${x - 20} ${i % 2 ? 28 : 0})`}>
            <rect
              x="0"
              y="88"
              width="40"
              height={i % 2 ? 77 : 105}
              rx="3"
              fill={color}
            />
            <ellipse cx="20" cy="88" rx="20" ry="5" fill="#f4e1ba" />
            <path d="M20 80Q-1 60 20 36Q41 61 20 80" fill="#f7c76f" />
            <path d="M20 73Q10 65 20 51Q29 64 20 73" fill="#fff5c8" />
            <path d="M20 82V90" stroke="#443527" strokeWidth="2" />
            <path d="M9 95V183" stroke="#ffffff2a" strokeWidth="4" />
          </g>
        ))}
      {category === 'lamp' && (
        <g>
          {asset === 'lantern' ? (
            <>
              <path
                d="M45 52V39Q70 8 95 39V52"
                stroke={color}
                strokeWidth="8"
                fill="none"
              />
              <path
                d="M28 61H112L103 187H37Z"
                fill="#ffe1a944"
                stroke={color}
                strokeWidth="8"
              />
              <path d="M70 70V184" stroke={color} strokeWidth="5" />
              <rect x="50" y="127" width="40" height="57" fill="#ffe4b0" />
              <path d="M25 53H115V65H25M31 187H109V197H31" fill={color} />
            </>
          ) : (
            <>
              <ellipse cx="72" cy="190" rx="40" ry="7" fill={color} />
              <path d="M72 94V189" stroke={color} strokeWidth="8" />
              <path d="M44 36H100L120 100Q70 111 20 100Z" fill={color} />
              <path d="M45 38L32 96" stroke="#ffffff36" strokeWidth="8" />
              <ellipse cx="70" cy="100" rx="49" ry="8" fill="#ffe7b6" />
            </>
          )}
        </g>
      )}
      {category === 'frame' && (
        <g>
          <rect x="10" y="40" width="120" height="152" rx="2" fill={color} />
          <rect x="20" y="50" width="100" height="132" fill="#eee5d5" />
          {asset === 'landscape' ? (
            <>
              <rect x="29" y="59" width="82" height="114" fill="#c8d5ca" />
              <circle cx="88" cy="87" r="16" fill="#eee0b0" />
              <path d="M29 156L56 104L91 155L110 129V173H29" fill="#6f8370" />
            </>
          ) : (
            <>
              <circle cx="70" cy="99" r="25" fill="#bc987d" />
              <path d="M35 167Q36 128 70 128Q104 128 106 167" fill="#7f8b70" />
              <path
                d="M44 92Q43 66 72 66Q103 67 97 104L91 82L47 92"
                fill="#534334"
              />
            </>
          )}
          <path
            d="M13 190V42H128"
            stroke="#ffffff30"
            fill="none"
            strokeWidth="3"
          />
        </g>
      )}
      {category === 'bookend' && (
        <g fill={color}>
          <path
            d={
              asset === 'arch'
                ? 'M15 195V112Q15 51  seventy 51Q125 51 125 112V195H96V114Q96 83 70 83Q44 83 44 114V195Z'.replace(
                    'seventy',
                    '70',
                  )
                : 'M10 195L68 62L130 195Z'
            }
          />
          <path d="M14 189H130" stroke="#ffffff40" strokeWidth="3" />
          {asset === 'mountain' && (
            <path d="M52 98L68 62L84 99L70 91L63 102Z" fill="#eee9dd" />
          )}
        </g>
      )}
      {category === 'divider' && (
        <g>
          <rect x="58" y="12" width="18" height="184" rx="2" fill={color} />
          <path d="M63 16V191" stroke="#ffffff60" strokeWidth="2" />
          {asset === 'label' && (
            <>
              <rect
                x="31"
                y="58"
                width="71"
                height="45"
                rx="4"
                fill="#f3e6cb"
                stroke={color}
                strokeWidth="3"
              />
              <path d="M43 75H90M48 86H83" stroke={color} strokeWidth="2" />
            </>
          )}
        </g>
      )}
      {category === 'clock' && (
        <g>
          <path
            d="M34 194L42 167M106 194L99 167"
            stroke={color}
            strokeWidth="9"
          />
          <circle cx="70" cy="113" r="67" fill={color} />
          <circle cx="70" cy="113" r="55" fill="#f1e8d8" />
          {Array.from({ length: 12 }, (_, i) => (
            <path
              key={i}
              d="M70 65V73"
              stroke="#7e705e"
              strokeWidth="2"
              transform={`rotate(${i * 30} 70 113)`}
            />
          ))}
          <path
            d="M70 86V113L94 127"
            stroke="#514940"
            strokeWidth="4"
            fill="none"
          />
          <circle cx="70" cy="113" r="4" fill="#514940" />
        </g>
      )}
      {category === 'mug' && (
        <g>
          <path
            d="M103 113H114Q145 143 109 166H100"
            fill="none"
            stroke={color}
            strokeWidth="12"
          />
          <path
            d="M20 100H105V162Q105 194 64 194Q20 194 20 162Z"
            fill={color}
          />
          <ellipse cx="62" cy="101" rx="43" ry="9" fill="#5c4030" />
          <path d="M31 112V166" stroke="#ffffff30" strokeWidth="8" />
          <path
            d="M50 75Q34 61 53 45M78 75Q63 59 82 41"
            stroke="#e2d8c8"
            strokeWidth="3"
            fill="none"
          />
        </g>
      )}
      {category === 'figure' && (
        <g fill={color} stroke="#00000015" strokeWidth="2">
          {asset === 'cat' ? (
            <>
              <path d="M39 98L34 53L61 70Q78 62 94 72L112 52L110 100Q128 154 106 195H43Q16 153 39 98Z" />
              <path
                d="M29 178Q0 171 10 126"
                fill="none"
                stroke={color}
                strokeWidth="15"
              />
              <circle cx="57" cy="94" r="3" fill="#3e3b31" />
              <circle cx="92" cy="94" r="3" fill="#3e3b31" />
            </>
          ) : asset === 'bird' ? (
            <>
              <ellipse cx="63" cy="138" rx="46" ry="40" />
              <circle cx="91" cy="99" r="28" />
              <path d="M116 98L140 110L117 115M22 136L4 101L9 148" />
              <circle cx="101" cy="94" r="3" fill="#36382e" />
              <path d="M62 174V194M80 174V194" stroke={color} strokeWidth="4" />
            </>
          ) : asset === 'moon' ? (
            <path d="M98 30Q23 45 27 108Q32 169 101 175Q63 140 63 103Q63 65 98 30Z" />
          ) : asset === 'star' ? (
            <path d="M70 36L90 92L139 95L101 132L113 188L70 157L27 188L39 132L1 95L51 92Z" />
          ) : (
            <>
              <path d="M31 195L16 91L57 21L93 35L126 112L104 195Z" />
              <path
                d="M57 21L61 195M93 35L78 98L104 195M16 91L78 98L126 112"
                stroke="#ffffff70"
                fill="none"
                strokeWidth="3"
              />
              <path d="M57 21L16 91L61 195Z" fill="#ffffff20" />
            </>
          )}
        </g>
      )}
    </svg>
  );
}

function ScenePhoto({
  src,
  width,
  height,
  fallback,
  requested,
  shading,
}: {
  src?: string;
  width: number;
  height: number;
  fallback: React.ReactNode;
  requested: boolean;
  shading?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <g
      data-photo-unavailable={
        requested && (!src || failed) ? 'true' : undefined
      }
    >
      {fallback}
      {src && !failed && (
        <image
          href={src}
          width={width}
          height={height}
          preserveAspectRatio="none"
          onError={() => setFailed(true)}
        />
      )}
      {(!src || failed) && shading}
    </g>
  );
}
function BookArt({
  entry,
  mode,
  width,
  height,
  photos,
  typography = 'classic',
}: {
  entry: LibraryBook;
  mode: string;
  width: number;
  height: number;
  photos: Record<string, string>;
  typography?: string;
}) {
  const color = spineStyle(entry).color,
    ink = textColor(color);
  const cover = mode === 'cover';
  const src = cover
    ? entry.book.cover_image_path
      ? photos[`book-covers/${entry.book.cover_image_path}`]
      : (entry.book.cover_url ?? undefined)
    : photos[`book-spines/${entry.spine?.image_path}`];
  const title = entry.book.title;
  const author =
    entry.book.authors?.map((a) => a.name).join(' · ') || 'Entre páginas';
  return (
    <g>
      <rect width={width} height={height} rx="2" fill={color} />
      <ScenePhoto
        requested={
          !!(cover
            ? entry.book.cover_image_path || entry.book.cover_url
            : entry.spine?.image_path)
        }
        src={src}
        width={width}
        height={height}
        shading={
          !cover && (
            <g data-automatic-spine-shading="true">
              <rect width="3" height={height} fill="#ffffff28" />
              <rect x={width - 3} width="3" height={height} fill="#00000028" />
              <rect
                x="3"
                y="0"
                width={Math.max(0, width - 6)}
                height="2"
                fill="#ffffff3b"
              />
            </g>
          )
        }
        fallback={
          cover ? (
            <>
              <rect
                x="8"
                y="8"
                width={width - 16}
                height={height - 16}
                rx="1"
                stroke={ink}
                strokeOpacity="0.45"
                fill="none"
              />
              <path d={`M${width / 2 - 18} 35h36`} stroke={ink} />
              <text
                x={width / 2}
                y={height * 0.4}
                textAnchor="middle"
                fill={ink}
                fontFamily="Lora,Georgia,serif"
                fontSize="14"
              >
                {title
                  .match(/.{1,15}(?:\s|$)|.{1,15}/g)
                  ?.slice(0, 5)
                  .map((line, i) => (
                    <tspan key={i} x={width / 2} dy={i ? 19 : 0}>
                      {line.trim()}
                    </tspan>
                  ))}
              </text>
              <text
                x={width / 2}
                y={height - 25}
                textAnchor="middle"
                fontSize="8"
                fill={ink}
              >
                {author.slice(0, 23)}
              </text>
            </>
          ) : (
            <>
              <path
                d={`M5 11H${width - 4}M5 16H${width - 4}M5 ${height - 24}H${width - 4}`}
                stroke={ink}
                strokeOpacity="0.55"
                strokeWidth="1"
              />
              <text
                transform={`translate(${width * 0.6} 28) rotate(90)`}
                fill={ink}
                fontFamily={
                  typography === 'modern'
                    ? 'Arial,sans-serif'
                    : 'Lora,Georgia,serif'
                }
                fontSize={typography === 'ornate' ? 12 : 11}
                fontWeight="600"
                textLength={Math.min(height - 63, title.length * 6)}
                lengthAdjust="spacingAndGlyphs"
              >
                {title.slice(0, 75)}
              </text>
              {width > 34 && (
                <text
                  transform={`translate(${width * 0.26} 28) rotate(90)`}
                  fill={ink}
                  opacity="0.75"
                  fontSize="7"
                  textLength={Math.min(height - 65, author.length * 4)}
                  lengthAdjust="spacingAndGlyphs"
                >
                  {author.slice(0, 55)}
                </text>
              )}
              <text
                x={width / 2}
                y={height - 9}
                textAnchor="middle"
                fill={ink}
                fontSize="7"
              >
                {entry.book.publisher?.slice(0, 2).toUpperCase() || 'EP'}
              </text>
            </>
          )
        }
      />
      {cover && (
        <g>
          <rect width="3" height={height} fill="#ffffff28" />
          <rect x={width - 3} width="3" height={height} fill="#00000028" />
          <rect
            x="3"
            y="0"
            width={Math.max(0, width - 6)}
            height="2"
            fill="#ffffff3b"
          />
        </g>
      )}
    </g>
  );
}

function BookInHand({
  entry,
  photos,
  width,
  height,
  depth,
  progress,
  tilt,
  restAngle,
  typography,
  onOpen,
}: {
  entry: LibraryBook;
  photos: Record<string, string>;
  width: number;
  height: number;
  depth: number;
  progress: number;
  tilt: number;
  restAngle: number;
  typography: string;
  onOpen?: (id: number) => void;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const p = ready ? progress : 0;
  return (
    <div
      className="book-in-hand-stage"
      style={
        {
          '--book-width': `${width}px`,
          '--book-height': `${height}px`,
          '--book-depth': `${depth}px`,
          '--book-angle': `${restAngle * (1 - p)}deg`,
          '--book-tilt': `${tilt * (1 - p)}deg`,
          '--book-rise': `${-(tilt ? height * 0.55 : 36) * p}px`,
          '--book-scale': 1 + p * 0.24,
          '--book-color': spineStyle(entry).color,
        } as CSSProperties
      }
    >
      <button
        type="button"
        className="book-in-hand"
        aria-label={`Abrir ficha de ${entry.book.title}`}
        onClick={() => onOpen?.(entry.book_id)}
      >
        <span className="book-in-hand-face book-in-hand-front">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            aria-hidden="true"
          >
            <BookArt
              entry={entry}
              mode="cover"
              width={width}
              height={height}
              photos={photos}
              typography={typography}
            />
          </svg>
        </span>
        <span className="book-in-hand-face book-in-hand-spine">
          <svg
            viewBox={`0 0 ${depth} ${height}`}
            width={depth}
            height={height}
            aria-hidden="true"
          >
            <BookArt
              entry={entry}
              mode="upright"
              width={depth}
              height={height}
              photos={photos}
              typography={typography}
            />
          </svg>
        </span>
        <span className="book-in-hand-face book-in-hand-pages" />
        <span className="book-in-hand-face book-in-hand-back" />
      </button>
    </div>
  );
}

export interface SceneProps {
  design: BookshelfDesign;
  books: LibraryBook[];
  selected?: string[];
  highlighted?: Set<number>;
  designing?: boolean;
  onSelect?: (
    item: SceneItem,
    additive: boolean,
    bookId?: number,
    direct?: boolean,
  ) => void;
  onOpen?: (id: number) => void;
  onPointerDown?: (event: PointerEvent<SVGGElement>, item: SceneItem) => void;
  preview?: {
    item: SceneItem;
    shelf_id: string;
    x: number;
    valid: boolean;
  } | null;
  svgRef?: Ref<SVGSVGElement>;
  caseId?: string;
  inspection?: { bookId: number; progress: number } | null;
}
export default function BookshelfScene({
  design,
  books,
  selected = [],
  highlighted,
  designing,
  onSelect,
  onOpen,
  onPointerDown,
  preview,
  svgRef,
  caseId,
  inspection,
}: SceneProps) {
  const uid = useId().replace(/:/g, ''),
    { photos, ready } = useScenePhotos(books),
    geometry = sceneGeometry(design);
  const interactive = !!(onSelect || onOpen);
  const bookMap = useMemo(
    () => new Map(books.map((book) => [book.book_id, book])),
    [books],
  );
  const selectedSet = new Set(selected);
  const cases = caseId
    ? geometry.cases.filter((c) => c.bookcase.id === caseId)
    : geometry.cases;
  const bounds =
    caseId && cases[0]
      ? {
          x: cases[0].x - 20,
          y: 0,
          width: cases[0].width + 40,
          height: cases[0].height + 150,
        }
      : { x: 0, y: 0, width: geometry.width, height: geometry.height };
  function renderItem(item: SceneItem, ghost = false) {
    const shelf = geometry.shelves.find(
      (entry) => entry.shelf.id === (ghost ? preview?.shelf_id : item.shelf_id),
    );
    if (!shelf) return null;
    const { width, height } = itemSize(item),
      x = shelf.x + (ghost ? preview!.x : item.x),
      y = shelf.bottom - height;
    const matching =
      !highlighted ||
      !item.book_ids.length ||
      item.book_ids.some((id) => highlighted.has(id));
    const label =
      item.kind === 'decor'
        ? decorations.find((a) => a[0] === item.asset)?.[1]
        : item.book_ids.map((id) => bookMap.get(id)?.book.title).join(', ');
    const book = bookMap.get(item.book_ids[0]);
    return (
      <g
        key={ghost ? 'ghost' : item.id}
        data-item-id={ghost || !interactive ? undefined : item.id}
        data-shelf-book={
          interactive && item.kind === 'book' && !ghost
            ? item.book_ids[0]
            : undefined
        }
        transform={`translate(${x} ${y})`}
        opacity={
          !ghost &&
          inspection?.bookId === item.book_ids[0] &&
          item.kind === 'book'
            ? 0
            : ghost
              ? 0.6
              : matching
                ? 1
                : 0.22
        }
        pointerEvents={
          !ghost &&
          inspection?.bookId === item.book_ids[0] &&
          item.kind === 'book'
            ? 'none'
            : undefined
        }
        role={
          ghost || !interactive
            ? undefined
            : item.kind === 'stack'
              ? 'group'
              : 'button'
        }
        tabIndex={
          ghost || !interactive ? undefined : item.kind === 'stack' ? -1 : 0
        }
        aria-label={
          ghost || !interactive
            ? undefined
            : `${designing ? 'Seleccionar' : 'Ver'} ${label}`
        }
        aria-pressed={
          designing && !ghost && item.kind !== 'stack'
            ? selectedSet.has(item.id)
            : undefined
        }
        onClick={
          ghost || item.kind === 'stack'
            ? undefined
            : (event) =>
                designing
                  ? onSelect?.(
                      item,
                      event.shiftKey || event.ctrlKey || event.metaKey,
                    )
                  : item.book_ids.length
                    ? onOpen?.(item.book_ids[0])
                    : undefined
        }
        onKeyDown={
          ghost || item.kind === 'stack'
            ? undefined
            : (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  designing
                    ? onSelect?.(
                        item,
                        event.shiftKey || event.ctrlKey || event.metaKey,
                        undefined,
                        true,
                      )
                    : item.book_ids.length && onOpen?.(item.book_ids[0]);
                }
              }
        }
        onPointerDown={
          ghost ? undefined : (event) => onPointerDown?.(event, item)
        }
        className={`scene-item ${selectedSet.has(item.id) ? 'selected' : ''}`}
      >
        <title>{label}</title>
        {interactive && !ghost && item.kind === 'decor' && (
          <rect
            width={width}
            height={height}
            fill="transparent"
            pointerEvents="all"
          />
        )}
        <ellipse
          cx={width / 2}
          cy={height + 2}
          rx={width / 2 + 4}
          ry="4"
          fill="#000000"
          opacity="0.19"
        />
        {item.kind === 'decor' ? (
          <g
            transform={`translate(${width / 2} ${height / 2}) rotate(${item.rotation}) scale(${1 / (1 + Math.abs(Math.sin((item.rotation * Math.PI) / 180)) * 1.4)}) translate(${-width / 2} ${-height / 2})`}
          >
            <svg width={width} height={height}>
              <DecorArt asset={item.asset} color={item.color} />
            </svg>
          </g>
        ) : item.kind === 'stack' ? (
          (() => {
            let bottom = height;
            const entries = item.book_ids
              .map((id) => bookMap.get(id))
              .filter((entry): entry is LibraryBook => !!entry);
            const total = entries.reduce(
              (sum, entry) => sum + spineStyle(entry).width,
              0,
            );
            const longest = Math.max(
              ...entries.map((entry) => spineStyle(entry).height),
            );
            return entries.map((entry, i) => {
              const h = (spineStyle(entry).width / total) * height;
              const w = (spineStyle(entry).height / longest) * (width - 4);
              bottom -= h;
              return (
                <g
                  key={entry.book_id}
                  className="scene-item"
                  data-shelf-book={
                    interactive && !ghost ? entry.book_id : undefined
                  }
                  transform={`translate(${i % 2 ? 4 : 0} ${bottom})`}
                  opacity={
                    !ghost && inspection?.bookId === entry.book_id
                      ? 0
                      : !highlighted ||
                          highlighted.has(entry.book_id) ||
                          !matching
                        ? 1
                        : 0.22
                  }
                  pointerEvents={
                    !ghost && inspection?.bookId === entry.book_id
                      ? 'none'
                      : undefined
                  }
                  role={interactive && !ghost ? 'button' : undefined}
                  tabIndex={interactive && !ghost ? 0 : undefined}
                  aria-label={
                    interactive && !ghost
                      ? `${designing ? 'Seleccionar' : 'Ver'} ${entry.book.title}`
                      : undefined
                  }
                  aria-pressed={
                    designing && !ghost ? selectedSet.has(item.id) : undefined
                  }
                  onClick={
                    ghost || !interactive
                      ? undefined
                      : (event) => {
                          event.stopPropagation();
                          if (designing)
                            onSelect?.(
                              item,
                              event.shiftKey || event.ctrlKey || event.metaKey,
                              entry.book_id,
                            );
                          else onOpen?.(entry.book_id);
                        }
                  }
                  onKeyDown={
                    ghost || !interactive
                      ? undefined
                      : (event) => {
                          if (event.key !== 'Enter' && event.key !== ' ')
                            return;
                          event.preventDefault();
                          event.stopPropagation();
                          if (designing)
                            onSelect?.(
                              item,
                              event.shiftKey || event.ctrlKey || event.metaKey,
                              entry.book_id,
                              true,
                            );
                          else onOpen?.(entry.book_id);
                        }
                  }
                >
                  <title>{entry.book.title}</title>
                  <g transform={`translate(0 ${h}) rotate(-90)`}>
                    <BookArt
                      entry={entry}
                      mode="upright"
                      width={h}
                      height={w}
                      photos={photos}
                      typography={item.asset || 'classic'}
                    />
                  </g>
                </g>
              );
            });
          })()
        ) : (
          book && (
            <g
              transform={
                item.mode === 'lean'
                  ? `translate(${height * 0.13} 0) skewX(-8)`
                  : undefined
              }
            >
              <BookArt
                entry={book}
                mode={item.mode}
                width={item.mode === 'lean' ? width - height * 0.14 : width}
                height={height}
                photos={photos}
                typography={item.asset || 'classic'}
              />
            </g>
          )
        )}
        {(selectedSet.has(item.id) || ghost) && (
          <rect
            x="-3"
            y="-3"
            width={width + 6}
            height={height + 6}
            rx="5"
            fill="none"
            stroke={
              ghost ? (preview!.valid ? '#91c5a2' : '#e18773') : '#d5ac65'
            }
            strokeWidth="3"
            strokeDasharray={ghost ? '7 5' : undefined}
          />
        )}
      </g>
    );
  }
  function renderInspection() {
    if (!inspection || !interactive) return null;
    const item = design.items.find((item) =>
      item.book_ids.includes(inspection.bookId),
    );
    const entry = bookMap.get(inspection.bookId);
    const shelf = geometry.shelves.find(
      (shelf) => shelf.shelf.id === item?.shelf_id,
    );
    if (!item || !entry || !shelf) return null;
    const size = itemSize(item);
    let height = size.height,
      depth = spineStyle(entry).width * item.scale;
    let cx = shelf.x + item.x + size.width / 2,
      cy = shelf.bottom - size.height / 2;
    if (item.kind === 'stack') {
      const entries = item.book_ids
        .map((id) => bookMap.get(id))
        .filter((book): book is LibraryBook => !!book);
      const total = entries.reduce(
        (sum, book) => sum + spineStyle(book).width,
        0,
      );
      const longest = Math.max(
        ...entries.map((book) => spineStyle(book).height),
      );
      let bottom = size.height;
      for (const [i, book] of entries.entries()) {
        const h = (spineStyle(book).width / total) * size.height;
        bottom -= h;
        if (book.book_id !== entry.book_id) continue;
        height = (spineStyle(book).height / longest) * (size.width - 4);
        depth = h;
        cx = shelf.x + item.x + (i % 2 ? 4 : 0) + height / 2;
        cy = shelf.bottom - size.height + bottom + h / 2;
        break;
      }
    }
    const width =
      item.kind === 'book' && item.mode === 'cover'
        ? size.width
        : (height * 2) / 3;
    return (
      <foreignObject
        x={cx - width}
        y={cy - height}
        width={width * 2}
        height={height * 2}
        className="book-in-hand-overlay"
        data-held-book={entry.book_id}
        data-pull-progress={inspection.progress}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <BookInHand
          key={entry.book_id}
          entry={entry}
          photos={photos}
          width={width}
          height={height}
          depth={depth}
          progress={inspection.progress}
          tilt={item.kind === 'stack' ? -90 : 0}
          restAngle={item.kind === 'book' && item.mode === 'cover' ? 0 : 90}
          typography={item.asset || 'classic'}
          onOpen={onOpen}
        />
      </foreignObject>
    );
  }
  return (
    <svg
      ref={svgRef}
      data-photos-ready={ready}
      xmlns="http://www.w3.org/2000/svg"
      className={`bookshelf-scene ${designing ? 'is-designing' : ''}`}
      viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
      width={bounds.width}
      height={bounds.height}
      aria-label="Tu estantería personalizada"
    >
      <defs>
        <linearGradient id={`${uid}-wall`} x2="0" y2="1">
          <stop stopColor={design.background_color} />
          <stop
            offset="1"
            stopColor={design.night ? '#121c26' : design.background_color}
          />
        </linearGradient>
        <pattern
          id={`${uid}-paper`}
          width="70"
          height="70"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M35 0Q55 15 35 35Q15 55 35 70M0 35Q15 15 35 35Q55 55 70 35"
            fill="none"
            stroke={design.night ? '#ffffff' : '#6c695c'}
            strokeOpacity="0.12"
            strokeWidth="1"
          />
        </pattern>
        <pattern
          id={`${uid}-wall-lines`}
          width="160"
          height="180"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 0H160V180H0Z"
            stroke="#000000"
            strokeOpacity="0.045"
            fill="none"
            strokeWidth="2"
          />
        </pattern>
        {cases.map(({ bookcase }) => {
          const wood = woods[bookcase.material];
          return (
            <g key={bookcase.id}>
              <linearGradient id={`${uid}-${bookcase.id}-wood`} x2="0" y2="1">
                <stop stopColor={wood[2]} />
                <stop offset="0.35" stopColor={wood[0]} />
                <stop offset="1" stopColor={wood[1]} />
              </linearGradient>
              <linearGradient id={`${uid}-${bookcase.id}-back`} x2="0" y2="1">
                <stop stopColor={wood[1]} />
                <stop offset="0.45" stopColor={wood[0]} />
                <stop offset="1" stopColor={wood[1]} />
              </linearGradient>
              <pattern
                id={`${uid}-${bookcase.id}-grain`}
                width="150"
                height="56"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M0 9Q40 16 80 8T160 11M0 27Q47 13 92 24T160 22M0 40Q53 50 100 38T160 44M0 51Q63 40 120 52"
                  stroke={wood[1]}
                  strokeWidth="0.7"
                  opacity="0.35"
                  fill="none"
                />
              </pattern>
            </g>
          );
        })}
        {geometry.shelves.map(({ shelf }) => (
          <linearGradient
            key={shelf.id}
            id={`${uid}-${shelf.id}-light`}
            x2="0"
            y2="1"
          >
            <stop
              stopColor={shelf.light.color}
              stopOpacity={shelf.light.intensity * 0.8}
            />
            <stop offset="1" stopColor={shelf.light.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      <rect
        x={bounds.x}
        width={bounds.width}
        height={bounds.height}
        fill={`url(#${uid}-wall)`}
      />
      {design.background !== 'plain' && (
        <rect
          x={bounds.x}
          width={bounds.width}
          height={bounds.height}
          fill={`url(#${uid}-${design.background === 'wallpaper' ? 'paper' : 'wall-lines'})`}
        />
      )}
      {cases.map(({ bookcase, x, y, width, height }) => (
        <g key={bookcase.id}>
          <rect
            x={x + 9}
            y={y + 16}
            width={width}
            height={height}
            rx="4"
            fill="#000000"
            opacity="0.13"
          />
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={`url(#${uid}-${bookcase.id}-wood)`}
          />
          <text
            x={x + width / 2}
            y="47"
            textAnchor="middle"
            fill={design.night ? '#e7dfcd' : '#5f5749'}
            fontFamily="Lora,Georgia,serif"
            fontSize="19"
            letterSpacing="2"
          >
            {bookcase.name}
          </text>
          {geometry.shelves
            .filter((entry) => entry.bookcase.id === bookcase.id)
            .map((entry, index) => (
              <g
                key={entry.shelf.id}
                data-shelf-id={entry.shelf.id}
                data-shelf-row={index}
              >
                <rect
                  x={entry.x}
                  y={entry.y}
                  width={bookcase.width}
                  height={entry.shelf.height}
                  fill={`url(#${uid}-${bookcase.id}-back)`}
                />
                <rect
                  x={entry.x}
                  y={entry.y}
                  width={bookcase.width}
                  height={entry.shelf.height}
                  fill="#16120e"
                  opacity={design.night ? 0.48 : 0.15}
                />
                {bookcase.material !== 'white' &&
                  bookcase.material !== 'black' && (
                    <rect
                      x={entry.x}
                      y={entry.y}
                      width={bookcase.width}
                      height={entry.shelf.height}
                      fill={`url(#${uid}-${bookcase.id}-grain)`}
                      opacity="0.3"
                    />
                  )}
                <path
                  d={`M${entry.x} ${entry.y}v${entry.shelf.height}h${bookcase.width}`}
                  stroke="#00000030"
                  strokeWidth="7"
                  fill="none"
                />
                <rect
                  x={entry.x}
                  y={entry.y}
                  width={bookcase.width}
                  height={entry.shelf.height * 0.82}
                  fill={`url(#${uid}-${entry.shelf.id}-light)`}
                />
                {entry.shelf.light.intensity > 0 && (
                  <rect
                    x={entry.x + 8}
                    y={entry.y + 2}
                    width={bookcase.width - 16}
                    height="3"
                    rx="2"
                    fill={entry.shelf.light.color}
                    opacity={entry.shelf.light.intensity}
                  />
                )}
                {entry.shelf.light.garland && (
                  <g>
                    <path
                      d={`M${entry.x + 6} ${entry.y + 12}Q${entry.x + bookcase.width / 2} ${entry.y + 63} ${entry.x + bookcase.width - 6} ${entry.y + 12}`}
                      fill="none"
                      stroke="#b6a77e"
                      strokeWidth="1.5"
                    />
                    {Array.from({ length: 19 }, (_, i) => {
                      const t = (i + 1) / 20;
                      return (
                        <g key={i}>
                          <circle
                            cx={entry.x + bookcase.width * t}
                            cy={entry.y + 12 + 100 * t * (1 - t)}
                            r="8"
                            fill={entry.shelf.light.color}
                            opacity="0.18"
                          />
                          <circle
                            cx={entry.x + bookcase.width * t}
                            cy={entry.y + 12 + 100 * t * (1 - t)}
                            r="3"
                            fill={entry.shelf.light.color}
                          />
                        </g>
                      );
                    })}
                  </g>
                )}
                {design.items
                  .filter((item) => item.shelf_id === entry.shelf.id)
                  .map((item) => renderItem(item))}
                <rect
                  x={x + 6}
                  y={entry.bottom}
                  width={width - 12}
                  height="18"
                  fill={`url(#${uid}-${bookcase.id}-wood)`}
                />
                {bookcase.material !== 'white' &&
                  bookcase.material !== 'black' && (
                    <rect
                      x={x + 6}
                      y={entry.bottom}
                      width={width - 12}
                      height="18"
                      fill={`url(#${uid}-${bookcase.id}-grain)`}
                    />
                  )}
                <path
                  d={`M${x + 6} ${entry.bottom + 1}H${x + width - 6}`}
                  stroke="#ffffff45"
                  strokeWidth="2"
                />
                <path
                  d={`M${x + 6} ${entry.bottom + 18}H${x + width - 6}`}
                  stroke="#00000030"
                  strokeWidth="2"
                />
              </g>
            ))}
          <rect
            x={x}
            y={y}
            width="20"
            height={height}
            fill={`url(#${uid}-${bookcase.id}-wood)`}
          />
          <rect
            x={x + width - 20}
            y={y}
            width="20"
            height={height}
            fill={`url(#${uid}-${bookcase.id}-wood)`}
          />
          <path
            d={`M${x + 2} ${y + 2}H${x + width - 2}`}
            stroke="#ffffff40"
            strokeWidth="3"
          />
        </g>
      ))}
      {preview && renderItem(preview.item, true)}
      {renderInspection()}
    </svg>
  );
}
