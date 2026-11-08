// BGM を WAV（MP3=1 なら MP3 も）に書き出して試聴する。前奏＋ループ LOOPS 回＋余韻
//   node tools/test/chip-render.js title,boss <出力先のフォルダ>
//   SPEC=1 でスペクトログラムの画像も（ffmpeg）
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { SONGS, INST } from '../../js/songs.js';
import { ChipSynth, compileSong, TPQ } from '../../js/chip.js';

const names = !process.argv[2] || process.argv[2] === 'all' ? Object.keys(SONGS) : process.argv[2].split(',');
const out = process.argv[3] || '.';
const loops = +(process.env.LOOPS || 1);
const SR = 44100;
mkdirSync(out, { recursive: true });
for (const name of names) {
  const song = SONGS[name];
  const c = compileSong(song, INST).song;
  const ticks = c.loop + (c.T - c.loop) * loops;
  const sec = +(process.env.SEC || 0) || (ticks / TPQ) * 60 / song.bpm + 1.5;
  const n = Math.ceil(sec * SR);
  const syn = new ChipSynth(SR);
  syn.message({ song, lib: INST });
  if (process.env.TEMPO) syn.message({ tempo: +process.env.TEMPO });
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bl = new Float32Array(128);
  const br = new Float32Array(128);
  for (let i = 0; i < n; i += 128) {
    syn.render(bl, br, 128);
    L.set(bl.subarray(0, Math.min(128, n - i)), i);
    R.set(br.subarray(0, Math.min(128, n - i)), i);
  }
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) { sum += L[i] * L[i] + R[i] * R[i]; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  const rms = Math.sqrt(sum / (2 * n));
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4);
  }
  const wav = `${out}/${name}.wav`;
  writeFileSync(wav, buf);
  console.log(`${name.padEnd(9)} ${sec.toFixed(1).padStart(6)} 秒  RMS ${(20 * Math.log10(rms)).toFixed(1)} dB  ピーク ${(20 * Math.log10(peak)).toFixed(1)} dB`);
  if (process.env.MP3) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '160k', `${out}/${name}.mp3`]);
  if (process.env.SPEC) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-lavfi', 'showspectrumpic=s=1600x600:legend=0:scale=log:fscale=log', `${out}/${name}.png`]);
}
