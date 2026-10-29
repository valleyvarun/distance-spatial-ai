// Calm, breezy Japanese-style background music, made on the fly with the
// Web Audio API (no audio files): koto plucks on the bright "yo" pentatonic
// scale, a breathy bamboo flute, soft low notes, wind chimes and a breeze.
// The melody is chosen as it plays, so it never loops.
const Music = (() => {
  const BPM = 66;
  const EIGHTH = 60 / BPM / 2;
  const LEVEL = 1.8;             // overall loudness at 100% volume
  const ROOT = 146.83;           // D3
  const YO = [0, 2, 5, 7, 9];    // D E G A B — semitones above D
  const BARS = [0, 4, 2, 3];     // each bar's chord root, in scale steps: D, B, G, A
  const CHORD = [0, 2, 4, 5, 7]; // chord tones above the root, in scale steps
  const ARPS = [                  // koto patterns: an index into CHORD per eighth, null = rest
    [0, 2, 4, 2, 3, null, 1, null],
    [0, null, 2, 3, 4, 3, 2, null],
    [0, 1, 2, null, 4, null, 3, 1],
    [4, 3, 2, null, 0, null, 2, null],
  ];

  let ac, master, bus, noise;
  const koto = [];
  let volume = 0.6, playing = false, timer = null, nextTime = 0, step = 0, arp = ARPS[0];

  // Frequency of a scale step (0 = D3, 5 = D4, negative goes lower)
  const freq = s => ROOT * 2 ** ((12 * Math.floor(s / 5) + YO[((s % 5) + 5) % 5]) / 12);
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---- Instruments -------------------------------------------------------

  // Karplus–Strong plucked string: a burst of noise circulating through a
  // short delay line that slowly smooths it out. The loop's pitch is a
  // little off from the target, so playback rate corrects it.
  function pluckBuffer(f, seconds) {
    const sr = ac.sampleRate, n = Math.floor(sr * seconds);
    const period = Math.max(2, Math.floor(sr / f - 0.5));
    const buffer = ac.createBuffer(1, n, sr), out = buffer.getChannelData(0);
    const ring = new Float32Array(period);
    let soft = 0;
    for (let i = 0; i < period; i++) ring[i] = soft = 0.5 * soft + 0.5 * (Math.random() * 2 - 1);
    for (let i = 0, j = 0; i < n; i++) {
      const k = (j + 1) % period;
      out[i] = ring[j];
      ring[j] = 0.4985 * (ring[j] + ring[k]);
      j = k;
    }
    const fade = Math.floor(sr * 0.3);
    for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
    return { buffer, rate: f / (sr / (period + 0.5)) };
  }

  function playKoto(s, time, velocity) {
    const { buffer, rate } = koto[s];
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const gain = ac.createGain();
    gain.gain.value = 0.3 * velocity;
    const pan = ac.createStereoPanner();
    pan.pan.value = rand(-0.3, 0.3);
    src.connect(gain).connect(pan).connect(bus);
    src.start(time);
  }

  function playBass(s, time, dur) {
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq(s);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.14, time + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(lp).connect(gain).connect(bus);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  // A quiet sustained chord that swells in and out under each bar
  function playPad(root, time, dur) {
    for (const s of [root, root + 2, root + 4]) {
      const osc = ac.createOscillator();
      osc.frequency.value = freq(s);
      osc.detune.value = rand(-4, 4);
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.022, time + dur * 0.4);
      gain.gain.linearRampToValueAtTime(0, time + dur * 1.15);
      osc.connect(gain).connect(bus);
      osc.start(time);
      osc.stop(time + dur * 1.2);
    }
  }

  // Bamboo flute: slides up into the note, vibrato grows as it's held,
  // and a puff of breath noise at the start
  function playFlute(f, time, dur) {
    const end = time + dur + 0.8;
    const osc = ac.createOscillator();
    osc.frequency.setValueAtTime(f * 0.97, time);
    osc.frequency.exponentialRampToValueAtTime(f, time + 0.18);
    const vibrato = ac.createOscillator();
    vibrato.frequency.value = 4.8;
    const depth = ac.createGain();
    depth.gain.setValueAtTime(0, time);
    depth.gain.linearRampToValueAtTime(f * 0.008, time + dur * 0.7);
    vibrato.connect(depth).connect(osc.frequency);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.08, time + 0.3);
    gain.gain.setValueAtTime(0.08, time + dur);
    gain.gain.linearRampToValueAtTime(0, end - 0.1);
    osc.connect(gain).connect(bus);

    const breath = ac.createBufferSource();
    breath.buffer = noise;
    breath.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 2;
    bp.Q.value = 3;
    const breathGain = ac.createGain();
    breathGain.gain.setValueAtTime(0, time);
    breathGain.gain.linearRampToValueAtTime(0.05, time + 0.1);
    breathGain.gain.linearRampToValueAtTime(0.012, time + 0.5);
    breathGain.gain.linearRampToValueAtTime(0, end - 0.1);
    breath.connect(bp).connect(breathGain).connect(bus);

    for (const node of [osc, vibrato]) { node.start(time); node.stop(end); }
    breath.start(time, rand(0, 1));
    breath.stop(end);
  }

  // A short, wandering flute phrase high above the koto
  function flutePhrase(time) {
    let s = Math.floor(rand(8, 14)), t = time;
    for (let i = Math.floor(rand(2, 5)); i > 0; i--) {
      const dur = EIGHTH * Math.floor(rand(2, 5));
      playFlute(freq(s), t, dur);
      t += dur + (Math.random() < 0.5 ? 0 : EIGHTH);
      s = Math.max(7, Math.min(13, s + [-2, -1, 1, 2][Math.floor(rand(0, 4))]));
    }
  }

  // Furin wind chimes: a few glassy pings with a bell-like overtone
  function chimes(time) {
    for (let i = Math.floor(rand(1, 4)); i > 0; i--, time += rand(0.15, 0.4)) {
      const f = freq(Math.floor(rand(10, 16))) * 2;
      const pan = ac.createStereoPanner();
      pan.pan.value = rand(-0.6, 0.6);
      pan.connect(bus);
      for (const [mult, amp] of [[1, 0.022], [2.76, 0.007]]) {
        const osc = ac.createOscillator();
        osc.frequency.value = f * mult;
        const gain = ac.createGain();
        gain.gain.setValueAtTime(amp, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 2.5);
        osc.connect(gain).connect(pan);
        osc.start(time);
        osc.stop(time + 2.6);
      }
    }
  }

  // Wind: filtered noise whose tone and loudness drift slowly
  function startBreeze() {
    const src = ac.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 0.6;
    const gain = ac.createGain();
    gain.gain.value = 0.035;
    for (const [rate, depth, param] of [[0.07, 450, bp.frequency], [0.11, 0.025, gain.gain]]) {
      const lfo = ac.createOscillator();
      lfo.frequency.value = rate;
      const amount = ac.createGain();
      amount.gain.value = depth;
      lfo.connect(amount).connect(param);
      lfo.start();
    }
    src.connect(bp).connect(gain).connect(master);
    src.start();
  }

  // ---- Sequencer --------------------------------------------------------

  function playStep(s, time) {
    const beat = s % 8, bar = Math.floor(s / 8);
    const root = BARS[bar % BARS.length];
    if (beat === 0) {
      arp = ARPS[Math.floor(rand(0, ARPS.length))];
      playBass(root - 5, time, EIGHTH * 8);
      playPad(root, time, EIGHTH * 8);
      if (bar % 2 === 1 && Math.random() < 0.7) flutePhrase(time + EIGHTH * 2);
    }
    const tone = arp[beat];
    if (tone !== null && Math.random() < 0.88) {
      playKoto(root + 5 + CHORD[tone], time + rand(-0.01, 0.01), rand(0.6, 1));
    }
    if (Math.random() < 0.04) chimes(time + rand(0, EIGHTH));
  }

  // Schedule a little ahead of the audio clock so timing stays steady
  function tick() {
    while (nextTime < ac.currentTime + 0.3) {
      playStep(step++, nextTime);
      nextTime += EIGHTH;
    }
  }

  // ---- Setup ------------------------------------------------------------

  function reverbImpulse(seconds) {
    const sr = ac.sampleRate, n = Math.floor(sr * seconds);
    const buffer = ac.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buffer.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
    }
    return buffer;
  }

  function init() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const limiter = ac.createDynamicsCompressor();
    limiter.connect(ac.destination);
    master = ac.createGain();
    master.gain.value = 0;
    master.connect(limiter);

    // Everything melodic goes through a soft, spacious reverb
    bus = ac.createGain();
    bus.connect(master);
    const reverb = ac.createConvolver();
    reverb.buffer = reverbImpulse(3.5);
    const wet = ac.createGain();
    wet.gain.value = 0.45;
    bus.connect(reverb).connect(wet).connect(master);

    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    for (let s = 5; s <= 16; s++) koto[s] = pluckBuffer(freq(s), 3.5);
    startBreeze();
  }

  // Browsers only allow sound after a click, so this is called from the button
  function start() {
    if (!ac) init();
    ac.resume();
    playing = true;
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setTargetAtTime(volume * LEVEL, ac.currentTime, 0.6);
    if (!timer) {
      nextTime = ac.currentTime + 0.1;
      timer = setInterval(tick, 60);
    }
  }

  function stop() {
    if (!ac) return;
    playing = false;
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setTargetAtTime(0, ac.currentTime, 0.25);
    setTimeout(() => {
      if (playing) return;
      clearInterval(timer);
      timer = null;
      ac.suspend();
    }, 1200);
  }

  function setVolume(v) {
    volume = v;
    if (playing) master.gain.setTargetAtTime(volume * LEVEL, ac.currentTime, 0.1);
  }

  return { start, stop, setVolume };
})();
