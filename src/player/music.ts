/* ---------- background music: royalty-free, generated live (chill lo-fi tech, ~84 BPM) ----------
 * Ported verbatim from the reference Music module; only type annotations were added. */
type Ctx = AudioContext;

export const Music = (() => {
  let ctx: Ctx | null = null,
    master: GainNode,
    duck: GainNode,
    bus: GainNode,
    noise: AudioBuffer,
    timer: ReturnType<typeof setInterval> | null = null,
    next = 0,
    step = 0,
    bar = 0;
  const BPM = 84,
    S16 = 60 / BPM / 4,
    SWING = 0.14;
  const PROG = [
    [53, 57, 60, 64],
    [50, 53, 57, 60],
    [46, 50, 53, 57],
    [48, 52, 55, 59],
  ];
  const ARP = [0, 2, 1, 3, 2, 1, 3, 2],
    mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
  function impulse(c: Ctx, sec: number) {
    const n = c.sampleRate * sec,
      b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    }
    return b;
  }
  function build(c: Ctx) {
    ctx = c;
    master = c.createGain();
    master.gain.value = 0;
    duck = c.createGain();
    duck.gain.value = 1;
    bus = c.createGain();
    bus.gain.value = 1;
    const tone = c.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 6000;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    const rev = c.createConvolver();
    rev.buffer = impulse(c, 2.6);
    const wet = c.createGain();
    wet.gain.value = 0.32;
    bus.connect(tone);
    bus.connect(rev);
    rev.connect(wet);
    wet.connect(tone);
    tone.connect(comp);
    comp.connect(duck);
    duck.connect(master);
    master.connect(c.destination);
    const n = c.sampleRate * 1.5;
    noise = c.createBuffer(1, n, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  function env(
    g: GainNode,
    t: number,
    a: number,
    peak: number,
    dec: number,
    sus: number,
    rel: number,
    len: number,
  ) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sus, t + a, dec);
    g.gain.setTargetAtTime(0, t + len, rel);
  }
  function pad(notes: number[], t: number, len: number) {
    const c = ctx as Ctx;
    notes.forEach((m) => {
      [-7, 7].forEach((cents) => {
        const o = c.createOscillator(),
          f = c.createBiquadFilter(),
          g = c.createGain();
        o.type = "sawtooth";
        o.frequency.value = mtof(m);
        o.detune.value = cents;
        f.type = "lowpass";
        f.frequency.value = 750;
        f.Q.value = 0.4;
        env(g, t, 1.1, 0.022, 0.8, 0.8, 0.9, len);
        o.connect(f);
        f.connect(g);
        g.connect(bus);
        o.start(t);
        o.stop(t + len + 4);
      });
    });
  }
  function keys(m: number, t: number, v: number) {
    const x = ctx as Ctx;
    const c = x.createOscillator(),
      mod = x.createOscillator(),
      mg = x.createGain(),
      g = x.createGain(),
      p = x.createStereoPanner ? x.createStereoPanner() : null;
    c.type = "sine";
    c.frequency.value = mtof(m);
    mod.type = "sine";
    mod.frequency.value = mtof(m) * 2;
    mg.gain.setValueAtTime(mtof(m) * 1.6, t);
    mg.gain.setTargetAtTime(0, t, 0.18);
    mod.connect(mg);
    mg.connect(c.frequency);
    env(g, t, 0.006, 0.075 * v, 0.35, 0.0, 0.3, 0.9);
    c.connect(g);
    if (p) {
      p.pan.value = (Math.random() - 0.5) * 0.6;
      g.connect(p);
      p.connect(bus);
    } else g.connect(bus);
    c.start(t);
    mod.start(t);
    c.stop(t + 2.5);
    mod.stop(t + 2.5);
  }
  function bass(m: number, t: number, len: number) {
    const c = ctx as Ctx;
    const o = c.createOscillator(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    o.type = "triangle";
    o.frequency.value = mtof(m);
    f.type = "lowpass";
    f.frequency.value = 380;
    env(g, t, 0.02, 0.16, 0.4, 0.6, 0.12, len);
    o.connect(f);
    f.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + len + 1);
  }
  function kick(t: number, v: number) {
    const c = ctx as Ctx;
    const o = c.createOscillator(),
      g = c.createGain();
    o.frequency.setValueAtTime(115, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.42 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + 0.4);
  }
  function hiss(t: number, freq: number, type: BiquadFilterType, peak: number, len: number, q?: number) {
    const c = ctx as Ctx;
    const s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = noise;
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q || 0.7;
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    s.connect(f);
    f.connect(g);
    g.connect(bus);
    s.start(t, Math.random());
    s.stop(t + len + 0.05);
  }
  function schedule(i: number, t: number) {
    const ch = PROG[bar % 4],
      s = i % 16;
    if (s === 0) {
      pad(ch, t, S16 * 16);
      bass(ch[0] - 12, t, S16 * 5);
    }
    if (s === 10) bass(ch[0] - 12 + (bar % 2 ? 7 : 0), t, S16 * 4);
    if (s === 0 || s === 10) kick(t, 1);
    if (s === 7 && bar % 2) kick(t, 0.55);
    if (s === 4 || s === 12) hiss(t, 1900, "bandpass", 0.07, 0.16, 1.2);
    if (s % 2 === 0) hiss(t, 8200, "highpass", s % 4 === 2 ? 0.03 : 0.016, 0.05);
    if ([0, 3, 6, 8, 11, 14].includes(s)) {
      const k = ARP[(s + bar) % 8];
      keys(ch[k % 4] + 12 + (k > 3 ? 12 : 0), t, s === 0 ? 1 : 0.8);
    }
    if (bar % 4 === 3 && s === 14) keys(ch[3] + 24, t, 0.6);
  }
  function tick() {
    const c = ctx as Ctx;
    while (next < c.currentTime + 0.15) {
      const swing = step % 2 ? S16 * SWING : 0;
      schedule(step, next + swing);
      next += S16;
      step++;
      if (step % 16 === 0) bar++;
    }
  }
  return {
    start() {
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!ctx) build(new AC());
        const c = ctx as Ctx;
        c.resume();
        if (!timer) {
          next = c.currentTime + 0.08;
          timer = setInterval(tick, 25);
        }
        master.gain.cancelScheduledValues(c.currentTime);
        master.gain.setTargetAtTime(0.5, c.currentTime, 0.9);
      } catch (e) {}
    },
    stop() {
      if (!ctx) return;
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.35);
      setTimeout(() => {
        if (master.gain.value < 0.02 && timer) {
          clearInterval(timer);
          timer = null;
        }
      }, 1800);
    },
    duck(on: boolean) {
      if (ctx) duck.gain.setTargetAtTime(on ? 0.42 : 1, ctx.currentTime, 0.22);
    },
  };
})();
