import { useId } from 'react';
import {
  itemSize,
  sceneGeometry,
  type BookshelfDesign,
  type SceneItem,
  type ShelfGeometry,
} from '../../src/library/bookshelf-design';
import { decorAction, shelfPowered } from '../../src/library/bookshelf-craft';
import './bookshelf-craft.css';
import { decorationBounds } from './bookshelf-decor';

// Every effect is native SVG: the very same geometry is embedded in PNG exports.
export function FurnitureBack({ entry }: { entry: ShelfGeometry }) {
  const { x, y, shelf, bookcase } = entry,
    w = bookcase.width,
    h = shelf.height,
    style = bookcase.style ?? 'classic';
  return (
    <g pointerEvents="none" aria-hidden="true">
      {['classic', 'gilded'].includes(style) && (
        <>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect
                x={x + 12 + (i * (w - 24)) / 3}
                y={y + 12}
                width={(w - 24) / 3 - 10}
                height={h - 26}
                rx="3"
                fill="none"
                stroke="#271e1650"
                strokeWidth="3"
              />
              <path
                d={`M${x + 14 + (i * (w - 24)) / 3} ${y + h - 16}v${-h + 30}h${(w - 24) / 3 - 15}`}
                fill="none"
                stroke={style === 'gilded' ? '#dec08845' : '#ffe9bf20'}
              />
            </g>
          ))}
        </>
      )}
      {style === 'industrial' && (
        <>
          <path
            d={`M${x + 8} ${y + 8}L${x + w - 8} ${y + h - 8}M${x + w - 8} ${y + 8}L${x + 8} ${y + h - 8}`}
            stroke="#262e2d"
            strokeWidth="3"
            opacity=".28"
          />
          <circle
            cx={x + w / 2}
            cy={y + h / 2}
            r="4"
            fill="#424c47"
            opacity=".4"
          />
        </>
      )}
      {style === 'arch' && (
        <path
          d={`M${x + 14} ${y + h - 10}V${y + 42}Q${x + w / 2} ${y - 12} ${x + w - 14} ${y + 42}V${y + h - 10}`}
          fill="none"
          stroke="#fde6af25"
          strokeWidth="2"
        />
      )}
    </g>
  );
}
export function ShelfFixtures({
  entry,
  uid,
}: {
  entry: ShelfGeometry;
  uid: string;
}) {
  const { shelf, bookcase, x, y } = entry,
    type = shelf.light.type ?? 'strip';
  const on = shelfPowered(bookcase, shelf),
    level = on ? shelf.light.intensity : 0;
  const color = shelf.light.color,
    width = bookcase.width,
    id = `${uid}-${shelf.id}-fixture`;
  const garland = shelf.light.garland || type === 'fairy' || type === 'globes';
  return (
    <g
      aria-hidden="true"
      pointerEvents="none"
      data-shelf-fixture={type}
      data-powered={on}
    >
      <defs>
        <radialGradient id={`${id}-halo`}>
          <stop stopColor={color} stopOpacity=".65" />
          <stop offset=".28" stopColor={color} stopOpacity=".18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-cone`} x2="0" y2="1">
          <stop stopColor={color} stopOpacity=".4" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {type === 'strip' && (
        <>
          <rect
            x={x + 8}
            y={y + 1}
            width={width - 16}
            height="5"
            rx="2"
            fill="#342f2a"
          />
          <rect
            x={x + 9}
            y={y + 2}
            width={width - 18}
            height="3"
            rx="2"
            fill={level ? color : '#77776e'}
            opacity={level || 0.4}
          />
        </>
      )}
      {type === 'spots' &&
        [0.18, 0.5, 0.82].map((t, i) => (
          <g key={i}>
            <path
              d={`M${x + width * t - 9} ${y + 10}l-65 ${shelf.height * 0.82}h148L${x + width * t + 9} ${y + 10}Z`}
              fill={`url(#${id}-cone)`}
              opacity={level}
            />
            <rect
              x={x + width * t - 16}
              y={y + 2}
              width="32"
              height="8"
              rx="3"
              fill="#403c35"
            />
            <ellipse
              cx={x + width * t}
              cy={y + 10}
              rx="10"
              ry="3"
              fill={level ? color : '#89877b'}
            />
          </g>
        ))}
      {type === 'neon' && (
        <g fill="none">
          <path
            d={`M${x + 18} ${y + 45}Q${x + width / 2} ${y - 20} ${x + width - 18} ${y + 45}`}
            stroke={color}
            strokeWidth="17"
            opacity={level * 0.12}
          />
          <path
            d={`M${x + 18} ${y + 45}Q${x + width / 2} ${y - 20} ${x + width - 18} ${y + 45}`}
            stroke={level ? color : '#817f8b'}
            strokeWidth="4"
            opacity={level || 0.3}
          />
          <path
            d={`M${x + 18} ${y + 45}Q${x + width / 2} ${y - 20} ${x + width - 18} ${y + 45}`}
            stroke="#fff7e8"
            strokeWidth="1"
            opacity={level * 0.9}
          />
        </g>
      )}
      {garland && (
        <>
          <path
            d={`M${x + 6} ${y + 12}Q${x + width / 2} ${y + 63} ${x + width - 6} ${y + 12}`}
            fill="none"
            stroke="#655840"
            strokeWidth="1.5"
          />
          {Array.from({ length: type === 'globes' ? 7 : 19 }, (_, i) => {
            const count = type === 'globes' ? 7 : 19,
              t = (i + 1) / (count + 1),
              cx = x + width * t,
              cy = y + 12 + 100 * t * (1 - t),
              r = type === 'globes' ? 7 : 2.8;
            return (
              <g key={i}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r * 5}
                  fill={`url(#${id}-halo)`}
                  opacity={level}
                />
                <rect
                  x={cx - 2}
                  y={cy - 7}
                  width="4"
                  height="6"
                  fill="#76613e"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={level ? color : '#8e8b78'}
                  opacity={level ? 0.65 + level * 0.35 : 0.5}
                />
                <circle
                  cx={cx - r * 0.25}
                  cy={cy - r * 0.3}
                  r={r * 0.3}
                  fill="#fffcec"
                  opacity={level || 0.1}
                />
              </g>
            );
          })}
        </>
      )}
      {level > 0 && type !== 'none' && (
        <ellipse
          cx={x + width / 2}
          cy={entry.bottom - 2}
          rx={width * 0.46}
          ry="13"
          fill={`url(#${id}-halo)`}
          opacity={level * 0.4}
        />
      )}
    </g>
  );
}

