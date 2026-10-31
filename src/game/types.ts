export interface Vec2 {
  x: number;
  y: number;
}

export interface Entity {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  hp: number;
  maxHp: number;
  dead: boolean;
}

export interface Player extends Entity {
  speed: number;
  fireRate: number;
  projectiles: number;
  damage: number;
  color: string;
  targetRange: number;
  projectileSpeed: number;
  mana: number;
  maxMana: number;
  chaosOrbs: number;
  exaltedOrbs: number;
  chainLightningLevel: number;
  splitShotLevel: number;
  spiritFireLevel: number;
  lmpLevel: number;
  enhanceLevel: number;
}

export type GemKind = 'support' | 'skill';

export interface GemDef {
  kind: GemKind;
  name: string;
  maxLevel: number;
  color: string;
  description: string;
}

export const GEM_DEFS: Record<string, GemDef> = {
  lmp:           { kind: 'support', name: '多重投射支援', maxLevel: 3, color: '#22d3ee', description: '增加投射物數量、傷害與速度' },
  enhance:       { kind: 'support', name: '增幅支援',     maxLevel: 3, color: '#a78bfa', description: '提升攻擊/施法速度' },
  chainLightning:{ kind: 'skill',   name: '連鎖閃電',     maxLevel: 3, color: '#67e8f9', description: '命中後彈射至附近敵人' },
  splitShot:     { kind: 'skill',   name: '分裂箭',       maxLevel: 3, color: '#84cc16', description: '額外投射物與傷害' },
  spiritFire:   { kind: 'skill',   name: '冥界之火',     maxLevel: 3, color: '#a855f7', description: '每 5 秒召喚環繞火焰' },
  burningArrow:  { kind: 'skill',   name: '燃燒箭矢',     maxLevel: 1, color: '#f97316', description: '25% 機率點燃敵人，持續 4 秒' },
  causticArrow:  { kind: 'skill',   name: '腐蝕箭矢',     maxLevel: 1, color: '#84cc16', description: '在命中點留下 2 秒毒霧地面' },
  iceShot:       { kind: 'skill',   name: '冰霜射擊',     maxLevel: 1, color: '#38bdf8', description: '命中後向後方爆發冰霜扇形並冰緩' },
  addedFire:     { kind: 'support', name: '附加火焰傷害', maxLevel: 3, color: '#f97316', description: '被輔助技能獲得 30% 額外火焰傷害' },
  addedCold:     { kind: 'support', name: '附加冰冷傷害', maxLevel: 3, color: '#38bdf8', description: '附加 30 點冰冷傷害，20% 機率冰緩' },
  addedLightning:{ kind: 'support', name: '附加閃電傷害', maxLevel: 3, color: '#facc15', description: '附加 1~60 點隨機閃電傷害，20% 機率感電' },
  coldPen:       { kind: 'support', name: '冰冷穿透',     maxLevel: 3, color: '#7dd3fc', description: '冰冷傷害穿透 30% 抗性' },
  vileToxins:    { kind: 'support', name: '罪惡毒素',     maxLevel: 3, color: '#a3e635', description: '擊中毒傷敵人每層 +5% 更多傷害，上限 5 層' },
};

export interface OwnedGem {
  id: string;
  defId: string;
  level: number;
}

export interface SocketSlot {
  gemId: string | null;
}

export interface SocketSetup {
  slots: SocketSlot[];
}

export interface OwnedGemInfo {
  gemId: string;
  defId: string;
  name: string;
  level: number;
  maxLevel: number;
  color: string;
  kind: GemKind;
  description: string;
  socketedSlot: number | null;
}

export interface SocketSlotInfo {
  index: number;
  gem: OwnedGemInfo | null;
  isSkillSlot: boolean;
}

export type ClassId = 'marauder' | 'ranger' | 'witch';

export interface ClassDef {
  id: ClassId;
  name: string;
  subtitle: string;
  description: string;
  color: string;
  hp: number;
  speed: number;
  fireRate: number;
  damage: number;
  targetRange: number;
  projectileSpeed: number;
  mana: number;
  skillName: string;
}

