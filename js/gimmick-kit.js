// =====================================================================
//  ステージギミックの共通の道具（hazards.js と、章ごとのギミック hazards2〜4.js が使う）
// =====================================================================
import { TAU } from './util.js';

// 地形を置く単位（この大きさの区画ごとに、座標から決まる乱数で置く）
export const CHUNK = 360;

// 座標から決まる乱数（同じ場所には毎回同じ地形）
export function hashRng(cx, cy, salt) {
  let h = (cx * 374761393 + cy * 668265263 + salt * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

// 点 (px, py) が、(x, y) から角度 a へ長さ len・幅 w の帯の中にあるか（r は点の半径）
export function inBeam(px, py, x, y, a, len, w, r = 0) {
  const ax = Math.cos(a), ay = Math.sin(a);
  const t = (px - x) * ax + (py - y) * ay;
  if (t < -r || t > len + r) return false;
  const nx = px - (x + ax * t), ny = py - (y + ay * t);
  return nx * nx + ny * ny < (w / 2 + r) ** 2;
}

// 帯の予告（予告の間は細い線が太くなっていく）。s：{ x, y, a, len, w, t, T, color }
export function drawBeamWarn(ctx, s) {
  const k = Math.min(1, s.t / s.T);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.a);
  ctx.globalAlpha = 0.18 + 0.3 * k;
  ctx.fillStyle = s.color;
  ctx.fillRect(0, (-s.w / 2) * k, s.len, s.w * k);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(0, -s.w / 2, s.len, s.w);
  ctx.setLineDash([]);
  ctx.restore();
}

// 予告の円（地面に描く。k は 0〜1 の進み具合）
export function drawCircleWarn(ctx, x, y, r, k, color) {
  ctx.globalAlpha = 0.2 + 0.3 * k;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r * k, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// 雑魚（ボス・置物・胴体を除く）を順に返す
export function* minions(g) {
  for (const e of g.enemies) if (e.alive && !e.boss && !e.prop && !e.segment) yield e;
}

// 画面の端（自機を中心に半径 R の円の上）の点
export function rimPoint(g, a, R = g.viewR + 60) {
  return { x: g.player.x + Math.cos(a) * R, y: g.player.y + Math.sin(a) * R };
}