export function FurnitureDetails({
  design,
  caseId,
  uid,
  onPower,
}: {
  design: BookshelfDesign;
  caseId: string;
  uid: string;
  onPower?: (id: string) => void;
}) {
  const {
    bookcase: c,
    x,
    y,
    width: w,
    height: h,
  } = sceneGeometry(design).cases.find(
    (entry) => entry.bookcase.id === caseId,
  )!;
  const style = c.style ?? 'classic';
  const wood = `url(#${uid}-${caseId}-wood)`,
    brass = '#b99858',
    on = c.lights_on !== false;
  return (
    <g data-furniture-style={style}>
      {style === 'classic' && (
        <g pointerEvents="none">
          <path
            d={`M${x - 5} ${y}h${w + 10}v10H${x - 5}Z M${x - 3} ${y + h - 10}h${w + 6}v13H${x - 3}Z`}
            fill={wood}
            stroke="#48342555"
          />
          <path
            d={`M${x + 9} ${y + 13}v${h - 26}M${x + w - 9} ${y + 13}v${h - 26}`}
            stroke="#fff7df30"
            strokeWidth="3"
          />
        </g>
      )}
      {style === 'arch' && (
        <g pointerEvents="none" fill="none">
          <path
            d={`M${x + 11} ${y + 24}Q${x + w / 2} ${y - 14} ${x + w - 11} ${y + 24}`}
            stroke={wood}
            strokeWidth="20"
          />
          <path
            d={`M${x + 11} ${y + 24}Q${x + w / 2} ${y - 14} ${x + w - 11} ${y + 24}`}
            stroke="#f5e5c744"
            strokeWidth="2"
          />
          <circle cx={x + w / 2} cy={y + 12} r="5" fill={brass} />
          <path
            d={`M${x + 9} ${y + 100}v${h - 118}M${x + w - 9} ${y + 100}v${h - 118}`}
            stroke="#ab875e"
            strokeWidth="2"
          />
        </g>
      )}
      {style === 'gilded' && (
        <g pointerEvents="none" fill="none" stroke={brass}>
          <rect
            x={x + 5}
            y={y + 5}
            width={w - 10}
            height={h - 10}
            strokeWidth="2"
          />
          <path
            d={`M${x + 13} ${y + 20}v${h - 40}M${x + w - 13} ${y + 20}v${h - 40}`}
            strokeWidth="3"
          />
          {[x + 13, x + w - 13].map((cx, i) => (
            <g key={i}>
              <path
                d={`M${cx - 6} ${y + 32}q6-20 12 0q-6 12-12 0M${cx - 6} ${y + h - 32}q6 20 12 0q-6-12-12 0`}
              />
              <circle cx={cx} cy={y + h / 2} r="4" />
            </g>
          ))}
          <path d={`M${x + 26} ${y + 9}H${x + w - 26}`} strokeWidth="3" />
        </g>
      )}
      {style === 'industrial' && (
        <g pointerEvents="none">
          {[x + 3, x + w - 15].map((cx, i) => (
            <g key={i}>
              <rect x={cx} y={y} width="12" height={h} rx="2" fill="#33383a" />
              <path
                d={`M${cx + 2} ${y + 3}v${h - 6}`}
                stroke="#8f9693"
                strokeWidth="1"
              />
              {c.shelves.map((s, j) => {
                const sy =
                  96 +
                  c.shelves.slice(0, j).reduce((n, s) => n + s.height + 24, 0) +
                  s.height;
                return (
                  <circle
                    key={s.id}
                    cx={cx + 6}
                    cy={sy + 9}
                    r="2.3"
                    fill="#a6a497"
                  />
                );
              })}
            </g>
          ))}
        </g>
      )}
      {style !== 'floating' && (
        <g pointerEvents="none">
          <path
            d={`M${x + 13} ${y + h}v12h28l5-12M${x + w - 46} ${y + h}l5 12h28v-12`}
            fill={wood}
          />
          <ellipse
            cx={x + w / 2}
            cy={y + h + 15}
            rx={w * 0.49}
            ry="7"
            fill="#000"
            opacity=".08"
          />
        </g>
      )}
      {onPower && (
        <g
          role="button"
          tabIndex={0}
          aria-label={`Luces de ${c.name}`}
          aria-pressed={on}
          className="shelf-power-switch"
          data-case-switch={caseId}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onPower(caseId)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onPower(caseId);
            }
          }}
          transform={`translate(${x + w - 61} ${y + h - 24})`}
        >
          <title>
            {on ? 'Apagar' : 'Encender'} luces de {c.name}
          </title>
          <rect
            x="-5"
            y="-8"
            width="56"
            height="39"
            rx="8"
            fill="transparent"
          />
          <rect
            width="45"
            height="23"
            rx="6"
            fill="#292d2b"
            stroke="#ccb78b"
            strokeWidth=".7"
          />
          <rect
            x={on ? 24 : 3}
            y="3"
            width="18"
            height="17"
            rx="4"
            fill={on ? '#e5c37a' : '#777d77'}
          />
          <circle
            cx={on ? 10 : 35}
            cy="11.5"
            r="2.4"
            fill={on ? '#ffe3a1' : '#52605a'}
          />
        </g>
      )}
    </g>
  );
}

