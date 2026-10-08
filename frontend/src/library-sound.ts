import {
  soundLayers,
  type BookshelfAtmosphere,
  type SoundLayer,
} from '../../src/library/bookshelf-atmosphere';

export type LibraryMix = BookshelfAtmosphere['sound'];
const clamp = (n: number) =>
  Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
export function safeMix(mix: LibraryMix): LibraryMix {
  return {
    master: clamp(mix.master),
    width: clamp(mix.width),
    layers: Object.fromEntries(
      soundLayers.map(([id]) => [id, clamp(mix.layers[id])]),
    ) as LibraryMix['layers'],
  };
}
const continuous: Partial<
  Record<
    SoundLayer,
    {
      noise: 'white' | 'pink' | 'brown';
      filter: BiquadFilterType;
      frequency: number;
      gain: number;
      period: number;
    }
  >
> = {
  rain: {
    noise: 'pink',
    filter: 'lowpass',
    frequency: 4200,
    gain: 0.62,
    period: 13,
  },
  fire: {
    noise: 'brown',
    filter: 'lowpass',
    frequency: 650,
    gain: 0.6,
    period: 5.7,
  },
  wind: {
    noise: 'brown',
    filter: 'lowpass',
    frequency: 1000,
    gain: 0.62,
    period: 17,
  },
  cafe: {
    noise: 'pink',
    filter: 'bandpass',
    frequency: 390,
    gain: 0.37,
    period: 8.3,
  },
  water: {
    noise: 'white',
    filter: 'bandpass',
    frequency: 2100,
    gain: 0.15,
    period: 3.7,
  },
  ocean: {
    noise: 'pink',
    filter: 'lowpass',
    frequency: 1500,
    gain: 0.76,
    period: 10.5,
  },
  vinyl: {
    noise: 'pink',
    filter: 'highpass',
    frequency: 1400,
    gain: 0.11,
    period: 21,
  },
};

const recordings: Partial<Record<SoundLayer, string>> = Object.fromEntries(
  ['rain', 'fire', 'birds', 'ocean', 'night', 'pages'].map((id) => [
    id,
    `/assets/library-sounds/${id}.mp3`,
  ]),
);

/** Self-hosted free recordings blend into original procedural textures. */
export class LibrarySoundEngine {
  readonly context: AudioContext;
  readonly output: DynamicsCompressorNode;
  private master: GainNode;
  private room: ConvolverNode;
  private roomGain: GainNode;
  private channels = new Map<SoundLayer, GainNode>();
  private pans: { panner: StereoPannerNode; position: number }[] = [];
  private loops: AudioScheduledSourceNode[] = [];
  private voices = new Set<AudioScheduledSourceNode>();
  private buffers = new Map<string, AudioBuffer>();
  private sampleBuffers = new Map<SoundLayer, AudioBuffer>();
  private sampleGains = new Map<SoundLayer, number>();
  private attempted = new Set<SoundLayer>();
  private loading = new Set<SoundLayer>();
  private requests = new Set<AbortController>();
  private beds = new Map<SoundLayer, GainNode[]>();
  private mix: LibraryMix;
  private solo: SoundLayer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private deadlines = new Map<SoundLayer, number>();
  private running = false;
  private closed = false;
  private seed = 386891;

