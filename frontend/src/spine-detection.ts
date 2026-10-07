import {
  quadBounds,
  insetQuad,
  validQuad,
  type PhotoPoint,
  type SpineQuad,
} from './spine-perspective';

export interface SpineCandidate {
  quad: SpineQuad;
  confidence: number;
}
interface Line {
  cos: number;
  sin: number;
  rho: number;
  votes: number;
  boundary?: boolean;
  inferred?: boolean;
  extent?: [number, number];
  profile?: Uint32Array;
}
/** Bounded, offline Sobel/Hough detector. No photo leaves the browser. */
function detectUprightSpines(image: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}): (SpineCandidate & { rank: number })[] {
  const { width: w, height: h, data } = image;
  if (w < 16 || h < 16) return [];
  const magnitude = new Float32Array(w * h),
    angle = new Float32Array(w * h);
  const grey = new Float32Array(w * h * 3);
  // Blur first so printed letters, sensor noise and wood grain do not dominate.
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++)
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            sum +=
              data[((y + dy) * w + x + dx) * 4 + c] *
              (dx === 0 ? 2 : 1) *
              (dy === 0 ? 2 : 1);
        grey[(y * w + x) * 3 + c] = sum / 16;
      }
  const strengths: number[] = [];
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      let best = 0,
        gx = 0,
        gy = 0;
      for (let c = 0; c < 3; c++) {
        const value = (dx: number, dy: number) =>
          grey[((y + dy) * w + x + dx) * 3 + c];
        const sx =
          -value(-1, -1) +
          value(1, -1) -
          2 * value(-1, 0) +
          2 * value(1, 0) -
          value(-1, 1) +
          value(1, 1);
        const sy =
          -value(-1, -1) -
          2 * value(0, -1) -
          value(1, -1) +
          value(-1, 1) +
          2 * value(0, 1) +
          value(1, 1);
        const strength = Math.hypot(sx, sy);
        if (strength > best) {
          best = strength;
          gx = sx;
          gy = sy;
        }
      }
      magnitude[i] = best;
      angle[i] = ((Math.atan2(gy, gx) * 180) / Math.PI + 180) % 180;
      if (best > 25) strengths.push(best);
    }
  if (strengths.length < Math.min(w, h)) return [];
  strengths.sort((a, b) => a - b);
  const threshold = Math.max(
    35,
    strengths[Math.floor(strengths.length * 0.55)] * 0.55,
  );
  let edgeCount = 0;
  for (const value of magnitude) if (value >= threshold) edgeCount++;
  if (edgeCount > w * h * 0.45) return [];
  const radius = Math.ceil(Math.hypot(w, h)),
    stride = radius * 2 + 1;
  const accumulator = new Float32Array(stride * 90);
  const trig = Array.from({ length: 90 }, (_, i) => ({
    cos: Math.cos((i * Math.PI) / 90),
    sin: Math.sin((i * Math.PI) / 90),
  }));
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      if (magnitude[i] < threshold) continue;
      const normal = Math.round(angle[i] / 2);
      for (let d = -4; d <= 4; d++) {
        const a = (normal + d + 90) % 90,
          { cos, sin } = trig[a];
        const rho = Math.round(x * cos + y * sin) + radius;
        accumulator[a * stride + rho] += Math.min(2, magnitude[i] / threshold);
      }
    }
  const peaks: { a: number; r: number; votes: number }[] = [];
  for (let a = 0; a < 90; a++)
    for (let r = 1; r < stride - 1; r++) {
      const votes = accumulator[a * stride + r];
      if (
        votes < Math.min(w, h) * 0.17 ||
        votes < accumulator[a * stride + r - 1] ||
        votes < accumulator[a * stride + r + 1]
      )
        continue;
      peaks.push({ a, r, votes });
    }
  peaks.sort((a, b) => b.votes - a.votes);
  const vertical: Line[] = [],
    horizontal: Line[] = [];
  for (const peak of peaks) {
    const line = { ...trig[peak.a], rho: peak.r - radius, votes: peak.votes };
    const family =
      Math.abs(line.cos) > 0.85
        ? vertical
        : Math.abs(line.sin) > 0.85
          ? horizontal
          : null;
    if (!family || family.length >= (family === horizontal ? 24 : 16)) continue;
    if (
      family.some((other) => {
        const sign = other.cos * line.cos + other.sin * line.sin < 0 ? -1 : 1;
        const location = (edge: Line) =>
          family === vertical
            ? (edge.rho - (edge.sin * h) / 2) / edge.cos
            : (edge.rho - (edge.cos * w) / 2) / edge.sin;
        return (
          Math.abs(location(other) - location(line)) < 5 &&
          Math.abs(other.cos - sign * line.cos) +
            Math.abs(other.sin - sign * line.sin) <
            0.15
        );
      })
    )
      continue;
    family.push(line);
  }
  // Refine quantized Hough peaks to subpixel outlines before rectification.
  for (const line of [...vertical, ...horizontal]) {
    let weight = 0,
      mx = 0,
      my = 0;
    const points: { x: number; y: number; weight: number }[] = [];
    for (let y = 2; y < h - 2; y++)
      for (let x = 2; x < w - 2; x++) {
        const i = y * w + x;
        if (
          magnitude[i] < threshold ||
          Math.abs(x * line.cos + y * line.sin - line.rho) > 2.5
        )
          continue;
        const a = (angle[i] * Math.PI) / 180;
        if (Math.abs(Math.cos(a) * line.cos + Math.sin(a) * line.sin) < 0.96)
          continue;
        const contribution = magnitude[i];
        points.push({ x, y, weight: contribution });
        weight += contribution;
        mx += x * contribution;
        my += y * contribution;
      }
    if (points.length < 16) continue;
    mx /= weight;
    my /= weight;
    let xx = 0,
      xy = 0,
      yy = 0;
    for (const point of points) {
      const x = point.x - mx,
        y = point.y - my;
      xx += x * x * point.weight;
      xy += x * y * point.weight;
      yy += y * y * point.weight;
    }
    const tangent = Math.atan2(2 * xy, xx - yy) / 2;
    let cos = -Math.sin(tangent),
      sin = Math.cos(tangent);
    if (cos * line.cos + sin * line.sin < 0) {
      cos *= -1;
      sin *= -1;
    }
    if (cos * line.cos + sin * line.sin > 0.995) {
      line.cos = cos;
      line.sin = sin;
      line.rho = mx * cos + my * sin;
    }
  }
  // Allow already tightly framed photographs to use the original image edges.
  vertical.push(
    { cos: 1, sin: 0, rho: 0, votes: 0, boundary: true },
    { cos: 1, sin: 0, rho: w, votes: 0, boundary: true },
  );
  horizontal.push(
    { cos: 0, sin: 1, rho: 0, votes: 0, boundary: true },
    { cos: 0, sin: 1, rho: h, votes: 0, boundary: true },
  );
  const intersect = (a: Line, b: Line): PhotoPoint => {
    const det = a.cos * b.sin - a.sin * b.cos;
    return {
      x: (a.rho * b.sin - a.sin * b.rho) / det,
      y: (a.cos * b.rho - a.rho * b.cos) / det,
    };
  };
  const edgeAt = (x: number, y: number, line: Line) => {
    if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) return false;
    let found = false;
    for (let d = -2; d <= 2; d++) {
      const px = Math.max(0, Math.min(w - 1, Math.round(x + line.cos * d))),
        py = Math.max(0, Math.min(h - 1, Math.round(y + line.sin * d))),
        pixel = py * w + px;
      const normal = (angle[pixel] * Math.PI) / 180;
      if (
        magnitude[pixel] >= threshold &&
        Math.abs(Math.cos(normal) * line.cos + Math.sin(normal) * line.sin) >
          0.94
      )
        found = true;
    }
    if (!found) return false;
    const sample = (direction: number) => {
      const sums = [0, 0, 0];
      for (let distance = 3; distance <= 6; distance++) {
        const px = Math.max(
            0,
            Math.min(w - 1, Math.round(x + line.cos * distance * direction)),
          ),
          py = Math.max(
            0,
            Math.min(h - 1, Math.round(y + line.sin * distance * direction)),
          );
        for (let channel = 0; channel < 3; channel++)
          sums[channel] += grey[(py * w + px) * 3 + channel] / 4;
      }
      return sums;
    };
    const inside = sample(1),
      outside = sample(-1);
    return (
      Math.max(...inside.map((channel, i) => Math.abs(channel - outside[i]))) >=
      24
    );
  };
  for (const line of [...vertical, ...horizontal]) {
    if (line.boundary) continue;
    const upright = Math.abs(line.cos) > Math.abs(line.sin),
      length = upright ? h : w;
    line.profile = new Uint32Array(length + 1);
    let start = -1,
      last = -1,
      best: [number, number] = [0, 0];
    for (let coordinate = 2; coordinate < length - 2; coordinate++) {
      const x = upright
        ? (line.rho - line.sin * coordinate) / line.cos
        : coordinate;
      const y = upright
        ? coordinate
        : (line.rho - line.cos * coordinate) / line.sin;
      const present = edgeAt(Math.round(x), Math.round(y), line);
      line.profile[coordinate + 1] =
        line.profile[coordinate] + (present ? 1 : 0);
      if (!present) continue;
      if (start < 0 || coordinate - last > 12) start = coordinate;
      last = coordinate;
      if (last - start > best[1] - best[0]) best = [start, last];
    }
    line.profile[length - 1] = line.profile[length - 2];
    line.profile[length] = line.profile[length - 1];
    if (best[1] - best[0] >= length * 0.2) line.extent = best;
  }
  const through = (a: PhotoPoint, b: PhotoPoint): Line => {
    const length = Math.hypot(b.x - a.x, b.y - a.y),
      cos = -(b.y - a.y) / length,
      sin = (b.x - a.x) / length;
    return { cos, sin, rho: cos * a.x + sin * a.y, votes: 0, inferred: true };
  };
  const support = (a: PhotoPoint, b: PhotoPoint, line: Line) => {
    if (line.boundary) return 0.42;
    if (line.inferred) return 0.6;
    const upright = Math.abs(line.cos) > Math.abs(line.sin),
      length = upright ? h : w;
    const start = Math.max(
      2,
      Math.ceil(Math.min(upright ? a.y : a.x, upright ? b.y : b.x)),
    );
    const end = Math.min(
      length - 3,
      Math.floor(Math.max(upright ? a.y : a.x, upright ? b.y : b.x)),
    );
    return line.profile && end >= start
      ? (line.profile[end + 1] - line.profile[start]) / (end - start + 1)
      : 0;
  };
  const found: (SpineCandidate & { rank: number })[] = [];
  for (let a = 0; a < vertical.length; a++)
    for (let b = a + 1; b < vertical.length; b++) {
      const pair = [vertical[a], vertical[b]].sort(
        (l, r) =>
          (l.rho - (l.sin * h) / 2) / l.cos - (r.rho - (r.sin * h) / 2) / r.cos,
      );
      const midWidth =
        (pair[1].rho - (pair[1].sin * h) / 2) / pair[1].cos -
        (pair[0].rho - (pair[0].sin * h) / 2) / pair[0].cos;
      if (midWidth < 8 || midWidth > w * 0.9) continue;
      const rowOptions = [...horizontal];
      if (pair.every((line) => line.extent)) {
        const pointAt = (line: Line, y: number) => ({
          x: (line.rho - line.sin * y) / line.cos,
          y,
        });
        for (const end of [0, 1]) {
          const line = through(
            pointAt(pair[0], pair[0].extent![end]),
            pointAt(pair[1], pair[1].extent![end]),
          );
          if (Math.abs(line.sin) > 0.85) rowOptions.push(line);
        }
      }
      for (let c = 0; c < rowOptions.length; c++)
        for (let d = c + 1; d < rowOptions.length; d++) {
          const rows = [rowOptions[c], rowOptions[d]].sort(
            (l, r) =>
              (l.rho - (l.cos * w) / 2) / l.sin -
              (r.rho - (r.cos * w) / 2) / r.sin,
          );
          const quad: SpineQuad = [
            intersect(pair[0], rows[0]),
            intersect(pair[1], rows[0]),
            intersect(pair[1], rows[1]),
            intersect(pair[0], rows[1]),
          ];
          if (!validQuad(quad, image)) continue;
          const width =
            (Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y) +
              Math.hypot(quad[2].x - quad[3].x, quad[2].y - quad[3].y)) /
            2;
          const height =
            (Math.hypot(quad[3].x - quad[0].x, quad[3].y - quad[0].y) +
              Math.hypot(quad[2].x - quad[1].x, quad[2].y - quad[1].y)) /
            2;
          const ratio = Math.min(width, height) / Math.max(width, height),
            area = (width * height) / (w * h);
          if (
            ratio < 0.055 ||
            ratio > 0.6 ||
            area < 0.025 ||
            Math.max(width, height) < Math.max(w, h) * 0.28
          )
            continue;
          const strengths = [
            support(quad[0], quad[1], rows[0]),
            support(quad[1], quad[2], pair[1]),
            support(quad[2], quad[3], rows[1]),
            support(quad[3], quad[0], pair[0]),
          ];
          const longEdges = height > width ? [1, 3] : [0, 2];
          if (
            longEdges.some((i) => strengths[i] < 0.55) ||
            strengths.some((s) => s < 0.32)
          )
            continue;
          const confidence = strengths.reduce((sum, s) => sum + s, 0) / 4;
          if (confidence < 0.67) continue;
          const sideLines = height > width ? pair : rows;
          const intervals =
            height > width
              ? [
                  [quad[0].y, quad[3].y],
                  [quad[1].y, quad[2].y],
                ]
              : [
                  [quad[0].x, quad[1].x],
                  [quad[3].x, quad[2].x],
                ];
          if (
            sideLines.some(
              (line, i) =>
                line.extent &&
                (intervals[i][0] < line.extent[0] - 10 ||
                  intervals[i][1] > line.extent[1] + 10),
            )
          )
            continue;
          const coverage =
            sideLines.reduce(
              (sum, line, i) =>
                sum +
                (line.extent
                  ? Math.min(
                      1,
                      (intervals[i][1] - intervals[i][0]) /
                        (line.extent[1] - line.extent[0]),
                    )
                  : 0),
              0,
            ) / 2;
          const oriented: SpineQuad =
            height > width ? quad : [quad[1], quad[2], quad[3], quad[0]];
          found.push({
            quad: oriented,
            confidence,
            rank:
              confidence +
              Math.min(0.15, area * 1.2) +
              coverage * 0.35 +
              (Math.max(width, height) / Math.max(w, h)) * 0.2,
          });
        }
    }
  found.sort((a, b) => b.rank - a.rank);
  const candidates: (SpineCandidate & { rank: number })[] = [];
  for (const candidate of found) {
    const box = quadBounds(candidate.quad);
    if (
      candidates.some((other) => {
        const b = quadBounds(other.quad),
          intersection =
            Math.max(
              0,
              Math.min(box.x + box.width, b.x + b.width) - Math.max(box.x, b.x),
            ) *
            Math.max(
              0,
              Math.min(box.y + box.height, b.y + b.height) -
                Math.max(box.y, b.y),
            );
        return (
          intersection /
            (box.width * box.height + b.width * b.height - intersection) >
          0.45
        );
      })
    )
      continue;
    const clean = insetQuad(candidate.quad, 1.8);
    candidates.push({
      quad: validQuad(clean, image) ? clean : candidate.quad,
      confidence: candidate.confidence,
      rank: candidate.rank,
    });
    if (candidates.length === 8) break;
  }
  return candidates;
}