export function DecorationEffects({
  item,
  powered,
  animate,
}: {
  item: SceneItem;
  powered: boolean;
  animate: boolean;
}) {
  const uid = useId().replace(/:/g, ''),
    size = itemSize(item),
    a = item.asset,
    art = decorationBounds(a, size.width, size.height),
    { width: w, height: h } = art;
  const lit =
    [
      'lamp',
      'lantern',
      'candle',
      'candles',
      'crystal',
      'moon',
      'star',
    ].includes(a) &&
    item.active !== false &&
    powered;
  const action = decorAction(item);
  return (
    <g
      pointerEvents="none"
      aria-hidden="true"
      data-decor-effect={a}
      transform={`translate(${art.x} ${art.y})`}
      data-active={item.active ?? lit}
    >
      <defs>
        <radialGradient id={`${uid}-glow`}>
          <stop
            stopColor={a === 'crystal' ? '#b7a9ff' : '#fff1be'}
            stopOpacity=".8"
          />
          <stop
            offset=".2"
            stopColor={a === 'crystal' ? '#977aea' : '#ffc87f'}
            stopOpacity=".25"
          />
          <stop offset="1" stopColor="#ffd383" stopOpacity="0" />
        </radialGradient>
      </defs>
      {lit && (
        <ellipse
          data-object-emission
          cx={a === 'lamp' ? w * 0.24 : w * 0.5}
          cy={
            a === 'lamp'
              ? h * 0.11
              : a === 'lantern'
                ? h * 0.53
                : a.startsWith('candle')
                  ? h * 0.04
                  : h * 0.28
          }
          rx={w * 1.15}
          ry={h * 0.8}
          fill={`url(#${uid}-glow)`}
        />
      )}
      {lit &&
        a.startsWith('candle') &&
        (a === 'candles'
          ? [
              [0.25, 0.32],
              [0.51, 0.09],
              [0.78, 0.46],
            ]
          : [[0.5, 0.04]]
        ).map(([px, py], i) => (
          <path
            key={i}
            className={animate ? 'craft-candle-flame' : undefined}
            d={`M${w * px} ${h * py - 9}q-5 7 0 10q5-3 0-10`}
            fill="#fff1b3"
          />
        ))}
      {a === 'mug' &&
        item.active &&
        [0, 1, 2].map((i) => (
          <path
            key={i}
            className={animate ? 'craft-steam' : undefined}
            style={{ animationDelay: `${i * -0.9}s` }}
            d={`M${w * (0.35 + i * 0.13)} ${h * 0.2}q-8-12 0-23t0-23`}
            fill="none"
            stroke="#fff5de"
            strokeWidth="1.4"
            opacity=".45"
          />
        ))}
      {a === 'clock' && item.active && (
        <g transform={`translate(${w * 0.51} ${h * 0.47})`}>
          <path
            d={`M${-w * 0.055} ${-h * 0.1}L0 0l${w * 0.09} ${-h * 0.13}`}
            fill="none"
            stroke="#302b24"
            strokeWidth="1.1"
          />
          <g className={animate ? 'craft-clock-hand' : undefined}>
            <path
              d={`M0 ${h * 0.04}v${-h * 0.27}`}
              stroke="#b98254"
              strokeWidth=".75"
            />
          </g>
          <circle r="1.1" fill="#d4b368" />
        </g>
      )}
      {['portrait', 'landscape'].includes(a) && item.artwork !== undefined && (
        <svg
          x={w * (a === 'portrait' ? 0.175 : 0.21)}
          y={h * (a === 'portrait' ? 0.13 : 0.33)}
          width={w * (a === 'portrait' ? 0.65 : 0.63)}
          height={h * (a === 'portrait' ? 0.73 : 0.53)}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          data-frame-art={item.artwork}
        >
          <rect
            width="100"
            height="100"
            fill={['#d2b898', '#242d4c', '#d8d2b1', '#453254'][item.artwork]}
          />
          {item.artwork === 0 ? (
            <>
              <circle cx="70" cy="27" r="13" fill="#f1dcac" />
              <path d="M0 85L35 32l28 43 20-20 17 30v15H0Z" fill="#627c68" />
              <path d="M0 90l48-29 52 39H0" fill="#304c49" />
            </>
          ) : item.artwork === 1 ? (
            <>
              <circle cx="66" cy="28" r="16" fill="#ede4c8" />
              <circle cx="73" cy="22" r="14" fill="#242d4c" />
              <path d="M0 87l22-29 19 13 20-30 39 46v13H0" fill="#495473" />
              {[12, 33, 49, 88].map((cx, i) => (
                <circle
                  key={i}
                  cx={cx}
                  cy={15 + i * 9}
                  r="1.4"
                  fill="#f6e5ae"
                />
              ))}
            </>
          ) : item.artwork === 2 ? (
            <>
              <path
                d="M50 97V20M50 80Q10 62 18 42Q40 44 50 80M50 63Q90 40 82 25Q58 29 50 63M50 40Q23 15 38 10Q54 17 50 40"
                fill="#60836b"
                stroke="#365643"
                strokeWidth="2"
              />
            </>
          ) : (
            <>
              <circle
                cx="50"
                cy="49"
                r="29"
                fill="none"
                stroke="#d0ac70"
                strokeWidth="1"
              />
              <path
                d="M50 11l8 27 28 11-28 8-8 30-10-30-26-8 26-11Z"
                fill="#d0ac70"
              />
              <circle cx="50" cy="49" r="8" fill="#f4db9f" />
            </>
          )}
        </svg>
      )}
      {item.active && ['cat', 'bird'].includes(a) && (
        <g className={animate ? 'craft-familiar' : undefined}>
          <path
            d={`M${w * 0.8} ${h * 0.18}l2-6 2 6 6 2-6 2-2 6-2-6-6-2Z`}
            fill="#e6ca8b"
            opacity=".8"
          />
        </g>
      )}
      {action && !lit && ['lamp', 'lantern'].includes(a) && (
        <ellipse
          cx={w * 0.5}
          cy={h * 0.16}
          rx={w * 0.33}
          ry={h * 0.16}
          fill="#181e22"
          opacity=".18"
        />
      )}
    </g>
  );
}
