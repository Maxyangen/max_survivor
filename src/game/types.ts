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
  chainLightningLevel: number;
  splitShotLevel: number;
  spiritFireLevel: number;
  lmpLevel: number;
  enhanceLevel: number;
  chaosOrbs: number;
  exaltedOrbs: number;
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
    color: '#991b1b', hp: 160, speed: 180, fireRate: 0.83, damage: 18,
    targetRange: 200, projectileSpeed: 0, mana: 50, skillName: '裂地之擊',
  },
  {
    id: 'ranger', name: '遊俠', subtitle: 'Ranger',
    description: '敏捷的弓箭手，移動迅速且攻擊間隔極短。',
    color: '#166534', hp: 80, speed: 280, fireRate: 1.67, damage: 8,
    targetRange: 600, projectileSpeed: 600, mana: 80, skillName: '電流箭矢',
  },
  {
    id: 'witch', name: '女巫', subtitle: 'Witch',
    description: '遠程法術使用者，投射物速度極快且索敵範圍廣闊。',
    color: '#6b21a8', hp: 70, speed: 220, fireRate: 1.0, damage: 12,
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
}

export type ProjectileKind = 'basic' | 'fireball' | 'arrow';

export interface Projectile extends Entity {
  damage: number;
  lifetime: number;
  color: string;
  chainRemaining: number;
  hitEnemies: Set<Enemy>;
  kind: ProjectileKind;
  explosionRadius: number;
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
  color: string; hitEnemies: Set<Enemy>;
}

export interface Explosion {
  pos: Vec2; radius: number; life: number; maxLife: number;
  damage: number; hitEnemies: Set<Enemy>; color: string;
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
  apply: (player: Player) => void;
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
  fireRate: string;
  projectileSpeed: number;
  targetRange: number;
  damage: number;
  chaosOrbs: number;
  exaltedOrbs: number;
  lmpLevel: number;
  enhanceLevel: number;
  skills: SkillInfo[];
}

export type GameState = 'playing' | 'leveling' | 'paused';
