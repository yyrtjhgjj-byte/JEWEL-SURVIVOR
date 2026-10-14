# 宝石の鑑賞画面（宝石ラボの組み込み）— 次の担当への伝言

ユーザーは、以前に作った「宝石ラボ」を見ながら宝石を眺める画面を、ゲームにも入れたいと考えている。ラボでは、スライダーで見た目を変えたり、ドラッグで向きを変えたりできる。この資料には、ラボの作りと組み込みの道筋を書く。組み込みが終わったら、今の仕様を CLAUDE.md に書き、この資料は消す。

## 1. 宝石ラボとは

- 公開ページ：`https://claude.ai/artifact/HaZKgsc58wFPr7V9rKfX99`（Artifact ツールの read で中身を読める。見本の画像を data URL で埋め込んでいるので 550KB ほどある）
- 画面の中身
  - 上：大きな宝石を 1 つ、その場で光線追跡して描く。ドラッグで向きを変えられる。
  - 右（スマホでは下）：名前・カット・屈折率などの表と、ボタン「ゆらす」「今の絵と比べる」、スライダー「明るさ」「ファイア」「きらめき」。
  - 下：透明な石・不透明な石・原石の見本の一覧。押すと上の宝石が切り替わる。
- ラボのシェーダー・カットの形・照明は、すでに js/gem-gl.js に移してある。移すときに縁の α を直し、そのあとゲーム側だけでオパールの遊色とラブラドライトのひらめき（layerFlash）を作り直したので、**描画はラボではなく gem-gl.js を正とする**。ラボから持ってくるのは、操作（ドラッグ・スライダー・ゆらす）と画質の自動調整だけ。
- 「今の絵と比べる」は、古い 2D のアイコンと比べるためのもので、もう要らない。見本の一覧は、ゲームでは図鑑やコレクションが同じ役目をしている。

## 2. ラボの操作の作り

状態は 1 つのオブジェクトにまとめている。

```js
const state = { id: 'diamond', rock: true, exp: 1.2, fire: 1.6, glint: 0.6, tilt: 12, spin: 0, drag: null, t0: performance.now(), scale: 1, ss: 1 };
```

**ドラッグで向きを変える**（canvas に pointer events を付ける）

```js
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); state.drag = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointermove', (e) => {
  if (!state.drag) return;
  state.spin += (e.clientX - state.drag.x) * 0.45;
  state.tilt = Math.max(-35, Math.min(65, state.tilt + (e.clientY - state.drag.y) * 0.35));
  state.drag = { x: e.clientX, y: e.clientY }; dirty = true;
});
const end = () => { state.drag = null; state.t0 = performance.now(); dirty = true; };
canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
```

- 横に動かすと縦の軸のまわりに回る（spin、1px で 0.45°、上限なし）。縦に動かすと手前へ傾く（tilt、1px で 0.35°、−35〜65°）。
- ドラッグの間はゆらしを止める。離したら `t0` を今にして、ゆらしを 0 から始め直す（ずれがいきなり飛ばないように）。
- iPhone では canvas に `touch-action: none` を付けないと、ドラッグで画面がスクロールしてしまう。

**ゆらす**：gem-gl.js の tick と同じ揺れ方。`rockT = 10 * sin(0.9t)`、`rockS = 14 * cos(0.6t)`（度。t は `t0` からの秒）。ボタンで ON／OFF する。

**向きの基準**：ラボでは、透明な石と facet の石は `state.tilt`、カボションと丸い石は `state.tilt + 6`。spin は `spin0`（なければ PORTRAIT のカットは 90、それ以外は 0）＋ 9 ＋ `state.spin`。gem-gl.js は傾きを 12°／18° に固定していて、+9 も付けていない。どちらに合わせるかは、見比べて決めてよい。

**スライダー**（値は石を選ぶたびに、その石の `GEM_LOOK` の値に戻す）

