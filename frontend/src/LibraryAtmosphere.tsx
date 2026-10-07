import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from 'react';
import {
  AudioLines,
  BookOpen,
  Check,
  ChevronDown,
  Headphones,
  Lightbulb,
  Pause,
  Play,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  atmosphereForScene,
  atmosphereScenes,
  readAtmosphere,
  soundLayers,
  type BookshelfAtmosphere,
  type SoundLayer,
} from '../../src/library/bookshelf-atmosphere';
import { useLibrarySound } from './useLibrarySound';
import { readingMinutes, remainingTime } from './library-session';
import './library-atmosphere.css';
import { decorationAssets } from './bookshelf-decor';

interface Props {
  ref?: Ref<{ page: () => void }>;
  ownerId: string;
  value?: BookshelfAtmosphere;
  night: boolean;
  onChange: (
    value: BookshelfAtmosphere,
    action: string,
    night?: boolean,
  ) => void;
}
const tabs = [
  ['scenes', 'Ambientes', Sparkles],
  ['light', 'Luz', Lightbulb],
  ['sound', 'Sonido', Headphones],
  ['reading', 'Lectura', BookOpen],
] as const;
const glyphs: Record<SoundLayer, string> = {
  rain: '☂',
  fire: '♨',
  wind: '≋',
  birds: '♬',
  pages: '▤',
  steps: '⋯',
  clock: '◷',
  cafe: '☕',
  water: '⤓',
  ocean: '≈',
  thunder: 'ϟ',
  night: '☾',
  vinyl: '◎',
  dream: '✧',
};
const colors = [
  ['Vela', '#ffbd76'],
  ['Ámbar', '#ffe0b5'],
  ['Natural', '#eef0e5'],
  ['Luna', '#a0c3ff'],
  ['Lavanda', '#d5acff'],
  ['Bosque', '#e7edb4'],
] as const;
const sceneObjects: Record<string, string> = {
  'rain-room': 'lamp',
  fireside: 'candles',
  midnight: 'lantern',
  garden: 'fern',
  cafe: 'mug',
  silence: 'vase',
  enchanted: 'crystal',
  coast: 'flowers',
  storm: 'lamp',
  timeless: 'clock',
};
const groups = [
  ['all', 'Todos'],
  ['nature', 'Naturaleza'],
  ['library', 'Biblioteca'],
  ['comfort', 'Fuego y calma'],
] as const;

