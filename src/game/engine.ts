import type {
  Player, Enemy, Projectile, XPGem, Vec2, UpgradeOption, GameState,
  ClassDef, DamageNumber, SpiritFlame, Chest, ShockWave, Explosion,
  ConeEffect, StatsData, SkillInfo, GroundItem, PickupLabel,
  OwnedGem, OwnedGemInfo, SocketSetup, SocketSlotInfo, CausticGround,
  GemChoiceData,
} from './types';
import { CLASSES, GEM_DEFS } from './types';
import { getSprites } from './sprites';
import type { SpriteSet } from './sprites';

const MAP_SIZE = 3000;
const MAP_HALF = MAP_SIZE / 2;
const ISO_W = 1;   // isometric horizontal scale
const ISO_H = 0.5;  // isometric vertical scale (2:1 ratio)
const BLOCK_HEIGHT = 20; // visual height of 3D blocks in screen pixels
const MAX_ENEMIES = 140;
const MOVE_SPEED_CAP = 400;

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
  causticGrounds: CausticGround[] = [];

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
  gemChoiceData: GemChoiceData | null = null;
  ownedGems: OwnedGem[] = [];
  socketSetups: SocketSetup[] = [];
  skillFireTimers: number[] = [];

  onStateChange: (state: GameState) => void = () => {};
  onHudUpdate: (data: { level: number; xp: number; xpToLevel: number; kills: number; time: number; hp: number; maxHp: number; mana: number; maxMana: number; wave: number; chaosOrbs: number; exaltedOrbs: number }) => void = () => {};
  onUpgradeChoices: (choices: UpgradeOption[]) => void = () => {};
  onGemChoice: (data: GemChoiceData) => void = () => {};
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
    const activeGem: OwnedGem = { id: `active-${classDef.id}`, defId: `active-${classDef.id}`, level: 1 };
    this.ownedGems = [activeGem];
    this.socketSetups = [{ slots: [{ gemId: activeGem.id }, { gemId: null }, { gemId: null }] }];
    this.skillFireTimers = [0];
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

  get enemySimulationRadius(): number {
    return Math.max(700, Math.max(this.width, this.height) * 1.35);
  }

  get moveSpeed(): number {
    return Math.min(this.player.speed, MOVE_SPEED_CAP);
  }

  get speedAtCap(): boolean {
    return this.player.speed >= MOVE_SPEED_CAP;
  }

  isEnemyNearPlayer(enemy: Enemy, padding = 0): boolean {
    return Math.hypot(enemy.pos.x - this.player.pos.x, enemy.pos.y - this.player.pos.y) <= this.enemySimulationRadius + padding;
  }

  get activeGemDefId(): string {
    const activeId = this.socketSetups[0]?.slots[0]?.gemId;
    return this.ownedGems.find((gem) => gem.id === activeId)?.defId ?? `active-${this.classDef.id}`;
  }

  get activeGemName(): string {
    return GEM_DEFS[this.activeGemDefId]?.name ?? this.classDef.skillName;
  }

  isRangerActiveSkill(defId: string): boolean {
    return this.classDef.id === 'ranger' && ['active-ranger', 'burningArrow', 'causticArrow', 'iceShot'].includes(defId);
  }

  getChainSupportLevel(chainIndex: number, defId: string): number {
    const chain = this.socketSetups[chainIndex];
    const gemId = chain?.slots.slice(1).map((slot) => slot.gemId).find((id) => this.ownedGems.find((gem) => gem.id === id)?.defId === defId);
    return gemId ? this.ownedGems.find((gem) => gem.id === gemId)?.level ?? 0 : 0;
  }

  getChainDamage(chainIndex: number): number {
    const lmp = this.getChainSupportLevel(chainIndex, 'lmp');
    return this.player.damage * (1 + ([0, 0.2, 0.35, 0.5][lmp] ?? 0));
  }

  getChainProjectileSpeed(chainIndex: number): number {
    const lmp = this.getChainSupportLevel(chainIndex, 'lmp');
    return this.player.projectileSpeed * (1 + ([0, 0.1, 0.15, 0.2][lmp] ?? 0));
  }

  getChainFireRate(chainIndex: number): number {
    const enhance = this.getChainSupportLevel(chainIndex, 'enhance');
    return this.player.fireRate * (1 + ([0, 0.1, 0.15, 0.2][enhance] ?? 0));
  }

  getChainTags(chainIndex: number): Set<string> {
    const tags = new Set<string>();
    const activeDefId = this.ownedGems.find((gem) => gem.id === this.socketSetups[chainIndex]?.slots[0]?.gemId)?.defId ?? `active-${this.classDef.id}`;
    if (activeDefId === 'burningArrow') tags.add('fire');
    if (activeDefId === 'causticArrow') tags.add('chaos');
    if (activeDefId === 'iceShot') tags.add('cold');
    if (this.getChainSupportLevel(chainIndex, 'addedFire') > 0) tags.add('fire');
    if (this.getChainSupportLevel(chainIndex, 'addedCold') > 0) tags.add('cold');
    if (this.getChainSupportLevel(chainIndex, 'addedLightning') > 0) tags.add('lightning');
    return tags;
  }

  computeHitDamage(chainIndex: number, baseDamage: number, enemy: Enemy): number {
    let damage = baseDamage;
    const fireLv = this.getChainSupportLevel(chainIndex, 'addedFire');
    const coldLv = this.getChainSupportLevel(chainIndex, 'addedCold');
    const lightLv = this.getChainSupportLevel(chainIndex, 'addedLightning');
    const coldPenLv = this.getChainSupportLevel(chainIndex, 'coldPen');
    const vileLv = this.getChainSupportLevel(chainIndex, 'vileToxins');
    let coldDamage = 0;
    if (fireLv > 0) damage += baseDamage * 0.3 * fireLv;
    if (coldLv > 0) { coldDamage = 30 * coldLv; damage += coldDamage; }
    if (lightLv > 0) damage += 1 + Math.random() * 60 * lightLv;
    if (coldPenLv > 0 && coldDamage > 0) damage += coldDamage * 0.3 * coldPenLv;
    if (vileLv > 0) {
      const stacks = Math.min(5, enemy.poisonStacks ?? 0);
      damage *= 1 + stacks * 0.05 * vileLv;
    }
    if ((enemy.shockTimer ?? 0) > 0) damage *= 1.15;
    return damage;
  }

  applyHitAilments(chainIndex: number, enemy: Enemy, baseDamage: number) {
    const fireLv = this.getChainSupportLevel(chainIndex, 'addedFire');
    const coldLv = this.getChainSupportLevel(chainIndex, 'addedCold');
    const lightLv = this.getChainSupportLevel(chainIndex, 'addedLightning');
    if (fireLv > 0) this.spawnParticles(enemy.pos, '#f97316', 5);
    if (coldLv > 0 && Math.random() < 0.2) this.chillEnemy(enemy, 0.3);
    if (lightLv > 0 && Math.random() < 0.2) this.shockEnemy(enemy);
    const tags = this.getChainTags(chainIndex);
    if (tags.has('chaos')) {
      const stacks = Math.min(5, (enemy.poisonStacks ?? 0) + 1);
      enemy.poisonStacks = stacks;
      enemy.poisonDecayTimer = 3;
    }
  }

  getGem(defId: string): OwnedGem | undefined {
    return this.ownedGems.find((gem) => gem.defId === defId);
  }

  getSocketedGem(defId: string): OwnedGem | undefined {
    const gemId = this.socketSetups.flatMap((setup) => setup.slots).map((slot) => slot.gemId).find((id) => this.ownedGems.find((gem) => gem.id === id)?.defId === defId);
    return gemId ? this.ownedGems.find((gem) => gem.id === gemId) : undefined;
  }

  relinkGems() {
    const firstChain = this.socketSetups[0];
    const levels: Record<string, number> = { lmp: 0, enhance: 0, chainLightning: 0, splitShot: 0, spiritFire: 0 };
    for (const slot of firstChain?.slots.slice(1) ?? []) {
      const gem = slot.gemId ? this.ownedGems.find((item) => item.id === slot.gemId) : undefined;
      if (gem && gem.defId in levels) levels[gem.defId] = gem.level;
    }
    this.player.lmpLevel = levels.lmp;
    this.player.enhanceLevel = levels.enhance;
    this.player.chainLightningLevel = levels.chainLightning;
    this.player.splitShotLevel = levels.splitShot;
    this.player.spiritFireLevel = levels.spiritFire;
  }

  setSocket(chainIndex: number, slotIndex: number, gemId: string | null) {
    const chain = this.socketSetups[chainIndex];
    if (!chain || slotIndex <= 0 || slotIndex >= chain.slots.length) return;
    const gem = gemId ? this.ownedGems.find((item) => item.id === gemId) : undefined;
    if (gemId && (!gem || this.isRangerActiveSkill(gem.defId))) return;
    for (const setup of this.socketSetups) for (const slot of setup.slots) if (slot.gemId === gemId) slot.gemId = null;
    chain.slots[slotIndex].gemId = gemId;
    this.relinkGems();
    this.onStatsUpdate(this.getStats());
  }

  acquireGem(defId: string) {
    const def = GEM_DEFS[defId];
    const existing = this.ownedGems.filter((gem) => gem.defId === defId && !gem.defId.startsWith('active-'));
    if (existing.length > 0 && !this.isRangerActiveSkill(defId)) {
      const highest = existing.reduce((a, b) => a.level >= b.level ? a : b);
      this.gemChoiceData = { defId, name: def?.name ?? defId, color: def?.color ?? '#22d3ee', currentLevel: highest.level, maxLevel: def?.maxLevel ?? 3 };
      this.state = 'gemChoice';
      this.onStateChange('gemChoice');
      this.onGemChoice(this.gemChoiceData);
      return;
    }
    this.addNewGem(defId);
    this.relinkGems();
    this.onStatsUpdate(this.getStats());
  }

  addNewGem(defId: string) {
    const gem: OwnedGem = { id: `${defId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, defId, level: 1 };
    this.ownedGems.push(gem);
    if (this.isRangerActiveSkill(defId)) {
      this.socketSetups.push({ slots: [{ gemId: gem.id }, { gemId: null }, { gemId: null }] });
      this.skillFireTimers.push(0);
    } else {
      const empty = this.socketSetups.find((setup) => setup.slots.slice(1).some((slot) => slot.gemId === null));
      const emptySlot = empty?.slots.findIndex((slot, index) => index > 0 && slot.gemId === null) ?? -1;
      if (empty && emptySlot >= 0) empty.slots[emptySlot].gemId = gem.id;
    }
  }

  levelUpHighestGem(defId: string) {
    const existing = this.ownedGems.filter((gem) => gem.defId === defId);
    if (existing.length === 0) return;
    const highest = existing.reduce((a, b) => a.level >= b.level ? a : b);
    highest.level = Math.min(GEM_DEFS[defId]?.maxLevel ?? 3, highest.level + 1);
  }

  resolveGemChoice(action: 'levelUp' | 'new') {
    if (!this.gemChoiceData) return;
    const defId = this.gemChoiceData.defId;
    this.gemChoiceData = null;
    if (action === 'levelUp') {
      this.levelUpHighestGem(defId);
    } else {
      this.addNewGem(defId);
    }
    this.relinkGems();
    this.onStatsUpdate(this.getStats());
    this.state = 'playing';
    this.onStateChange('playing');
    this.lastTime = performance.now();
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
    this.updateAilments(dt);
    this.updateCausticGrounds(dt);
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
    this.enemies = this.enemies.filter((enemy) => !enemy.dead);
    this.updateWaves(dt);

    if (this.classDef.id === 'ranger') {
      this.socketSetups.forEach((_, chainIndex) => {
        this.skillFireTimers[chainIndex] = (this.skillFireTimers[chainIndex] ?? 0) + dt;
        if (this.skillFireTimers[chainIndex] >= 1 / this.getChainFireRate(chainIndex)) {
          this.skillFireTimers[chainIndex] = 0;
          this.fireSkill(chainIndex);
        }
      });
    } else {
      this.fireTimer += dt;
      if (this.fireTimer >= 1 / this.player.fireRate) {
        this.fireTimer = 0;
        this.fire();
      }
    }

    if (this.socketSetups.some((setup, index) => this.getChainSupportLevel(index, 'spiritFire') > 0)) {
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

    const halfVisW = this.width / (2 * ISO_W);
    const halfVisH = this.height / (2 * ISO_H);
    const maxCamOffset = (halfVisW + halfVisH) / 2;
    const camMin = -MAP_HALF + maxCamOffset;
    const camMax = MAP_HALF - maxCamOffset;
    if (camMin < camMax) {
      this.camera.x = Math.max(camMin, Math.min(camMax, this.player.pos.x));
      this.camera.y = Math.max(camMin, Math.min(camMax, this.player.pos.y));
    } else {
      this.camera.x = 0; this.camera.y = 0;
    }
    this.emitHud();
  }

  updateWaves(dt: number) {
    this.enemySpawnTimer += dt;
    const wave = this.currentWave;
    const densityStep = Math.floor(this.gameTime / 30);
    const spawnInterval = Math.max(0.38, 1.5 * Math.pow(0.85, densityStep));
    if (this.enemySpawnTimer >= spawnInterval && this.enemies.length < MAX_ENEMIES) {
      this.enemySpawnTimer = 0;
      const packSize = Math.min(12, 3 + Math.floor(Math.random() * 3) + densityStep);
      const available = MAX_ENEMIES - this.enemies.length;
      const packAngle = Math.random() * Math.PI * 2;
      const packDistance = Math.max(700, Math.max(this.width, this.height) * 0.8) + Math.random() * 240;
      const packCenter = { x: this.player.pos.x + Math.cos(packAngle) * packDistance, y: this.player.pos.y + Math.sin(packAngle) * packDistance };
      for (let i = 0; i < Math.min(packSize, available); i++) {
        this.spawnEnemy(wave >= 2 ? 'mix' : 'normal', packCenter);
      }
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
      const ms = this.moveSpeed; p.vel.x = wx * ms; p.vel.y = wy * ms;
    } else if (this.useMouse) {
      const wm = this.screenToWorld(this.mouse);
      const ddx = wm.x - p.pos.x, ddy = wm.y - p.pos.y;
      const dist = Math.hypot(ddx, ddy);
      if (dist > 5) { const ms = this.moveSpeed; p.vel.x = (ddx / dist) * ms; p.vel.y = (ddy / dist) * ms; }
      else { p.vel.x = 0; p.vel.y = 0; }
    } else { p.vel.x = 0; p.vel.y = 0; }
    p.pos.x += p.vel.x * dt; p.pos.y += p.vel.y * dt;
    p.pos.x = Math.max(-MAP_HALF + p.radius, Math.min(MAP_HALF - p.radius, p.pos.x));
    p.pos.y = Math.max(-MAP_HALF + p.radius, Math.min(MAP_HALF - p.radius, p.pos.y));
  }

  updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead || !this.isEnemyNearPlayer(e, 120)) continue;
      if (e.knockback.x !== 0 || e.knockback.y !== 0) {
        e.pos.x += e.knockback.x * dt;
        e.pos.y += e.knockback.y * dt;
        e.pos.x = Math.max(-MAP_HALF + e.radius, Math.min(MAP_HALF - e.radius, e.pos.x));
        e.pos.y = Math.max(-MAP_HALF + e.radius, Math.min(MAP_HALF - e.radius, e.pos.y));
        e.knockback.x *= 0.85; e.knockback.y *= 0.85;
        if (Math.abs(e.knockback.x) < 1) e.knockback.x = 0;
        if (Math.abs(e.knockback.y) < 1) e.knockback.y = 0;
      }
      if (e.stunTimer > 0) { e.stunTimer -= dt; continue; }
      const dx = p.pos.x - e.pos.x, dy = p.pos.y - e.pos.y;
      const dist = Math.hypot(dx, dy) || 1;
      const chillMultiplier = (e.chillTimer ?? 0) > 0 ? (1 - (e.chillAmount ?? 0.5)) : 1;
      e.vel.x = (dx / dist) * e.speed * chillMultiplier; e.vel.y = (dy / dist) * e.speed * chillMultiplier;
      e.pos.x += e.vel.x * dt; e.pos.y += e.vel.y * dt;
      e.pos.x = Math.max(-MAP_HALF + e.radius, Math.min(MAP_HALF - e.radius, e.pos.x));
      e.pos.y = Math.max(-MAP_HALF + e.radius, Math.min(MAP_HALF - e.radius, e.pos.y));
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  updateAilments(dt: number) {
    for (const e of this.enemies) {
      if (e.igniteTimer && e.igniteTimer > 0) {
        e.igniteTimer -= dt;
        e.igniteTick = (e.igniteTick ?? 1) - dt;
        if ((e.igniteTick ?? 0) <= 0) {
          e.igniteTick = 1;
          this.damageEnemy(e, e.igniteDamage ?? this.player.damage * 0.25, '#fb923c');
        }
      }
      if (e.chillTimer && e.chillTimer > 0) e.chillTimer -= dt;
      if (e.shockTimer && e.shockTimer > 0) e.shockTimer -= dt;
      if (e.poisonDecayTimer && e.poisonDecayTimer > 0) {
        e.poisonDecayTimer -= dt;
        if (e.poisonDecayTimer <= 0) e.poisonStacks = 0;
      }
    }
  }

  updateCausticGrounds(dt: number) {
    for (const ground of this.causticGrounds) {
      ground.life -= dt;
      ground.tickTimer -= dt;
      for (const [enemy, cooldown] of ground.hitCooldown) {
        const next = cooldown - dt;
        if (enemy.dead || next <= 0) ground.hitCooldown.delete(enemy);
        else ground.hitCooldown.set(enemy, next);
      }
      if (ground.tickTimer <= 0) {
        ground.tickTimer = 0.2;
        for (const enemy of this.enemies) {
          if (enemy.dead || ground.hitCooldown.has(enemy) || !this.isEnemyNearPlayer(enemy, ground.radius)) continue;
          if (Math.hypot(enemy.pos.x - ground.pos.x, enemy.pos.y - ground.pos.y) <= ground.radius + enemy.radius) {
            this.damageEnemy(enemy, this.player.damage * 0.22, '#84cc16');
            ground.hitCooldown.set(enemy, 0.2);
          }
        }
      }
    }
    this.causticGrounds = this.causticGrounds.filter((ground) => ground.life > 0);
  }

  updateProjectiles(dt: number) {
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      if (pr.kind === 'burningArrow' || pr.kind === 'causticArrow' || pr.kind === 'iceShot') {
        const trailColor = pr.kind === 'burningArrow' ? '#f97316' : pr.kind === 'causticArrow' ? '#84cc16' : '#38bdf8';
        this.particles.push({ pos: { x: pr.pos.x, y: pr.pos.y }, vel: { x: 0, y: 0 }, life: 0.18, maxLife: 0.18, color: trailColor, size: pr.kind === 'causticArrow' ? 5 : 3 });
      }
      pr.pos.x += pr.vel.x * dt; pr.pos.y += pr.vel.y * dt;
      pr.lifetime -= dt;
      if (pr.lifetime <= 0) {
        pr.dead = true;
        if (pr.kind === 'fireball') this.createExplosion(pr.pos, pr.explosionRadius, pr.damage);
        if (pr.kind === 'causticArrow') this.spawnCausticGround(pr.pos);
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
        if (e.dead || !this.isEnemyNearPlayer(e, 120)) continue;
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
        if (e.dead || sw.hitEnemies.has(e) || !this.isEnemyNearPlayer(e, sw.maxRange)) continue;
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
        if (e.dead || ex.hitEnemies.has(e) || !this.isEnemyNearPlayer(e, ex.radius)) continue;
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

  igniteEnemy(enemy: Enemy, damage: number) {
    enemy.igniteTimer = 4;
    enemy.igniteDamage = damage * 0.3;
    enemy.igniteTick = 1;
    this.spawnPickupLabel(enemy.pos, '點燃', '#fb923c');
  }

  chillEnemy(enemy: Enemy, amount = 0.5) {
    enemy.chillTimer = 2;
    enemy.chillAmount = amount;
    this.spawnParticles(enemy.pos, '#bae6fd', 5);
  }

  shockEnemy(enemy: Enemy) {
    enemy.shockTimer = 2;
    this.spawnParticles(enemy.pos, '#facc15', 6);
    this.spawnPickupLabel(enemy.pos, '感電', '#facc15');
  }

  spawnCausticGround(pos: Vec2) {
    this.causticGrounds.push({ pos: { x: pos.x, y: pos.y }, radius: 60, life: 2, maxLife: 2, tickTimer: 0, hitCooldown: new Map<Enemy, number>() });
    this.spawnParticles(pos, '#84cc16', 16);
  }

  applyIceBurst(enemy: Enemy, projectile: Projectile) {
    const angle = Math.atan2(projectile.vel.y, projectile.vel.x) + Math.PI;
    this.coneEffects.push({ pos: { x: enemy.pos.x, y: enemy.pos.y }, angle, spread: Math.PI * (40 / 180), range: 120, life: 0.35, maxLife: 0.35, color: '#38bdf8' });
    for (const target of this.enemies) {
      if (target.dead) continue;
      const dx = target.pos.x - enemy.pos.x, dy = target.pos.y - enemy.pos.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= 120 && Math.abs(this.angleDiff(Math.atan2(dy, dx), angle)) <= Math.PI * (40 / 180)) {
        this.damageEnemy(target, projectile.damage * 0.65, '#7dd3fc');
        this.chillEnemy(target);
      }
    }
  }

  handleCollisions() {
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      for (const e of this.enemies) {
        if (e.dead || pr.hitEnemies.has(e) || !this.isEnemyNearPlayer(e, 160)) continue;
        if (Math.hypot(pr.pos.x - e.pos.x, pr.pos.y - e.pos.y) < pr.radius + e.radius) {
          pr.hitEnemies.add(e);
          if (pr.kind === 'fireball') {
            this.createExplosion(pr.pos, pr.explosionRadius, pr.damage);
            if (pr.chainRemaining > 0) this.chainLightning(e, pr.damage * 0.7, pr.chainRemaining, pr.hitEnemies);
            pr.dead = true;
          } else if (pr.kind === 'arrow') {
            this.damageEnemy(e, pr.damage);
            if (pr.chainRemaining > 0) this.chainLightning(e, pr.damage * 0.7, pr.chainRemaining, pr.hitEnemies);
          } else if (pr.kind === 'burningArrow') {
            this.damageEnemy(e, pr.damage, '#fb923c');
            if (Math.random() < 0.25) this.igniteEnemy(e, pr.damage);
            if (pr.chainRemaining > 0) this.chainLightning(e, pr.damage * 0.7, pr.chainRemaining, pr.hitEnemies);
            pr.dead = true;
          } else if (pr.kind === 'causticArrow') {
            this.damageEnemy(e, pr.damage, '#84cc16');
            this.spawnCausticGround(pr.pos);
            if (pr.chainRemaining > 0) this.chainLightning(e, pr.damage * 0.7, pr.chainRemaining, pr.hitEnemies);
            pr.dead = true;
          } else if (pr.kind === 'iceShot') {
            this.damageEnemy(e, pr.damage, '#7dd3fc');
            this.chillEnemy(e);
            this.applyIceBurst(e, pr);
            if (pr.chainRemaining > 0) this.chainLightning(e, pr.damage * 0.7, pr.chainRemaining, pr.hitEnemies);
            pr.dead = true;
          } else {
            this.damageEnemy(e, pr.damage);
            this.applyKnockback(e, pr);
            if (pr.chainRemaining > 0) this.chainLightning(e, pr.damage * 0.7, pr.chainRemaining, pr.hitEnemies);
            pr.dead = true;
          }
          if (pr.kind === 'arrow') continue;
          break;
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

  damageEnemy(e: Enemy, damage: number, color = '#f87171') {
    e.hp -= damage;
    this.spawnDamageNumber(e.pos, Math.round(damage), color);
    this.spawnParticles(e.pos, color, 4);
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
    // Higher gem level = less damage decay
    const decayReduction = (this.player.chainLightningLevel - 1) * 0.15;
    const decay = Math.max(0.3, 0.7 - decayReduction);
    this.damageEnemy(nearest, damage * decay);
    this.spawnLightning(source.pos, nearest.pos);
    if (remaining > 1) this.chainLightning(nearest, damage * decay, remaining - 1, hitSet);
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

  spawnEnemy(mix: 'normal' | 'mix' = 'normal', packCenter?: Vec2) {
    const a = packCenter ? Math.random() * Math.PI * 2 : Math.random() * Math.PI * 2;
    const d = packCenter ? Math.random() * 80 : 600 + Math.random() * 200;
    const thp = Math.floor(this.gameTime / 10) * 10;
    let sx = packCenter ? packCenter.x + Math.cos(a) * d : this.player.pos.x + Math.cos(a) * d;
    let sy = packCenter ? packCenter.y + Math.sin(a) * d : this.player.pos.y + Math.sin(a) * d;
    sx = Math.max(-MAP_HALF + 50, Math.min(MAP_HALF - 50, sx));
    sy = Math.max(-MAP_HALF + 50, Math.min(MAP_HALF - 50, sy));
    if (mix === 'mix' && Math.random() < 0.4) {
      this.enemies.push({
        pos: { x: sx, y: sy },
        vel: { x: 0, y: 0 }, radius: 10, hp: 8, maxHp: 8, dead: false,
        speed: 220 + Math.random() * 60, color: '#facc15', spawnTime: this.gameTime,
        kind: 'charger', knockback: { x: 0, y: 0 }, stunTimer: 0,
      });
    } else {
      const hp = 20 + thp;
      this.enemies.push({
        pos: { x: sx, y: sy },
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
      let sx = this.player.pos.x + Math.cos(a) * dist;
      let sy = this.player.pos.y + Math.sin(a) * dist;
      sx = Math.max(-MAP_HALF + 30, Math.min(MAP_HALF - 30, sx));
      sy = Math.max(-MAP_HALF + 30, Math.min(MAP_HALF - 30, sy));
      this.enemies.push({
        pos: { x: sx, y: sy },
        vel: { x: 0, y: 0 }, radius: 12, hp, maxHp: hp, dead: false,
        speed: 100, color: '#a855f7', spawnTime: this.gameTime,
        kind: 'surround', knockback: { x: 0, y: 0 }, stunTimer: 0,
      });
    }
  }

  spawnBoss() {
    const a = Math.random() * Math.PI * 2, d = 500, hp = 2000;
    let sx = this.player.pos.x + Math.cos(a) * d;
    let sy = this.player.pos.y + Math.sin(a) * d;
    sx = Math.max(-MAP_HALF + 60, Math.min(MAP_HALF - 60, sx));
    sy = Math.max(-MAP_HALF + 60, Math.min(MAP_HALF - 60, sy));
    this.enemies.push({
      pos: { x: sx, y: sy },
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

  fireSkill(chainIndex: number) {
    const activeDefId = this.ownedGems.find((gem) => gem.id === this.socketSetups[chainIndex]?.slots[0]?.gemId)?.defId ?? 'active-ranger';
    if (activeDefId === 'burningArrow') this.fireBurningArrow(chainIndex);
    else if (activeDefId === 'causticArrow') this.fireCausticArrow(chainIndex);
    else if (activeDefId === 'iceShot') this.fireIceShot(chainIndex);
    else this.fireGalvanicArrow(chainIndex);
  }

  fire() {
    switch (this.classDef.id) {
      case 'witch': this.fireFireball(); break;
      case 'ranger': this.fireSkill(0); break;
      case 'marauder': this.fireGroundSlam(); break;
    }
  }

  fireFireball() {
    const p = this.player;
    const nearest = this.findNearestEnemy();
    if (!nearest) return;
    const angle = Math.atan2(nearest.pos.y - p.pos.y, nearest.pos.x - p.pos.x);
    // LMP: lv1 = +2 proj, lv2 = +2, lv3 = +3
    const lmpExtra = p.lmpLevel === 0 ? 0 : p.lmpLevel >= 3 ? p.lmpLevel * 2 + 1 : p.lmpLevel * 2;
    const fireballCount = 1 + lmpExtra;
    for (let i = 0; i < fireballCount; i++) {
      const off = fireballCount > 1 ? (i / (fireballCount - 1) - 0.5) * 0.2 : 0;
      const a = angle + off;
      this.projectiles.push({
        pos: { x: p.pos.x, y: p.pos.y },
        vel: { x: Math.cos(a) * p.projectileSpeed, y: Math.sin(a) * p.projectileSpeed },
        radius: 10, hp: 1, maxHp: 1, dead: false,
        damage: p.damage, lifetime: p.targetRange / p.projectileSpeed,
        color: '#ff6b35', chainRemaining: p.chainLightningLevel > 0 ? 1 + p.chainLightningLevel : 0,
        hitEnemies: new Set<Enemy>(), kind: 'fireball', explosionRadius: 40,
      });
    }
  }

  fireElementalArrow(kind: 'burningArrow' | 'causticArrow' | 'iceShot', chainIndex = 0) {
    const p = this.player;
    const nearest = this.findNearestEnemy();
    if (!nearest) return;
    const baseAngle = Math.atan2(nearest.pos.y - p.pos.y, nearest.pos.x - p.pos.x);
    const lmpLevel = this.getChainSupportLevel(chainIndex, 'lmp');
    const lmpExtra = lmpLevel === 0 ? 0 : lmpLevel >= 3 ? lmpLevel * 2 + 1 : lmpLevel * 2;
    const arrowCount = 1 + lmpExtra;
    const spread = kind === 'iceShot' ? 0.1 : 0.06;
    const color = kind === 'burningArrow' ? '#f97316' : kind === 'causticArrow' ? '#84cc16' : '#38bdf8';
    for (let i = 0; i < arrowCount; i++) {
      const angle = baseAngle + (arrowCount > 1 ? (i / (arrowCount - 1) - 0.5) * spread * 2 : 0);
      this.projectiles.push({
        pos: { x: p.pos.x, y: p.pos.y }, vel: { x: Math.cos(angle) * this.getChainProjectileSpeed(chainIndex), y: Math.sin(angle) * this.getChainProjectileSpeed(chainIndex) },
        radius: 5, hp: 1, maxHp: 1, dead: false, damage: this.getChainDamage(chainIndex),
        lifetime: p.targetRange / this.getChainProjectileSpeed(chainIndex), color,
        chainRemaining: this.getChainSupportLevel(chainIndex, 'chainLightning') > 0 ? 1 + this.getChainSupportLevel(chainIndex, 'chainLightning') : 0,
        hitEnemies: new Set<Enemy>(), kind, explosionRadius: 0,
      });
    }
  }

  fireBurningArrow(chainIndex = 0) { this.fireElementalArrow('burningArrow', chainIndex); }
  fireCausticArrow(chainIndex = 0) { this.fireElementalArrow('causticArrow', chainIndex); }
  fireIceShot(chainIndex = 0) { this.fireElementalArrow('iceShot', chainIndex); }

  fireGalvanicArrow(chainIndex = 0) {
    const p = this.player;
    const nearest = this.findNearestEnemy();
    if (!nearest) return;
    const baseAngle = Math.atan2(nearest.pos.y - p.pos.y, nearest.pos.x - p.pos.x);
    // LMP and Split Shot are read from this skill chain only.
    const lmpLevel = this.getChainSupportLevel(chainIndex, 'lmp');
    const splitLevel = this.getChainSupportLevel(chainIndex, 'splitShot');
    const chainLevel = this.getChainSupportLevel(chainIndex, 'chainLightning');
    const lmpExtra = lmpLevel === 0 ? 0 : lmpLevel >= 3 ? lmpLevel * 2 + 1 : lmpLevel * 2;
    const splitExtra = splitLevel * 2;
    const arrowCount = 3 + splitExtra + lmpExtra;
    const spread = 0.12;
    for (let i = 0; i < arrowCount; i++) {
      const off = arrowCount > 1 ? (i / (arrowCount - 1) - 0.5) * spread * 2 : 0;
      const angle = baseAngle + off;
      this.projectiles.push({
        pos: { x: p.pos.x, y: p.pos.y },
        vel: { x: Math.cos(angle) * this.getChainProjectileSpeed(chainIndex), y: Math.sin(angle) * this.getChainProjectileSpeed(chainIndex) },
        radius: 4, hp: 1, maxHp: 1, dead: false,
        damage: this.getChainDamage(chainIndex), lifetime: 1.5,
        color: '#22d3ee', chainRemaining: chainLevel > 0 ? 1 + chainLevel : 0,
        hitEnemies: new Set<Enemy>(), kind: 'arrow', explosionRadius: 0,
      });
    }
    const halfCone = Math.PI / 6 + lmpLevel * (Math.PI / 12);
    this.coneEffects.push({
      pos: { x: p.pos.x, y: p.pos.y }, angle: baseAngle, spread: halfCone,
      range: 120 + lmpLevel * 40, life: 0.25, maxLife: 0.25, color: '#22d3ee',
    });
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.pos.x - p.pos.x, dy = e.pos.y - p.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 120 + lmpLevel * 40) continue;
      const angle = Math.atan2(dy, dx);
      if (Math.abs(this.angleDiff(angle, baseAngle)) < halfCone) {
        this.damageEnemy(e, this.getChainDamage(chainIndex));
      }
    }
  }

  fireGroundSlam() {
    const p = this.player;
    const nearest = this.findNearestEnemy();
    if (!nearest) return;
    const baseAngle = Math.atan2(nearest.pos.y - p.pos.y, nearest.pos.x - p.pos.x);
    const slamCount = 1 + this.getChainSupportLevel(0, 'lmp');
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
      const defId = item.name === '多重投射支援' ? 'lmp' : 'enhance';
      this.acquireGem(defId);
      this.spawnParticles(item.pos, '#22d3ee', 10);
      this.spawnPickupLabel(item.pos, `${item.name} +1`, '#22d3ee');
    } else if (item.kind === 'currency') {
      if (item.name === '混沌石') { this.player.chaosOrbs++; this.spawnPickupLabel(item.pos, '+1 混沌石', '#92400e'); }
      else { this.player.exaltedOrbs++; this.spawnPickupLabel(item.pos, '+1 崇高石', '#fbbf24'); }
      this.spawnParticles(item.pos, '#fbbf24', 8);
    } else if (item.kind === 'equipment') {
      const bonus = Math.random();
      if (bonus < 0.4) { this.player.maxHp += 20; this.player.hp += 20; this.spawnPickupLabel(item.pos, `${item.name} (HP+20)`, item.labelColor); }
      else if (bonus < 0.7) { this.player.speed = Math.min(this.player.speed * 1.02, MOVE_SPEED_CAP); this.spawnPickupLabel(item.pos, `${item.name} (速度+2%)`, item.labelColor); }
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

  spawnDamageNumber(pos: Vec2, value: number, color = '#fbbf24') {
    this.damageNumbers.push({
      pos: { x: pos.x, y: pos.y - 10 }, vel: { x: (Math.random() - 0.5) * 20, y: -60 },
      value, life: 0.8, maxLife: 0.8, color,
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
    if (opt.isGemUpgrade) {
      const defId = opt.id.split('_')[0];
      if (defId in GEM_DEFS) this.acquireGem(defId);
      else opt.apply(this.player);
    } else opt.apply(this.player);
    this.state = 'playing';
    this.onStateChange('playing');
    this.lastTime = performance.now();
  }

  rollUpgrades(): UpgradeOption[] {
    const p = this.player;
    const GEM_MAX = 3;
    const results: UpgradeOption[] = [];

    // --- Gem upgrade candidates (dynamic, based on owned gems) ---
    const gemUpgrades: UpgradeOption[] = [];

    if (p.lmpLevel > 0 && p.lmpLevel < GEM_MAX) {
      const lv = p.lmpLevel;
      const next = lv + 1;
      const dmgBonus = [0, 0.20, 0.35, 0.50][next] ?? 0.50;
      const spdBonus = [0, 0.10, 0.15, 0.20][next] ?? 0.20;
      const extraProj = next >= 3 ? 1 : 0;
      const details: string[] = [];
      details.push(`投射物傷害 +${Math.round(dmgBonus * 100)}%`);
      details.push(`投射物速度 +${Math.round(spdBonus * 100)}%`);
      if (extraProj > 0) details.push(`投射物數量 +${extraProj}`);
      gemUpgrades.push({
        id: `lmp_lv${next}`, name: '多重投射支援', color: '#22d3ee',
        isGemUpgrade: true, gemLevel: lv, gemMaxLevel: GEM_MAX, detailLines: details,
        description: `Lv.${lv} → Lv.${next}`,
        apply: (pl) => {
          pl.lmpLevel = next;
          pl.damage *= 1 + dmgBonus;
          pl.projectileSpeed *= 1 + spdBonus;
        },
      });
    }

    if (p.enhanceLevel > 0 && p.enhanceLevel < GEM_MAX) {
      const lv = p.enhanceLevel;
      const next = lv + 1;
      const speedBonus = [0, 0.10, 0.15, 0.20][next] ?? 0.20;
      const details: string[] = [];
      details.push(`攻擊/施法速度 +${Math.round(speedBonus * 100)}%`);
      details.push(`冷卻時間進一步縮短`);
      gemUpgrades.push({
        id: `enhance_lv${next}`, name: '增幅支援', color: '#a78bfa',
        isGemUpgrade: true, gemLevel: lv, gemMaxLevel: GEM_MAX, detailLines: details,
        description: `Lv.${lv} → Lv.${next}`,
        apply: (pl) => {
          pl.enhanceLevel = next;
          pl.fireRate *= 1 + speedBonus;
        },
      });
    }

    if (p.chainLightningLevel > 0 && p.chainLightningLevel < GEM_MAX) {
      const lv = p.chainLightningLevel;
      const next = lv + 1;
      const chains = next + 1;
      const dmgPct = next * 15;
      const details: string[] = [];
      details.push(`連鎖次數提升至 ${chains}`);
      details.push(`連鎖傷害衰減減少 ${dmgPct}%`);
      gemUpgrades.push({
        id: `chain_lv${next}`, name: '連鎖閃電', color: '#67e8f9',
        isGemUpgrade: true, gemLevel: lv, gemMaxLevel: GEM_MAX, detailLines: details,
        description: `Lv.${lv} → Lv.${next}`,
        apply: (pl) => { pl.chainLightningLevel = next; },
      });
    }

    if (p.splitShotLevel > 0 && p.splitShotLevel < GEM_MAX) {
      const lv = p.splitShotLevel;
      const next = lv + 1;
      const extra = next * 2;
      const dmgPct = next * 10;
      const details: string[] = [];
      details.push(`額外投射物 +${extra}`);
      details.push(`投射物傷害 +${dmgPct}%`);
      gemUpgrades.push({
        id: `split_lv${next}`, name: '分裂箭', color: '#84cc16',
        isGemUpgrade: true, gemLevel: lv, gemMaxLevel: GEM_MAX, detailLines: details,
        description: `Lv.${lv} → Lv.${next}`,
        apply: (pl) => {
          pl.splitShotLevel = next;
          pl.damage *= 1 + dmgPct / 100;
        },
      });
    }

    if (p.spiritFireLevel > 0 && p.spiritFireLevel < GEM_MAX) {
      const lv = p.spiritFireLevel;
      const next = lv + 1;
      const dmgPct = next * 25;
      const extraFlames = next >= 2 ? 1 : 0;
      const details: string[] = [];
      details.push(`火焰傷害 +${dmgPct}%`);
      if (extraFlames > 0) details.push(`額外召喚 ${extraFlames} 朵冥界之火`);
      gemUpgrades.push({
        id: `spirit_lv${next}`, name: '冥界之火', color: '#a855f7',
        isGemUpgrade: true, gemLevel: lv, gemMaxLevel: GEM_MAX, detailLines: details,
        description: `Lv.${lv} → Lv.${next}`,
        apply: (pl) => { pl.spiritFireLevel = next; },
      });
    }

    // --- New gem discovery (only if not already owned) ---
    const newGemUpgrades: UpgradeOption[] = [];
    if (p.lmpLevel === 0) {
      newGemUpgrades.push({
        id: 'lmp_new', name: '多重投射支援', color: '#22d3ee',
        isGemUpgrade: true, gemLevel: 0, gemMaxLevel: GEM_MAX,
        detailLines: ['投射物數量 +2', '初次拾取'],
        description: '新輔助寶石',
        apply: (pl) => { pl.lmpLevel = 1; },
      });
    }
    if (p.enhanceLevel === 0) {
      newGemUpgrades.push({
        id: 'enhance_new', name: '增幅支援', color: '#a78bfa',
        isGemUpgrade: true, gemLevel: 0, gemMaxLevel: GEM_MAX,
        detailLines: ['攻擊速度 +40%', '初次拾取'],
        description: '新輔助寶石',
        apply: (pl) => {
          pl.enhanceLevel = 1;
          pl.fireRate *= 1.4;
        },
      });
    }
    if (p.chainLightningLevel === 0) {
      newGemUpgrades.push({
        id: 'chain_new', name: '連鎖閃電', color: '#67e8f9',
        isGemUpgrade: true, gemLevel: 0, gemMaxLevel: GEM_MAX,
        detailLines: ['命中後彈射至 2 個敵人', '初次拾取'],
        description: '新輔助寶石',
        apply: (pl) => { pl.chainLightningLevel = 1; },
      });
    }
    if (p.splitShotLevel === 0) {
      newGemUpgrades.push({
        id: 'split_new', name: '分裂箭', color: '#84cc16',
        isGemUpgrade: true, gemLevel: 0, gemMaxLevel: GEM_MAX,
        detailLines: ['額外投射物 +2', '初次拾取'],
        description: '新輔助寶石',
        apply: (pl) => { pl.splitShotLevel = 1; },
      });
    }
    if (p.spiritFireLevel === 0) {
      newGemUpgrades.push({
        id: 'spirit_new', name: '冥界之火', color: '#a855f7',
        isGemUpgrade: true, gemLevel: 0, gemMaxLevel: GEM_MAX,
        detailLines: ['每 5 秒召喚環繞火焰', '初次拾取'],
        description: '新輔助寶石',
        apply: (pl) => { pl.spiritFireLevel = 1; },
      });
    }

    if (this.classDef.id === 'ranger' && this.socketSetups.length < 3) {
      const rangerSkills: Array<{ id: string; name: string; color: string; details: string[] }> = [
        { id: 'burningArrow', name: '燃燒箭矢', color: '#f97316', details: ['火焰箭矢', '25% 機率點燃 4 秒'] },
        { id: 'causticArrow', name: '腐蝕箭矢', color: '#84cc16', details: ['半徑 60 腐蝕地面', '持續 2 秒混沌傷害'] },
        { id: 'iceShot', name: '冰霜射擊', color: '#38bdf8', details: ['後方 80° 冰霜爆發', '冰緩 50%，持續 2 秒'] },
      ];
      for (const skill of rangerSkills) {
        if (this.getGem(skill.id)) continue;
        newGemUpgrades.push({
          id: `${skill.id}_new`, name: skill.name, color: skill.color,
          isGemUpgrade: true, gemLevel: 0, gemMaxLevel: 1,
          detailLines: [...skill.details, '解鎖新的主動技能鏈'], description: '新主動技能',
          apply: () => {},
        });
      }
    }

    // --- Global baseline stat pool (option C candidates) ---
    const globalPool: UpgradeOption[] = [
      { id: 'firerate', name: '攻速提升', description: '攻擊速度 +25%', color: '#f59e0b', apply: (pl) => { pl.fireRate *= 1.25; } },
      { id: 'speed', name: '移速提升', description: '移動速度 +5%', color: '#38bdf8', apply: (pl) => { pl.speed = Math.min(pl.speed * 1.05, MOVE_SPEED_CAP); } },
      { id: 'damage', name: '傷害提升', description: '攻擊傷害 +50%', color: '#f87171', apply: (pl) => { pl.damage *= 1.5; } },
      { id: 'heal', name: '恢復生命', description: '恢復 40 點生命', color: '#22c55e', apply: (pl) => { pl.hp = Math.min(pl.maxHp, pl.hp + 40); } },
      { id: 'maxhp', name: '最大生命', description: '最大生命 +30 並恢復', color: '#34d399', apply: (pl) => { pl.maxHp += 30; pl.hp = pl.maxHp; } },
      { id: 'maxhp_pct', name: '生命強化', description: '最大生命 +20% 並恢復', color: '#34d399', apply: (pl) => { pl.maxHp = Math.round(pl.maxHp * 1.2); pl.hp = pl.maxHp; } },
      { id: 'speed_pct', name: '迅捷', description: '移動速度 +3%', color: '#38bdf8', apply: (pl) => { pl.speed = Math.min(pl.speed * 1.03, MOVE_SPEED_CAP); } },
    ];

    // --- Build the 3 choices ---
    // Slot A & B: prioritize existing gem upgrades (60%), then new gems (25%), then global stats (15%)
    const priorityPool: UpgradeOption[] = [];
    if (gemUpgrades.length > 0) {
      // Weight existing gem upgrades heavily — add each twice
      for (const gu of gemUpgrades) { priorityPool.push(gu); priorityPool.push(gu); }
    }
    for (const ng of newGemUpgrades) { priorityPool.push(ng); }
    // Add some global stat options to A/B pool too
    for (const gp of globalPool) { priorityPool.push(gp); }

    const chosen: UpgradeOption[] = [];
    const used = new Set<string>();

    // Try to fill A and B from priority pool
    const shuffled = [...priorityPool].sort(() => Math.random() - 0.5);
    for (const opt of shuffled) {
      if (chosen.length >= 2) break;
      if (used.has(opt.id)) continue;
      used.add(opt.id);
      chosen.push(opt);
    }

    // If we couldn't fill A/B from priority, fill from global
    while (chosen.length < 2) {
      const gp = globalPool[Math.floor(Math.random() * globalPool.length)];
      if (!used.has(gp.id)) { used.add(gp.id); chosen.push(gp); }
    }

    // Slot C: guaranteed global baseline stat
    const cPool = globalPool.filter((g) => !used.has(g.id));
    if (cPool.length > 0) {
      chosen.push(cPool[Math.floor(Math.random() * cPool.length)]);
    } else {
      // Fallback: any global stat
      chosen.push(globalPool[Math.floor(Math.random() * globalPool.length)]);
    }

    return chosen.slice(0, 3);
  }

  getStats(): StatsData {
    const p = this.player;
    const toInfo = (gem: OwnedGem | null, socketedSlot: number | null): OwnedGemInfo | null => {
      if (!gem) return null;
      const def = GEM_DEFS[gem.defId];
      const isClassActive = gem.defId.startsWith('active-');
      return {
        gemId: gem.id, defId: gem.defId,
        name: isClassActive ? this.classDef.skillName : (def?.name ?? gem.defId),
        level: gem.level, maxLevel: def?.maxLevel ?? 1,
        color: isClassActive ? this.classDef.color : (def?.color ?? '#d6d3d1'),
        kind: def?.kind ?? 'skill', description: isClassActive ? '職業主動技能' : (def?.description ?? '技能寶石'), socketedSlot,
      };
    };
    const skillChains: SocketSlotInfo[][] = this.socketSetups.map((setup) => setup.slots.map((slot, index) => ({
      index,
      gem: toInfo(slot.gemId ? this.ownedGems.find((gem) => gem.id === slot.gemId) ?? null : null, index),
      isSkillSlot: index === 0,
    })));
    const ownedGems = this.ownedGems.filter((gem) => !this.isRangerActiveSkill(gem.defId) && !gem.defId.startsWith('active-')).map((gem) => {
      const chainIndex = this.socketSetups.findIndex((setup) => setup.slots.some((slot) => slot.gemId === gem.id));
      const slotIndex = chainIndex >= 0 ? this.socketSetups[chainIndex].slots.findIndex((slot) => slot.gemId === gem.id) : -1;
      return toInfo(gem, slotIndex >= 0 ? slotIndex : null)!;
    });
    return {
      className: this.classDef.name, classSubtitle: this.classDef.subtitle,
      level: this.level, time: this.gameTime, maxHp: p.maxHp, speed: Math.round(this.moveSpeed), speedAtCap: this.speedAtCap,
      fireRate: p.fireRate.toFixed(2), projectileSpeed: Math.round(p.projectileSpeed),
      targetRange: Math.round(p.targetRange), damage: Math.round(p.damage),
      chaosOrbs: p.chaosOrbs, exaltedOrbs: p.exaltedOrbs,
      lmpLevel: p.lmpLevel, enhanceLevel: p.enhanceLevel,
      chainLevel: p.chainLightningLevel, splitLevel: p.splitShotLevel, spiritLevel: p.spiritFireLevel,
      skillChains, ownedGems, skills: skillChains.flatMap((chain) => chain.filter((slot) => slot.gem).map((slot) => ({ name: slot.gem!.name, level: slot.gem!.level }))),
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
    this.drawMapBoundary();

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

    for (const ground of this.causticGrounds) {
      const s = this.worldToScreen(ground.pos);
      const alpha = Math.min(0.7, ground.life / ground.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#65a30d'; ctx.shadowColor = '#84cc16'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, ground.radius * ISO_W, ground.radius * ISO_H, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#bef264'; ctx.lineWidth = 2; ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = alpha * 0.65;
      for (let i = 0; i < 5; i++) {
        const bubble = this.worldToScreen({ x: ground.pos.x + Math.cos(this.gameTime * 2 + i) * ground.radius * 0.6, y: ground.pos.y + Math.sin(this.gameTime * 2 + i) * ground.radius * 0.6 });
        ctx.fillStyle = '#d9f99d'; ctx.beginPath(); ctx.arc(bubble.x, bubble.y - 8, 3 + (i % 2), 0, Math.PI * 2); ctx.fill();
      }
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

      if (!d.isPlayer) {
        const enemy = this.enemies.find((item) => item.pos === d.pos);
        if (enemy?.chillTimer && enemy.chillTimer > 0) {
          ctx.strokeStyle = '#bae6fd'; ctx.lineWidth = 2; ctx.globalAlpha = 0.65;
          ctx.beginPath(); ctx.ellipse(s.x, s.y, d.radius * ISO_W + 5, d.radius * ISO_H + 5, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (enemy?.igniteTimer && enemy.igniteTimer > 0) {
          ctx.fillStyle = '#fb923c'; ctx.shadowColor = '#f97316'; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.moveTo(s.x - 8, s.y - drawSize - 4); ctx.quadraticCurveTo(s.x - 2, s.y - drawSize - 22, s.x + 1, s.y - drawSize - 7); ctx.quadraticCurveTo(s.x + 8, s.y - drawSize - 22, s.x + 9, s.y - drawSize - 3); ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

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
      const length = pr.kind === 'burningArrow' ? 28 : pr.kind === 'causticArrow' ? 22 : pr.kind === 'iceShot' ? 24 : 14;
      const speed = Math.hypot(pr.vel.x, pr.vel.y) || 1;
      const tail = this.worldToScreen({ x: pr.pos.x - (pr.vel.x / speed) * length, y: pr.pos.y - (pr.vel.y / speed) * length });
      ctx.strokeStyle = pr.color; ctx.lineWidth = pr.kind === 'causticArrow' ? 5 : 3; ctx.globalAlpha = 0.8; ctx.shadowColor = pr.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(tail.x, tail.y - 15); ctx.lineTo(s.x, s.y - 15); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = pr.color;
      ctx.beginPath(); ctx.ellipse(s.x, s.y - 15, pr.radius + 1, pr.radius * 0.7, 0, 0, Math.PI * 2); ctx.fill();
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

    // Minimap (top-right corner, fixed on screen)
    this.drawMinimap();
  }

  drawMapBoundary() {
    const ctx = this.ctx;
    const corners = [
      { x: -MAP_HALF, y: -MAP_HALF },
      { x: MAP_HALF, y: -MAP_HALF },
      { x: MAP_HALF, y: MAP_HALF },
      { x: -MAP_HALF, y: MAP_HALF },
    ];
    const screenCorners = corners.map((c) => this.worldToScreen(c));

    // Draw 4 half-transparent quads outside each edge to create a "void" effect
    // without using evenodd fill (which can cover the screen on some setups)
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const expand = 3000;
    for (let i = 0; i < 4; i++) {
      const a = screenCorners[i];
      const b = screenCorners[(i + 1) % 4];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const dir = (mx - this.width / 2) * nx + (my - this.height / 2) * ny;
      const sign = dir >= 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x + nx * sign * expand, b.y + ny * sign * expand);
      ctx.lineTo(a.x + nx * sign * expand, a.y + ny * sign * expand);
      ctx.closePath();
      ctx.fill();
    }

    // Draw gothic wall on each edge
    const wallThickness = 8;
    for (let i = 0; i < 4; i++) {
      const a = screenCorners[i];
      const b = screenCorners[(i + 1) % 4];

      // Outer thick wall line
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = wallThickness;
      ctx.shadowColor = 'rgba(120,53,15,0.6)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner thin gold highlight
      ctx.strokeStyle = 'rgba(251,191,36,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Corner ornaments (gothic diamond gems at each corner)
    for (const c of screenCorners) {
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      const ds = 8;
      ctx.moveTo(c.x, c.y - ds);
      ctx.lineTo(c.x + ds, c.y);
      ctx.lineTo(c.x, c.y + ds);
      ctx.lineTo(c.x - ds, c.y);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, ds + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Mid-edge tick marks
    for (let i = 0; i < 4; i++) {
      const a = screenCorners[i];
      const b = screenCorners[(i + 1) % 4];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(120,53,15,0.3)';
      ctx.shadowBlur = 4;
      const tick = 12;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      ctx.beginPath();
      ctx.moveTo(mx - nx * tick, my - ny * tick);
      ctx.lineTo(mx + nx * tick, my + ny * tick);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  drawMinimap() {
    const ctx = this.ctx;
    const size = 150;
    const margin = 20;
    const mx = this.width - size - margin - 6;
    const my = margin + 6;

    // Background: semi-transparent black
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(mx, my, size, size);

    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, size, size);
    ctx.clip();

    // World-to-minimap helper (full map, not radar)
    const toMini = (wx: number, wy: number) => ({
      x: mx + ((wx + MAP_HALF) / MAP_SIZE) * size,
      y: my + ((wy + MAP_HALF) / MAP_SIZE) * size,
    });

    // Draw subtle grid
    ctx.strokeStyle = 'rgba(180,120,60,0.1)';
    ctx.lineWidth = 1;
    const gridSteps = 4;
    for (let i = 1; i < gridSteps; i++) {
      const gx = mx + (size / gridSteps) * i;
      const gy = my + (size / gridSteps) * i;
      ctx.beginPath(); ctx.moveTo(gx, my); ctx.lineTo(gx, my + size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, gy); ctx.lineTo(mx + size, gy); ctx.stroke();
    }

    // Map boundary outline on minimap
    ctx.strokeStyle = 'rgba(146,64,14,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + 1, my + 1, size - 2, size - 2);

    // Enemy dots (red) — all enemies on the full map
    for (const e of this.enemies) {
      if (e.dead) continue;
      const m = toMini(e.pos.x, e.pos.y);
      ctx.fillStyle = e.kind === 'boss' ? '#fbbf24' : '#ef4444';
      ctx.shadowColor = e.kind === 'boss' ? '#fbbf24' : '#ef4444';
      ctx.shadowBlur = 3;
      const dotSize = e.kind === 'boss' ? 3 : 1.5;
      ctx.beginPath();
      ctx.arc(m.x, m.y, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Chest dots (gold)
    for (const c of this.chests) {
      if (c.opened) continue;
      const m = toMini(c.pos.x, c.pos.y);
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Player dot (green)
    const pm = toMini(this.player.pos.x, this.player.pos.y);
    ctx.fillStyle = '#22c55e';
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(pm.x, pm.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Player direction indicator
    if (this.player.vel.x !== 0 || this.player.vel.y !== 0) {
      const ang = Math.atan2(this.player.vel.y, this.player.vel.x);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pm.x, pm.y);
      ctx.lineTo(pm.x + Math.cos(ang) * 8, pm.y + Math.sin(ang) * 8);
      ctx.stroke();
    }

    ctx.restore();

    // Minimap outer border (dark gold, gothic style)
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(120,53,15,0.5)';
    ctx.shadowBlur = 8;
    ctx.strokeRect(mx, my, size, size);
    ctx.shadowBlur = 0;

    // Inner thin highlight
    ctx.strokeStyle = 'rgba(251,191,36,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + 1, my + 1, size - 2, size - 2);

    // Corner brackets
    const cs = 10;
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(mx, my + cs); ctx.lineTo(mx, my); ctx.lineTo(mx + cs, my); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx + size - cs, my); ctx.lineTo(mx + size, my); ctx.lineTo(mx + size, my + cs); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx, my + size - cs); ctx.lineTo(mx, my + size); ctx.lineTo(mx + cs, my + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx + size - cs, my + size); ctx.lineTo(mx + size, my + size); ctx.lineTo(mx + size, my + size - cs); ctx.stroke();

    // Label
    ctx.fillStyle = 'rgba(251,191,36,0.6)';
    ctx.font = 'bold 9px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('MAP', mx + size / 2, my - 4);
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
        if (wx < -MAP_HALF || wx > MAP_HALF || wy < -MAP_HALF || wy > MAP_HALF) continue;
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