export const CLASSES: ClassDef[] = [
  {
    id: 'marauder', name: '野蠻人', subtitle: 'Marauder',
    description: '血量充沛的肉搏戰士，移動較慢但能承受大量傷害。',
    color: '#991b1b', hp: 160, speed: 170, fireRate: 0.83, damage: 18,
    targetRange: 200, projectileSpeed: 0, mana: 50, skillName: '裂地之擊',
  },
  {
    id: 'ranger', name: '遊俠', subtitle: 'Ranger',
    description: '敏捷的弓箭手，移動迅速且攻擊間隔極短。',
    color: '#166534', hp: 80, speed: 250, fireRate: 1.67, damage: 8,
    targetRange: 600, projectileSpeed: 600, mana: 80, skillName: '電流箭矢',
  },
  {
    id: 'witch', name: '女巫', subtitle: 'Witch',
    description: '遠程法術使用者，投射物速度極快且索敵範圍廣闊。',
    color: '#6b21a8', hp: 70, speed: 200, fireRate: 1.0, damage: 12,
    targetRange: 900, projectileSpeed: 800, mana: 120, skillName: '火球',
  },
];

export type EnemyKind = 'normal' | 'charger' | 'surround' | 'boss';

export interface Enemy extends Entity {
  speed: number;
  color: string;
  spawnTime: number;
  kind: EnemyKind;
  knockback: Vec2;
  stunTimer: number;
  igniteTimer?: number;
  igniteDamage?: number;
  igniteTick?: number;
  chillTimer?: number;
  chillAmount?: number;
  shockTimer?: number;
  poisonStacks?: number;
  poisonDecayTimer?: number;
}

export type ProjectileKind = 'basic' | 'fireball' | 'arrow' | 'burningArrow' | 'causticArrow' | 'iceShot';

export interface Projectile extends Entity {
  damage: number;
  lifetime: number;
  color: string;
  chainRemaining: number;
  hitEnemies: Set<Enemy>;
  kind: ProjectileKind;
  explosionRadius: number;
  chainIndex: number;
}

export interface CausticGround {
  pos: Vec2;
  radius: number;
  life: number;
  maxLife: number;
  tickTimer: number;
  hitCooldown: Map<Enemy, number>;
}

export interface XPGem extends Entity {
  value: number;
  color: string;
}

export interface Chest extends Entity {
  opened: boolean;
}

export interface DamageNumber {
  pos: Vec2; vel: Vec2; value: number; life: number; maxLife: number; color: string;
}

export interface GroundItem {
  pos: Vec2; radius: number; kind: string; name: string;
  labelColor: string; itemColor: string; life: number; dead: boolean;
  gemDefId?: string;
}

export interface PickupLabel {
  pos: Vec2; vel: Vec2; text: string; life: number; maxLife: number; color: string;
}

export interface SpiritFlame {
  angle: number; radius: number; damage: number; hitCooldown: Map<Enemy, number>;
}

export interface ShockWave {
  pos: Vec2; angle: number; spread: number; maxRange: number;
  currentRange: number; life: number; maxLife: number; damage: number;
  color: string; hitEnemies: Set<Enemy>; chainIndex: number;
}

export interface Explosion {
  pos: Vec2; radius: number; life: number; maxLife: number;
  damage: number; hitEnemies: Set<Enemy>; color: string; chainIndex: number;
}

export interface ConeEffect {
  pos: Vec2; angle: number; spread: number; range: number;
  life: number; maxLife: number; color: string;
}

export interface UpgradeOption {
  id: string;
  name: string;
  description: string;
  color: string;
  isGemUpgrade?: boolean;
  gemLevel?: number;
  gemMaxLevel?: number;
  detailLines?: string[];
  apply: (player: Player) => void;
  gemAction?: { type: 'acquire' | 'levelUp'; defId: string };
}

export interface SkillInfo {
  name: string;
  level: number;
}

export interface StatsData {
  className: string;
  classSubtitle: string;
  level: number;
  time: number;
  maxHp: number;
  speed: number;
  speedAtCap: boolean;
  fireRate: string;
  projectileSpeed: number;
  targetRange: number;
  damage: number;
  chaosOrbs: number;
  exaltedOrbs: number;
  lmpLevel: number;
  enhanceLevel: number;
  chainLevel: number;
  splitLevel: number;
  spiritLevel: number;
  skillChains: SocketSlotInfo[][];
  ownedGems: OwnedGemInfo[];
  skills: SkillInfo[];
}

export interface GemChoiceData {
  defId: string;
  name: string;
  color: string;
  currentLevel: number;
  maxLevel: number;
}

export type GameState = 'playing' | 'leveling' | 'paused' | 'gemChoice';
