// Pixel art sprite generator - creates all game sprites as offscreen canvases
// Each sprite is defined as a string array where each character maps to a color

type Palette = Record<string, string>;

function createSprite(pixels: string[], palette: Palette, scale = 2): HTMLCanvasElement {
  const h = pixels.length;
  const w = pixels[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = pixels[y][x];
      const color = palette[c];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
  return canvas;
}

// Witch palette
const witchPal: Palette = {
  '.': '', 'H': '#2e1065', 'h': '#3b0764', 'P': '#7c3aed', 'p': '#5b21b6',
  'L': '#a78bfa', 'S': '#e9d5ff', 'E': '#fbbf24', 'B': '#1a1a2e', 'W': '#c4b5fd',
};

const witchSprite = [
  '......HHHH......',
  '.....HPPPPH.....',
  '....HPPPPPPH....',
  '...HPPPPPPPPH...',
  '...HPPPPPPPPH...',
  '....hSSSSSSh....',
  '....hSEESEES....',
  '.....SSSSSS.....',
  '...PPPPPPPPPP...',
  '..PLPPPPPPPPPL..',
  '..PPPPPPPPPPPP..',
  '..PPPPPPPPPPPP..',
  '...PPPPPPPPPP...',
  '....PPPPPPPP....',
  '....pp....pp....',
  '....BB....BB....',
];

// Ranger palette
const rangerPal: Palette = {
  '.': '', 'g': '#14532d', 'G': '#166534', 'F': '#22c55e', 'f': '#16a34a',
  'S': '#fef3c7', 'E': '#1e293b', 'B': '#78350f', 'b': '#451a03', 'Y': '#fbbf24',
  'A': '#86efac', 'D': '#365314',
};

const rangerSprite = [
  '.....ggggg......',
  '....ggGGGgg.....',
  '...gGGGGGGGg....',
  '..gGGSSSSSSGg...',
  '..gGSEESEESGg...',
  '...gSSSSSSGg....',
  '....SSSSSS......',
  '...FFGGGGFF.....',
  '..FFGGGGGGFF....',
  '..FfGGGGGGfF.Y.',
  '..FFGGGGGGFF.Y.',
  '..FfGGGGGGfF.Y.',
  '...FFGGGGFF.....',
  '...FF..FF.......',
  '...bb..bb.......',
  '...bb..bb.......',
];

// Marauder palette
const marauderPal: Palette = {
  '.': '', 'R': '#7f1d1d', 'r': '#991b1b', 'M': '#dc2626', 'S': '#fca5a5',
  'E': '#1e1b4b', 'B': '#451a03', 'A': '#78350f', 'a': '#92400e', 'G': '#fbbf24',
  'D': '#440606', 'H': '#fef3c7',
};

const marauderSprite = [
  '...RRRRRRRR.....',
  '..RrrrrrrrrR....',
  '.RrrrrrrrrrrR...',
  '.RrSSSSSSSSrR...',
  '.RrSEESSEESrR...',
  '..RSSSSSSSSR....',
  '...RSSSSSSR.....',
  '..AAAAAAAAa..GG',
  '.AArrAAAArrAA.GG',
  '.ArrAAAAAArrA.GG',
  '.AAAAAAAAAAAA...',
  '..AAAAAAAAAA....',
  '...AAAAAAA......',
  '...AA...AA......',
  '...BB...BB......',
  '...BB...BB......',
];

// Skeleton palette
const skelPal: Palette = {
  '.': '', 'W': '#e5e7eb', 'w': '#9ca3af', 'G': '#d1d5db', 'K': '#1f2937',
  'E': '#ef4444', 'B': '#374151', 'b': '#1f2937',
};

const skeletonSprite = [
  '......WWWW......',
  '....WWWWWWWW....',
  '...WWGGWWGGWW...',
  '..WWGWWWWGWWW...',
  '..WWKWWWKWWW....',
  '..WWEWWWEWW.....',
  '...WWWWWW.......',
  '...WWWWWW.......',
  '..WWWWWWWW......',
  '..WWWWWWWW......',
  '...WWWWWW.......',
  '...WW..WW.......',
  '...WW..WW.......',
  '...bb..bb.......',
  '...bb..bb.......',
  '....b...b.......',
];

// Charger palette (fast yellow enemy)
const chargerPal: Palette = {
  '.': '', 'Y': '#facc15', 'y': '#eab308', 'O': '#fde047', 'E': '#dc2626',
  'B': '#1a1a1a', 'R': '#fbbf24',
};

const chargerSprite = [
  '......yy........',
  '....yyYYyy......',
  '...yYYYYYYy.....',
  '..yYYOOOOYYy....',
  '..yYOEOEOOYy....',
  '...yOOOOOOy.....',
  '....yYYYYy......',
  '...YYyyyyYY.....',
  '..YYyyyyyYY.....',
  '..Yyyy..yyY.....',
  '..Yy....yy......',
  '...y....y.......',
  '...B....B.......',
  '...B....B.......',
  '....R..R........',
  '................',
];

// Surround enemy (purple)
const surroundPal: Palette = {
  '.': '', 'P': '#7c3aed', 'p': '#5b21b6', 'L': '#a855f7', 'E': '#fbbf24',
  'B': '#1a1a2e', 'D': '#3b0764',
};

const surroundSprite = [
  '....DDDDDD......',
  '...DPPPPPPD.....',
  '..DPPPPPPPPD....',
  '..DPEEPPEEPDD...',
  '..DPPPPPPPPD....',
  '...DPPPPPPD.....',
  '....DPPPPD......',
  '...PPPPPPPP.....',
  '..PPLPPPPPLP....',
  '..PPPPPPPPPP....',
  '...PPPPPPPP.....',
  '....PPPPPP......',
  '....pp..pp......',
  '....pp..pp......',
    '....BB..BB......',
  '.....B...B......',
];

// Boss palette (large dark red demon)
const bossPal: Palette = {
  '.': '', 'D': '#450a0a', 'R': '#7f1d1d', 'r': '#991b1b', 'M': '#dc2626',
  'E': '#fbbf24', 'F': '#ef4444', 'B': '#1a0505', 'G': '#fbbf24', 'K': '#0a0a0a',
  'H': '#fef3c7', 'O': '#fb923c',
};

const bossSprite = [
  '........DDDDDDDD........',
  '.......DRRRRRRRRD.......',
  '......DRRRRRRRRRRD......',
  '.....DRRrrrrrrrrRRD.....',
  '.....DRrSSSSSSSSrRD......',
  '....DRrSEEFFEESSrRD.....',
  '....DRrSEEFFEESSrRD.....',
  '....DRrSSSSSSSSSrRD.....',
  '...DRRRRSSSSSSSSRRRD....',
  '..DRRRRRRRRRRRRRRRRRD...',
  '.DRRMMRRRRRRRRRRMMRRRD..',
  '.DRRMMRRRRRRRRRRMMRRRD..',
  '..DRRRRRRRRRRRRRRRRRRD..',
  '..DRRRRRRRRRRRRRRRRRRD..',
  '...DRRRRRRRRRRRRRRRRD...',
  '....DRRRRRRRRRRRRRRD...',
  '....DRR..RRRRRR..RRD....',
  '...DRR...RRRRR...RRRD...',
  '...DRR...RRRRR...RRRD...',
  '...BBB...BBBBB...BBB....',
  '...BBB...BBBBB...BBB....',
  '...BBB....BBB...BBB.....',
  '....BB.....B....BB......',
  '....BB.....B....BB......',
  '.....B.....B.....B.......',
  '.....B.....B.....B......',
  '....RRR...RRR...RRR......',
  '...RRRRR.RRRRR.RRRRR....',
  '..RRRRRRRRRRRRRRRRRRR...',
  '.KKKKKKKKKKKKKKKKKKKKK..',
  '.KKKKKKKKKKKKKKKKKKKKK..',
  '...KKKKKKKKKKKKKKKKK....',
];

export interface SpriteSet {
  witch: HTMLCanvasElement;
  ranger: HTMLCanvasElement;
  marauder: HTMLCanvasElement;
  skeleton: HTMLCanvasElement;
  charger: HTMLCanvasElement;
  surround: HTMLCanvasElement;
  boss: HTMLCanvasElement;
}

let cachedSprites: SpriteSet | null = null;

export function getSprites(): SpriteSet {
  if (cachedSprites) return cachedSprites;
  cachedSprites = {
    witch: createSprite(witchSprite, witchPal, 3),
    ranger: createSprite(rangerSprite, rangerPal, 3),
    marauder: createSprite(marauderSprite, marauderPal, 3),
    skeleton: createSprite(skeletonSprite, skelPal, 3),
    charger: createSprite(chargerSprite, chargerPal, 3),
    surround: createSprite(surroundSprite, surroundPal, 3),
    boss: createSprite(bossSprite, bossPal, 2),
  };
  return cachedSprites;
}
