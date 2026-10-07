import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import {
  fitImage,
  moveCrop,
  resizeCrop,
  type CropHandle,
  type CropRect,
} from './spine-photo';
import { adjustQuad, type SpineQuad } from './spine-perspective';

const handles: { id: CropHandle; label: string }[] = [
  { id: 'nw', label: 'esquina superior izquierda' },
  { id: 'n', label: 'borde superior' },
  { id: 'ne', label: 'esquina superior derecha' },
  { id: 'e', label: 'borde derecho' },
  { id: 'se', label: 'esquina inferior derecha' },
  { id: 's', label: 'borde inferior' },
  { id: 'sw', label: 'esquina inferior izquierda' },
  { id: 'w', label: 'borde izquierdo' },
];
interface Drag {
  pointer: number;
  x: number;
  y: number;
  crop: CropRect;
  handle: CropHandle | 'move';
  scale: number;
  quad?: SpineQuad;
}
export default function SpinePhotoCropper({
  source,
  crop,
  onChange,
  disabled,
  subject = 'lomo',
  quad,
  onQuadChange,
}: {
  source: HTMLCanvasElement;
  crop: CropRect;
  onChange: (crop: CropRect) => void;
  disabled: boolean;
  subject?: 'lomo' | 'portada';
  quad?: SpineQuad | null;
  onQuadChange?: (quad: SpineQuad) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const [size, setSize] = useState({ width: 300, height: 340 });
  const [photoZoom, setPhotoZoom] = useState(1);
  const fitted = fitImage(
    source,
    Math.max(1, size.width - 32),
    Math.max(1, size.height - 32),
  );
  const magnification = quad ? photoZoom : 1;
  const fit = {
    scale: fitted.scale * magnification,
    width: fitted.width * magnification,
    height: fitted.height * magnification,
    left: magnification === 1 ? fitted.left + 16 : 16,
    top: magnification === 1 ? fitted.top + 16 : 16,
  };
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(stage.current!);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const canvas = photo.current!;
    canvas.width = Math.max(1, Math.round(fit.width * 2));
    canvas.height = Math.max(1, Math.round(fit.height * 2));
    canvas
      .getContext('2d')
      ?.drawImage(source, 0, 0, canvas.width, canvas.height);
  }, [source, fit.width, fit.height]);
  useEffect(() => {
    drag.current = null;
    setPhotoZoom(1);
  }, [source, disabled]);
  function start(
    event: PointerEvent<HTMLButtonElement>,
    handle: CropHandle | 'move',
  ) {
    if (
      disabled ||
      drag.current ||
      !fit.scale ||
      (event.pointerType === 'mouse' && event.button !== 0)
    )
      return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      crop,
      handle,
      scale: fit.scale,
      quad: quad ?? undefined,
    };
  }
  function moving(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || start.pointer !== event.pointerId) return;
    const dx = (event.clientX - start.x) / start.scale,
      dy = (event.clientY - start.y) / start.scale;
    if (start.quad && onQuadChange) {
      onQuadChange(adjustQuad(start.quad, start.handle, dx, dy, source));
      return;
    }
    onChange(
      start.handle === 'move'
        ? moveCrop(start.crop, dx, dy, source)
        : resizeCrop(start.crop, start.handle, dx, dy, source),
    );
  }
  function finish(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    if (drag.current?.pointer !== event.pointerId) return;
    const start = drag.current;
    drag.current = null;
    if (cancel) {
      if (start.quad && onQuadChange) onQuadChange(start.quad);
      else onChange(start.crop);
    }
  }
  function keyboard(
    event: KeyboardEvent<HTMLButtonElement>,
    handle: CropHandle | 'move',
  ) {
    if (disabled) return;
    if (event.key === 'Escape' && drag.current) {
      event.preventDefault();
      event.stopPropagation();
      if (drag.current.quad && onQuadChange) onQuadChange(drag.current.quad);
      else onChange(drag.current.crop);
      drag.current = null;
      return;
    }
    if (
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
        event.key,
      ) ||
      !fit.scale
    )
      return;
    event.preventDefault();
    const step = (event.shiftKey ? 10 : 2) / fit.scale;
    const dx =
      event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const dy =
      event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    if (quad && onQuadChange) {
      onQuadChange(adjustQuad(quad, handle, dx, dy, source));
      return;
    }
    onChange(
      handle === 'move'
        ? moveCrop(crop, dx, dy, source)
        : resizeCrop(crop, handle, dx, dy, source),
    );
  }
  const events = (handle: CropHandle | 'move') => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) =>
      start(event, handle),
    onPointerMove: moving,
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => finish(event),
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) =>
      finish(event, true),
    onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) =>
      finish(event, true),
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) =>
      keyboard(event, handle),
  });
  return (
    <div className="spine-crop-editor">
      <div
        className={`spine-crop-stage ${quad ? 'has-perspective' : ''}`}
        ref={stage}
        aria-label={`Foto completa para recortar ${subject === 'lomo' ? 'el lomo' : 'la portada'}`}
      >
        {quad && (
          <div
            className="spine-photo-scroll-size"
            aria-hidden="true"
            style={{
              minWidth: Math.max(size.width, fit.width + 32),
              height: Math.max(size.height, fit.height + 32),
            }}
          />
        )}
        <canvas
          ref={photo}
          className="spine-crop-original"
          aria-label="Fotografía original"
          style={{
            left: fit.left,
            top: fit.top,
            width: fit.width,
            height: fit.height,
          }}
        />
        {quad && (
          <svg
            className="spine-perspective-overlay"
            width={fit.width}
            height={fit.height}
            viewBox={`0 0 ${source.width} ${source.height}`}
            style={{ left: fit.left, top: fit.top }}
            aria-hidden="true"
          >
            <path
              d={`M0 0H${source.width}V${source.height}H0Z M${quad.map((p) => `${p.x} ${p.y}`).join('L')}Z`}
              fill="#151c19a6"
              fillRule="evenodd"
            />
            <polygon
              points={quad.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#fff9ed"
              strokeWidth={2 / fit.scale}
            />
          </svg>
        )}
        <div
          className={`spine-crop-frame ${quad ? 'is-perspective' : ''}`}
          role="group"
          aria-label={`Área de la foto que se usará como ${subject}`}
          data-crop-x={crop.x}
          data-crop-y={crop.y}
          data-crop-width={crop.width}
          data-crop-height={crop.height}
          style={
            {
              left: fit.left + crop.x * fit.scale,
              top: fit.top + crop.y * fit.scale,
              width: crop.width * fit.scale,
              height: crop.height * fit.scale,
            } as CSSProperties
          }
        >
          <button
            type="button"
            className="spine-crop-move"
            aria-label="Mover recorte"
            disabled={disabled}
            style={
              quad
                ? {
                    clipPath: `polygon(${quad.map((p) => `${((p.x - crop.x) / crop.width) * 100}% ${((p.y - crop.y) / crop.height) * 100}%`).join(',')})`,
                  }
                : undefined
            }
            {...events('move')}
          />
          {!quad && <span className="spine-crop-grid" aria-hidden="true" />}
          {handles.map((handle, i) => {
            const point = quad
              ? i % 2 === 0
                ? quad[i / 2]
                : {
                    x:
                      (quad[Math.floor(i / 2)].x +
                        quad[(Math.floor(i / 2) + 1) % 4].x) /
                      2,
                    y:
                      (quad[Math.floor(i / 2)].y +
                        quad[(Math.floor(i / 2) + 1) % 4].y) /
                      2,
                  }
              : null;
            return (
              <button
                type="button"
                key={handle.id}
                className={`spine-crop-handle crop-handle-${handle.id}`}
                aria-label={`Ajustar ${handle.label} del recorte`}
                disabled={disabled}
                style={
                  point
                    ? {
                        left: (point.x - crop.x) * fit.scale,
                        top: (point.y - crop.y) * fit.scale,
                      }
                    : undefined
                }
                {...events(handle.id)}
              />
            );
          })}
        </div>
      </div>
      {quad && (
        <div
          className="spine-photo-zoom"
          role="group"
          aria-label="Ampliación de la fotografía"
        >
          <button
            type="button"
            className="button secondary"
            aria-label="Reducir foto"
            disabled={disabled || photoZoom === 1}
            onClick={() => setPhotoZoom((n) => Math.max(1, n - 0.5))}
          >
            −
          </button>
          <span>{Math.round(photoZoom * 100)}%</span>
          <button
            type="button"
            className="button secondary"
            aria-label="Ampliar foto"
            disabled={disabled || photoZoom === 4}
            onClick={() => setPhotoZoom((n) => Math.min(4, n + 0.5))}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
