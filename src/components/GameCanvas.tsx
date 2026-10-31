import { useEffect, useRef, useState } from 'react';
import { Game } from '@/game/engine';
import type { UpgradeOption, ClassDef, StatsData, GemChoiceData } from '@/game/types';
import { CLASSES } from '@/game/types';

interface HudData {
  level: number; xp: number; xpToLevel: number; kills: number; time: number;
  hp: number; maxHp: number; mana: number; maxMana: number; wave: number;
  chaosOrbs: number; exaltedOrbs: number;
}

type Screen = 'menu' | 'classSelect' | 'game';

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [screen, setScreen] = useState<Screen>('menu');
  const [selectedClass, setSelectedClass] = useState<ClassDef | null>(null);
  const [hud, setHud] = useState<HudData>({
    level: 1, xp: 0, xpToLevel: 5, kills: 0, time: 0,
    hp: 100, maxHp: 100, mana: 50, maxMana: 50, wave: 1,
    chaosOrbs: 0, exaltedOrbs: 0,
  });
  const [choices, setChoices] = useState<UpgradeOption[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [dead, setDead] = useState(false);
  const [paused, setPaused] = useState(false);
  const [bossAlert, setBossAlert] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [hoveredGem, setHoveredGem] = useState<string | null>(null);
  const [gemChoice, setGemChoice] = useState<GemChoiceData | null>(null);

  const wireGame = (game: Game) => {
    game.onHudUpdate = (data) => setHud(data);
    game.onUpgradeChoices = (c) => setChoices(c);
    game.onStateChange = (s) => {
      setShowMenu(s === 'leveling');
      setPaused(s === 'paused');
    };
    game.onDeath = () => setDead(true);
    game.onBossSpawn = () => {
      setBossAlert(true);
      setTimeout(() => setBossAlert(false), 3000);
    };
    game.onStatsUpdate = (s) => setStats(s);
    game.onGemChoice = (data) => setGemChoice(data);
  };

  const startGame = (classDef: ClassDef) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    gameRef.current?.stop();
    setSelectedClass(classDef);
    setDead(false); setShowMenu(false); setPaused(false); setBossAlert(false);
    setHud({
      level: 1, xp: 0, xpToLevel: 5, kills: 0, time: 0,
      hp: classDef.hp, maxHp: classDef.hp,
      mana: classDef.mana, maxMana: classDef.mana, wave: 1,
      chaosOrbs: 0, exaltedOrbs: 0,
    });
    const game = new Game(canvas, classDef);
    gameRef.current = game;
    wireGame(game);
    game.start();
    setScreen('game');
  };

  useEffect(() => {
    const onResize = () => gameRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      gameRef.current?.stop();
    };
  }, []);

  const handleChoose = (opt: UpgradeOption) => {
    gameRef.current?.chooseUpgrade(opt);
    setShowMenu(false);
  };

  const resumeGame = () => gameRef.current?.togglePause();

  const moveGemToSocket = (chainIndex: number, slotIndex: number, gemId: string) => {
    gameRef.current?.setSocket(chainIndex, slotIndex, gemId);
  };

  const restart = () => { if (selectedClass) startGame(selectedClass); };

  const backToMenu = () => {
    gameRef.current?.stop();
    gameRef.current = null;
    setDead(false); setShowMenu(false); setPaused(false); setGemChoice(null);
    setScreen('menu');
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const hpPct = Math.max(0, (hud.hp / hud.maxHp) * 100);
  const manaPct = Math.max(0, (hud.mana / hud.maxMana) * 100);
  const xpPct = (hud.xp / hud.xpToLevel) * 100;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0a0a] select-none">
      <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair" />

      {/* MAIN MENU */}
      {screen === 'menu' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-[#120a0a] to-black" />
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(139,0,0,0.15), transparent 60%)' }} />
          <div className="relative z-10 flex flex-col items-center gap-10">
            <div className="flex flex-col items-center gap-2">
              <p className="text-amber-700/80 tracking-[0.5em] text-sm font-medium uppercase">A Dark Fantasy Survival</p>
              <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-300 via-amber-500 to-amber-800 tracking-wider drop-shadow-[0_4px_20px_rgba(180,83,9,0.4)]"
                style={{ fontFamily: 'Georgia, serif' }}>
                群益倖存者
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="h-px w-24 bg-gradient-to-r from-transparent to-amber-700/60" />
                <span className="text-amber-600/60 text-xs tracking-[0.3em] uppercase">Survive the Horde</span>
                <span className="h-px w-24 bg-gradient-to-l from-transparent to-amber-700/60" />
              </div>
            </div>
            <button
              onClick={() => setScreen('classSelect')}
              className="group relative px-16 py-4 text-2xl font-bold tracking-widest text-amber-200 border-2 border-amber-700/50 bg-gradient-to-b from-[#1a0e0e] to-[#0a0505] hover:from-[#2a1515] hover:to-[#150808] transition-all duration-300 hover:scale-105 hover:border-amber-500 hover:text-amber-300 hover:shadow-[0_0_30px_rgba(180,83,9,0.3)]"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              <span className="relative z-10">開始遊戲</span>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-700/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </button>
            <div className="flex gap-2 mt-4">
              {CLASSES.map((c) => (
                <div key={c.id} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.color, boxShadow: `0 0 8px ${c.color}` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CLASS SELECTION */}
      {screen === 'classSelect' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0a12] to-black" />
          <div className="relative z-10 flex flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-1">
              <h2 className="text-5xl font-bold text-amber-400/90 tracking-wider" style={{ fontFamily: 'Georgia, serif' }}>
                選擇你的職業
              </h2>
              <p className="text-amber-700/70 text-sm tracking-[0.2em] uppercase">Choose Your Class</p>
            </div>
            <div className="flex gap-6">
              {CLASSES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => startGame(c)}
                  className="group relative w-64 h-80 bg-gradient-to-b from-[#181018] to-[#0a0508] rounded-lg border-2 border-stone-800 hover:border-amber-600/60 transition-all duration-300 hover:scale-105 hover:-translate-y-1 flex flex-col items-center justify-between p-6 shadow-2xl overflow-hidden"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `radial-gradient(circle at 50% 30%, ${c.color}22, transparent 70%)` }} />
                  <div className="relative z-10 flex flex-col items-center gap-3 w-full">
                    <div className="w-20 h-20 rounded-md flex items-center justify-center text-4xl font-black text-white/90 transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: c.color, boxShadow: `0 0 30px ${c.color}66, inset 0 0 12px rgba(0,0,0,0.4)` }}>
                      {c.name.charAt(0)}
                    </div>
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-amber-200" style={{ fontFamily: 'Georgia, serif' }}>{c.name}</h3>
                      <p className="text-stone-500 text-xs tracking-[0.2em] uppercase mt-0.5">{c.subtitle}</p>
                      <p className="text-amber-600/70 text-xs mt-1 font-semibold">{c.skillName}</p>
                    </div>
                  </div>
                  <div className="relative z-10 flex flex-col gap-2 w-full">
                    <p className="text-stone-400 text-xs text-center leading-relaxed min-h-[3rem]">{c.description}</p>
                    <div className="flex flex-col gap-1 text-xs mt-1">
                      <Stat label="生命" value={c.hp} max={180} color="#991b1b" />
                      <Stat label="移速" value={c.speed} max={400} color="#166534" />
                      <Stat label="攻速" value={c.fireRate} max={2} color="#a16207" />
                      <Stat label="射程" value={c.targetRange} max={900} color="#6b21a8" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setScreen('menu')}
              className="text-stone-500 hover:text-amber-600 text-sm tracking-widest uppercase transition-colors mt-2">
              ← 返回主選單
            </button>
          </div>
        </div>
      )}

      {/* IN-GAME HUD */}
      {screen === 'game' && (
        <>
          <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
            <div className="mx-auto max-w-2xl pt-3 px-4">
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-amber-500 font-bold text-sm" style={{ fontFamily: 'Georgia, serif' }}>Lv {hud.level}</span>
                <span className="text-stone-500 text-xs font-mono">{formatTime(hud.time)}</span>
                <span className="text-red-500/70 text-xs font-semibold">{hud.kills} 擊殺</span>
                <span className="text-amber-700/70 text-xs font-semibold ml-auto">第 {hud.wave} 波</span>
                <span className="text-amber-600/80 text-xs font-mono">混沌x{hud.chaosOrbs}</span>
                <span className="text-amber-400/80 text-xs font-mono">崇高x{hud.exaltedOrbs}</span>
              </div>
              <div className="relative w-full h-2.5 bg-[#1a1010]/90 rounded-full overflow-hidden border border-amber-900/40 shadow-lg">
                <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-200 rounded-full"
                  style={{ width: `${xpPct}%`, boxShadow: '0 0 8px rgba(245,158,11,0.5)' }} />
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <div className="bg-[#1a1010]/70 backdrop-blur px-4 py-2 rounded-full border border-amber-900/30 text-stone-500 text-xs flex gap-4">
              <span><b className="text-amber-500">WASD</b> 鍵盤移動</span>
              <span><b className="text-amber-500">滑鼠</b> 跟隨移動</span>
              <span><b className="text-amber-500">ESC</b> 暫停查看屬性</span>
            </div>
          </div>

          {/* HP Globe */}
          <div className="absolute bottom-6 left-6 z-10 pointer-events-none">
            <div className="relative w-28 h-28">
              <div className="absolute inset-0 rounded-full border-2 border-amber-900/50 shadow-2xl overflow-hidden bg-[#1a0a0a]"
                style={{ boxShadow: '0 0 20px rgba(127,29,29,0.3), inset 0 0 20px rgba(0,0,0,0.6)' }}>
                <div className="absolute bottom-0 left-0 right-0 transition-all duration-300"
                  style={{ height: `${hpPct}%`, background: 'linear-gradient(to top, #7f1d1d, #dc2626, #ef4444)', boxShadow: '0 -2px 8px rgba(239,68,68,0.4)' }}>
                  <div className="absolute top-0 left-0 right-0 h-1 bg-red-300/40" style={{ borderRadius: '50%' }} />
                </div>
                <div className="absolute inset-0 rounded-full" style={{ boxShadow: 'inset 6px 6px 16px rgba(255,255,255,0.1)' }} />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-red-200 font-bold text-lg drop-shadow-lg" style={{ fontFamily: 'Georgia, serif' }}>{hud.hp}</span>
                <span className="text-red-400/50 text-xs font-mono">{hud.maxHp}</span>
              </div>
            </div>
          </div>

          {/* Mana Globe */}
          <div className="absolute bottom-6 right-6 z-10 pointer-events-none">
            <div className="relative w-28 h-28">
              <div className="absolute inset-0 rounded-full border-2 border-blue-900/50 shadow-2xl overflow-hidden bg-[#0a0a1a]"
                style={{ boxShadow: '0 0 20px rgba(30,58,138,0.3), inset 0 0 20px rgba(0,0,0,0.6)' }}>
                <div className="absolute bottom-0 left-0 right-0 transition-all duration-300"
                  style={{ height: `${manaPct}%`, background: 'linear-gradient(to top, #1e3a8a, #2563eb, #3b82f6)', boxShadow: '0 -2px 8px rgba(59,130,246,0.4)' }}>
                  <div className="absolute top-0 left-0 right-0 h-1 bg-blue-300/40" style={{ borderRadius: '50%' }} />
                </div>
                <div className="absolute inset-0 rounded-full" style={{ boxShadow: 'inset 6px 6px 16px rgba(255,255,255,0.1)' }} />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-blue-200 font-bold text-lg drop-shadow-lg" style={{ fontFamily: 'Georgia, serif' }}>{hud.mana}</span>
                <span className="text-blue-400/50 text-xs font-mono">{hud.maxMana}</span>
              </div>
            </div>
          </div>

          {/* Boss alert */}
          {bossAlert && (
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div className="text-center animate-in fade-in zoom-in duration-500">
                <p className="text-red-600 text-xl tracking-[0.4em] uppercase mb-2" style={{ fontFamily: 'Georgia, serif' }}>⚠ 警告 ⚠</p>
                <h2 className="text-5xl font-black text-red-500 drop-shadow-[0_4px_20px_rgba(239,68,68,0.6)]" style={{ fontFamily: 'Georgia, serif' }}>BOSS 來襲</h2>
              </div>
            </div>
          )}
        </>
      )}

      {/* UPGRADE MENU */}
      {showMenu && !dead && screen === 'game' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <h2 className="text-4xl font-bold text-amber-400 drop-shadow-lg" style={{ fontFamily: 'Georgia, serif' }}>升級</h2>
              <span className="h-px w-40 bg-gradient-to-r from-transparent via-amber-700 to-transparent" />
              <p className="text-stone-400 text-lg">選擇一項強化</p>
            </div>
            <div className="flex gap-4">
              {choices.map((opt) => (
                <button key={opt.id} onClick={() => handleChoose(opt)}
                  className="group relative w-56 h-72 bg-gradient-to-b from-[#1a1018] to-[#0a0508] rounded-lg border-2 border-stone-800 hover:border-amber-600 transition-all duration-200 hover:scale-105 hover:-translate-y-1 flex flex-col items-center justify-between gap-2 p-6 shadow-2xl overflow-hidden">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `radial-gradient(circle at 50% 40%, ${opt.color}22, transparent 70%)` }} />
                  <div className="relative z-10 flex flex-col items-center gap-2 w-full">
                    <div className="w-14 h-14 rounded-lg flex items-center justify-center text-2xl font-bold text-white/90"
                      style={{ backgroundColor: opt.color, boxShadow: `0 0 24px ${opt.color}55` }}>
                      {opt.name.charAt(0)}
                    </div>
                    <h3 className="text-lg font-bold text-amber-200 text-center" style={{ fontFamily: 'Georgia, serif' }}>{opt.name}</h3>
                    {opt.isGemUpgrade ? (
                      <div className="flex flex-col items-center gap-0.5 w-full">
                        <span className="text-cyan-400 text-xs font-semibold tracking-wider">
                          {opt.description === '新輔助寶石' ? '新輔助寶石' : `寶石升級 ${opt.description}`}
                        </span>
                        {opt.gemLevel !== undefined && opt.gemMaxLevel !== undefined && opt.description !== '新輔助寶石' && (
                          <div className="flex gap-0.5">
                            {Array.from({ length: opt.gemMaxLevel }, (_, i) => (
                              <span key={i} className={`w-2 h-2 rounded-sm ${i < (opt.gemLevel ?? 0) ? 'bg-cyan-400' : 'bg-stone-700'}`} />
                            ))}
                            <span className="text-stone-600 text-[10px] ml-1">→</span>
                            {Array.from({ length: opt.gemMaxLevel }, (_, i) => (
                              <span key={i} className={`w-2 h-2 rounded-sm ${i < ((opt.gemLevel ?? 0) + 1) ? 'bg-cyan-300' : 'bg-stone-700'}`} />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-amber-600/60 text-xs tracking-wider">基礎屬性</span>
                    )}
                  </div>
                  <div className="relative z-10 flex flex-col gap-1 w-full">
                    {opt.isGemUpgrade && opt.detailLines ? (
                      opt.detailLines.map((line, i) => (
                        <p key={i} className="text-cyan-300/80 text-xs text-center leading-relaxed">{line}</p>
                      ))
                    ) : (
                      <p className="text-stone-400 text-sm text-center">{opt.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GEM CHOICE OVERLAY */}
      {gemChoice && !dead && screen === 'game' && (
        <div className="absolute inset-0 z-25 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-gradient-to-b from-[#1a1208] to-[#0a0805] rounded-xl border-2 border-amber-800/60 shadow-2xl p-6"
            style={{ boxShadow: '0 0 40px rgba(120,53,15,0.4), inset 0 0 20px rgba(0,0,0,0.5)' }}>
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-amber-600/60 rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-amber-600/60 rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-amber-600/60 rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-amber-600/60 rounded-br-xl" />

            <h2 className="text-2xl font-bold text-amber-400 text-center mb-1" style={{ fontFamily: 'Georgia, serif' }}>重複寶石</h2>
            <div className="flex items-center justify-center gap-2 mb-5">
              <span className="h-px w-16 bg-gradient-to-r from-transparent to-amber-700" />
              <span className="text-amber-700/70 text-xs tracking-[0.2em] uppercase">Forge or Claim</span>
              <span className="h-px w-16 bg-gradient-to-l from-transparent to-amber-700" />
            </div>

            <div className="flex items-center justify-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold text-white/90"
                style={{ backgroundColor: gemChoice.color, boxShadow: `0 0 20px ${gemChoice.color}55` }}>
                {gemChoice.name.charAt(0)}
              </div>
              <div className="text-center">
                <p className="text-amber-200 font-bold text-sm" style={{ fontFamily: 'Georgia, serif' }}>{gemChoice.name}</p>
                <p className="text-stone-500 text-xs">目前最高 Lv.{gemChoice.currentLevel} / {gemChoice.maxLevel}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button onClick={() => { gameRef.current?.resolveGemChoice('levelUp'); setGemChoice(null); }}
                className="group relative w-full px-5 py-4 bg-gradient-to-b from-[#2a1810] to-[#1a0e08] rounded-lg border-2 border-amber-700/50 hover:border-amber-500 hover:from-[#3a2018] hover:to-[#251208] transition-all duration-200 hover:scale-[1.02] shadow-lg overflow-hidden">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'radial-gradient(circle at 50% 40%, rgba(245,158,11,0.15), transparent 70%)' }} />
                <div className="relative z-10 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md flex items-center justify-center bg-amber-700/30 border border-amber-600/40">
                    <span className="text-amber-400 text-lg font-bold">+1</span>
                  </div>
                  <div className="text-left">
                    <p className="text-amber-300 font-bold text-sm" style={{ fontFamily: 'Georgia, serif' }}>熔煉：讓現有寶石等級 +1</p>
                    <p className="text-stone-500 text-xs">提升最高等級的那顆 {gemChoice.name}</p>
                  </div>
                </div>
              </button>

              <button onClick={() => { gameRef.current?.resolveGemChoice('new'); setGemChoice(null); }}
                className="group relative w-full px-5 py-4 bg-gradient-to-b from-[#101820] to-[#080a12] rounded-lg border-2 border-cyan-800/50 hover:border-cyan-600 hover:from-[#182028] hover:to-[#0a1218] transition-all duration-200 hover:scale-[1.02] shadow-lg overflow-hidden">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'radial-gradient(circle at 50% 40%, rgba(34,211,238,0.15), transparent 70%)' }} />
                <div className="relative z-10 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md flex items-center justify-center bg-cyan-800/30 border border-cyan-700/40">
                    <span className="text-cyan-400 text-lg font-bold">+1</span>
                  </div>
                  <div className="text-left">
                    <p className="text-cyan-300 font-bold text-sm" style={{ fontFamily: 'Georgia, serif' }}>獲得：多拿一顆全新 1 等寶石</p>
                    <p className="text-stone-500 text-xs">背包新增一顆 Lv.1 的 {gemChoice.name}，可自由連線</p>
                  </div>
                </div>
              </button>
            </div>
            <p className="text-stone-600 text-[10px] text-center mt-4">可拖曳新寶石到其他技能鏈的空白插槽，各鏈獨立計算效果</p>
          </div>
        </div>
      )}

      {/* PAUSE / SOCKETS PANEL */}
      {paused && !dead && screen === 'game' && stats && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-gradient-to-b from-[#1a1208] to-[#0a0805] rounded-xl border-2 border-amber-800/50 shadow-2xl p-5 sm:p-8"
            style={{ boxShadow: '0 0 40px rgba(120,53,15,0.3), inset 0 0 20px rgba(0,0,0,0.5)' }}>
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-amber-600/60 rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-amber-600/60 rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-amber-600/60 rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-amber-600/60 rounded-br-xl" />

            <h2 className="text-3xl font-bold text-amber-400 text-center mb-1" style={{ fontFamily: 'Georgia, serif' }}>角色狀態</h2>
            <div className="flex items-center justify-center gap-2 mb-5">
              <span className="h-px w-20 bg-gradient-to-r from-transparent to-amber-700" />
              <span className="text-amber-700/70 text-xs tracking-[0.2em] uppercase">Sockets &amp; Links</span>
              <span className="h-px w-20 bg-gradient-to-l from-transparent to-amber-700" />
            </div>

            <div className="mb-5 p-3 bg-[#0a0604] rounded-lg border border-amber-900/30 flex justify-between items-center">
              <div>
                <span className="text-stone-400 text-xs uppercase tracking-wider">職業</span>
                <p className="text-amber-200 font-bold text-lg" style={{ fontFamily: 'Georgia, serif' }}>{stats.className} <span className="text-stone-500 text-sm font-normal">{stats.classSubtitle}</span></p>
              </div>
              <div className="text-right"><span className="text-stone-400 text-xs uppercase tracking-wider">等級 / 時間</span><p className="text-amber-300 font-bold text-lg" style={{ fontFamily: 'Georgia, serif' }}>Lv {stats.level} <span className="text-stone-500 text-sm font-mono font-normal">{formatTime(stats.time)}</span></p></div>
            </div>

            <div className="mb-5">
              <p className="text-amber-700/80 text-xs uppercase tracking-wider mb-2">技能插槽與連線</p>
              <div className="space-y-3">
                {stats.skillChains.map((chain, chainIndex) => (
                  <div key={chainIndex} className="rounded-lg border border-amber-900/40 bg-[#080604] p-3">
                    <div className="flex items-center gap-3 overflow-x-auto">
                      <div className="w-24 shrink-0"><p className="text-stone-500 text-[10px] uppercase tracking-widest">技能鏈 {chainIndex + 1}</p><p className="text-amber-200 text-xs font-bold truncate">{chain[0]?.gem?.name ?? '主動技能'}</p></div>
                      <div className="flex items-center justify-center min-w-max">
                        {chain.map((slot, slotIndex) => (
                          <div key={slot.index} className="flex items-center">
                            {slotIndex > 0 && <div className="w-7 sm:w-12 h-2 rounded-full bg-gradient-to-r from-[#7c4a19] via-[#e4ad52] to-[#7c4a19] border-y border-[#f6d58b]/60 shadow-[0_0_8px_rgba(217,164,65,0.45)]" />}
                            <div draggable={slotIndex > 0 && !!slot.gem} onDragStart={(event) => { if (slot.gem && slotIndex > 0) event.dataTransfer.setData('text/gem-id', slot.gem.gemId); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const gemId = event.dataTransfer.getData('text/gem-id'); if (gemId) moveGemToSocket(chainIndex, slotIndex, gemId); }} onMouseEnter={() => setHoveredGem(slot.gem?.gemId ?? null)} onMouseLeave={() => setHoveredGem(null)} className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full border-[5px] border-[#f1eee5] bg-[radial-gradient(circle_at_35%_30%,#fffef5,#b9b6aa_45%,#514d43_68%,#15130f_72%)] shadow-[inset_0_0_0_2px_#77736a,0_0_12px_rgba(255,244,200,0.28)] flex items-center justify-center transition-transform hover:scale-105 cursor-pointer">
                              {slot.gem && <span className="text-[9px] sm:text-[10px] text-center font-bold text-stone-900 leading-tight px-1">{slot.gem.name}<br /><span className="text-[8px]">Lv.{slot.gem.level}</span></span>}
                              {slot.gem && hoveredGem === slot.gem.gemId && <div className="absolute z-50 bottom-full mb-3 left-1/2 -translate-x-1/2 w-48 rounded border border-cyan-400/70 bg-[#07141a] p-3 text-left shadow-lg pointer-events-none"><p className="text-cyan-300 text-xs font-bold">{slot.gem.name} Lv.{slot.gem.level}</p><p className="text-cyan-100/80 text-[11px] mt-1 leading-relaxed">{slot.gem.description}</p>{slotIndex === 0 && <p className="text-stone-400 text-[10px] mt-1">主動技能已鎖定</p>}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                <p className="text-stone-600 text-[10px] text-center">拖曳輔助寶石到任一技能鏈的白色插槽；每條鏈獨立計算支援效果</p>
              </div>
            </div>

            <div className="mb-5">
              <p className="text-amber-700/80 text-xs uppercase tracking-wider mb-2">可用寶石</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {stats.ownedGems.length === 0 && <p className="col-span-full text-stone-600 text-xs text-center py-3">尚未取得輔助寶石</p>}
                {stats.ownedGems.map((gem) => (
                  <div key={gem.gemId} draggable onDragStart={(event) => event.dataTransfer.setData('text/gem-id', gem.gemId)} onMouseEnter={() => setHoveredGem(gem.gemId)} onMouseLeave={() => setHoveredGem(null)} className="relative p-2 rounded border border-stone-700/60 bg-[#110d09] hover:border-cyan-400/70 cursor-grab transition-colors">
                    <p className="text-cyan-300 text-xs font-bold truncate">{gem.name}</p><p className="text-stone-500 text-[10px]">Lv.{gem.level}/{gem.maxLevel} {gem.socketedSlot !== null ? `· 插槽 ${gem.socketedSlot + 1}` : '· 未連線'}</p>
                    {hoveredGem === gem.gemId && <div className="absolute z-40 bottom-full mb-2 left-0 w-44 rounded border border-cyan-400/70 bg-[#07141a] p-2 text-cyan-100 text-[10px] shadow-lg pointer-events-none">{gem.description}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-5"><p className="text-amber-700/80 text-xs uppercase tracking-wider mb-2">核心屬性</p><div className="grid grid-cols-2 gap-2"><StatRow label="最大生命" value={stats.maxHp} /><StatRow label="移動速度" value={stats.speedAtCap ? `${stats.speed} (已達上限)` : stats.speed} /><StatRow label="攻擊速度" value={stats.fireRate + '/s'} /><StatRow label="傷害" value={stats.damage} /></div></div>

            <div className="flex gap-3"><button onClick={resumeGame} className="flex-1 px-6 py-3 bg-amber-700 hover:bg-amber-600 text-amber-50 font-bold rounded-lg transition-all hover:scale-105 shadow-lg border border-amber-500/30" style={{ fontFamily: 'Georgia, serif' }}>返回遊戲</button><button onClick={backToMenu} className="flex-1 px-6 py-3 bg-transparent hover:bg-[#1a0a0a] text-red-400 hover:text-red-300 font-bold rounded-lg transition-all border border-red-900/50 hover:border-red-700/50" style={{ fontFamily: 'Georgia, serif' }}>回到主選單</button></div>
          </div>
        </div>
      )}

      {/* DEATH SCREEN */}
      {dead && screen === 'game' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur">
          <div className="flex flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-1">
              <h2 className="text-6xl font-black text-red-700 drop-shadow-[0_4px_16px_rgba(127,29,29,0.5)] tracking-wider" style={{ fontFamily: 'Georgia, serif' }}>
                你已隕落
              </h2>
              <span className="h-px w-48 bg-gradient-to-r from-transparent via-red-800 to-transparent" />
            </div>
            <div className="flex gap-10 text-center">
              <div>
                <p className="text-stone-500 text-sm tracking-widest uppercase">存活時間</p>
                <p className="text-3xl font-bold text-amber-200" style={{ fontFamily: 'Georgia, serif' }}>{formatTime(hud.time)}</p>
              </div>
              <div>
                <p className="text-stone-500 text-sm tracking-widest uppercase">擊殺數</p>
                <p className="text-3xl font-bold text-amber-200" style={{ fontFamily: 'Georgia, serif' }}>{hud.kills}</p>
              </div>
              <div>
                <p className="text-stone-500 text-sm tracking-widest uppercase">等級</p>
                <p className="text-3xl font-bold text-amber-200" style={{ fontFamily: 'Georgia, serif' }}>{hud.level}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={restart}
                className="px-8 py-3 bg-amber-700 hover:bg-amber-600 text-amber-50 font-bold rounded-lg text-lg transition-all hover:scale-105 shadow-lg border border-amber-500/30"
                style={{ fontFamily: 'Georgia, serif' }}>再戰一回</button>
              <button onClick={backToMenu}
                className="px-8 py-3 bg-transparent hover:bg-stone-900 text-stone-400 hover:text-amber-500 font-bold rounded-lg text-lg transition-all border border-stone-700 hover:border-amber-700/50"
                style={{ fontFamily: 'Georgia, serif' }}>返回主選單</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center p-2 bg-[#0a0604] rounded border border-amber-900/20">
      <span className="text-stone-500 text-xs">{label}</span>
      <span className="text-amber-200 font-bold text-sm">{value}</span>
    </div>
  );
}

function Stat({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-stone-500 w-8 text-right">{label}</span>
      <div className="flex-1 h-1.5 bg-stone-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