  constructor(
    mix: LibraryMix,
    context?: AudioContext,
    private onFallback?: () => void,
  ) {
    this.context = context ?? new AudioContext({ latencyHint: 'playback' });
    this.mix = safeMix(mix);
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.output = this.context.createDynamicsCompressor();
    this.output.threshold.value = -19;
    this.output.knee.value = 16;
    this.output.ratio.value = 5;
    this.output.attack.value = 0.012;
    this.output.release.value = 0.4;
    this.master.connect(this.output);
    this.output.connect(this.context.destination);
    // Short stereo room response: early reflections and a diffuse, quiet tail.
    this.room = this.context.createConvolver();
    this.room.normalize = false;
    const impulse = this.context.createBuffer(
      2,
      Math.round(this.context.sampleRate * 1.2),
      this.context.sampleRate,
    );
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i++)
        data[i] = (this.random() * 2 - 1) * (1 - i / data.length) ** 3 * 0.012;
      for (const [time, gain] of [
        [0.019, 0.24],
        [0.037, 0.17],
        [0.069, 0.11],
        [0.113, 0.07],
      ])
        data[Math.round((time + channel * 0.004) * this.context.sampleRate)] +=
          gain;
    }
    this.room.buffer = impulse;
    this.roomGain = this.context.createGain();
    this.roomGain.gain.value = this.mix.width * 0.16;
    const roomFilter = this.context.createBiquadFilter();
    roomFilter.type = 'lowpass';
    roomFilter.frequency.value = 3100;
    roomFilter.connect(this.room);
    this.room.connect(this.roomGain);
    this.roomGain.connect(this.master);
    for (const [id] of soundLayers) {
      const gain = this.context.createGain();
      gain.gain.value = 0;
      gain.connect(this.master);
      if (['pages', 'steps', 'clock', 'cafe', 'dream'].includes(id))
        gain.connect(roomFilter);
      this.channels.set(id, gain);
      this.deadlines.set(
        id,
        this.context.currentTime +
          (id === 'clock' ? 0.3 : 1 + this.random() * 4),
      );
      const recipe = continuous[id];
      if (recipe)
        for (const position of [-0.7, 0.7]) {
          const source = this.context.createBufferSource();
          source.buffer = this.noise(recipe.noise);
          source.loop = true;
          const filter = this.context.createBiquadFilter();
          filter.type = recipe.filter;
          filter.frequency.value = recipe.frequency;
          filter.Q.value = 0.5;
          const swell = this.context.createGain();
          swell.gain.value = recipe.gain;
          const lfo = this.context.createOscillator();
          lfo.frequency.value = 1 / (recipe.period + this.random() * 2);
          const depth = this.context.createGain();
          depth.gain.value = recipe.gain * (id === 'ocean' ? 0.7 : 0.18);
          lfo.connect(depth);
          depth.connect(swell.gain);
          const panner = this.context.createStereoPanner();
          panner.pan.value = position * this.mix.width;
          source.connect(filter);
          filter.connect(swell);
          swell.connect(panner);
          const bed = this.context.createGain();
          panner.connect(bed);
          bed.connect(gain);
          this.beds.set(id, [...(this.beds.get(id) ?? []), bed]);
          source.start(0, this.random() * 6);
          lfo.start();
          this.loops.push(source, lfo);
          this.pans.push({ panner, position });
        }
    }
    // Slow consonant tones, rather than a prerecorded music loop.
    for (const [i, frequency] of [
      130.813, 195.998, 261.626, 329.628,
    ].entries()) {
      const tone = this.context.createOscillator();
      tone.type = 'sine';
      tone.frequency.value = frequency;
      const gain = this.context.createGain();
      gain.gain.value = 0.025;
      const lfo = this.context.createOscillator();
      lfo.frequency.value = 0.035 + i * 0.009;
      const depth = this.context.createGain();
      depth.gain.value = 0.015;
      lfo.connect(depth);
      depth.connect(gain.gain);
      tone.connect(gain);
      gain.connect(this.channels.get('dream')!);
      tone.start();
      lfo.start();
      this.loops.push(tone, lfo);
    }
    this.update(mix);
  }

  private async loadRecording(id: SoundLayer) {
    const url = recordings[id];
    if (!url || this.attempted.has(id) || this.closed) return;
    this.attempted.add(id);
    this.loading.add(id);
    const request = new AbortController();
    this.requests.add(request);
    const timeout = setTimeout(() => request.abort(), 10000);
    try {
      const response = await fetch(url, { signal: request.signal });
      if (!response.ok) throw new Error('Recording unavailable');
      const data = await response.arrayBuffer();
      if (this.closed) return;
      const buffer = await this.context.decodeAudioData(data);
      if (this.closed) return;
      // Match the procedural bed before blending. LUFS normalization alone
      // varies with the spectrum of rain, fire and birdsong.
      const samples = buffer.getChannelData(0);
      let power = 0;
      for (let i = 0; i < samples.length; i++) power += samples[i] * samples[i];
      const recordingGain = Math.min(
        3,
        (id === 'pages' ? 0.12 : 0.16) /
          Math.max(0.001, Math.sqrt(power / samples.length)),
      );
      this.sampleGains.set(id, recordingGain);
      // Join loop ends without a click; the page recording is played once.
      if (id !== 'pages')
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const samples = buffer.getChannelData(channel),
            seam = Math.min(
              Math.round(buffer.sampleRate * 0.18),
              (samples.length / 4) | 0,
            );
          for (let i = 0; i < seam; i++) {
            const t = i / (seam - 1),
              j = samples.length - seam + i;
            samples[j] = samples[j] * (1 - t) + samples[seam - 1 - i] * t;
          }
        }
      this.sampleBuffers.set(id, buffer);
      if (id === 'pages') return;
      const now = this.context.currentTime;
      for (const position of [-0.7, 0.7]) {
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(recordingGain, now + 1.8);
        const pan = this.context.createStereoPanner();
        pan.pan.value = position * this.mix.width;
        source.connect(gain);
        gain.connect(pan);
        pan.connect(this.channels.get(id)!);
        source.start(
          now,
          this.random() * Math.max(0.01, buffer.duration - 0.2),
        );
        this.loops.push(source);
        this.pans.push({ panner: pan, position });
      }
      for (const bed of this.beds.get(id) ?? [])
        this.ramp(bed.gain, 0, now, 1.8);
    } catch {
      if (!this.closed) this.onFallback?.();
    } finally {
      clearTimeout(timeout);
      this.requests.delete(request);
      this.loading.delete(id);
    }
  }

  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private noise(kind: string) {
    const cached = this.buffers.get(kind);
    if (cached) return cached;
    const buffer = this.context.createBuffer(
      1,
      this.context.sampleRate * 8,
      this.context.sampleRate,
    );
    const data = buffer.getChannelData(0);
    let brown = 0,
      pink = 0;
    for (let i = 0; i < data.length; i++) {
      const white = this.random() * 2 - 1;
      brown = (brown + white * 0.035) * 0.995;
      pink = pink * 0.91 + white * 0.09;
      data[i] =
        kind === 'brown'
          ? Math.tanh(brown * 2)
          : kind === 'pink'
            ? pink * 2.2
            : white * 0.45;
    }
    // Match the loop boundary for the low frequency textures.
    const seam = Math.round(this.context.sampleRate * 0.12);
    for (let i = 0; i < seam; i++) {
      const t = i / (seam - 1);
      const j = data.length - seam + i;
      data[j] = data[j] * (1 - t) + data[Math.round((1 - t) * (seam - 1))] * t;
    }
    this.buffers.set(kind, buffer);
    return buffer;
  }

  update(mix: LibraryMix, solo: SoundLayer | null = this.solo) {
    if (this.closed) return;
    this.mix = safeMix(mix);
    this.solo = solo;
    const now = this.context.currentTime;
    const total = Object.values(this.mix.layers).reduce(
      (sum, value) => sum + value * value,
      0,
    );
    const normalization = 1 / Math.max(1, Math.sqrt(total));
    for (const [id, gain] of this.channels)
      this.ramp(
        gain.gain,
        (!solo || solo === id ? this.mix.layers[id] : 0) * normalization,
        now,
        0.2,
      );
    if (this.running)
      for (const [id] of soundLayers)
        if (this.mix.layers[id] > 0 && (!solo || solo === id))
          void this.loadRecording(id);
    for (const { panner, position } of this.pans)
      this.ramp(panner.pan, position * this.mix.width, now, 0.2);
    this.ramp(this.roomGain.gain, this.mix.width * 0.16, now, 0.2);
    this.ramp(
      this.master.gain,
      this.running ? this.mix.master * 0.4 : 0,
      now,
      0.3,
    );
  }
  private ramp(
    parameter: AudioParam,
    value: number,
    time: number,
    duration: number,
  ) {
    if (typeof parameter.cancelAndHoldAtTime === 'function')
      parameter.cancelAndHoldAtTime(time);
    else {
      const held = parameter.value;
      parameter.cancelScheduledValues(time);
      parameter.setValueAtTime(held, time);
    }
    parameter.linearRampToValueAtTime(value, time + duration);
  }
  async play() {
    if (this.closed) throw new Error('El ambiente de sonido ya está cerrado.');
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    this.suspendTimer = null;
    for (const id of this.attempted)
      if (!this.sampleBuffers.has(id) && !this.loading.has(id))
        this.attempted.delete(id);
    await this.context.resume();
    if (this.closed) return;
    this.running = true;
    this.update(this.mix);
    if (!this.timer) this.timer = setInterval(() => this.pump(), 400);
    this.pump();
  }
  pause(fade = 0.35) {
    if (this.closed) return;
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    this.ramp(this.master.gain, 0, this.context.currentTime, fade);
    this.suspendTimer = setTimeout(
      () => {
        this.suspendTimer = null;
        if (!this.running && !this.closed)
          void this.context.suspend().catch(() => {});
      },
      fade * 1000 + 50,
    );
  }
  /** Book gestures may add a subtle page sound only to an already enabled mix. */
  page() {
    if (
      this.running &&
      this.mix.layers.pages > 0.01 &&
      (!this.solo || this.solo === 'pages')
    )
      this.event('pages', this.context.currentTime + 0.03);
  }
  chime() {
    if (!this.running) return;
    for (const [i, hz] of [523.25, 659.25, 783.99].entries())
      this.tone(
        'dream',
        this.context.currentTime + i * 0.16,
        0.9,
        hz,
        hz,
        0.09,
        'sine',
        0,
        this.master,
      );
  }
  private pump() {
    if (!this.running || this.closed || this.context.state !== 'running')
      return;
    const now = this.context.currentTime;
    for (const [id] of soundLayers) {
      if (
        !this.mix.layers[id] ||
        (this.solo && this.solo !== id) ||
        !this.mix.master
      )
        continue;
      if (now + 0.1 < (this.deadlines.get(id) ?? 0)) continue;
      this.event(id, now + 0.08);
      const delays: Record<SoundLayer, [number, number]> = {
        rain: [0.4, 1.4],
        fire: [0.35, 1.1],
        wind: [6, 10],
        birds: [3.8, 9],
        pages: [7, 15],
        steps: [14, 23],
        clock: [1, 0],
        cafe: [6, 12],
        water: [0.35, 0.8],
        ocean: [6, 8],
        thunder: [22, 30],
        night: [1.2, 3],
        vinyl: [2, 6],
        dream: [14, 20],
      };
      const [base, spread] = delays[id];
      this.deadlines.set(id, now + base + this.random() * spread);
    }
  }
  private envelope(
    gain: AudioParam,
    time: number,
    duration: number,
    volume: number,
    attack = 0.015,
  ) {
    gain.setValueAtTime(0, time);
    gain.linearRampToValueAtTime(volume, time + Math.min(attack, duration / 3));
    gain.exponentialRampToValueAtTime(0.00001, time + duration);
    gain.setValueAtTime(0, time + duration + 0.01);
  }
  private track(
    source: AudioScheduledSourceNode,
    nodes: AudioNode[],
    at: number,
    duration: number,
  ) {
    this.voices.add(source);
    source.onended = () => {
      source.disconnect();
      nodes.forEach((node) => node.disconnect());
      this.voices.delete(source);
    };
    source.start(at);
    source.stop(at + duration + 0.04);
  }
  private hiss(
    id: SoundLayer,
    at: number,
    duration: number,
    frequency: number,
    volume: number,
    kind = 'white',
    filterType: BiquadFilterType = 'bandpass',
    attack = 0.015,
  ) {
    const source = this.context.createBufferSource();
    source.buffer = this.noise(kind);
    source.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;
    const gain = this.context.createGain();
    this.envelope(gain.gain, at, duration, volume, attack);
    const pan = this.context.createStereoPanner();
    pan.pan.value = (this.random() * 2 - 1) * this.mix.width * 0.65;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.channels.get(id)!);
    this.track(source, [filter, gain, pan], at, duration);
  }
  private tone(
    id: SoundLayer,
    at: number,
    duration: number,
    from: number,
    to: number,
    volume: number,
    shape: OscillatorType = 'sine',
    position = 0,
    destination?: AudioNode,
  ) {
    const source = this.context.createOscillator();
    source.type = shape;
    source.frequency.setValueAtTime(from, at);
    source.frequency.exponentialRampToValueAtTime(to, at + duration * 0.7);
    const gain = this.context.createGain();
    this.envelope(gain.gain, at, duration, volume);
    const pan = this.context.createStereoPanner();
    pan.pan.value = position * this.mix.width;
    source.connect(gain);
    gain.connect(pan);
    pan.connect(destination ?? this.channels.get(id)!);
    this.track(source, [gain, pan], at, duration);
  }
  private event(id: SoundLayer, at: number) {
    const recording = this.sampleBuffers.get(id);
    if (recording) {
      if (id === 'pages') {
        const source = this.context.createBufferSource();
        source.buffer = recording;
        const gain = this.context.createGain();
        this.envelope(
          gain.gain,
          at,
          recording.duration,
          0.8 * (this.sampleGains.get(id) ?? 1),
          0.04,
        );
        const pan = this.context.createStereoPanner();
        pan.pan.value = (this.random() - 0.5) * this.mix.width;
        source.connect(gain);
        gain.connect(pan);
        pan.connect(this.channels.get(id)!);
        this.track(source, [gain, pan], at, recording.duration);
      }
      return;
    }
    switch (id) {
      case 'rain':
        this.hiss(id, at, 0.055, 2800 + this.random() * 2500, 0.06);
        break;
      case 'fire':
        this.hiss(
          id,
          at,
          0.035 + this.random() * 0.08,
          1300 + this.random() * 1700,
          0.2,
        );
        this.tone(id, at, 0.18, 130, 65, 0.06);
        break;
      case 'wind':
        this.hiss(id, at, 4, 850, 0.12, 'brown', 'lowpass', 0.7);
        break;
      case 'birds': {
        const base = 1700 + this.random() * 1400,
          position = this.random() * 1.2 - 0.6;
        for (let i = 0; i < 3; i++)
          this.tone(
            id,
            at + i * 0.2,
            0.19,
            base + i * 120,
            base * (i % 2 ? 0.88 : 1.35),
            0.035,
            'sine',
            position,
          );
        break;
      }
      case 'pages':
        this.hiss(id, at, 0.5, 3200, 0.19, 'pink', 'highpass', 0.09);
        this.hiss(id, at + 0.18, 0.2, 4800, 0.08);
        break;
      case 'steps':
        for (let i = 0; i < 4; i++) {
          this.hiss(id, at + i * 0.62, 0.13, 160, 0.35, 'brown', 'lowpass');
          this.tone(
            id,
            at + i * 0.62,
            0.1,
            85,
            40,
            0.06,
            'sine',
            i % 2 ? 0.35 : -0.35,
          );
        }
        break;
      case 'clock':
        this.hiss(id, at, 0.022, 1500, 0.16);
        this.tone(id, at, 0.055, 1300, 900, 0.022);
        break;
      case 'cafe':
        this.tone(id, at, 0.3, 2100, 2070, 0.035, 'sine', -0.3);
        this.hiss(id, at + 0.08, 0.2, 3400, 0.035);
        break;
      case 'water':
        this.tone(
          id,
          at,
          0.08,
          650 + this.random() * 600,
          1600,
          0.045,
          'sine',
          this.random() - 0.5,
        );
        break;
      case 'ocean':
        this.hiss(id, at, 4.5, 3400, 0.14, 'pink', 'lowpass', 1.2);
        break;
      case 'thunder':
        this.hiss(id, at, 7, 155, 0.85, 'brown', 'lowpass', 0.8);
        this.hiss(id, at + 0.7, 5, 400, 0.22, 'brown', 'lowpass', 0.6);
        break;
      case 'night':
        for (let i = 0; i < 4; i++)
          this.tone(id, at + i * 0.12, 0.07, 3600, 3550, 0.019, 'sine', 0.45);
        break;
      case 'vinyl':
        this.hiss(id, at, 0.008, 3200, 0.1);
        break;
      case 'dream':
        this.tone(id, at, 7, 391.995, 392.1, 0.018, 'sine', -0.3);
        break;
    }
  }
  async dispose() {
    if (this.closed) return;
    this.closed = true;
    for (const request of this.requests) request.abort();
    this.requests.clear();
    this.sampleBuffers.clear();
    this.sampleGains.clear();
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    this.timer = null;
    this.suspendTimer = null;
    for (const source of [...this.loops, ...this.voices]) {
      try {
        source.stop();
      } catch {
        /* already ended */
      }
      source.disconnect();
    }
    this.loops = [];
    this.voices.clear();
    this.buffers.clear();
    this.master.disconnect();
    this.room.disconnect();
    this.roomGain.disconnect();
    this.output.disconnect();
    if (this.context.state !== 'closed')
      await this.context.close().catch(() => {});
  }
}