function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  suffix = '%',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <label className="atmo-slider">
      <span>
        {label}
        <output>
          {Math.round(value)}
          {suffix}
        </output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step="1"
        value={Math.round(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function LibraryAtmosphere({
  ref,
  ownerId,
  value,
  night,
  onChange,
}: Props) {
  const mix = readAtmosphere(value, night);
  const audio = useLibrarySound(ownerId, mix.sound);
  useImperativeHandle(ref, () => ({ page: audio.page }), [audio.page]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<(typeof tabs)[number][0]>('scenes');
  const [group, setGroup] = useState<(typeof groups)[number][0]>('all');
  const [minutes, setMinutes] = useState(25);
  const [finish, setFinish] = useState('fade');
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState('');
  const remembered = useRef(new Map<SoundLayer, number>());
  const actions = useRef(audio);
  actions.current = audio;
  const panelId = useId();
  const scene = atmosphereScenes.find((entry) => entry.id === mix.scene);
  const active = soundLayers.filter(([id]) => mix.sound.layers[id] > 0);
  useEffect(() => {
    setDeadline(null);
    setNotice('');
    remembered.current.clear();
  }, [ownerId]);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (time >= deadline) {
        setDeadline(null);
        if (finish === 'fade') actions.current.pause(10);
        else actions.current.chime();
        setNotice(
          finish === 'fade'
            ? 'Tu sesión ha terminado. El sonido se apaga suavemente.'
            : 'Tu sesión ha terminado. Puedes seguir leyendo.',
        );
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline, finish]);
  function light<K extends keyof BookshelfAtmosphere['lighting']>(
    key: K,
    v: BookshelfAtmosphere['lighting'][K],
  ) {
    onChange(
      { ...mix, scene: 'custom', lighting: { ...mix.lighting, [key]: v } },
      `atmosphere-light-${key}`,
    );
  }
  function sound(key: 'master' | 'width', v: number) {
    onChange(
      { ...mix, scene: 'custom', sound: { ...mix.sound, [key]: v } },
      `atmosphere-sound-${key}`,
    );
  }
  function layer(id: SoundLayer, v: number) {
    onChange(
      {
        ...mix,
        scene: 'custom',
        sound: { ...mix.sound, layers: { ...mix.sound.layers, [id]: v } },
      },
      `atmosphere-layer-${id}`,
    );
  }
  const playback = (
    <button
      className={`atmo-play ${audio.playing ? 'is-playing' : ''}`}
      disabled={audio.busy || (!active.length && !audio.playing)}
      onClick={() => void audio.toggle()}
    >
      {audio.playing ? <Pause size={16} /> : <Play size={16} />}
      {audio.busy
        ? 'Preparando sonido…'
        : audio.playing
          ? 'Pausar sonido'
          : 'Activar sonido'}
    </button>
  );
  return (
    <section className="library-atmosphere" data-ambient-controls>
      <div className="atmo-bar">
        <span
          className="atmo-orb"
          style={{ '--atmo-color': mix.lighting.color } as CSSProperties}
        >
          <Lightbulb size={17} />
        </span>
        <div className="atmo-current">
          <span className="atmo-eyebrow">EL AMBIENTE DE TU BIBLIOTECA</span>
          <strong>{scene?.name ?? 'Tu ambiente personal'}</strong>
        </div>
        {deadline && (
          <button
            className="atmo-countdown"
            onClick={() => {
              setTab('reading');
              setOpen(true);
            }}
            aria-label={`Temporizador de lectura: ${remainingTime(deadline, now)}`}
          >
            <Timer size={15} />
            {remainingTime(deadline, now)}
          </button>
        )}
        {playback}
        <button
          className="atmo-open"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal size={16} />
          Luz y sonido
          <ChevronDown size={14} className={open ? 'is-open' : ''} />
        </button>
      </div>
      {audio.error && (
        <p className="atmo-message" role="alert">
          {audio.error}
        </p>
      )}
      {audio.warning && (
        <p className="atmo-message" role="status">
          {audio.warning}
        </p>
      )}
      <span className="atmo-announcement" role="status">
        {notice}
      </span>
      {open && (
        <div
          id={panelId}
          className="atmo-panel"
          role="region"
          aria-label="Luz y sonido de la biblioteca"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              event.currentTarget.parentElement
                ?.querySelector<HTMLButtonElement>('.atmo-open')
                ?.focus();
            }
          }}
        >
          <div className="atmo-panel-head">
            <div>
              <span className="atmo-eyebrow">QUÉDATE UN RATO</span>
              <h4>Un lugar al que volver.</h4>
            </div>
            <button
              className="icon-button"
              aria-label="Cerrar luz y sonido"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div
            className="atmo-tabs"
            role="tablist"
            aria-label="Herramientas de ambiente"
          >
            {tabs.map(([id, label, Icon], index) => (
              <button
                key={id}
                role="tab"
                id={`${panelId}-${id}`}
                aria-selected={tab === id}
                tabIndex={tab === id ? 0 : -1}
                aria-controls={`${panelId}-content`}
                onKeyDown={(event) => {
                  let target = index;
                  if (event.key === 'ArrowRight')
                    target = (index + 1) % tabs.length;
                  else if (event.key === 'ArrowLeft')
                    target = (index + tabs.length - 1) % tabs.length;
                  else if (event.key === 'Home') target = 0;
                  else if (event.key === 'End') target = tabs.length - 1;
                  else return;
                  event.preventDefault();
                  setTab(tabs[target][0]);
                  document
                    .getElementById(`${panelId}-${tabs[target][0]}`)
                    ?.focus();
                }}
                onClick={() => setTab(id)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
          <div
            id={`${panelId}-content`}
            role="tabpanel"
            aria-labelledby={`${panelId}-${tab}`}
            className="atmo-content"
          >
            {tab === 'scenes' && (
              <>
                <p className="atmo-intro">
                  Elige cómo se siente la sala. Tus libros y objetos conservan
                  su lugar.
                </p>
                <div className="atmo-scenes">
                  {atmosphereScenes.map((entry) => (
                    <button
                      key={entry.id}
                      className="atmo-scene"
                      aria-pressed={mix.scene === entry.id}
                      onClick={() => {
                        audio.setSolo(null);
                        onChange(
                          atmosphereForScene(entry.id, mix.sound.master),
                          '',
                          entry.night,
                        );
                      }}
                      style={
                        {
                          '--scene-accent': entry.accent,
                          '--scene-light': entry.color,
                        } as CSSProperties
                      }
                    >
                      <span className="atmo-scene-art" aria-hidden="true">
                        <span className="atmo-window" />
                        <svg className="atmo-mini-shelf" viewBox="0 0 120 120">
                          <defs>
                            <linearGradient id={`${panelId}-mini-${entry.id}`}>
                              <stop stopColor="#b79c70" />
                              <stop offset="1" stopColor="#786c56" />
                            </linearGradient>
                          </defs>
                          {[0, 1].map((row) => (
                            <g key={row}>
                              <rect
                                x="1"
                                y={row * 51 + 55}
                                width="114"
                                height="6"
                                rx="1"
                                fill={`url(#${panelId}-mini-${entry.id})`}
                              />
                              {[0, 1, 2, 3, 4].map((book) => {
                                const height =
                                  24 + ((book * 7 + row * 11) % 19);
                                return (
                                  <g key={book}>
                                    <rect
                                      x={5 + book * 12}
                                      y={row * 51 + 55 - height}
                                      width="9"
                                      height={height}
                                      rx="1"
                                      fill={
                                        [
                                          '#d5c5a7',
                                          '#7e8d7b',
                                          '#bd9786',
                                          '#80949a',
                                          '#bab392',
                                        ][(book + row) % 5]
                                      }
                                    />
                                    <path
                                      d={`M${7 + book * 12} ${row * 51 + 58 - height}v${height - 6}`}
                                      stroke="#fffae633"
                                    />
                                    <path
                                      d={`M${6 + book * 12} ${row * 51 + 49}h7`}
                                      stroke="#fffae670"
                                    />
                                  </g>
                                );
                              })}
                            </g>
                          ))}
                          <image
                            href={
                              decorationAssets[sceneObjects[entry.id]]
                                ?.thumbnail
                            }
                            x="70"
                            y="58"
                            width="40"
                            height="48"
                            preserveAspectRatio="xMidYMax meet"
                          />
                          <rect
                            x="0"
                            y="9"
                            width="3"
                            height="103"
                            fill="#bda781"
                            opacity=".6"
                          />
                          <rect
                            x="113"
                            y="9"
                            width="3"
                            height="103"
                            fill="#bda781"
                            opacity=".6"
                          />
                        </svg>
                        <span className="atmo-scene-symbol">
                          {entry.backdrop === 'rain'
                            ? '☂'
                            : entry.backdrop === 'stars'
                              ? '✧'
                              : entry.id === 'fireside'
                                ? '♨'
                                : entry.id === 'coast'
                                  ? '≈'
                                  : entry.backdrop === 'leaves'
                                    ? '❧'
                                    : entry.backdrop === 'snow'
                                      ? '❄'
                                      : '☀'}
                        </span>
                        {mix.scene === entry.id && (
                          <span className="atmo-scene-check">
                            <Check size={14} />
                          </span>
                        )}
                      </span>
                      <strong>{entry.name}</strong>
                      <span>{entry.subtitle}</span>
                      <small>
                        {Object.keys(entry.layers).length
                          ? `${Object.keys(entry.layers).length} capas · ${entry.night ? 'Noche' : 'Día'}`
                          : 'Sin sonido · Día'}
                      </small>
                    </button>
                  ))}
                </div>
                <p className="atmo-footnote">
                  El ambiente se guarda contigo. El sonido empieza cuando lo
                  activas.
                </p>
              </>
            )}
            {tab === 'light' && (
              <>
                <div className="atmo-section-heading">
                  <div>
                    <h5>La luz cuenta otra historia.</h5>
                    <p>
                      Desde el sol de la tarde hasta un refugio iluminado por
                      velas.
                    </p>
                  </div>
                  <label className="atmo-toggle">
                    <input
                      type="checkbox"
                      checked={mix.lighting.enabled}
                      onChange={(event) =>
                        light('enabled', event.target.checked)
                      }
                    />
                    Iluminación ambiental
                  </label>
                </div>
                <div className="atmo-light-grid">
                  <div>
                    <span className="atmo-label">Temperatura y color</span>
                    <div className="atmo-palette">
                      {colors.map(([label, color]) => (
                        <button
                          key={label}
                          aria-label={`Luz ${label}`}
                          aria-pressed={mix.lighting.color === color}
                          onClick={() => light('color', color)}
                          style={{ '--swatch': color } as CSSProperties}
                        >
                          <span />
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="atmo-color">
                      Color de la luz
                      <input
                        type="color"
                        value={mix.lighting.color}
                        onChange={(event) => light('color', event.target.value)}
                      />
                    </label>
                    <Slider
                      label="Luz ambiental"
                      value={mix.lighting.ambient * 100}
                      onChange={(v) => light('ambient', v / 100)}
                    />
                    <Slider
                      label="Rayos de ventana"
                      value={mix.lighting.beam * 100}
                      onChange={(v) => light('beam', v / 100)}
                    />
                    <Slider
                      label="Dirección de la luz"
                      value={mix.lighting.angle}
                      min={-60}
                      max={60}
                      suffix="°"
                      onChange={(v) => light('angle', v)}
                    />
                  </div>
                  <div>
                    <Slider
                      label="Resplandor de lámparas y velas"
                      value={mix.lighting.glow * 100}
                      onChange={(v) => light('glow', v / 100)}
                    />
                    <Slider
                      label="Sombras en los bordes"
                      value={mix.lighting.vignette * 100}
                      onChange={(v) => light('vignette', v / 100)}
                    />
                    <label className="atmo-select">
                      Al otro lado de la ventana
                      <select
                        value={mix.lighting.backdrop}
                        onChange={(event) =>
                          light(
                            'backdrop',
                            event.target
                              .value as BookshelfAtmosphere['lighting']['backdrop'],
                          )
                        }
                      >
                        <option value="none">Cielo tranquilo</option>
                        <option value="rain">Lluvia</option>
                        <option value="snow">Nieve</option>
                        <option value="leaves">Hojas al viento</option>
                        <option value="stars">Estrellas</option>
                      </select>
                    </label>
                    <label className="atmo-toggle">
                      <input
                        type="checkbox"
                        checked={mix.lighting.dust}
                        onChange={(event) =>
                          light('dust', event.target.checked)
                        }
                      />
                      Polvo en los rayos de luz
                    </label>
                    <label className="atmo-toggle">
                      <input
                        type="checkbox"
                        checked={mix.lighting.motion}
                        onChange={(event) =>
                          light('motion', event.target.checked)
                        }
                      />
                      Movimiento suave
                    </label>
                    <p className="atmo-footnote">
                      Las luces y guirnaldas de cada balda se ajustan en Diseñar
                      → Muebles. El movimiento respeta las preferencias de
                      accesibilidad.
                    </p>
                  </div>
                </div>
              </>
            )}
            {tab === 'sound' && (
              <>
                <div className="atmo-section-heading">
                  <div>
                    <h5>Tu banda sonora, capa a capa.</h5>
                    <p>
                      {active.length} de 14 sonidos en tu mezcla. Usa
                      auriculares para disfrutar del espacio estéreo.
                    </p>
                  </div>
                </div>
                <div className="atmo-master">
                  <Slider
                    label="Volumen general"
                    value={mix.sound.master * 100}
                    onChange={(v) => sound('master', v / 100)}
                  />
                  <Slider
                    label="Amplitud estéreo"
                    value={mix.sound.width * 100}
                    onChange={(v) => sound('width', v / 100)}
                  />
                </div>
                <div className="atmo-filters" aria-label="Tipos de sonido">
                  {groups.map(([id, label]) => (
                    <button
                      key={id}
                      aria-pressed={group === id}
                      onClick={() => setGroup(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {audio.solo && (
                  <div className="atmo-solo-notice">
                    <Headphones size={15} />
                    Escuchando solo{' '}
                    {soundLayers.find(([id]) => id === audio.solo)?.[1]}.
                    <button onClick={() => audio.setSolo(null)}>
                      Escuchar la mezcla
                    </button>
                  </div>
                )}
                <div className="atmo-sounds">
                  {soundLayers
                    .filter((entry) => group === 'all' || entry[3] === group)
                    .map(([id, label, description]) => (
                      <div
                        key={id}
                        className={`atmo-sound ${mix.sound.layers[id] ? 'is-active' : ''}`}
                      >
                        <span className="atmo-sound-glyph" aria-hidden="true">
                          {glyphs[id]}
                        </span>
                        <div className="atmo-sound-title">
                          <strong>{label}</strong>
                          <small>{description}</small>
                        </div>
                        <button
                          className="atmo-solo"
                          aria-label={`Escuchar solo ${label}`}
                          aria-pressed={audio.solo === id}
                          disabled={!mix.sound.layers[id]}
                          onClick={() =>
                            audio.setSolo(audio.solo === id ? null : id)
                          }
                        >
                          <Headphones size={14} />
                        </button>
                        <label className="atmo-layer-range">
                          <span className="sr-only">Volumen de {label}</span>
                          <input
                            aria-label={`Volumen de ${label}`}
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round(mix.sound.layers[id] * 100)}
                            onChange={(event) =>
                              layer(id, Number(event.target.value) / 100)
                            }
                          />
                          <output>
                            {Math.round(mix.sound.layers[id] * 100)}%
                          </output>
                        </label>
                        <button
                          className="atmo-mute"
                          aria-label={`${mix.sound.layers[id] ? 'Silenciar' : 'Activar'} ${label}`}
                          onClick={() => {
                            const volume = mix.sound.layers[id];
                            if (volume) remembered.current.set(id, volume);
                            layer(
                              id,
                              volume ? 0 : (remembered.current.get(id) ?? 0.35),
                            );
                          }}
                        >
                          {mix.sound.layers[id] ? (
                            <Volume2 size={15} />
                          ) : (
                            <VolumeX size={15} />
                          )}
                        </button>
                      </div>
                    ))}
                </div>
                <p className="atmo-footnote">
                  <AudioLines size={14} />
                  Grabaciones gratuitas y sonidos sintetizados en tu
                  dispositivo. Sin servicios de audio externos ni suscripciones.
                  <a
                    href="/assets/library-sounds/credits.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Créditos y licencias
                  </a>
                </p>
                {!active.length && (
                  <p className="atmo-message">
                    Activa un sonido o elige un ambiente para empezar.
                  </p>
                )}
              </>
            )}
            {tab === 'reading' && (
              <div className="atmo-reading">
                <div className="atmo-reading-art" aria-hidden="true">
                  <BookOpen size={50} />
                  <span>UN CAPÍTULO MÁS</span>
                </div>
                <div>
                  <h5>Tiempo para desaparecer entre páginas.</h5>
                  <p>
                    Elige una sesión. Al terminar, el sonido puede apagarse poco
                    a poco o darte un aviso suave.
                  </p>
                  <div className="atmo-duration">
                    {[15, 25, 45, 60, 90].map((v) => (
                      <button
                        key={v}
                        aria-pressed={minutes === v}
                        onClick={() => setMinutes(v)}
                      >
                        {v} min
                      </button>
                    ))}
                  </div>
                  <label className="atmo-select">
                    Duración en minutos
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={minutes || ''}
                      onChange={(event) =>
                        setMinutes(Number(event.target.value))
                      }
                      onBlur={() => setMinutes(readingMinutes(minutes))}
                    />
                  </label>
                  <label className="atmo-select">
                    Al terminar
                    <select
                      value={finish}
                      onChange={(event) => setFinish(event.target.value)}
                    >
                      <option value="fade">Apagar sonido suavemente</option>
                      <option value="chime">
                        Solo avisar, seguir escuchando
                      </option>
                    </select>
                  </label>
                  {deadline ? (
                    <div className="atmo-timer-active">
                      <strong>{remainingTime(deadline, now)}</strong>
                      <button
                        className="button secondary"
                        onClick={() => {
                          setDeadline(null);
                          setNotice('Temporizador cancelado.');
                        }}
                      >
                        Cancelar temporizador
                      </button>
                    </div>
                  ) : (
                    <button
                      className="button primary"
                      onClick={() => {
                        const time = Date.now();
                        setNow(time);
                        setDeadline(time + readingMinutes(minutes) * 60000);
                        setNotice('Sesión de lectura iniciada.');
                      }}
                    >
                      <Timer size={16} />
                      Empezar sesión de lectura
                    </button>
                  )}
                  <p className="atmo-footnote">
                    El temporizador pertenece a esta sesión. Puedes cerrar este
                    panel y seguir disfrutando de la estantería.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
