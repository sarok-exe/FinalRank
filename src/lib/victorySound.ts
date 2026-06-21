const WAVES: OscillatorType[] = ['sine', 'triangle', 'square', 'sawtooth'];

function playNote(
  ctx: AudioContext, freq: number, wave: OscillatorType,
  start: number, dur: number, vol: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.value = freq;
  const a = 0.008;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + a);
  gain.gain.linearRampToValueAtTime(vol * 0.35, start + dur * 0.45);
  gain.gain.linearRampToValueAtTime(0, start + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur);
}

let audioCtx: AudioContext | null = null;

function getCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function playVictorySound(volume: number = 0.4) {
  try {
    const ctx = getCtx();
    const idx = 16;
    const baseFreq = 262 + idx * 5;
    const wave = WAVES[idx % 4];
    const oct = Math.floor(idx / 9);
    const noteCount = 1 + (idx % 7);
    const step = 3 + (idx % 5);
    const noteDur = Math.max(0.08, 0.3 - idx * 0.005);
    const gap = noteDur * 0.55;
    const isChord = idx % 4 === 3;

    const v = Math.max(0, Math.min(1, volume));

    if (isChord) {
      for (let n = 0; n < noteCount; n++) {
        const f = baseFreq * Math.pow(2, (n * step) / 12) * Math.pow(2, oct);
        playNote(ctx, f, wave, 0, noteDur * 2, v / noteCount);
      }
    } else {
      for (let n = 0; n < noteCount; n++) {
        const t = n * (noteDur + gap);
        const f = baseFreq * Math.pow(2, (n * step) / 12) * Math.pow(2, oct);
        playNote(ctx, f, n % 4 === 0 ? wave : 'sine', t, noteDur, v * (1 - n * 0.08));
      }
    }
  } catch {}
}
