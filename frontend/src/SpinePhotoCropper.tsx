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
}
export default function SpinePhotoCropper({
  source,
  crop,
  onChange,
  disabled,
}: {
  source: HTMLCanvasElement;
  crop: CropRect;
  onChange: (crop: CropRect) => void;
  disabled: boolean;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const [size, setSize] = useState({ width: 300, height: 340 });
  const fitted = fitImage(
    source,
    Math.max(1, size.width - 32),
    Math.max(1, size.height - 32),
  );
  const fit = { ...fitted, left: fitted.left + 16, top: fitted.top + 16 };
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
    };
  }
  function moving(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || start.pointer !== event.pointerId) return;
    const dx = (event.clientX - start.x) / start.scale,
      dy = (event.clientY - start.y) / start.scale;
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
    if (cancel) onChange(start.crop);
  }
  function keyboard(
    event: KeyboardEvent<HTMLButtonElement>,
    handle: CropHandle | 'move',
  ) {
    if (disabled) return;
    if (event.key === 'Escape' && drag.current) {
      event.preventDefault();
      event.stopPropagation();
      onChange(drag.current.crop);
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
    <div
      className="spine-crop-stage"
      ref={stage}
      aria-label="Foto completa para recortar el lomo"
    >
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
      <div
        className="spine-crop-frame"
        role="group"
        aria-label="Área de la foto que se usará como lomo"
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
          {...events('move')}
        />
        <span className="spine-crop-grid" aria-hidden="true" />
        {handles.map((handle) => (
          <button
            type="button"
            key={handle.id}
            className={`spine-crop-handle crop-handle-${handle.id}`}
            aria-label={`Ajustar ${handle.label} del recorte`}
            disabled={disabled}
            {...events(handle.id)}
          />
        ))}
      </div>
    </div>
  );
}
