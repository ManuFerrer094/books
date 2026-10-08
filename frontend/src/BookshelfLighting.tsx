import {
  itemSize,
  sceneGeometry,
  type BookshelfDesign,
  type ShelfGeometry,
} from '../../src/library/bookshelf-design';
import { readAtmosphere } from '../../src/library/bookshelf-atmosphere';
import { shelfPowered } from '../../src/library/bookshelf-craft';
import { decorationBounds } from './bookshelf-decor';

type Bounds = { x: number; y?: number; width: number; height: number };
interface Props {
  design: BookshelfDesign;
  uid: string;
  bounds: Bounds;
  animate: boolean;
}
export function LightingDefs({ design, uid, bounds }: Props) {
  const light = readAtmosphere(design.atmosphere, design.night).lighting;
  if (!light.enabled) return null;
  return (
    <>
      <linearGradient id={`${uid}-atmo-ray`} x1="0" y1="0" x2=".4" y2="1">
        <stop stopColor={light.color} stopOpacity=".45" />
        <stop offset=".55" stopColor={light.color} stopOpacity=".12" />
        <stop offset="1" stopColor={light.color} stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${uid}-atmo-halo`}>
        <stop stopColor={light.color} stopOpacity=".75" />
        <stop offset=".2" stopColor={light.color} stopOpacity=".3" />
        <stop offset=".6" stopColor={light.color} stopOpacity=".09" />
        <stop offset="1" stopColor={light.color} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-atmo-flame`}>
        <stop stopColor="#fffbe7" stopOpacity=".9" />
        <stop offset=".07" stopColor="#ffe3aa" stopOpacity=".8" />
        <stop offset=".25" stopColor="#ffb663" stopOpacity=".3" />
        <stop offset=".7" stopColor="#ffae59" stopOpacity=".07" />
        <stop offset="1" stopColor="#ffae59" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${uid}-atmo-lamp`} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#ffe7bc" stopOpacity=".3" />
        <stop offset="1" stopColor="#ffe7bc" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${uid}-atmo-vignette`} rx=".72" ry=".8">
        <stop offset=".35" stopColor="#111b21" stopOpacity="0" />
        <stop
          offset="1"
          stopColor="#111b21"
          stopOpacity={light.vignette * 0.85}
        />
      </radialGradient>
      <linearGradient id={`${uid}-atmo-wall`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor={light.color} stopOpacity=".28" />
        <stop offset=".55" stopColor={light.color} stopOpacity=".1" />
        <stop
          offset="1"
          stopColor="#18272e"
          stopOpacity={(1 - light.ambient) * 0.45}
        />
      </linearGradient>
      <pattern
        id={`${uid}-atmo-rain`}
        width="53"
        height="45"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M13 0l-4 21M38 22l-3 15"
          stroke={light.color}
          strokeOpacity=".33"
          strokeWidth="1"
        />
        <path
          d="M5 25l-1 6M46 0l-2 8"
          stroke={light.color}
          strokeOpacity=".13"
        />
      </pattern>
      <pattern
        id={`${uid}-atmo-snow`}
        width="97"
        height="72"
        patternUnits="userSpaceOnUse"
      >
        {[
          [11, 17, 1.5],
          [48, 54, 2],
          [83, 8, 1],
          [80, 69, 1],
        ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#fff8e9" opacity=".42" />
        ))}
      </pattern>
      <pattern
        id={`${uid}-atmo-stars`}
        width="139"
        height="107"
        patternUnits="userSpaceOnUse"
      >
        <circle cx="31" cy="46" r="1.4" fill="#fff9e6" />
        <circle cx="106" cy="15" r=".8" fill="#fff9e6" />
        <path
          d="M80 77h8m-4-4v8"
          stroke="#fff9e6"
          strokeWidth=".7"
          opacity=".6"
        />
      </pattern>
      <pattern
        id={`${uid}-atmo-leaves`}
        width="210"
        height="165"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M34 45q-12-12-20 3 18 14 20-3M171 120q8-13 23-7-9 20-23 7"
          fill={light.color}
          opacity=".23"
        />
      </pattern>
      <clipPath id={`${uid}-atmo-scene-clip`}>
        <rect
          x={bounds.x}
          y={bounds.y ?? 0}
          width={bounds.width}
          height={bounds.height}
        />
      </clipPath>
      {sceneGeometry(design).cases.map(({ bookcase, x, y, width, height }) => (
        <clipPath key={bookcase.id} id={`${uid}-${bookcase.id}-atmo-clip`}>
          <rect x={x + 20} y={y + 24} width={width - 40} height={height - 30} />
        </clipPath>
      ))}
    </>
  );
}
export function LightingBackground({ design, uid, bounds, animate }: Props) {
  const light = readAtmosphere(design.atmosphere, design.night).lighting;
  if (!light.enabled) return null;
  return (
    <g
      aria-hidden="true"
      pointerEvents="none"
      clipPath={`url(#${uid}-atmo-scene-clip)`}
      className={animate && light.motion ? 'library-light-motion' : undefined}
    >
      <rect
        x={bounds.x}
        width={bounds.width}
        height={bounds.height}
        fill={`url(#${uid}-atmo-wall)`}
      />
      {light.backdrop !== 'none' && (
        <g className={`library-weather-${light.backdrop}`}>
          <rect
            x={bounds.x - 50}
            y="-80"
            width={bounds.width + 100}
            height={bounds.height + 160}
            fill={`url(#${uid}-atmo-${light.backdrop})`}
            opacity={light.backdrop === 'stars' ? 0.6 : 0.48}
          />
        </g>
      )}
    </g>
  );
}
export function ShelfGlow({
  design,
  entry,
  uid,
}: {
  design: BookshelfDesign;
  entry: ShelfGeometry;
  uid: string;
}) {
  const light = readAtmosphere(design.atmosphere, design.night).lighting;
  if (
    !light.enabled ||
    !light.glow ||
    !shelfPowered(entry.bookcase, entry.shelf)
  )
    return null;
  const sources = design.items.filter(
    (item) =>
      item.shelf_id === entry.shelf.id &&
      item.kind === 'decor' &&
      item.active !== false &&
      ['lamp', 'lantern', 'candle', 'candles'].includes(item.asset),
  );
  return (
    <g
      aria-hidden="true"
      pointerEvents="none"
      data-shelf-glow
      clipPath={`url(#${uid}-${entry.bookcase.id}-atmo-clip)`}
    >
      <rect
        x={entry.x}
        y={entry.y}
        width={entry.bookcase.width}
        height={entry.shelf.height * 0.9}
        fill={`url(#${uid}-${entry.shelf.id}-light)`}
        opacity={light.glow * 0.32}
      />
      {sources.flatMap((item) => {
        const size = itemSize(item),
          art = decorationBounds(item.asset, size.width, size.height),
          left = entry.x + item.x,
          top = entry.bottom - size.height;
        const candle = item.asset.startsWith('candle');
        const points =
          item.asset === 'candles'
            ? [
                [0.25, 0.32],
                [0.51, 0.09],
                [0.78, 0.46],
              ]
            : item.asset === 'lamp'
              ? [[0.24, 0.11]]
              : item.asset === 'lantern'
                ? [[0.5, 0.53]]
                : [[0.5, 0.04]];
        return points.map(([px, py], i) => {
          const angle = (item.rotation * Math.PI) / 180,
            fit = 1 / (1 + Math.abs(Math.sin(angle)) * 1.4),
            dx = (art.x + px * art.width - size.width / 2) * fit,
            dy = (art.y + py * art.height - size.height / 2) * fit,
            x =
              left +
              size.width / 2 +
              dx * Math.cos(angle) -
              dy * Math.sin(angle),
            y =
              top +
              size.height / 2 +
              dx * Math.sin(angle) +
              dy * Math.cos(angle),
            radius = candle ? 70 : 135;
          return (
            <g
              key={`${item.id}-${i}`}
              data-light-source={item.asset}
              opacity={light.glow}
            >
              {!candle && (
                <path
                  d={`M${x - 8} ${y}L${x - 100} ${entry.bottom}H${x + 110}L${x + 8} ${y}Z`}
                  fill={`url(#${uid}-atmo-lamp)`}
                  opacity=".5"
                />
              )}
              <ellipse
                className={candle ? 'library-flame' : undefined}
                cx={x}
                cy={y}
                rx={radius}
                ry={radius * 0.78}
                fill={`url(#${uid}-atmo-flame)`}
              />
              <ellipse
                cx={x}
                cy={entry.bottom - 2}
                rx={radius * 0.75}
                ry="16"
                fill={`url(#${uid}-atmo-flame)`}
                opacity=".25"
              />
            </g>
          );
        });
      })}
    </g>
  );
}
export function LightingForeground({ design, uid, bounds, animate }: Props) {
  const atmosphere = readAtmosphere(design.atmosphere, design.night),
    light = atmosphere.lighting;
  if (!light.enabled) return null;
  const geometry = sceneGeometry(design);
  const shift = Math.tan((light.angle * Math.PI) / 180);
  return (
    <g
      data-library-lighting
      data-atmosphere-scene={atmosphere.scene}
      aria-hidden="true"
      pointerEvents="none"
      className={animate && light.motion ? 'library-light-motion' : undefined}
      clipPath={`url(#${uid}-atmo-scene-clip)`}
    >
      <rect
        x={bounds.x}
        width={bounds.width}
        height={bounds.height}
        fill="#101b25"
        opacity={(1 - light.ambient) * 0.46}
      />
      {geometry.cases.map(({ bookcase, x, y, width, height }) => (
        <g key={bookcase.id} clipPath={`url(#${uid}-${bookcase.id}-atmo-clip)`}>
          <ellipse
            cx={x + width * 0.3}
            cy={y + height * 0.23}
            rx={width * 0.72}
            ry={height * 0.65}
            fill={`url(#${uid}-atmo-halo)`}
            opacity={light.beam * 0.12}
          />
          {Array.from({ length: 4 }, (_, i) => {
            const start = x + width * (0.04 + i * 0.13),
              bottom = start + height * shift,
              w = width * 0.075;
            return (
              <path
                key={i}
                d={`M${start} ${y}h${w}L${bottom + w + width * 0.14} ${y + height}H${bottom - width * 0.07}Z`}
                fill={`url(#${uid}-atmo-ray)`}
                opacity={light.beam * (i % 2 ? 0.38 : 0.64)}
              />
            );
          })}
          {light.dust && light.beam > 0 && (
            <g opacity={light.beam * 0.8}>
              <g className="library-dust">
                {Array.from({ length: 22 }, (_, i) => (
                  <circle
                    key={i}
                    cx={
                      x +
                      30 +
                      ((i * 173 + 47) % Math.max(1, Math.floor(width - 60)))
                    }
                    cy={
                      y +
                      32 +
                      ((i * 197 + 19) % Math.max(1, Math.floor(height - 60)))
                    }
                    r={i % 3 === 0 ? 1.5 : 0.8}
                    fill={light.color}
                    opacity={0.25 + (i % 5) * 0.1}
                  />
                ))}
              </g>
            </g>
          )}
          {geometry.shelves
            .filter((entry) => entry.bookcase.id === bookcase.id)
            .map((entry) => (
              <ShelfGlow
                key={entry.shelf.id}
                design={design}
                entry={entry}
                uid={uid}
              />
            ))}
        </g>
      ))}
      <rect
        x={bounds.x}
        width={bounds.width}
        height={bounds.height}
        fill={`url(#${uid}-atmo-vignette)`}
      />
    </g>
  );
}