| 名前 | 範囲・刻み | 初期値 | シェーダーへの渡し方 |
|---|---|---|---|
| 明るさ | 0.5〜2.2・0.05 | 石の `exp`、なければ 1.2 | `uExp`。透明な石はそのまま、それ以外は ÷1.2 |
| ファイア | 0〜4・0.1 | 石の `fire`、なければ 1.6 | 透明な石だけ（ほかは disabled）。毎回の描画で `d = disp × fire` から `uIor = (ior − d·0.42, ior, ior + d·0.58)` を送り直す |
| きらめき | 0〜1.5・0.05 | 0.6（gem-gl.js の `GLINT`） | 仕上げのシェーダーの `uBloom = glint ×（カットした石 1、丸い石 0.5）`、`uStar = カットした石なら glint、丸い石は 0` |

- 写る大きさ `uSpan` は、ラボは 1.32、gem-gl.js は `SPAN` = 1.36（小さいほど大きく写る）。

**描き直しと画質の自動調整**

- 描くのは「ゆらしが ON」「ドラッグ中」「値が変わった（dirty）」のどれかのときだけ。止まっているあいだは描かない（電池のため）。
- 1 フレームが 48ms を超えることが 6 回続いたら、まず 4 点の超標本化（`ss` 2）を 1 に下げ、それでも重ければ解像度 `scale` を 0.15 ずつ下げる（下限 0.45）。22ms を切ることが 40 回続いたら、解像度を戻し、そのあと `ss` を 2 にする。gem-gl.js の tick にも同じ仕組みがある（目安の値が違う）。
- WebGL2 が使えないときは、書き出した画像（gemIcon）を代わりに出す。

## 3. ゲームに組み込むときの道筋（案）

1. **描画の関数に値を渡せるようにする**：gem-gl.js の createRenderer が返す `draw(W, rockT, rockS, ss)` に、向き・明るさ・ファイア・きらめきを渡す引数を足す（例：最後に `o = { tilt, spin, exp, fire, glint }`。省いたら今と同じ）。ファイアは今は `load` で `uIor` を決めているので、`o.fire` があるときだけ draw で送り直す。今の呼び出し（mountLiveGem の tick・bakeGem）の見た目は変えない（書き出した画像と合わなくなるため）。
2. **WebGL は 1 つを使い回す**：CLAUDE.md §5 の重さ対策のとおり、キャンバスと WebGL はアプリで 1 つだけにする（iOS は作り捨てたものも数えるので、2 つ目を作ると落ちやすくなる）。鑑賞画面のために新しく作らず、mountLiveGem の `live`（canvas と renderer）を借りる。たとえば `live.ctl`（操作の状態）を持たせて tick がそれを draw に渡し、画面を閉じたら外す。
3. **mountLiveGem は 1 度に 1 つの img にしか付かない**：別の img に付けると、前の img は画像に戻る。そのため、宝石の詳細の上に鑑賞画面を重ねると、下の宝石は画像になる。閉じたら下の宝石にもう一度 mountLiveGem する。tick は img が DOM から外れると止まるので、鑑賞画面の中に img を置いて mountLiveGem すれば、今の仕組みにそのまま乗る。
4. **pointer events と `touch-action: none` は鑑賞画面のあいだだけ付ける**：live.canvas は付け先の img の className と style を写して使い回すので、外すのを忘れると、ほかの画面の宝石でもドラッグが効いてしまう。
5. **止まっているときは描かない**：今の tick はゆらし続ける前提で、毎フレーム描いている。ゆらしが OFF でドラッグもしていないなら、描くのを飛ばす。
6. **置き場所はユーザーと決める**：候補は、研磨コレクションの宝石の詳細（atelier-ui.js の `.gd-top`。持っている宝石はもう mountLiveGem している）、図鑑の武器・チャーム、経営の宝物庫の名石。スライダーの値を保存するか（宝石ごとに覚えるか）もユーザーに聞く。
7. **文言**：ラボの説明文（「上の大きな宝石は、いまこの画面で光を計算して…」）やスペックの表の飾りは持ってこない。画面に出すのは、操作に要る最小限（スライダーの名前など）だけにする（CLAUDE.md §2）。
8. 組み込んだら、遊び方（howto.js）にも書き、sw.js の版数を上げ、iPhone 13 相当のスクリーンショットで目視して確認する。