/** Evaluate both orientations so a sideways photo gets the same whole-spine detection. */
export function detectSpines(image: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}): SpineCandidate[] {
  const first = detectUprightSpines(image),
    rotated = new Uint8ClampedArray(image.data.length);
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      const before = (y * image.width + x) * 4,
        after = (x * image.height + image.height - 1 - y) * 4;
      for (let c = 0; c < 4; c++) rotated[after + c] = image.data[before + c];
    }
  const second = detectUprightSpines({
    data: rotated,
    width: image.height,
    height: image.width,
  }).map((candidate) => ({
    ...candidate,
    quad: candidate.quad.map((p) => ({
      x: p.y,
      y: image.height - p.x,
    })) as SpineQuad,
  }));
  const choices: SpineCandidate[] = [];
  for (const candidate of [...first, ...second].sort(
    (a, b) => b.rank - a.rank,
  )) {
    const box = quadBounds(candidate.quad);
    if (
      choices.some((other) => {
        const b = quadBounds(other.quad),
          intersection =
            Math.max(
              0,
              Math.min(box.x + box.width, b.x + b.width) - Math.max(box.x, b.x),
            ) *
            Math.max(
              0,
              Math.min(box.y + box.height, b.y + b.height) -
                Math.max(box.y, b.y),
            );
        return (
          intersection /
            (box.width * box.height + b.width * b.height - intersection) >
          0.45
        );
      })
    )
      continue;
    choices.push({ quad: candidate.quad, confidence: candidate.confidence });
    if (choices.length === 8) break;
  }
  return choices;
}
