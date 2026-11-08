// BGM の楽譜を確かめる：小節の長さ・チャンネルの長さ・ループの位置のずれ、曲の長さ、
// 旋律の長い音が和音とぶつかっていないか（和音の音でなく、和音の音の半音上にある音）
//   node tools/test/chip-check.js [title,boss]
import { SONGS, INST, parseChord, chordNames } from '../../js/songs.js';
import { compileSong, TPQ } from '../../js/chip.js';

const only = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : null;
const NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
let bad = 0;
for (const [name, song] of Object.entries(SONGS)) {
  if (only && !only.includes(name)) continue;
  const bar = (song.meter || 4) * TPQ;
  let r;
  try { r = compileSong({ ...song, name }, INST); } catch (e) { console.log(`✗ ${name}: ${e.message}`); bad++; continue; }
  const { song: c, warnings } = r;
  const sec = (t) => (t / TPQ) * 60 / song.bpm;
  console.log(`${warnings.length ? '✗' : '✓'} ${name.padEnd(9)} ${String(song.bpm).padStart(3)} BPM  前奏 ${(c.loop / bar).toFixed(0).padStart(2)} 小節 ${sec(c.loop).toFixed(1).padStart(5)} 秒  ループ ${((c.T - c.loop) / bar).toFixed(0).padStart(3)} 小節 ${sec(c.T - c.loop).toFixed(1).padStart(6)} 秒`);
  for (const w of warnings) console.log(`    ${w}`);
  bad += warnings.length;
  if (!song.chords || !song.melody) continue;
  const chords = chordNames(song.chords);
  if (chords.length * bar !== c.T) console.log(`    和音の小節数 ${chords.length} が曲の長さ ${c.T / bar} と合わない`);
  for (const id of [].concat(song.melody)) {
    const ch = song.ch.find((x) => x.id === id);
    const ev = compileSong({ ...song, ch: [ch] }, INST).song.ch[0].ev;
    for (const e of ev) {
      const dur = e.g - e.t;
      if (!(dur >= TPQ * 0.8 && e.t % TPQ === 0) && !(dur >= TPQ * 1.4)) continue;
      const b = Math.floor(e.t / bar);
      const cs = chords[b];
      if (!cs) continue;
      const cn = cs[Math.min(cs.length - 1, Math.floor(((e.t % bar) / bar) * cs.length))];
      const cd = parseChord(cn);
      const pcs = new Set(cd.iv.map((x) => (cd.root + x) % 12));
      const pc = e.n % 12;
      if (pcs.has(pc)) continue;
      const dom = cd.iv.includes(4) && cd.iv.includes(10);
      const rel = (pc - cd.root + 12) % 12;
      if (dom && (rel === 1 || rel === 3 || rel === 8)) continue;
      if (pcs.has((pc + 11) % 12)) {
        const beat = (e.t % bar) / TPQ + 1;
        console.log(`    ${id} 小節 ${b + 1} ${beat} 拍目：${NN[pc]}${Math.floor(e.n / 12) - 1} が ${cn} とぶつかる（${(dur / TPQ).toFixed(2)} 拍）`);
      }
    }
  }
}
process.exit(bad ? 1 : 0);
