import type {
  Player, Enemy, Projectile, XPGem, Vec2, UpgradeOption, GameState,
  ClassDef, DamageNumber, SpiritFlame, Chest, ShockWave, Explosion,
  ConeEffect, StatsData, SkillInfo, GroundItem, PickupLabel,
} from './types';
import { CLASSES } from './types';
import { getSprites } from './sprites';
import type { SpriteSet } from './sprites';

const WORLD_BOUNDS = 80;
const ISO_W = 1;   // isometric horizontal scale
const ISO_H = 0.5;  // isometric vertical scale (2:1 ratio)
const BLOCK_HEIGHT = 20; // visual height of 3D blocks in screen pixels

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width = 0; height = 0; dpr = 1;

  player: Player;
  classDef: ClassDef;
  sprites: SpriteSet;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  gems: XPGem[] = [];
  chests: Chest[] = [];
  particles: { pos: Vec2; vel: Vec2; life: number; maxLife: number; color: string; size: number }[] = [];
  damageNumbers: DamageNumber[] = [];
  spiritFlames: SpiritFlame[] = [];
  shockWaves: ShockWave[] = [];
  explosions: Explosion[] = [];
  coneEffects: ConeEffect[] = [];
  groundItems: GroundItem[] = [];
  pickupLabels: PickupLabel[] = [];

  camera: Vec2 = { x: 0, y: 0 };
  shakeAmount = 0; shakeTime = 0;
  keys: Record<string, boolean> = {};
  mouse: Vec2 = { x: 0, y: 0 };
  useMouse = false;

  lastTime = 0;
  enemySpawnTimer = 0;
  surroundSpawnTimer = 0;
  fireTimer = 0;
  spiritFireTimer = 0;
  gameTime = 0;
  bossSpawned = false;

  level = 1; xp = 0; xpToLevel = 5;
  state: GameState = 'playing';
  upgrades: UpgradeOption[] = [];

  onStateChange: (state: GameState) => void = () => {};
  onHudUpdate: (data: { level: number; xp: number; xpToLevel: number; kills: number; time: number; hp: number; maxHp: number; mana: number; maxMana: number; wave: number; chaosOrbs: number; exaltedOrbs: number }) => void = () => {};
  onUpgradeChoices: (choices: UpgradeOption[]) => void = () => {};
  onDeath: () => void = () => {};
  onBossSpawn: () => void = () => {};
  onStatsUpdate: (stats: StatsData) => void = () => {};

  kills = 0;
  running = false;
  rafId = 0;

  constructor(canvas: HTMLCanvasElement, classDef: ClassDef = CLASSES[0]) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    this.classDef = classDef;
    this.sprites = getSprites();
    this.player = {
      pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, radius: 16,
      hp: classDef.hp, maxHp: classDef.hp, dead: false,
      speed: classDef.speed, fireRate: classDef.fireRate, projectiles: 1,
      damage: classDef.damage, color: classDef.color,
      targetRange: classDef.targetRange, projectileSpeed: classDef.projectileSpeed,
      mana: classDef.mana, maxMana: classDef.mana,
      chainLightningLevel: 0, splitShotLevel: 0, spiritFireLevel: 0,
      lmpLevel: 0, enhanceLevel: 0, chaosOrbs: 0, exaltedOrbs: 0,
    };
  }

  get currentWave(): number {
    if (this.gameTime < 60) return 1;
    if (this.gameTime < 120) return 2;
    return 3;
  }

  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
  }

  onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.togglePause();
      return;
    }
    this.keys[e.key.toLowerCase()] = true;
    if (['w', 'a', 's', 'd'].includes(e.key.toLowerCase())) this.useMouse = false;
  };
  onKeyUp = (e: KeyboardEvent) => { this.keys[e.key.toLowerCase()] = false; };
  onMouseMove = (e: MouseEvent) => {
    this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.useMouse = true;
  };

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.onStateChange('paused');
      this.onStatsUpdate(this.getStats());
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.onStateChange('playing');
      this.lastTime = performance.now();
    }
  }

  loop = () => {
    if (!this.running) return;
    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.05) dt = 0.05;
    if (this.state === 'playing') this.update(dt);
    this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  update(dt: number) {
    this.gameTime += dt;
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateGems(dt);
    this.updateParticles(dt);
    this.updateDamageNumbers(dt);
    this.updateSpiritFlames(dt);
    this.updateShockWaves(dt);
    this.updateExplosions(dt);
    this.updateConeEffects(dt);
    this.updateChests(dt);
    this.updateGroundItems(dt);
    this.updatePickupLabels(dt);
    this.handleCollisions();
    this.updateWaves(dt);

    this.fireTimer += dt;
    if (this.fireTimer >= 1 / this.player.fireRate) {
      this.fireTimer = 0;
      this.fire();
    }

    if (this.player.spiritFireLevel > 0) {
      this.spiritFireTimer += dt;
      if (this.spiritFireTimer >= 5) {
        this.spiritFireTimer = 0;
        this.summonSpiritFlames();
      }
    }

    this.player.mana = Math.min(this.player.maxMana, this.player.mana + 2 * dt);

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) this.shakeAmount = 0;
    }

    this.camera.x = this.player.pos.x;
    this.camera.y = this.player.pos.y;
    this.emitHud();
  }

  updateWaves(dt: number) {
    this.enemySpawnTimer += dt;
    const wave = this.currentWave;
    if (this.enemySpawnTimer >= 2) {
      this.enemySpawnTimer = 0;
      this.spawnEnemy(wave >= 2 ? 'mix' : 'normal');
    }
    if (wave >= 3) {
      this.surroundSpawnTimer += dt;
      if (this.surroundSpawnTimer >= 30) {
        this.surroundSpawnTimer = 0;
        this.spawnSurroundRing();
      }
    }
    if (this.gameTime >= 300 && !this.bossSpawned) {
      this.bossSpawned = true;
      this.spawnBoss();
      this.onBossSpawn();
    }
  }

  updatePlayer(dt: number) {
    const p = this.player;
    // Isometric movement: WASD maps to world axis directions
    // W=worldY-1 (screen up-right), S=worldY+1 (screen down-left)
    // A=worldX-1 (screen up-left), D=worldX+1 (screen down-right)
    let wx = 0, wy = 0;
    if (this.keys['w']) wy -= 1;
    if (this.keys['s']) wy += 1;
    if (this.keys['a']) wx -= 1;
    if (this.keys['d']) wx += 1;
    if (wx !== 0 || wy !== 0) {
      this.useMouse = false;
      const len = Math.hypot(wx, wy);
      wx /= len; wy /= len;
      p.vel.x = wx * p.speed; p.vel.y = wy * p.speed;
    } else if (this.useMouse) {
      const wm = this.screenToWorld(this.mouse);
      const ddx = wm.x - p.pos.x, ddy = wm.y - p.pos.y;
      const dist = Math.hypot(ddx, ddy);
      if (dist > 5) { p.vel.x = (ddx / dist) * p.speed; p.vel.y = (ddy / dist) * p.speed; }
      else { p.vel.x = 0; p.vel.y = 0; }
    } else { p.vel.x = 0; p.vel.y = 0; }
    p.pos.x += p.vel.x * dt; p.pos.y += p.vel.y * dt;
    const dfo = Math.hypot(p.pos.x, p.pos.y);
    if (dfo > WORLD_BOUNDS * 20) { p.pos.x *= 0.98; p.pos.y *= 0.98; }
  }

  updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.knockback.x !== 0 || e.knockback.y !== 0) {
        e.pos.x += e.knockback.x * dt;
        e.pos.y += e.knockback.y * dt;
        e.knockback.x *= 0.85; e.knockback.y *= 0.85;
        if (Math.abs(e.knockback.x) < 1) e.knockback.x = 0;
        if (Math.abs(e.knockback.y) < 1) e.knockback.y = 0;
      }
      if (e.stunTimer > 0) { e.stunTimer -= dt; continue; }
      const dx = p.pos.x - e.pos.x, dy = p.pos.y - e.pos.y;
      const dist = Math.hypot(dx, dy) || 1;
      e.vel.x = (dx / dist) * e.speed; e.vel.y = (dy / dist) * e.speed;
      e.pos.x += e.vel.x * dt; e.pos.y += e.vel.y * dt;
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  updateProjectiles(dt: number) {
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      pr.pos.x += pr.vel.x * dt; pr.pos.y += pr.vel.y * dt;
      pr.lifetime -= dt;
      if (pr.lifetime <= 0) {
        pr.dead = true;
        if (pr.kind === 'fireball') this.createExplosion(pr.pos, pr.explosionRadius, pr.damage);
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  updateGems(dt: number) {
    const p = this.player;
    for (const g of this.gems) {
      if (g.dead) continue;
      const dx = p.pos.x - g.pos.x, dy = p.pos.y - g.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 120) {
        const pull = 300 * (1 - dist / 120);
        g.vel.x = (dx / (dist || 1)) * pull; g.vel.y = (dy / (dist || 1)) * pull;
        g.pos.x += g.vel.x * dt; g.pos.y += g.vel.y * dt;
      }
      if (dist < p.radius + g.radius) {
        g.dead = true; this.gainXP(g.value); this.spawnParticles(g.pos, g.color, 6);
      }
    }
    this.gems = this.gems.filter((g) => !g.dead);
  }

  updateParticles(dt: number) {
    for (const pt of this.particles) {
      pt.pos.x += pt.vel.x * dt; pt.pos.y += pt.vel.y * dt;
      pt.vel.x *= 0.92; pt.vel.y *= 0.92; pt.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  updateDamageNumbers(dt: number) {
    for (const dn of this.damageNumbers) {
      dn.pos.y += dn.vel.y * dt; dn.vel.y *= 0.95; dn.life -= dt;
    }
    this.damageNumbers = this.damageNumbers.filter((d) => d.life > 0);
  }

  updateSpiritFlames(dt: number) {
    const p = this.player;
    for (const sf of this.spiritFlames) {
      sf.angle += dt * 2;
      const fx = p.pos.x + Math.cos(sf.angle) * sf.radius;
      const fy = p.pos.y + Math.sin(sf.angle) * sf.radius;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.pos.x - fx, e.pos.y - fy) < e.radius + 12) {
          const cd = sf.hitCooldown.get(e) ?? 0;
          if (cd <= 0) { this.damageEnemy(e, sf.damage); sf.hitCooldown.set(e, 0.5); }
        }
      }
      for (const [key, val] of sf.hitCooldown) {
        if (val <= 0) sf.hitCooldown.delete(key);
        else sf.hitCooldown.set(key, val - dt);
      }
    }
  }

  updateShockWaves(dt: number) {
    for (const sw of this.shockWaves) {
      sw.currentRange = sw.maxRange * (1 - sw.life / sw.maxLife);
      for (const e of this.enemies) {
        if (e.dead || sw.hitEnemies.has(e)) continue;
        const dx = e.pos.x - sw.pos.x, dy = e.pos.y - sw.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > sw.currentRange || dist < 5) continue;
        const angle = Math.atan2(dy, dx);
        if (Math.abs(this.angleDiff(angle, sw.angle)) < sw.spread) {
          sw.hitEnemies.add(e);
          if (dist < 60) { this.damageEnemy(e, e.hp); }
          else {
            this.damageEnemy(e, sw.damage);
            e.knockback.x += Math.cos(sw.angle) * 300;
            e.knockback.y += Math.sin(sw.angle) * 300;
            e.stunTimer = 0.5;
          }
        }
      }
      sw.life -= dt;
    }
    this.shockWaves = this.shockWaves.filter((s) => s.life > 0);
  }

  updateExplosions(dt: number) {
    for (const ex of this.explosions) {
      for (const e of this.enemies) {
        if (e.dead || ex.hitEnemies.has(e)) continue;
        if (Math.hypot(e.pos.x - ex.pos.x, e.pos.y - ex.pos.y) < ex.radius + e.radius) {
          ex.hitEnemies.add(e);
          this.damageEnemy(e, ex.damage);
        }
      }
      ex.life -= dt;
    }
    this.explosions = this.explosions.filter((e) => e.life > 0);
  }

  updateConeEffects(dt: number) {
    for (const ce of this.coneEffects) ce.life -= dt;
    this.coneEffects = this.coneEffects.filter((c) => c.life > 0);
  }

  updateChests(dt: number) {
    const p = this.player;
    for (const c of this.chests) {
      if (c.opened) continue;
      if (Math.hypot(c.pos.x - p.pos.x, c.pos.y - p.pos.y) < p.radius + c.radius) {
        c.opened = true;
        for (let i = 0; i < 10; i++) {
          this.gems.push({
            pos: { x: c.pos.x + (Math.random() - 0.5) * 40, y: c.pos.y + (Math.random() - 0.5) * 40 },
            vel: { x: 0, y: 0 }, radius: 8, hp: 1, maxHp: 1, dead: false,
            value: 3, color: '#fbbf24',
          });
        }
        this.spawnParticles(c.pos, '#fbbf24', 20);
        this.triggerShake(6, 0.4);
      }
    }
    this.chests = this.chests.filter((c) => !c.opened);
  }

  handleCollisions() {
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      for (const e of this.enemies) {
        if (e.dead || pr.hitEnemies.has(e)) continue;
        if (Math.hypot(pr.pos.x - e.pos.x, pr.pos.y - e.pos.y) < pr.radius + e.radius) {
          pr.hitEnemies.add(e);
          if (pr.kind === 'fireball') {
            this.createExplosion(pr.pos, pr.explosionRadius, pr.damage);
            if (pr.chainRemaining > 0) this.chainLightning(e, pr.damage * 0.7, pr.chainRemaining, pr.hitEnemies);
            pr.dead = true;
          } else if (pr.kind === 'arrow') {
            this.damageEnemy(e, pr.damage);
            if (pr.chainRemaining > 0) this.chainLightning(e, pr.damage * 0.7, pr.chainRemaining, pr.hitEnemies);
          } else {
            this.damageEnemy(e, pr.damage);
            this.applyKnockback(e, pr);
            if (pr.chainRemaining > 0) this.chainLightning(e, pr.damage * 0.7, pr.chainRemaining, pr.hitEnemies);
            pr.dead = true;
          }
          if (pr.kind !== 'arrow') break;
        }
      }
    }
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.pos.x - p.pos.x, e.pos.y - p.pos.y) < e.radius + p.radius) {
        p.hp -= (e.kind === 'boss' ? 35 : 20) * 0.016;
        if (p.hp <= 0) {
          p.hp = 0;
          if (!p.dead) { p.dead = true; this.triggerShake(10, 0.5); this.onDeath(); }
        }
      }
    }
  }

  damageEnemy(e: Enemy, damage: number) {
    e.hp -= damage;
    this.spawnDamageNumber(e.pos, Math.round(damage));
    this.spawnParticles(e.pos, '#f87171', 4);
    if (e.hp <= 0) {
      e.dead = true; this.kills++; this.spawnGem(e.pos);
      this.spawnParticles(e.pos, '#f87171', e.kind === 'boss' ? 30 : 10);
      if (e.kind === 'boss') { this.spawnChest(e.pos); this.triggerShake(15, 0.8); }
      this.maybeDropItem(e.pos, e.kind);
    }
  }

  applyKnockback(e: Enemy, pr: Projectile) {
    const a = Math.atan2(pr.vel.y, pr.vel.x);
    e.knockback.x += Math.cos(a) * 100; e.knockback.y += Math.sin(a) * 100;
  }

  chainLightning(source: Enemy, damage: number, remaining: number, hitSet: Set<Enemy>) {
    let nearest: Enemy | null = null; let minDist = 250;
    for (const e of this.enemies) {
      if (e.dead || hitSet.has(e)) continue;
      const d = Math.hypot(e.pos.x - source.pos.x, e.pos.y - source.pos.y);
      if (d < minDist) { minDist = d; nearest = e; }
    }
    if (!nearest) return;
    hitSet.add(nearest);
    this.damageEnemy(nearest, damage);
    this.spawnLightning(source.pos, nearest.pos);
    if (remaining > 1) this.chainLightning(nearest, damage * 0.7, remaining - 1, hitSet);
  }

  spawnLightning(from: Vec2, to: Vec2) {
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.particles.push({
        pos: { x: from.x + (to.x - from.x) * t + (Math.random() - 0.5) * 20, y: from.y + (to.y - from.y) * t + (Math.random() - 0.5) * 20 },
        vel: { x: 0, y: 0 }, life: 0.3, maxLife: 0.3, color: '#67e8f9', size: 3,
      });
    }
  }

  spawnEnemy(mix: 'normal' | 'mix' = 'normal') {
    const a = Math.random() * Math.PI * 2;
    const d = 600 + Math.random() * 200;
    const thp = Math.floor(this.gameTime / 10) * 10;
    if (mix === 'mix' && Math.random() < 0.4) {
      this.enemies.push({
        pos: { x: this.player.pos.x + Math.cos(a) * d, y: this.player.pos.y + Math.sin(a) * d },
        vel: { x: 0, y: 0 }, radius: 10, hp: 8, maxHp: 8, dead: false,
        speed: 220 + Math.random() * 60, color: '#facc15', spawnTime: this.gameTime,
        kind: 'charger', knockback: { x: 0, y: 0 }, stunTimer: 0,
      });
    } else {
      const hp = 20 + thp;
      this.enemies.push({
        pos: { x: this.player.pos.x + Math.cos(a) * d, y: this.player.pos.y + Math.sin(a) * d },
        vel: { x: 0, y: 0 }, radius: 14, hp, maxHp: hp, dead: false,
        speed: 80 + Math.random() * 40, color: '#ef4444', spawnTime: this.gameTime,
        kind: 'normal', knockback: { x: 0, y: 0 }, stunTimer: 0,
      });
    }
  }

  spawnSurroundRing() {
    const count = 12, dist = 350;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const hp = 15 + Math.floor(this.gameTime / 10) * 5;
      this.enemies.push({
        pos: { x: this.player.pos.x + Math.cos(a) * dist, y: this.player.pos.y + Math.sin(a) * dist },
        vel: { x: 0, y: 0 }, radius: 12, hp, maxHp: hp, dead: false,
        speed: 100, color: '#a855f7', spawnTime: this.gameTime,
        kind: 'surround', knockback: { x: 0, y: 0 }, stunTimer: 0,
      });
    }
  }

  spawnBoss() {
    const a = Math.random() * Math.PI * 2, d = 500, hp = 2000;
    this.enemies.push({
      pos: { x: this.player.pos.x + Math.cos(a) * d, y: this.player.pos.y + Math.sin(a) * d },
      vel: { x: 0, y: 0 }, radius: 48, hp, maxHp: hp, dead: false,
      speed: 60, color: '#7f1d1d', spawnTime: this.gameTime,
      kind: 'boss', knockback: { x: 0, y: 0 }, stunTimer: 0,
    });
    this.triggerShake(20, 1.0);
  }

  spawnChest(pos: Vec2) {
    this.chests.push({
      pos: { x: pos.x, y: pos.y }, vel: { x: 0, y: 0 }, radius: 18,
      hp: 1, maxHp: 1, dead: false, opened: false,
    });
  }

  // --- Class-specific attacks ---

  findNearestEnemy(): Enemy | null {
    const p = this.player;
    let nearest: Enemy | null = null, minDist = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.pos.x - p.pos.x, e.pos.y - p.pos.y);
      if (d < minDist && d <= p.targetRange) { minDist = d; nearest = e; }
    }
    return nearest;
  }

  angleDiff(a: number, b: number): number {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  fire() {
    switch (this.classDef.id) {
      case 'witch': this.fireFireball(); break;
      case 'ranger': this.fireGalvanicArrow(); break;
      case 'marauder': this.fireGroundSlam(); break;
    }
  }

  fireFireball() {
    const p = this.player;
    const nearest = this.findNearestEnemy();
    if (!nearest) return;
    const angle = Math.atan2(nearest.pos.y - p.pos.y, nearest.pos.x - p.pos.x);
    const fireballCount = 1 + p.lmpLevel * 2;
    for (let i = 0; i < fireballCount; i++) {
      const off = fireballCount > 1 ? (i / (fireballCount - 1) - 0.5) * 0.2 : 0;
      const a = angle + off;
      this.projectiles.push({
        pos: { x: p.pos.x, y: p.pos.y },
        vel: { x: Math.cos(a) * p.projectileSpeed, y: Math.sin(a) * p.projectileSpeed },
        radius: 10, hp: 1, maxHp: 1, dead: false,
        damage: p.damage, lifetime: p.targetRange / p.projectileSpeed,
        color: '#ff6b35', chainRemaining: p.chainLightningLevel > 0 ? 2 : 0,
        hitEnemies: new Set<Enemy>(), kind: 'fireball', explosionRadius: 40,
      });
    }
  }

  fireGalvanicArrow() {
    const p = this.player;
    const nearest = this.findNearestEnemy();
    if (!nearest) return;
    const baseAngle = Math.atan2(nearest.pos.y - p.pos.y, nearest.pos.x - p.pos.x);
    const arrowCount = 3 + p.splitShotLevel * 2 + p.lmpLevel * 2;
    const spread = 0.12;
    for (let i = 0; i < arrowCount; i++) {
      const off = arrowCount > 1 ? (i / (arrowCount - 1) - 0.5) * spread * 2 : 0;
      const angle = baseAngle + off;
      this.projectiles.push({
        pos: { x: p.pos.x, y: p.pos.y },
        vel: { x: Math.cos(angle) * p.projectileSpeed, y: Math.sin(angle) * p.projectileSpeed },
        radius: 4, hp: 1, maxHp: 1, dead: false,
        damage: p.damage, lifetime: 1.5,
        color: '#22d3ee', chainRemaining: p.chainLightningLevel > 0 ? 2 : 0,
        hitEnemies: new Set<Enemy>(), kind: 'arrow', explosionRadius: 0,
      });
    }
    const halfCone = Math.PI / 6 + p.lmpLevel * (Math.PI / 12);
    this.coneEffects.push({
      pos: { x: p.pos.x, y: p.pos.y }, angle: baseAngle, spread: halfCone,
      range: 120 + p.lmpLevel * 40, life: 0.25, maxLife: 0.25, color: '#22d3ee',
    });
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.pos.x - p.pos.x, dy = e.pos.y - p.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 120 + p.lmpLevel * 40) continue;
      const angle = Math.atan2(dy, dx);
      if (Math.abs(this.angleDiff(angle, baseAngle)) < halfCone) {
        this.damageEnemy(e, p.damage);
      }
    }
  }

  fireGroundSlam() {
    const p = this.player;
    const nearest = this.findNearestEnemy();
    if (!nearest) return;
    const baseAngle = Math.atan2(nearest.pos.y - p.pos.y, nearest.pos.x - p.pos.x);
    const slamCount = 1 + p.lmpLevel;
    for (let i = 0; i < slamCount; i++) {
      this.shockWaves.push({
        pos: { x: p.pos.x, y: p.pos.y }, angle: baseAngle,
        spread: Math.PI / 8, maxRange: 150, currentRange: 0,
        life: 0.4 + i * 0.15, maxLife: 0.4 + i * 0.15, damage: p.damage,
        color: '#991b1b', hitEnemies: new Set<Enemy>(),
      });
    }
    this.triggerShake(6, 0.3);
  }

  createExplosion(pos: Vec2, radius: number, damage: number) {
    this.explosions.push({
      pos: { x: pos.x, y: pos.y }, radius, life: 0.3, maxLife: 0.3,
      damage, hitEnemies: new Set<Enemy>(), color: '#ff6b35',
    });
    this.spawnParticles(pos, '#ff6b35', 15);
    this.triggerShake(4, 0.2);
  }

  summonSpiritFlames() {
    this.spiritFlames.push({
      angle: Math.random() * Math.PI * 2, radius: 60,
      damage: this.player.damage * 0.5, hitCooldown: new Map<Enemy, number>(),
    });
  }

  spawnGem(pos: Vec2) {
    this.gems.push({
      pos: { x: pos.x, y: pos.y }, vel: { x: 0, y: 0 }, radius: 8,
      hp: 1, maxHp: 1, dead: false, value: 1, color: '#22c55e',
    });
  }

  maybeDropItem(pos: Vec2, enemyKind: string) {
    const baseChance = enemyKind === 'boss' ? 1.0 : enemyKind === 'charger' ? 0.25 : 0.15;
    if (Math.random() > baseChance) return;
    const roll = Math.random();
    if (roll < 0.15) {
      this.spawnGroundItem(pos, 'gem', Math.random() < 0.5 ? '多重投射支援' : '增幅支援', '#22d3ee', '#0e7490');
    } else if (roll < 0.30) {
      this.spawnGroundItem(pos, 'currency', Math.random() < 0.7 ? '混沌石' : '崇高石', '#92400e', '#fbbf24');
    } else {
      const equips = ['製圖者之帽', '皮革腰帶', '鐵戒指', '鏽劍', '秘法法袍', '皮甲', '鋼盾'];
      const name = equips[Math.floor(Math.random() * equips.length)];
      const rarityRoll = Math.random();
      const labelColor = rarityRoll < 0.5 ? '#d1d5db' : rarityRoll < 0.8 ? '#60a5fa' : rarityRoll < 0.95 ? '#fbbf24' : '#fb923c';
      this.spawnGroundItem(pos, 'equipment', name, labelColor, labelColor);
    }
  }

  spawnGroundItem(pos: Vec2, kind: string, name: string, labelColor: string, itemColor: string) {
    this.groundItems.push({
      pos: { x: pos.x + (Math.random() - 0.5) * 20, y: pos.y + (Math.random() - 0.5) * 20 },
      radius: 10, kind, name, labelColor, itemColor, life: 30, dead: false,
    });
  }

  updateGroundItems(dt: number) {
    const p = this.player;
    for (const item of this.groundItems) {
      if (item.dead) continue;
      item.life -= dt;
      if (item.life <= 0) { item.dead = true; continue; }
      const dist = Math.hypot(item.pos.x - p.pos.x, item.pos.y - p.pos.y);
      if (dist < 100) {
        const pull = 200 * (1 - dist / 100);
        item.pos.x += (p.pos.x - item.pos.x) / (dist || 1) * pull * dt;
        item.pos.y += (p.pos.y - item.pos.y) / (dist || 1) * pull * dt;
      }
      if (dist < p.radius + item.radius) {
        item.dead = true;
        this.pickupItem(item);
      }
    }
    this.groundItems = this.groundItems.filter((i) => !i.dead);
  }

  updatePickupLabels(dt: number) {
    for (const lbl of this.pickupLabels) {
      lbl.pos.y += lbl.vel.y * dt; lbl.vel.y *= 0.96; lbl.life -= dt;
    }
    this.pickupLabels = this.pickupLabels.filter((l) => l.life > 0);
  }

  pickupItem(item: GroundItem) {
    if (item.kind === 'gem') {
      if (item.name === '多重投射支援') {
        this.player.lmpLevel++;
        this.spawnParticles(item.pos, '#22d3ee', 10);
      } else {
        this.player.enhanceLevel++;
        this.player.fireRate *= 1.3;
        this.spawnParticles(item.pos, '#22d3ee', 10);
      }
      this.spawnPickupLabel(item.pos, `${item.name} +1`, '#22d3ee');
    } else if (item.kind === 'currency') {
      if (item.name === '混沌石') { this.player.chaosOrbs++; this.spawnPickupLabel(item.pos, '+1 混沌石', '#92400e'); }
      else { this.player.exaltedOrbs++; this.spawnPickupLabel(item.pos, '+1 崇高石', '#fbbf24'); }
      this.spawnParticles(item.pos, '#fbbf24', 8);
    } else if (item.kind === 'equipment') {
      const bonus = Math.random();
      if (bonus < 0.4) { this.player.maxHp += 20; this.player.hp += 20; this.spawnPickupLabel(item.pos, `${item.name} (HP+20)`, item.labelColor); }
      else if (bonus < 0.7) { this.player.speed *= 1.05; this.spawnPickupLabel(item.pos, `${item.name} (速度+5%)`, item.labelColor); }
      else if (bonus < 0.9) { this.player.damage *= 1.1; this.spawnPickupLabel(item.pos, `${item.name} (傷害+10%)`, item.labelColor); }
      else { this.player.maxMana += 15; this.player.mana += 15; this.spawnPickupLabel(item.pos, `${item.name} (法力+15)`, item.labelColor); }
      this.spawnParticles(item.pos, item.labelColor, 8);
    }
  }

  spawnPickupLabel(pos: Vec2, text: string, color: string) {
    this.pickupLabels.push({
      pos: { x: pos.x, y: pos.y - 15 }, vel: { x: 0, y: -40 },
      text, life: 2, maxLife: 2, color,
    });
  }

  spawnParticles(pos: Vec2, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = 50 + Math.random() * 150;
      this.particles.push({
        pos: { x: pos.x, y: pos.y }, vel: { x: Math.cos(a) * s, y: Math.sin(a) * s },
        life: 0.5, maxLife: 0.5, color, size: 2 + Math.random() * 3,
      });
    }
  }

  spawnDamageNumber(pos: Vec2, value: number) {
    this.damageNumbers.push({
      pos: { x: pos.x, y: pos.y - 10 }, vel: { x: (Math.random() - 0.5) * 20, y: -60 },
      value, life: 0.8, maxLife: 0.8, color: '#fbbf24',
    });
  }

  triggerShake(amount: number, duration: number) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  gainXP(amount: number) {
    this.xp += amount;
    if (this.xp >= this.xpToLevel) {
      this.xp -= this.xpToLevel;
      this.level++;
      this.xpToLevel = Math.floor(this.xpToLevel * 1.5);
      this.triggerLevelUp();
    }
  }

  triggerLevelUp() {
    this.state = 'leveling';
    this.onStateChange('leveling');
    this.upgrades = this.rollUpgrades();
    this.onUpgradeChoices(this.upgrades);
  }

  chooseUpgrade(opt: UpgradeOption) {
    opt.apply(this.player);
    this.state = 'playing';
    this.onStateChange('playing');
    this.lastTime = performance.now();
  }

  rollUpgrades(): UpgradeOption[] {
    const pool: UpgradeOption[] = [
      { id: 'firerate', name: '攻速提升', description: '攻擊速度 +25%', color: '#f59e0b', apply: (p) => { p.fireRate *= 1.25; } },
      { id: 'speed', name: '移速提升', description: '移動速度 +20%', color: '#38bdf8', apply: (p) => { p.speed *= 1.2; } },
      { id: 'damage', name: '傷害提升', description: '攻擊傷害 +50%', color: '#f87171', apply: (p) => { p.damage *= 1.5; } },
      { id: 'heal', name: '恢復生命', description: '恢復 40 點生命', color: '#22c55e', apply: (p) => { p.hp = Math.min(p.maxHp, p.hp + 40); } },
      { id: 'maxhp', name: '最大生命', description: '最大生命 +30 並恢復', color: '#34d399', apply: (p) => { p.maxHp += 30; p.hp = p.maxHp; } },
      { id: 'maxmana', name: '最大法力', description: '最大法力 +20 並恢復', color: '#3b82f6', apply: (p) => { p.maxMana += 20; p.mana = p.maxMana; } },
      { id: 'chain', name: '連鎖閃電', description: '命中後彈射至附近 2 個敵人', color: '#67e8f9', apply: (p) => { p.chainLightningLevel++; } },
      { id: 'split', name: '分裂箭', description: '增加 2 發投射物', color: '#84cc16', apply: (p) => { p.splitShotLevel++; } },
      { id: 'spirit', name: '冥界之火', description: '每 5 秒召喚環繞火焰造成持續傷害', color: '#a855f7', apply: (p) => { p.spiritFireLevel++; } },
    ];
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
  }

  getStats(): StatsData {
    const p = this.player;
    const skills: SkillInfo[] = [{ name: this.classDef.skillName, level: 1 }];
    if (p.chainLightningLevel > 0) skills.push({ name: '連鎖閃電', level: p.chainLightningLevel });
    if (p.splitShotLevel > 0) skills.push({ name: '分裂箭', level: p.splitShotLevel });
    if (p.spiritFireLevel > 0) skills.push({ name: '冥界之火', level: p.spiritFireLevel });
    if (p.lmpLevel > 0) skills.push({ name: '多重投射支援', level: p.lmpLevel });
    if (p.enhanceLevel > 0) skills.push({ name: '增幅支援', level: p.enhanceLevel });
    return {
      className: this.classDef.name, classSubtitle: this.classDef.subtitle,
      level: this.level, time: this.gameTime,
      maxHp: p.maxHp, speed: Math.round(p.speed),
      fireRate: p.fireRate.toFixed(2), projectileSpeed: Math.round(p.projectileSpeed),
      targetRange: Math.round(p.targetRange), damage: Math.round(p.damage),
      chaosOrbs: p.chaosOrbs, exaltedOrbs: p.exaltedOrbs,
      lmpLevel: p.lmpLevel, enhanceLevel: p.enhanceLevel, skills,
    };
  }

  screenToWorld(screen: Vec2): Vec2 {
    const sx = screen.x - this.width / 2;
    const sy = screen.y - this.height / 2;
    return {
      x: (sx / ISO_W + sy / ISO_H) / 2 + this.camera.x,
      y: (sy / ISO_H - sx / ISO_W) / 2 + this.camera.y,
    };
  }
  worldToScreen(world: Vec2): Vec2 {
    const dx = world.x - this.camera.x;
    const dy = world.y - this.camera.y;
    return {
      x: (dx - dy) * ISO_W + this.width / 2,
      y: (dx + dy) * ISO_H + this.height / 2,
    };
  }

  emitHud() {
    this.onHudUpdate({
      level: this.level, xp: this.xp, xpToLevel: this.xpToLevel,
      kills: this.kills, time: this.gameTime,
      hp: Math.ceil(this.player.hp), maxHp: this.player.maxHp,
      mana: Math.ceil(this.player.mana), maxMana: this.player.maxMana,
      wave: this.currentWave, chaosOrbs: this.player.chaosOrbs, exaltedOrbs: this.player.exaltedOrbs,
    });
  }

  getShakeOffset(): Vec2 {
    if (this.shakeAmount <= 0 || this.shakeTime <= 0) return { x: 0, y: 0 };
    return { x: (Math.random() - 0.5) * this.shakeAmount, y: (Math.random() - 0.5) * this.shakeAmount };
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    const shake = this.getShakeOffset();
    ctx.translate(shake.x, shake.y);
    this.drawIsoGrid();

    // ground-level effects first
    for (const g of this.gems) {
      const s = this.worldToScreen(g.pos);
      // gem shadow
      this.drawShadow(s, g.radius);
      ctx.fillStyle = g.color; ctx.shadowColor = g.color; ctx.shadowBlur = 12;
      this.drawIsoBlock(s, g.radius, g.color, 6);
      ctx.shadowBlur = 0;
    }

    for (const c of this.chests) {
      if (c.opened) continue;
      const s = this.worldToScreen(c.pos);
      this.drawShadow(s, c.radius);
      this.drawIsoBlock(s, c.radius, '#92400e', 12);
      // gold lock
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(s.x - 4, s.y - 4, 8, 8);
    }

    for (const pt of this.particles) {
      const s = this.worldToScreen(pt.pos);
      ctx.globalAlpha = pt.life / pt.maxLife;
      ctx.fillStyle = pt.color;
      ctx.fillRect(s.x - pt.size / 2, s.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // shock waves (ground level)
    for (const sw of this.shockWaves) {
      const s = this.worldToScreen(sw.pos);
      const r = sw.currentRange;
      const alpha = sw.life / sw.maxLife;
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = sw.color;
      // draw iso ellipse
      this.fillIsoEllipse(s, r, sw.angle - sw.spread, sw.angle + sw.spread);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
      this.strokeIsoEllipse(s, r, sw.angle - sw.spread, sw.angle + sw.spread);
    }
    ctx.globalAlpha = 1;

    // explosions
    for (const ex of this.explosions) {
      const s = this.worldToScreen(ex.pos);
      const t = 1 - ex.life / ex.maxLife;
      const r = ex.radius * (0.3 + t * 0.7);
      ctx.globalAlpha = ex.life / ex.maxLife;
      ctx.fillStyle = ex.color; ctx.shadowColor = ex.color; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, r * ISO_W, r * ISO_H, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.ellipse(s.x, s.y, r * 0.4 * ISO_W, r * 0.4 * ISO_H, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // cone effects
    for (const ce of this.coneEffects) {
      const s = this.worldToScreen(ce.pos);
      const alpha = ce.life / ce.maxLife;
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = ce.color; ctx.shadowColor = ce.color; ctx.shadowBlur = 12;
      this.fillIsoCone(s, ce.range, ce.angle, ce.spread);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // Sort enemies + player by world Y for depth ordering
    const drawables: { pos: Vec2; radius: number; color: string; kind: string; hp: number; maxHp: number; stunTimer: number; isPlayer: boolean }[] = [];
    for (const e of this.enemies) {
      if (!e.dead) drawables.push({ pos: e.pos, radius: e.radius, color: e.color, kind: e.kind, hp: e.hp, maxHp: e.maxHp, stunTimer: e.stunTimer, isPlayer: false });
    }
    if (!this.player.dead) {
      drawables.push({ pos: this.player.pos, radius: this.player.radius, color: this.player.color, kind: 'player', hp: this.player.hp, maxHp: this.player.maxHp, stunTimer: 0, isPlayer: true });
    }
    drawables.sort((a, b) => (a.pos.x + a.pos.y) - (b.pos.x + b.pos.y));

    for (const d of drawables) {
      const s = this.worldToScreen(d.pos);
      if (s.x < -150 || s.x > this.width + 150 || s.y < -150 || s.y > this.height + 150) continue;

      // shadow on ground
      this.drawShadow(s, d.radius);

      // select sprite
      let sprite: HTMLCanvasElement;
      let drawSize: number;
      if (d.isPlayer) {
        sprite = this.classDef.id === 'witch' ? this.sprites.witch : this.classDef.id === 'ranger' ? this.sprites.ranger : this.sprites.marauder;
        drawSize = 48;
      } else if (d.kind === 'boss') {
        sprite = this.sprites.boss;
        drawSize = 120;
      } else if (d.kind === 'charger') {
        sprite = this.sprites.charger;
        drawSize = 40;
      } else if (d.kind === 'surround') {
        sprite = this.sprites.surround;
        drawSize = 40;
      } else {
        sprite = this.sprites.skeleton;
        drawSize = 42;
      }

      // draw sprite centered above shadow, with a slight elevation for 2.5D feel
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, s.x - drawSize / 2, s.y - drawSize - 4, drawSize, drawSize);

      // stun indicator
      if (d.stunTimer > 0) {
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, d.radius * ISO_W + 4, d.radius * ISO_H + 4, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // hp bar
      if (d.hp < d.maxHp && !d.isPlayer) {
        const bw = d.radius * 2;
        const barY = d.kind === 'boss' ? s.y - drawSize - 4 : s.y - drawSize - 2;
        ctx.fillStyle = '#333'; ctx.fillRect(s.x - bw / 2, barY, bw, 4);
        ctx.fillStyle = d.kind === 'boss' ? '#fbbf24' : '#ef4444';
        ctx.fillRect(s.x - bw / 2, barY, bw * (d.hp / d.maxHp), 4);
      }
      if (d.kind === 'boss') {
        ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 14px Georgia'; ctx.textAlign = 'center';
        ctx.fillText('BOSS', s.x, s.y - drawSize - 10);
      }
    }

    // projectiles (floating above ground)
    for (const pr of this.projectiles) {
      const s = this.worldToScreen(pr.pos);
      ctx.fillStyle = pr.color; ctx.shadowColor = pr.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.ellipse(s.x, s.y - 15, pr.radius, pr.radius * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // spirit flames
    for (const sf of this.spiritFlames) {
      const fx = this.player.pos.x + Math.cos(sf.angle) * sf.radius;
      const fy = this.player.pos.y + Math.sin(sf.angle) * sf.radius;
      const s = this.worldToScreen({ x: fx, y: fy });
      ctx.fillStyle = '#a855f7'; ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(s.x, s.y - 15, 10, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // ground items
    for (const item of this.groundItems) {
      const s = this.worldToScreen(item.pos);
      if (s.x < -50 || s.x > this.width + 50 || s.y < -50 || s.y > this.height + 50) continue;
      this.drawShadow(s, item.radius);
      // item block
      ctx.fillStyle = item.itemColor; ctx.shadowColor = item.itemColor; ctx.shadowBlur = 8;
      this.drawIsoBlock(s, item.radius, item.itemColor, 6);
      ctx.shadowBlur = 0;
      // floating label
      const labelAlpha = item.life < 5 ? item.life / 5 : 1;
      ctx.globalAlpha = labelAlpha;
      ctx.fillStyle = item.labelColor;
      ctx.font = 'bold 11px Georgia'; ctx.textAlign = 'center';
      ctx.fillText(item.name, s.x, s.y - 16);
      ctx.globalAlpha = 1;
    }

    // pickup labels (floating text)
    for (const lbl of this.pickupLabels) {
      const s = this.worldToScreen(lbl.pos);
      ctx.globalAlpha = lbl.life / lbl.maxLife;
      ctx.fillStyle = lbl.color; ctx.font = 'bold 14px Georgia'; ctx.textAlign = 'center';
      ctx.fillText(lbl.text, s.x, s.y);
    }
    ctx.globalAlpha = 1;

    // damage numbers
    for (const dn of this.damageNumbers) {
      const s = this.worldToScreen(dn.pos);
      ctx.globalAlpha = dn.life / dn.maxLife;
      ctx.fillStyle = dn.color; ctx.font = 'bold 16px Georgia'; ctx.textAlign = 'center';
      ctx.fillText(`-${dn.value}`, s.x, s.y - 20);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  drawIsoBlock(s: Vec2, radius: number, color: string, height: number, glow: number = 8) {
    const ctx = this.ctx;
    const w = radius * ISO_W;
    const h = radius * ISO_H;
    // colors
    const top = this.lightenColor(color, 1.3);
    const left = this.lightenColor(color, 0.7);
    const right = this.lightenColor(color, 0.85);

    if (glow > 0) { ctx.shadowColor = color; ctx.shadowBlur = glow; }

    // top face (diamond)
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - height - h);
    ctx.lineTo(s.x + w, s.y - height);
    ctx.lineTo(s.x, s.y - height + h);
    ctx.lineTo(s.x - w, s.y - height);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // left face
    ctx.fillStyle = left;
    ctx.beginPath();
    ctx.moveTo(s.x - w, s.y - height);
    ctx.lineTo(s.x, s.y - height + h);
    ctx.lineTo(s.x, s.y + h);
    ctx.lineTo(s.x - w, s.y);
    ctx.closePath();
    ctx.fill();

    // right face
    ctx.fillStyle = right;
    ctx.beginPath();
    ctx.moveTo(s.x + w, s.y - height);
    ctx.lineTo(s.x, s.y - height + h);
    ctx.lineTo(s.x, s.y + h);
    ctx.lineTo(s.x + w, s.y);
    ctx.closePath();
    ctx.fill();

    // top outline
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - height - h);
    ctx.lineTo(s.x + w, s.y - height);
    ctx.lineTo(s.x, s.y - height + h);
    ctx.lineTo(s.x - w, s.y - height);
    ctx.closePath();
    ctx.stroke();
  }

  drawShadow(s: Vec2, radius: number) {
    const ctx = this.ctx;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, radius * ISO_W, radius * ISO_H, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  fillIsoEllipse(s: Vec2, r: number, angleStart: number, angleEnd: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.ellipse(s.x, s.y, r * ISO_W, r * ISO_H, 0, angleStart, angleEnd);
    ctx.closePath();
    ctx.fill();
  }

  strokeIsoEllipse(s: Vec2, r: number, angleStart: number, angleEnd: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, r * ISO_W, r * ISO_H, 0, angleStart, angleEnd);
    ctx.stroke();
  }

  fillIsoCone(s: Vec2, range: number, angle: number, spread: number) {
    const ctx = this.ctx;
    // Convert world angle cone to screen-space points
    const steps = 12;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = angle - spread + t * spread * 2;
      const wx = Math.cos(a) * range;
      const wy = Math.sin(a) * range;
      const px = s.x + (wx - wy) * ISO_W;
      const py = s.y + (wx + wy) * ISO_H;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  lightenColor(hex: string, factor: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const nr = Math.min(255, Math.round(r * factor));
    const ng = Math.min(255, Math.round(g * factor));
    const nb = Math.min(255, Math.round(b * factor));
    return `rgb(${nr},${ng},${nb})`;
  }

  drawIsoGrid() {
    const ctx = this.ctx;
    const gs = 64;
    // Draw diamond grid tiles
    ctx.strokeStyle = 'rgba(180,120,60,0.08)'; ctx.lineWidth = 1;
    const range = 40;
    for (let i = -range; i <= range; i++) {
      for (let j = -range; j <= range; j++) {
        const wx = Math.floor(this.camera.x / gs) * gs + i * gs;
        const wy = Math.floor(this.camera.y / gs) * gs + j * gs;
        const s = this.worldToScreen({ x: wx, y: wy });
        if (s.x < -100 || s.x > this.width + 100 || s.y < -100 || s.y > this.height + 100) continue;
        const w = gs * ISO_W;
        const h = gs * ISO_H;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - h);
        ctx.lineTo(s.x + w, s.y);
        ctx.lineTo(s.x, s.y + h);
        ctx.lineTo(s.x - w, s.y);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
}
