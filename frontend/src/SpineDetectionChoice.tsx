import { useEffect, useRef } from 'react';
import { drawPerspectiveSpine, type SpineQuad } from './spine-perspective';

export default function SpineDetectionChoice({
  source,
  quad,
  index,
  selected,
  onSelect,
}: {
  source: HTMLCanvasElement;
  quad: SpineQuad;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvas.current)
      drawPerspectiveSpine(canvas.current, source, quad, 0.22, 160);
  }, [source, quad]);
  return (
    <button
      type="button"
      className="spine-detection-choice"
      aria-pressed={selected}
      aria-label={`Elegir lomo ${index + 1}`}
      onClick={onSelect}
    >
      <canvas ref={canvas} aria-hidden="true" />
      <span>Lomo {index + 1}</span>
    </button>
  );
}
