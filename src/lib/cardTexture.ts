import type { Ability, ChampionCard, SkinEdition } from '../types/cards';

export const CARD_TEXTURE_WIDTH = 768;
export const CARD_TEXTURE_HEIGHT = 1280;

export interface CardTextureCanvases {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
}

export class CardTextureError extends Error {
  readonly sourceUrl?: string;

  constructor(message: string, sourceUrl?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CardTextureError';
    this.sourceUrl = sourceUrl;
  }
}

const GOLD = '#d9bd78';
const PALE_GOLD = '#f5e8bd';
const INK = '#06101b';
const CYAN = '#64e6dd';

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_TEXTURE_WIDTH;
  canvas.height = CARD_TEXTURE_HEIGHT;
  return canvas;
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new CardTextureError('当前浏览器无法创建卡面画布。');
  }
  return context;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function loadCorsImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('图片加载已取消。', 'AbortError'));
      return;
    }

    const image = new Image();
    let settled = false;

    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      image.src = '';
      reject(new DOMException('图片加载已取消。', 'AbortError'));
    };

    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new CardTextureError('官方原画加载失败，无法生成卡面。', url));
    };
    signal?.addEventListener('abort', abort, { once: true });
    image.src = url;
  });
}

async function loadOptionalImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement | undefined> {
  try {
    return await loadCorsImage(url, signal);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return undefined;
  }
}

export function getCardArtworkCandidates(skin: SkinEdition): string[] {
  return Array.from(new Set([skin.splashUrl, skin.loadingUrl].filter(Boolean)));
}

