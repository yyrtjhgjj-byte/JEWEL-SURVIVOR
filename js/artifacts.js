// =====================================================================
//  秘宝（ARTIFACT）
//  ヴァンサバのアルカナにあたる、ラン全体の性質を変える宝石の道具。
//  開始時に 1 つ、6:00 以降の中ボス撃破で 1 つ選べる（選ばないことも可）。
//  解放は実績（ach）の達成で行う。
// =====================================================================
import { save } from './save.js';

export const ARTIFACTS = [
  { id: 'lodestone', no: 'I', name: 'ロードストーン', en: 'LODESTONE', gem: 'granite', ach: 'coll5',
    desc: '偶数分ごとに、画面中のアイテム・経験値・原石をすべて足元へ引き寄せる' },
  { id: 'pendant', no: 'II', name: '護石のペンダント', en: 'GUARDIAN PENDANT', gem: 'turquoise', ach: 'clear2',
    desc: '復活 +3。復活するたびに 最大HP +10%、アーマー +1、攻撃力・攻撃範囲・弾速・持続 +5%' },
  { id: 'grail', no: 'III', name: '癒しの聖杯', en: 'HOLY GRAIL', gem: 'angelite', ach: 'heal300',
    desc: 'あらゆる回復量が 2 倍。回復すると、回復量に応じた衝撃波を周囲に放つ' },
  { id: 'box', no: 'IV', name: '空の宝石箱', en: 'EMPTY CASKET', gem: 'amber', ach: 'solo',
    desc: '空いている武器枠 1 つにつき 攻撃力 +20%、クールダウン短縮 8%。さらに復活 +3' },
  { id: 'wheel', no: 'V', name: '研磨ホイール', en: 'GRINDING WHEEL', gem: 'diamond', ach: 'runner',
    desc: '移動している間、すべての武器の動作が 1.5 倍速になる' },
  { id: 'loupe', no: 'VI', name: '氷晶のルーペ', en: 'FROST LOUPE', gem: 'aquamarine', ach: 'clear4',
    desc: 'すべての攻撃が、命中時に 8% の確率で敵を凍結させる（ボスを除く）' },
  { id: 'scale', no: 'VII', name: '黄金の天秤', en: 'GOLDEN SCALE', gem: 'titanite', ach: 'coin500',
    desc: 'コインを拾うとゴールドフィーバーが起きることがある。フィーバー中は敵がコインを落とし、コインを拾うと HP が回復する' },
  { id: 'crown', no: 'VIII', name: '職人の王冠', en: 'ARTISAN CROWN', gem: 'ruby', ach: 'awaken3',
    desc: '初期武器の弾数 +3' },
  { id: 'hope', no: 'IX', name: '呪われた宝石', en: 'HOPE DIAMOND', gem: 'sapphire', ach: 'clear3',
    desc: '1 分ごとにエリートが追加で出現する。エリートは撃破で宝箱を落とす' },
  { id: 'musicbox', no: 'X', name: '流星のオルゴール', en: 'STARFALL MUSIC BOX', gem: 'opal', ach: 'lv50',
    desc: 'レベルアップのたびに、回復・磁石・時計・爆弾などのアイテムが空から降ってくる' },
  { id: 'prism', no: 'XI', name: '分光プリズム', en: 'SPECTRAL PRISM', gem: 'labradorite', ach: 'evo3',
    desc: '攻撃範囲が 10 秒周期で −50% 〜 +200% の間を波のように変動する' },
];
export const ARTIFACT_BY_ID = Object.fromEntries(ARTIFACTS.map((a) => [a.id, a]));
export const ARTIFACT_MAX = 3; // 1 ランで持てる数

export function artifactUnlocked(id) {
  const a = ARTIFACT_BY_ID[id];
  return !!(a && save.achievements[a.ach]);
}
export function unlockedArtifacts() {
  return ARTIFACTS.filter((a) => save.achievements[a.ach]).map((a) => a.id);
}
