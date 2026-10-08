import {
  furnitureStyles,
  shelfLightTypes,
  type Bookcase,
  type BookshelfDesign,
  type SceneItem,
  type Shelf,
} from '../../src/library/bookshelf-design';
import {
  decorAction,
  furnitureNames,
  lightNames,
} from '../../src/library/bookshelf-craft';

function ChoiceArt({ kind, light }: { kind: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 100 60" aria-hidden="true">
      <rect x="8" y="6" width="84" height="49" rx="3" fill="#342e29" />
      {light ? (
        <>
          <path d="M14 11H86" stroke="#6d6454" strokeWidth="2" />
          {kind === 'strip' && (
            <>
              <path d="M15 12H85" stroke="#ffdfa0" strokeWidth="3" />
              <path d="M15 15L9 52h82l-6-37" fill="#efc271" opacity=".14" />
            </>
          )}
          {kind === 'spots' &&
            [25, 50, 75].map((x) => (
              <g key={x}>
                <path d={`M${x} 13l-15 35h30Z`} fill="#ffdfa0" opacity=".2" />
                <ellipse cx={x} cy="12" rx="6" ry="3" fill="#f9d69a" />
              </g>
            ))}
          {['fairy', 'globes'].includes(kind) && (
            <>
              <path d="M15 12Q50 37 85 12" fill="none" stroke="#c6af7b" />
              {Array.from({ length: kind === 'fairy' ? 11 : 5 }, (_, i) => {
                const t = (i + 1) / (kind === 'fairy' ? 12 : 6);
                return (
                  <circle
                    key={i}
                    cx={15 + 70 * t}
                    cy={12 + 50 * t * (1 - t)}
                    r={kind === 'fairy' ? 1.5 : 4}
                    fill="#ffe2a0"
                  />
                );
              })}
            </>
          )}
          {kind === 'neon' && (
            <path
              d="M15 32Q50 0 85 32"
              fill="none"
              stroke="#d4b9fc"
              strokeWidth="3"
            />
          )}
          <path d="M14 52H86" stroke="#98774d" strokeWidth="4" />
        </>
      ) : (
        <>
          <rect x="14" y="12" width="72" height="39" fill="#826449" />
          <path d="M14 26H86M14 41H86" stroke="#c19d68" strokeWidth="3" />
          {[20, 27, 34, 54, 63, 72].map((x, i) => (
            <rect
              key={x}
              x={x}
              y={i < 3 ? 14 : 29}
              width="5"
              height="11"
              fill={['#c0b288', '#777e67', '#a28470'][i % 3]}
            />
          ))}
          {kind === 'arch' && (
            <path
              d="M11 22Q50-7 89 22"
              stroke="#dec49a"
              strokeWidth="5"
              fill="none"
            />
          )}
          {kind === 'gilded' && (
            <rect
              x="11"
              y="9"
              width="78"
              height="45"
              fill="none"
              stroke="#e6bf70"
              strokeWidth="1.5"
            />
          )}
          {kind === 'industrial' && (
            <path d="M12 7v48M88 7v48" stroke="#88918a" strokeWidth="4" />
          )}
          {kind === 'floating' && (
            <path
              d="M8 7v48M92 7v48M8 7h84"
              stroke="#faf7f0"
              strokeWidth="10"
            />
          )}
        </>
      )}
    </svg>
  );
}
type Change = (fn: (design: BookshelfDesign) => void, action?: string) => void;
export function FurnitureControls({
  bookcase,
  shelf,
  changed,
}: {
  bookcase: Bookcase;
  shelf: Shelf;
  changed: Change;
}) {
  const updateLight = (fn: (shelf: Shelf) => void, all = false) =>
    changed((next) => {
      const c = next.bookcases.find((c) => c.id === bookcase.id)!;
      for (const s of c.shelves) if (all || s.id === shelf.id) fn(s);
    });
  return (
    <>
      <section className="craft-section" aria-label="Diseño del mueble">
        <strong>Un mueble con carácter</strong>
        <p>Elige la carpintería. Tus libros y objetos conservan su sitio.</p>
        <div className="craft-options">
          {furnitureStyles.map((style) => (
            <button
              key={style}
              className="craft-choice"
              aria-pressed={(bookcase.style ?? 'classic') === style}
              onClick={() =>
                changed((next) => {
                  next.bookcases.find((c) => c.id === bookcase.id)!.style =
                    style;
                })
              }
            >
              <ChoiceArt kind={style} />
              {furnitureNames[style]}
            </button>
          ))}
        </div>
      </section>
      <section className="craft-section" aria-label="Iluminación del mueble">
        <strong>La luz de esta balda</strong>
        <div className="craft-options">
          {shelfLightTypes.map((type) => (
            <button
              key={type}
              className="craft-choice"
              aria-pressed={(shelf.light.type ?? 'strip') === type}
              onClick={() =>
                updateLight((s) => {
                  s.light.type = type;
                })
              }
            >
              <ChoiceArt kind={type} light />
              {lightNames[type]}
            </button>
          ))}
        </div>
        <button
          className="button secondary"
          aria-pressed={bookcase.lights_on !== false}
          onClick={() =>
            changed((next) => {
              const c = next.bookcases.find((c) => c.id === bookcase.id)!;
              c.lights_on = c.lights_on === false;
            })
          }
        >
          {bookcase.lights_on === false ? 'Encender' : 'Apagar'} luces de este
          mueble
        </button>
        <label className="studio-checkbox">
          <input
            type="checkbox"
            checked={shelf.light.enabled !== false}
            onChange={(e) =>
              updateLight((s) => {
                s.light.enabled = e.target.checked;
              })
            }
          />{' '}
          Luz de esta balda encendida
        </label>
        <button
          className="text-button"
          onClick={() =>
            updateLight((s) => {
              s.light = { ...shelf.light };
            }, true)
          }
        >
          Copiar esta iluminación a todas las baldas
        </button>
        <p>
          El interruptor del mueble controla sus luminarias y objetos luminosos.
          La luz de la habitación es independiente.
        </p>
      </section>
    </>
  );
}
export function DecorationControls({
  item,
  onInteract,
  onUpdate,
}: {
  item: SceneItem;
  onInteract: (item: SceneItem) => void;
  onUpdate: (patch: Partial<SceneItem>) => void;
}) {
  const action = decorAction(item);
  return action ? (
    <section className="craft-section">
      <strong>Este objeto está vivo</strong>
      {['portrait', 'landscape'].includes(item.asset) && (
        <label className="field">
          Ilustración del marco
          <select
            aria-label="Ilustración del marco"
            value={item.artwork ?? 'original'}
            onChange={(e) =>
              onUpdate({
                artwork:
                  e.target.value === 'original'
                    ? undefined
                    : Number(e.target.value),
              })
            }
          >
            <option value="original">Fotografía original</option>
            <option value="0">Paisaje de montaña</option>
            <option value="1">Noche lunar</option>
            <option value="2">Herbario</option>
            <option value="3">Sigilo dorado</option>
          </select>
        </label>
      )}
      <button className="button secondary" onClick={() => onInteract(item)}>
        {action}
      </button>
      <p>
        En modo Ver puedes tocarlo directamente. Su estado se guarda con la
        composición.
      </p>
    </section>
  ) : null;
}
