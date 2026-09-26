// =====================================================================
//  そうさ：どこでも タッチで でてくる バーチャルスティック ＋ キーボード
// =====================================================================
const MAX_R = 56;

export class Input {
  constructor(el, joyEl, knobEl) {
    this.el = el;
    this.joy = joyEl;
    this.knob = knobEl;
    this.vec = { x: 0, y: 0 };
    this.touchId = null;
    this.ox = 0;
    this.oy = 0;
    this.keys = new Set();
    this.enabled = false;

    const opt = { passive: false };
    el.addEventListener('touchstart', (e) => this.onStart(e), opt);
    el.addEventListener('touchmove', (e) => this.onMove(e), opt);
    el.addEventListener('touchend', (e) => this.onEnd(e), opt);
    el.addEventListener('touchcancel', (e) => this.onEnd(e), opt);
    // マウス（PCで テストするとき）
    el.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.mouse = true;
      this.begin(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => { if (this.mouse) this.move(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { if (this.mouse) { this.mouse = false; this.end(); } });

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.reset(); });
  }

  onStart(e) {
    e.preventDefault();
    if (!this.enabled || this.touchId !== null) return;
    const t = e.changedTouches[0];
    this.touchId = t.identifier;
    this.begin(t.clientX, t.clientY);
  }
  onMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === this.touchId) this.move(t.clientX, t.clientY);
  }
  onEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === this.touchId) { this.touchId = null; this.end(); }
  }

  begin(x, y) {
    this.ox = x;
    this.oy = y;
    this.active = true;
    this.joy.style.transform = `translate(${x}px, ${y}px)`;
    this.joy.classList.add('show');
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.vec.x = this.vec.y = 0;
  }
  move(x, y) {
    if (!this.active) return;
    let dx = x - this.ox, dy = y - this.oy;
    const d = Math.hypot(dx, dy);
    if (d > MAX_R) {
      // スティックを ひっぱると 中心も ついてくる
      const over = d - MAX_R;
      this.ox += (dx / d) * over;
      this.oy += (dy / d) * over;
      dx = x - this.ox;
      dy = y - this.oy;
      this.joy.style.transform = `translate(${this.ox}px, ${this.oy}px)`;
    }
    const m = Math.min(1, Math.hypot(dx, dy) / (MAX_R * 0.6));
    const l = Math.hypot(dx, dy) || 1;
    this.vec.x = (dx / l) * m;
    this.vec.y = (dy / l) * m;
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
  end() {
    this.active = false;
    this.vec.x = this.vec.y = 0;
    this.joy.classList.remove('show');
  }

  reset() {
    this.touchId = null;
    this.mouse = false;
    this.end();
  }

  read() {
    let kx = 0, ky = 0;
    const k = this.keys;
    if (k.has('ArrowLeft') || k.has('KeyA')) kx -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) kx += 1;
    if (k.has('ArrowUp') || k.has('KeyW')) ky -= 1;
    if (k.has('ArrowDown') || k.has('KeyS')) ky += 1;
    if (kx || ky) {
      const l = Math.hypot(kx, ky);
      return { x: kx / l, y: ky / l };
    }
    return this.vec;
  }
}