async function loadCardArtwork(skin: SkinEdition, signal?: AbortSignal): Promise<HTMLImageElement> {
  const candidates = getCardArtworkCandidates(skin);
  let lastError: unknown;

  for (const url of candidates) {
    try {
      return await loadCorsImage(url, signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      lastError = error;
    }
  }

  throw new CardTextureError(
    '官方高清原画和竖版原画均加载失败，无法生成卡面。',
    candidates[0],
    { cause: lastError },
  );
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;

  if (imageRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function trackedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
): void {
  const glyphs = Array.from(text);
  const widths = glyphs.map((glyph) => context.measureText(glyph).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + spacing * Math.max(0, glyphs.length - 1);
  let cursor = x - total / 2;
  glyphs.forEach((glyph, index) => {
    const width = widths[index] ?? 0;
    context.fillText(glyph, cursor, y);
    cursor += width + spacing;
  });
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const characters = Array.from(text.replace(/\s+/g, ' ').trim());
  const lines: string[] = [];
  let line = '';

  for (const character of characters) {
    const candidate = line + character;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = character;
      if (lines.length === maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const consumed = lines.join('').length;
  if (consumed < characters.length && lines.length > 0) {
    const lastIndex = lines.length - 1;
    const lastLine = lines[lastIndex] ?? '';
    lines[lastIndex] = `${lastLine.slice(0, Math.max(0, lastLine.length - 1))}…`;
  }

  lines.forEach((value, index) => context.fillText(value, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function drawFrame(context: CanvasRenderingContext2D): void {
  context.save();
  roundedRect(context, 13, 13, CARD_TEXTURE_WIDTH - 26, CARD_TEXTURE_HEIGHT - 26, 42);
  context.lineWidth = 24;
  context.strokeStyle = '#172f3b';
  context.stroke();
  context.lineWidth = 7;
  context.strokeStyle = GOLD;
  context.stroke();
  roundedRect(context, 32, 32, CARD_TEXTURE_WIDTH - 64, CARD_TEXTURE_HEIGHT - 64, 28);
  context.lineWidth = 2;
  context.strokeStyle = 'rgba(245, 232, 189, .82)';
  context.stroke();

  for (const [x, y, rotation] of [
    [52, 52, 0],
    [CARD_TEXTURE_WIDTH - 52, 52, Math.PI / 2],
    [CARD_TEXTURE_WIDTH - 52, CARD_TEXTURE_HEIGHT - 52, Math.PI],
    [52, CARD_TEXTURE_HEIGHT - 52, -Math.PI / 2],
  ] as const) {
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.strokeStyle = PALE_GOLD;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, 25);
    context.lineTo(0, 0);
    context.lineTo(25, 0);
    context.moveTo(7, 18);
    context.lineTo(7, 7);
    context.lineTo(18, 7);
    context.stroke();
    context.restore();
  }
  context.restore();
}

function drawFront(
  canvas: HTMLCanvasElement,
  champion: ChampionCard,
  skin: SkinEdition,
  artwork: HTMLImageElement,
): void {
  const context = getContext(canvas);
  drawImageCover(context, artwork, 0, 0, canvas.width, canvas.height);

  const topShade = context.createLinearGradient(0, 0, 0, 300);
  topShade.addColorStop(0, 'rgba(2, 10, 18, .74)');
  topShade.addColorStop(1, 'rgba(2, 10, 18, 0)');
  context.fillStyle = topShade;
  context.fillRect(0, 0, canvas.width, 300);

  const bottomShade = context.createLinearGradient(0, 700, 0, canvas.height);
  bottomShade.addColorStop(0, 'rgba(2, 10, 18, 0)');
  bottomShade.addColorStop(.56, 'rgba(2, 10, 18, .76)');
  bottomShade.addColorStop(1, 'rgba(2, 10, 18, .98)');
  context.fillStyle = bottomShade;
  context.fillRect(0, 700, canvas.width, canvas.height - 700);

  context.textAlign = 'center';
  context.fillStyle = CYAN;
  context.font = '500 21px Inter, "PingFang SC", sans-serif';
  trackedText(context, 'THE RIFT ARCHIVE', canvas.width / 2, 92, 7);

  context.shadowColor = 'rgba(0, 0, 0, .86)';
  context.shadowBlur = 20;
  context.fillStyle = PALE_GOLD;
  context.font = '700 78px "Songti SC", "STSong", serif';
  context.fillText(champion.title, canvas.width / 2, 1045, 610);
  context.shadowBlur = 0;

  context.fillStyle = 'rgba(244, 234, 215, .88)';
  context.font = '400 30px "PingFang SC", sans-serif';
  trackedText(context, champion.name, canvas.width / 2, 1100, 5);

  context.strokeStyle = 'rgba(217, 189, 120, .56)';
  context.beginPath();
  context.moveTo(158, 1134);
  context.lineTo(610, 1134);
  context.stroke();
  context.fillStyle = '#f4ead7';
  context.font = '500 27px "PingFang SC", sans-serif';
  const skinName = skin.isBase ? '经典造型' : skin.name;
  context.fillText(skinName, canvas.width / 2, 1186, 610);
  drawFrame(context);
}

function drawHexPattern(context: CanvasRenderingContext2D): void {
  context.save();
  context.strokeStyle = 'rgba(100, 230, 221, .07)';
  context.lineWidth = 2;
  const radius = 52;
  const height = Math.sin(Math.PI / 3) * radius;
  for (let row = -1; row < 15; row += 1) {
    for (let column = -1; column < 9; column += 1) {
      const cx = column * radius * 1.5 + (row % 2 ? radius * .75 : 0);
      const cy = row * height;
      context.beginPath();
      for (let side = 0; side < 6; side += 1) {
        const angle = side * Math.PI / 3;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (side === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.stroke();
    }
  }
  context.restore();
}

function drawMetric(
  context: CanvasRenderingContext2D,
  label: string,
  value: number,
  x: number,
  y: number,
): void {
  const normalized = Math.max(0, Math.min(10, value));
  context.textAlign = 'left';
  context.fillStyle = 'rgba(244, 234, 215, .72)';
  context.font = '500 22px "PingFang SC", sans-serif';
  context.fillText(label, x, y);
  context.textAlign = 'right';
  context.fillStyle = PALE_GOLD;
  context.fillText(String(normalized), x + 286, y);
  context.fillStyle = 'rgba(100, 230, 221, .12)';
  roundedRect(context, x, y + 18, 286, 10, 5);
  context.fill();
  const gradient = context.createLinearGradient(x, 0, x + 286, 0);
  gradient.addColorStop(0, '#287d82');
  gradient.addColorStop(1, CYAN);
  context.fillStyle = gradient;
  roundedRect(context, x, y + 18, 286 * (normalized / 10), 10, 5);
  context.fill();
}

function drawAbility(
  context: CanvasRenderingContext2D,
  ability: Ability,
  icon: HTMLImageElement | undefined,
  x: number,
  y: number,
): void {
  context.save();
  roundedRect(context, x, y, 94, 94, 17);
  context.clip();
  if (icon) {
    drawImageCover(context, icon, x, y, 94, 94);
  } else {
    context.fillStyle = '#102a37';
    context.fillRect(x, y, 94, 94);
  }
  context.restore();
  roundedRect(context, x, y, 94, 94, 17);
  context.strokeStyle = GOLD;
  context.lineWidth = 3;
  context.stroke();

  context.textAlign = 'center';
  context.fillStyle = INK;
  context.beginPath();
  context.arc(x + 80, y + 13, 18, 0, Math.PI * 2);
  context.fillStyle = GOLD;
  context.fill();
  context.fillStyle = INK;
  context.font = '700 18px Inter, sans-serif';
  context.fillText(ability.slot, x + 80, y + 20);
  context.fillStyle = 'rgba(244, 234, 215, .82)';
  context.font = '500 17px "PingFang SC", sans-serif';
  context.fillText(ability.name, x + 47, y + 124, 116);
}

function drawBack(
  canvas: HTMLCanvasElement,
  champion: ChampionCard,
  abilities: Ability[],
  icons: Array<HTMLImageElement | undefined>,
): void {
  const context = getContext(canvas);
  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, '#0c2532');
  background.addColorStop(.48, '#07131f');
  background.addColorStop(1, '#102837');
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawHexPattern(context);

  const halo = context.createRadialGradient(canvas.width / 2, 190, 10, canvas.width / 2, 190, 330);
  halo.addColorStop(0, 'rgba(100, 230, 221, .18)');
  halo.addColorStop(1, 'rgba(100, 230, 221, 0)');
  context.fillStyle = halo;
  context.fillRect(0, 0, canvas.width, 500);

  context.textAlign = 'center';
  context.fillStyle = CYAN;
  context.font = '500 19px Inter, "PingFang SC", sans-serif';
  trackedText(context, 'CHAMPION DOSSIER', canvas.width / 2, 86, 7);
  context.fillStyle = PALE_GOLD;
  context.font = '700 62px "Songti SC", "STSong", serif';
  context.fillText(champion.title, canvas.width / 2, 174, 600);
  context.fillStyle = 'rgba(244, 234, 215, .76)';
  context.font = '400 26px "PingFang SC", sans-serif';
  context.fillText(champion.name, canvas.width / 2, 220, 600);

  const tags = champion.tags.length ? champion.tags.join(' · ') : '未知定位';
  context.fillStyle = GOLD;
  context.font = '500 22px "PingFang SC", sans-serif';
  trackedText(context, tags, canvas.width / 2, 270, 4);

  drawMetric(context, '攻击', champion.info.attack, 72, 342);
  drawMetric(context, '防御', champion.info.defense, 410, 342);
  drawMetric(context, '法术', champion.info.magic, 72, 422);
  drawMetric(context, '难度', champion.info.difficulty, 410, 422);

  context.strokeStyle = 'rgba(217, 189, 120, .4)';
  context.beginPath();
  context.moveTo(72, 510);
  context.lineTo(696, 510);
  context.stroke();

  const abilityWidth = 118;
  const abilityStart = (canvas.width - abilities.length * abilityWidth) / 2 + 12;
  abilities.forEach((ability, index) => {
    drawAbility(context, ability, icons[index], abilityStart + index * abilityWidth, 560);
  });

  context.textAlign = 'left';
  context.fillStyle = GOLD;
  context.font = '600 22px "PingFang SC", sans-serif';
  trackedText(context, '英雄传记', 120, 790, 3);
  context.fillStyle = 'rgba(244, 234, 215, .76)';
  context.font = '400 23px "PingFang SC", sans-serif';
  wrapText(context, champion.lore, 72, 840, 624, 39, 7);

  context.textAlign = 'center';
  context.fillStyle = 'rgba(100, 230, 221, .66)';
  context.font = '500 16px Inter, sans-serif';
  trackedText(context, champion.id.toUpperCase(), canvas.width / 2, 1172, 6);
  drawFrame(context);
}

/**
 * Builds export-safe front/back canvases. Every remote image is requested with
 * `crossOrigin="anonymous"`; a server that does not opt into CORS causes a
 * descriptive error instead of silently producing a tainted export canvas.
 */
export async function createCardTextureCanvases(
  champion: ChampionCard,
  skin: SkinEdition,
  signal?: AbortSignal,
): Promise<CardTextureCanvases> {
  const abilities = [champion.passive, ...champion.spells]
    .filter((ability): ability is Ability => Boolean(ability))
    .slice(0, 5);
  // Splash art carries substantially more source pixels than the loading-screen
  // portrait. It is cropped into the card frame, with the portrait kept as a
  // resilient fallback for older or temporarily missing splash assets.
  const artworkPromise = loadCardArtwork(skin, signal);
  const iconPromises = abilities.map((ability) => loadOptionalImage(ability.iconUrl, signal));
  const [artwork, icons] = await Promise.all([artworkPromise, Promise.all(iconPromises)]);
  if (signal?.aborted) throw new DOMException('卡面生成已取消。', 'AbortError');

  const front = makeCanvas();
  const back = makeCanvas();
  drawFront(front, champion, skin, artwork);
  drawBack(back, champion, abilities, icons);
  return { front, back };
}
