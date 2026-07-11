import type { Ability, ChampionCard, SkinEdition } from '../types/cards';

export const CARD_TEXTURE_WIDTH = 768;
export const CARD_TEXTURE_HEIGHT = 1280;
// The relief map is deliberately small: the shader linearly interpolates it,
// while keeping per-card analysis below a perceptible main-thread long task on
// low-end phones.
export const DEPTH_TEXTURE_WIDTH = 96;
export const DEPTH_TEXTURE_HEIGHT = 160;

export interface CardTextureCanvases {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  artwork: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  depth: HTMLCanvasElement;
  depthConfidence: number;
  artworkFit: ArtworkFit;
}

export type ArtworkFitMode = 'smart-crop' | 'portrait-fallback' | 'center-crop';

export interface ArtworkFit {
  mode: ArtworkFitMode;
  focalX: number;
  matchScore?: number;
  matchMargin?: number;
  confidence?: number;
}

export interface PixelPlane {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

export interface FocusMatch {
  focalX: number;
  score: number;
  margin: number;
  confidence: number;
  confident: boolean;
  matchedWindow: { x: number; width: number };
}

export interface CoverCrop {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  positionX: number;
  positionY: number;
}

export interface ReliefDepthStats {
  minimum: number;
  maximum: number;
  mean: number;
}

export interface ReliefDepthMap {
  values: Uint8ClampedArray;
  stats: ReliefDepthStats;
  confidence: number;
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
const FOCAL_SAMPLE_HEIGHT = 80;
const HUE_BINS = 12;
const SATURATION_BINS = 6;
const COLOR_BIN_COUNT = HUE_BINS * SATURATION_BINS;

function makeCanvas(
  width = CARD_TEXTURE_WIDTH,
  height = CARD_TEXTURE_HEIGHT,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
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

interface LoadedArtworkSources {
  splash?: HTMLImageElement;
  portrait?: HTMLImageElement;
}

async function loadCardArtworkSources(
  skin: SkinEdition,
  signal?: AbortSignal,
): Promise<LoadedArtworkSources> {
  const splashPromise = loadCorsImage(skin.splashUrl, signal);
  const portraitPromise = skin.loadingUrl === skin.splashUrl
    ? Promise.resolve<HTMLImageElement | undefined>(undefined)
    : loadCorsImage(skin.loadingUrl, signal);
  const [splashResult, portraitResult] = await Promise.allSettled([
    splashPromise,
    portraitPromise,
  ]);

  for (const result of [splashResult, portraitResult]) {
    if (
      result.status === 'rejected' &&
      result.reason instanceof DOMException &&
      result.reason.name === 'AbortError'
    ) {
      throw result.reason;
    }
  }

  const splash = splashResult.status === 'fulfilled' ? splashResult.value : undefined;
  const portrait = portraitResult.status === 'fulfilled' ? portraitResult.value : undefined;
  if (splash || portrait) return { splash, portrait };

  const cause = splashResult.status === 'rejected'
    ? splashResult.reason
    : portraitResult.status === 'rejected'
      ? portraitResult.reason
      : undefined;
  throw new CardTextureError('官方高清原画和竖版原画均加载失败，无法生成卡面。', skin.splashUrl, {
    cause,
  });
}

function samplePixelPlane(
  image: HTMLImageElement,
  width: number,
  height: number,
): PixelPlane {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = getContext(canvas);
  context.drawImage(image, 0, 0, width, height);
  return { width, height, rgba: context.getImageData(0, 0, width, height).data };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(from: number, to: number, value: number): number {
  if (Math.abs(to - from) <= 1e-8) return 0;
  const progress = clamp01((value - from) / (to - from));
  return progress * progress * (3 - 2 * progress);
}

function preparePixels(plane: PixelPlane): {
  luma: Float32Array;
  colorBin: Uint8Array;
} {
  const pixelCount = plane.width * plane.height;
  if (plane.rgba.length < pixelCount * 4) {
    throw new Error('卡面像素数据不完整。');
  }

  const luma = new Float32Array(pixelCount);
  const colorBin = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    const pixelIndex = index * 4;
    const red = (plane.rgba[pixelIndex] ?? 0) / 255;
    const green = (plane.rgba[pixelIndex + 1] ?? 0) / 255;
    const blue = (plane.rgba[pixelIndex + 2] ?? 0) / 255;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const delta = maximum - minimum;
    let hue = 0;

    if (delta > 1e-6) {
      if (maximum === red) hue = ((green - blue) / delta) % 6;
      else if (maximum === green) hue = (blue - red) / delta + 2;
      else hue = (red - green) / delta + 4;
      hue = ((hue / 6) + 1) % 1;
    }

    const saturation = maximum > 1e-6 ? delta / maximum : 0;
    const hueBin = Math.min(HUE_BINS - 1, Math.floor(hue * HUE_BINS));
    const saturationBin = Math.min(
      SATURATION_BINS - 1,
      Math.floor(saturation * SATURATION_BINS),
    );
    colorBin[index] = hueBin * SATURATION_BINS + saturationBin;
    luma[index] = red * .2126 + green * .7152 + blue * .0722;
  }
  return { luma, colorBin };
}

/**
 * Uses the official portrait as a composition reference and slides it across
 * the wide splash. Color histograms tolerate Riot's portrait re-lighting while
 * luminance correlation keeps same-composition crops precise.
 */
export function estimateSplashFocalX(loading: PixelPlane, splash: PixelPlane): FocusMatch {
  const fallback: FocusMatch = {
    focalX: .5,
    score: 0,
    margin: 0,
    confidence: 0,
    confident: false,
    matchedWindow: { x: .5, width: 1 },
  };
  if (
    loading.height !== splash.height ||
    loading.width >= splash.width ||
    loading.width < 8 ||
    loading.height < 8
  ) {
    return fallback;
  }

  const reference = preparePixels(loading);
  const panorama = preparePixels(splash);
  const trimX = Math.max(2, Math.round(loading.width * .08));
  const trimY = Math.max(2, Math.round(loading.height * .06));
  const xStart = trimX;
  const xEnd = loading.width - trimX;
  const yStart = trimY;
  const yEnd = loading.height - trimY;
  const pixelCount = (xEnd - xStart) * (yEnd - yStart);
  if (pixelCount <= 0) return fallback;

  const referenceHistogram = new Float32Array(COLOR_BIN_COUNT);
  let referenceSum = 0;
  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const index = y * loading.width + x;
      referenceSum += reference.luma[index] ?? 0;
      const histogramIndex = reference.colorBin[index] ?? 0;
      referenceHistogram[histogramIndex] = (referenceHistogram[histogramIndex] ?? 0) + 1;
    }
  }
  const referenceMean = referenceSum / pixelCount;
  let referenceVariance = 0;
  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const difference = (reference.luma[y * loading.width + x] ?? 0) - referenceMean;
      referenceVariance += difference * difference;
    }
  }
  if (referenceVariance <= 1e-8) return fallback;
  for (let index = 0; index < referenceHistogram.length; index += 1) {
    referenceHistogram[index] = (referenceHistogram[index] ?? 0) / pixelCount;
  }

  const candidateCount = splash.width - loading.width + 1;
  const scores = new Float32Array(candidateCount);
  const candidateHistogram = new Float32Array(COLOR_BIN_COUNT);
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestX = 0;

  for (let offset = 0; offset < candidateCount; offset += 1) {
    candidateHistogram.fill(0);
    let candidateSum = 0;
    for (let y = yStart; y < yEnd; y += 1) {
      for (let x = xStart; x < xEnd; x += 1) {
        candidateSum += panorama.luma[y * splash.width + offset + x] ?? 0;
      }
    }
    const candidateMean = candidateSum / pixelCount;

    let candidateVariance = 0;
    let covariance = 0;
    for (let y = yStart; y < yEnd; y += 1) {
      for (let x = xStart; x < xEnd; x += 1) {
        const referenceIndex = y * loading.width + x;
        const candidateIndex = y * splash.width + offset + x;
        const referenceDifference = (reference.luma[referenceIndex] ?? 0) - referenceMean;
        const candidateDifference = (panorama.luma[candidateIndex] ?? 0) - candidateMean;
        candidateVariance += candidateDifference * candidateDifference;
        covariance += referenceDifference * candidateDifference;
        const histogramIndex = panorama.colorBin[candidateIndex] ?? 0;
        candidateHistogram[histogramIndex] = (candidateHistogram[histogramIndex] ?? 0) + 1;
      }
    }

    let histogramIntersection = 0;
    for (let index = 0; index < candidateHistogram.length; index += 1) {
      histogramIntersection += Math.min(
        referenceHistogram[index] ?? 0,
        (candidateHistogram[index] ?? 0) / pixelCount,
      );
    }
    const denominator = Math.sqrt(referenceVariance * candidateVariance);
    const correlation = denominator > 1e-8
      ? Math.max(-1, Math.min(1, covariance / denominator))
      : 0;
    const score = histogramIntersection * .7 + ((correlation + 1) / 2) * .3;
    scores[offset] = score;
    if (score > bestScore) {
      bestScore = score;
      bestX = offset;
    }
  }

  const exclusion = Math.max(2, Math.floor(loading.width / 3));
  let runnerUp = Number.NEGATIVE_INFINITY;
  for (let offset = 0; offset < scores.length; offset += 1) {
    if (Math.abs(offset - bestX) > exclusion) {
      runnerUp = Math.max(runnerUp, scores[offset] ?? Number.NEGATIVE_INFINITY);
    }
  }
  if (!Number.isFinite(runnerUp)) runnerUp = bestScore;
  const margin = Math.max(0, bestScore - runnerUp);
  const confidence = smoothstep(.62, .74, bestScore) * smoothstep(.012, .06, margin);
  const focalX = clamp01((bestX + loading.width / 2) / splash.width);
  return {
    focalX,
    score: bestScore,
    margin,
    confidence,
    confident: bestScore >= .67 && margin >= .02 && confidence >= .25,
    matchedWindow: {
      x: bestX / splash.width,
      width: loading.width / splash.width,
    },
  };
}

interface ArtworkRenderPlan {
  image: HTMLImageElement;
  fit: ArtworkFit;
}

function createArtworkRenderPlan(sources: LoadedArtworkSources): ArtworkRenderPlan {
  const { splash, portrait } = sources;
  if (!splash && portrait) {
    return { image: portrait, fit: { mode: 'portrait-fallback', focalX: .5 } };
  }
  if (!splash) throw new CardTextureError('没有可用于卡面的官方原画。');
  if (!portrait) {
    return { image: splash, fit: { mode: 'center-crop', focalX: .5 } };
  }

  try {
    const panoramaWidth = Math.max(
      1,
      Math.round((splash.naturalWidth / splash.naturalHeight) * FOCAL_SAMPLE_HEIGHT),
    );
    const referenceWidth = Math.min(
      panoramaWidth,
      Math.max(8, Math.round((portrait.naturalWidth / portrait.naturalHeight) * FOCAL_SAMPLE_HEIGHT)),
    );
    const panorama = samplePixelPlane(splash, panoramaWidth, FOCAL_SAMPLE_HEIGHT);
    const reference = samplePixelPlane(portrait, referenceWidth, FOCAL_SAMPLE_HEIGHT);
    const match = estimateSplashFocalX(reference, panorama);
    if (match.confident) {
      return {
        image: splash,
        fit: {
          mode: 'smart-crop',
          focalX: match.focalX,
          matchScore: match.score,
          matchMargin: match.margin,
          confidence: match.confidence,
        },
      };
    }
  } catch {
    // A blocked pixel read must not hide the card; the portrait remains safe.
  }

  return { image: portrait, fit: { mode: 'portrait-fallback', focalX: .5 } };
}

export function resolveCoverCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  focalX = .5,
  focalY = .5,
): CoverCrop {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return {
      sourceX: 0,
      sourceY: 0,
      sourceWidth: Math.max(0, sourceWidth),
      sourceHeight: Math.max(0, sourceHeight),
      positionX: .5,
      positionY: .5,
    };
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let sourceX = 0;
  let sourceY = 0;
  if (sourceRatio > targetRatio) {
    cropWidth = sourceHeight * targetRatio;
    sourceX = Math.min(
      sourceWidth - cropWidth,
      Math.max(0, sourceWidth * clamp01(focalX) - cropWidth / 2),
    );
  } else {
    cropHeight = sourceWidth / targetRatio;
    sourceY = Math.min(
      sourceHeight - cropHeight,
      Math.max(0, sourceHeight * clamp01(focalY) - cropHeight / 2),
    );
  }

  return {
    sourceX,
    sourceY,
    sourceWidth: cropWidth,
    sourceHeight: cropHeight,
    positionX: sourceWidth === cropWidth ? .5 : sourceX / (sourceWidth - cropWidth),
    positionY: sourceHeight === cropHeight ? .5 : sourceY / (sourceHeight - cropHeight),
  };
}

function boxBlur(
  source: Float32Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  if (radius <= 0) return source.slice();
  const horizontal = new Float32Array(source.length);
  const output = new Float32Array(source.length);
  const diameter = radius * 2 + 1;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const x = Math.min(width - 1, Math.max(0, offset));
      sum += source[row + x] ?? 0;
    }
    for (let x = 0; x < width; x += 1) {
      horizontal[row + x] = sum / diameter;
      const leavingX = Math.min(width - 1, Math.max(0, x - radius));
      const enteringX = Math.min(width - 1, Math.max(0, x + radius + 1));
      sum += (source[row + enteringX] ?? 0) - (source[row + leavingX] ?? 0);
    }
  }

  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const y = Math.min(height - 1, Math.max(0, offset));
      sum += horizontal[y * width + x] ?? 0;
    }
    for (let y = 0; y < height; y += 1) {
      output[y * width + x] = sum / diameter;
      const leavingY = Math.min(height - 1, Math.max(0, y - radius));
      const enteringY = Math.min(height - 1, Math.max(0, y + radius + 1));
      sum += (horizontal[enteringY * width + x] ?? 0) -
        (horizontal[leavingY * width + x] ?? 0);
    }
  }
  return output;
}

/**
 * Produces a lightweight pseudo-depth field for arbitrary splash art. The
 * centered portrait prior keeps the featured champion forward, while local
 * contrast, edges and saturation add relief around armor, faces and weapons.
 */
type ColorFeature = [luma: number, chromaOrange: number, chromaGreen: number];

function featureDistanceSquared(
  luma: number,
  chromaOrange: number,
  chromaGreen: number,
  center: ColorFeature,
): number {
  const deltaLuma = luma - center[0];
  const deltaOrange = chromaOrange - center[1];
  const deltaGreen = chromaGreen - center[2];
  return deltaLuma * deltaLuma * 1.15 +
    deltaOrange * deltaOrange * .72 +
    deltaGreen * deltaGreen * .78;
}

function percentile(values: Float32Array, fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice();
  sorted.sort();
  const position = clamp01(fraction) * (sorted.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex] ?? 0;
  const upper = sorted[upperIndex] ?? lower;
  return lower + (upper - lower) * (position - lowerIndex);
}

function percentileBand(
  values: Float32Array,
  lowFraction: number,
  highFraction: number,
): [low: number, high: number] {
  const low = percentile(values, lowFraction);
  let high = percentile(values, highFraction);
  if (high - low <= 1e-5) {
    let maximum = low;
    for (const value of values) maximum = Math.max(maximum, value);
    if (maximum - low > 1e-5) high = maximum;
  }
  return [low, high];
}

/**
 * Estimates a soft foreground relief from the border colors of arbitrary card
 * art. It never relies on brightness alone, so dark armor and creatures can
 * still sit in front of bright skies or spell effects.
 */
export function generateReliefDepthMap(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): ReliefDepthMap {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) {
    throw new Error('无法从不完整的卡面像素生成景深。');
  }

  const pixelCount = width * height;
  const luma = new Float32Array(pixelCount);
  const chromaOrange = new Float32Array(pixelCount);
  const chromaGreen = new Float32Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    const pixelIndex = index * 4;
    const red = (rgba[pixelIndex] ?? 0) / 255;
    const green = (rgba[pixelIndex + 1] ?? 0) / 255;
    const blue = (rgba[pixelIndex + 2] ?? 0) / 255;
    luma[index] = red * .25 + green * .5 + blue * .25;
    chromaOrange[index] = red - blue;
    chromaGreen[index] = green - (red + blue) * .5;
  }

  const borderY = Math.max(1, Math.round(height * .055));
  const borderIndices: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      // Full-height side strips and even deep corner blocks frequently contain
      // a champion's armor or weapon. Anchor only to the shallow top edge so
      // edge-touching subject colors cannot become background clusters.
      const isTop = y < borderY;
      if (isTop) borderIndices.push(y * width + x);
    }
  }

  const featureAt = (index: number): ColorFeature => [
    luma[index] ?? 0,
    chromaOrange[index] ?? 0,
    chromaGreen[index] ?? 0,
  ];
  const averageFeature = (indices: number[]): ColorFeature => {
    let sumLuma = 0;
    let sumOrange = 0;
    let sumGreen = 0;
    for (const index of indices) {
      sumLuma += luma[index] ?? 0;
      sumOrange += chromaOrange[index] ?? 0;
      sumGreen += chromaGreen[index] ?? 0;
    }
    const divisor = Math.max(1, indices.length);
    return [sumLuma / divisor, sumOrange / divisor, sumGreen / divisor];
  };
  const farthestBorderFeature = (centers: ColorFeature[]): ColorFeature => {
    let bestIndex = borderIndices[0] ?? 0;
    let bestDistance = Number.NEGATIVE_INFINITY;
    for (const index of borderIndices) {
      let nearest = Number.POSITIVE_INFINITY;
      for (const center of centers) {
        nearest = Math.min(nearest, featureDistanceSquared(
          luma[index] ?? 0,
          chromaOrange[index] ?? 0,
          chromaGreen[index] ?? 0,
          center,
        ));
      }
      if (nearest > bestDistance) {
        bestDistance = nearest;
        bestIndex = index;
      }
    }
    return featureAt(bestIndex);
  };

  const backgroundCenters: ColorFeature[] = [averageFeature(borderIndices)];
  backgroundCenters.push(farthestBorderFeature(backgroundCenters));
  backgroundCenters.push(farthestBorderFeature(backgroundCenters));
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const sums = backgroundCenters.map(() => [0, 0, 0, 0] as [number, number, number, number]);
    for (const index of borderIndices) {
      let cluster = 0;
      let nearest = Number.POSITIVE_INFINITY;
      backgroundCenters.forEach((center, centerIndex) => {
        const distance = featureDistanceSquared(
          luma[index] ?? 0,
          chromaOrange[index] ?? 0,
          chromaGreen[index] ?? 0,
          center,
        );
        if (distance < nearest) {
          nearest = distance;
          cluster = centerIndex;
        }
      });
      const sum = sums[cluster]!;
      sum[0] += luma[index] ?? 0;
      sum[1] += chromaOrange[index] ?? 0;
      sum[2] += chromaGreen[index] ?? 0;
      sum[3] += 1;
    }
    sums.forEach((sum, index) => {
      if (sum[3] > 0) {
        backgroundCenters[index] = [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]];
      }
    });
  }

  // Loading-screen compositions almost always place the champion's torso,
  // clothing or mount in the lower-center band. A small color model from that
  // domain-specific seed lets smooth body regions inherit the relief detected
  // on their outline instead of producing a hollow emboss.
  const subjectSeedIndices: number[] = [];
  const subjectStartX = Math.floor(width * .3);
  const subjectEndX = Math.max(subjectStartX + 1, Math.ceil(width * .7));
  const subjectStartY = Math.floor(height * .7);
  const subjectEndY = Math.max(subjectStartY + 1, Math.ceil(height * .91));
  for (let y = subjectStartY; y < Math.min(height, subjectEndY); y += 1) {
    for (let x = subjectStartX; x < Math.min(width, subjectEndX); x += 1) {
      subjectSeedIndices.push(y * width + x);
    }
  }
  const subjectCenters: ColorFeature[] = [averageFeature(subjectSeedIndices)];
  let farthestSubjectIndex = subjectSeedIndices[0] ?? 0;
  let farthestSubjectDistance = Number.NEGATIVE_INFINITY;
  for (const index of subjectSeedIndices) {
    const distance = featureDistanceSquared(
      luma[index] ?? 0,
      chromaOrange[index] ?? 0,
      chromaGreen[index] ?? 0,
      subjectCenters[0]!,
    );
    if (distance > farthestSubjectDistance) {
      farthestSubjectDistance = distance;
      farthestSubjectIndex = index;
    }
  }
  subjectCenters.push(featureAt(farthestSubjectIndex));
  let subjectClusterCounts = new Uint32Array(subjectCenters.length);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const sums = subjectCenters.map(() => [0, 0, 0, 0] as [number, number, number, number]);
    for (const index of subjectSeedIndices) {
      let cluster = 0;
      let nearest = Number.POSITIVE_INFINITY;
      subjectCenters.forEach((center, centerIndex) => {
        const distance = featureDistanceSquared(
          luma[index] ?? 0,
          chromaOrange[index] ?? 0,
          chromaGreen[index] ?? 0,
          center,
        );
        if (distance < nearest) {
          nearest = distance;
          cluster = centerIndex;
        }
      });
      const sum = sums[cluster]!;
      sum[0] += luma[index] ?? 0;
      sum[1] += chromaOrange[index] ?? 0;
      sum[2] += chromaGreen[index] ?? 0;
      sum[3] += 1;
    }
    subjectClusterCounts = new Uint32Array(subjectCenters.length);
    sums.forEach((sum, index) => {
      subjectClusterCounts[index] = sum[3];
      if (sum[3] > 0) {
        subjectCenters[index] = [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]];
      }
    });
  }

  const subjectSpread = new Float32Array(subjectCenters.length);
  for (const index of subjectSeedIndices) {
    let cluster = 0;
    let nearest = Number.POSITIVE_INFINITY;
    subjectCenters.forEach((center, centerIndex) => {
      const distance = featureDistanceSquared(
        luma[index] ?? 0,
        chromaOrange[index] ?? 0,
        chromaGreen[index] ?? 0,
        center,
      );
      if (distance < nearest) {
        nearest = distance;
        cluster = centerIndex;
      }
    });
    subjectSpread[cluster] = (subjectSpread[cluster] ?? 0) + Math.sqrt(nearest);
  }
  const subjectReliability = new Float32Array(subjectCenters.length);
  let portraitConfidence = 0;
  subjectCenters.forEach((center, index) => {
    const count = subjectClusterCounts[index] ?? 0;
    const spread = (subjectSpread[index] ?? 0) / Math.max(1, count);
    subjectSpread[index] = spread;
    let backgroundSeparation = Number.POSITIVE_INFINITY;
    for (const backgroundCenter of backgroundCenters) {
      backgroundSeparation = Math.min(
        backgroundSeparation,
        Math.sqrt(featureDistanceSquared(center[0], center[1], center[2], backgroundCenter)),
      );
    }
    const share = count / Math.max(1, subjectSeedIndices.length);
    const reliability = smoothstep(.07, .3, backgroundSeparation) *
      smoothstep(.1, .32, share) *
      (.35 + (1 - smoothstep(.12, .36, spread)) * .65);
    subjectReliability[index] = reliability;
    portraitConfidence = Math.max(portraitConfidence, reliability);
  });

  const portraitInterior = new Float32Array(pixelCount);
  for (let y = 0; y < height; y += 1) {
    const normalizedY = height === 1 ? .5 : y / (height - 1);
    const vertical = (normalizedY - .62) / .72;
    const topFade = smoothstep(.04, .2, normalizedY);
    for (let x = 0; x < width; x += 1) {
      const normalizedX = width === 1 ? .5 : x / (width - 1);
      const horizontal = (normalizedX - .5) / .62;
      const spatialPrior = Math.exp(-(horizontal * horizontal + vertical * vertical)) * topFade;
      let affinity = 0;
      subjectCenters.forEach((center, centerIndex) => {
        const reliability = subjectReliability[centerIndex] ?? 0;
        if (reliability <= 0) return;
        const distance = Math.sqrt(featureDistanceSquared(
          luma[y * width + x] ?? 0,
          chromaOrange[y * width + x] ?? 0,
          chromaGreen[y * width + x] ?? 0,
          center,
        ));
        const inner = .035 + (subjectSpread[centerIndex] ?? 0) * 1.35;
        const similarity = 1 - smoothstep(inner, inner + .2, distance);
        affinity = Math.max(affinity, similarity * reliability);
      });
      portraitInterior[y * width + x] = affinity * spatialPrior;
    }
  }

  const backgroundDistance = new Float32Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    let nearest = Number.POSITIVE_INFINITY;
    for (const center of backgroundCenters) {
      nearest = Math.min(nearest, Math.sqrt(featureDistanceSquared(
        luma[index] ?? 0,
        chromaOrange[index] ?? 0,
        chromaGreen[index] ?? 0,
        center,
      )));
    }
    backgroundDistance[index] = nearest;
  }
  const [backgroundLow, backgroundHigh] = percentileBand(backgroundDistance, .2, .85);

  const localRadius = Math.max(2, Math.round(Math.min(width, height) * .028));
  const localAverage = boxBlur(luma, width, height, localRadius);
  const rawDetail = new Float32Array(pixelCount);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const value = luma[index] ?? 0;
      const left = luma[y * width + Math.max(0, x - 1)] ?? value;
      const right = luma[y * width + Math.min(width - 1, x + 1)] ?? value;
      const up = luma[Math.max(0, y - 1) * width + x] ?? value;
      const down = luma[Math.min(height - 1, y + 1) * width + x] ?? value;
      rawDetail[index] = Math.abs(value - (localAverage[index] ?? value)) * 2.8 +
        (Math.abs(right - left) + Math.abs(down - up)) * .9;
    }
  }
  const detailHigh = Math.max(1e-5, percentile(rawDetail, .9));

  const detail = new Float32Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    detail[index] = clamp01((rawDetail[index] ?? 0) / detailHigh);
  }
  const detailEnvelope = boxBlur(
    detail,
    width,
    height,
    Math.max(2, Math.round(Math.min(width, height) * .04)),
  );
  const saliency = new Float32Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    const contrast = smoothstep(backgroundLow, backgroundHigh, backgroundDistance[index] ?? 0);
    const localDetail = detail[index] ?? 0;
    const envelope = detailEnvelope[index] ?? 0;
    // Color novelty is only allowed to reinforce nearby structure. A smooth
    // sky opening or spell glow therefore cannot become near solely because
    // its color differs from the top-edge background model.
    saliency[index] = clamp01(
      contrast * envelope * .28 + localDetail * .48 + envelope * .24,
    );
  }

  const [initialLow, initialHigh] = percentileBand(saliency, .55, .85);
  let weightedX = 0;
  let weightedY = 0;
  let weightSum = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const weight = smoothstep(initialLow, initialHigh, saliency[index] ?? 0);
      weightedX += x * weight;
      weightedY += y * weight;
      weightSum += weight;
    }
  }
  const subjectCenterX = Math.min(.68, Math.max(.32,
    weightSum > 0 ? weightedX / weightSum / Math.max(1, width - 1) : .5,
  ));
  const subjectCenterY = Math.min(.55, Math.max(.31,
    weightSum > 0 ? weightedY / weightSum / Math.max(1, height - 1) : .43,
  ));
  const centerPrior = new Float32Array(pixelCount);
  for (let y = 0; y < height; y += 1) {
    const normalizedY = height === 1 ? .5 : y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const normalizedX = width === 1 ? .5 : x / (width - 1);
      const horizontal = (normalizedX - subjectCenterX) / .44;
      const vertical = (normalizedY - subjectCenterY) / .58;
      const index = y * width + x;
      centerPrior[index] = Math.exp(-(horizontal * horizontal + vertical * vertical));
      saliency[index] = (saliency[index] ?? 0) * (.86 + (centerPrior[index] ?? 0) * .14);
    }
  }

  const [saliencyLow, saliencyHigh] = percentileBand(saliency, .55, .85);
  const softMask = new Float32Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    softMask[index] = smoothstep(saliencyLow, saliencyHigh, saliency[index] ?? 0);
  }

  const labels = new Int32Array(pixelCount);
  labels.fill(-1);
  const queue = new Int32Array(pixelCount);
  const components: Array<{
    area: number;
    saliency: number;
    detail: number;
    fill: number;
    centerX: number;
    centerY: number;
    score: number;
  }> = [];
  for (let start = 0; start < pixelCount; start += 1) {
    if ((softMask[start] ?? 0) <= .46 || labels[start] !== -1) continue;
    const label = components.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = label;
    let area = 0;
    let saliencySum = 0;
    let detailSum = 0;
    let xSum = 0;
    let ySum = 0;
    let minimumX = width;
    let maximumX = 0;
    let minimumY = height;
    let maximumY = 0;
    while (head < tail) {
      const index = queue[head++] ?? 0;
      const x = index % width;
      const y = Math.floor(index / width);
      area += 1;
      saliencySum += saliency[index] ?? 0;
      detailSum += detail[index] ?? 0;
      xSum += x;
      ySum += y;
      minimumX = Math.min(minimumX, x);
      maximumX = Math.max(maximumX, x);
      minimumY = Math.min(minimumY, y);
      maximumY = Math.max(maximumY, y);
      const left = index - 1;
      if (x > 0 && labels[left] === -1 && (softMask[left] ?? 0) > .46) {
        labels[left] = label;
        queue[tail++] = left;
      }
      const right = index + 1;
      if (x + 1 < width && labels[right] === -1 && (softMask[right] ?? 0) > .46) {
        labels[right] = label;
        queue[tail++] = right;
      }
      const upper = index - width;
      if (y > 0 && labels[upper] === -1 && (softMask[upper] ?? 0) > .46) {
        labels[upper] = label;
        queue[tail++] = upper;
      }
      const lower = index + width;
      if (y + 1 < height && labels[lower] === -1 && (softMask[lower] ?? 0) > .46) {
        labels[lower] = label;
        queue[tail++] = lower;
      }
    }
    const centerX = xSum / Math.max(1, area) / Math.max(1, width - 1);
    const centerY = ySum / Math.max(1, area) / Math.max(1, height - 1);
    const priorX = (centerX - subjectCenterX) / .5;
    const priorY = (centerY - subjectCenterY) / .65;
    const componentCenterWeight = Math.exp(-(priorX * priorX + priorY * priorY));
    const meanSaliency = saliencySum / Math.max(1, area);
    const meanDetail = detailSum / Math.max(1, area);
    const boundingArea = Math.max(1, maximumX - minimumX + 1) *
      Math.max(1, maximumY - minimumY + 1);
    components.push({
      area,
      saliency: meanSaliency,
      detail: meanDetail,
      fill: area / boundingArea,
      centerX,
      centerY,
      score: area * (meanSaliency * .75 + meanDetail * .25) *
        (.82 + componentCenterWeight * .18),
    });
  }

  let mainComponent = -1;
  let mainScore = 0;
  components.forEach((component, index) => {
    if (component.score > mainScore) {
      mainScore = component.score;
      mainComponent = index;
    }
  });
  const keepComponent = components.map((component, index) => (
    index === mainComponent ||
    (component.area / pixelCount >= .015 && component.score >= mainScore * .45)
  ));
  const binaryForeground = new Float32Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    const label = labels[index] ?? -1;
    if (label >= 0 && keepComponent[label]) binaryForeground[index] = 1;
  }
  const expanded = boxBlur(binaryForeground, width, height, 1);
  const closed = new Float32Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    closed[index] = (expanded[index] ?? 0) > .12 ? 1 : 0;
  }
  const softened = boxBlur(closed, width, height, 2);

  const main = mainComponent >= 0 ? components[mainComponent] : undefined;
  const spreadConfidence = smoothstep(.055, .22, saliencyHigh - saliencyLow);
  const areaFraction = (main?.area ?? 0) / pixelCount;
  const areaConfidence = smoothstep(.008, .075, areaFraction) *
    (1 - smoothstep(.72, .94, areaFraction));
  const mainCenterConfidence = main
    ? Math.exp(-(
      Math.pow((main.centerX - subjectCenterX) / .48, 2) +
      Math.pow((main.centerY - subjectCenterY) / .62, 2)
    ))
    : 0;
  const detailConfidence = main ? smoothstep(.035, .22, main.detail) : 0;
  const compactConfidence = main ? smoothstep(.06, .32, main.fill) : 0;
  const componentConfidence = main
    ? clamp01(
      spreadConfidence *
      (.55 + areaConfidence * .3 + mainCenterConfidence * .15) *
      (.08 + detailConfidence * .92) *
      (.15 + compactConfidence * .85),
    )
    : 0;
  const confidence = Math.max(componentConfidence, portraitConfidence * .82);
  const dynamicRange = confidence;

  const localDetailSupport = boxBlur(detail, width, height, 2);

  const rawDepth = new Float32Array(pixelCount);
  for (let y = 0; y < height; y += 1) {
    const normalizedY = height === 1 ? .5 : y / (height - 1);
    const verticalFalloff = smoothstep(0, .06, normalizedY) *
      smoothstep(0, .025, 1 - normalizedY);
    for (let x = 0; x < width; x += 1) {
      const normalizedX = width === 1 ? .5 : x / (width - 1);
      const horizontalFalloff = smoothstep(0, .06, normalizedX) *
        smoothstep(0, .06, 1 - normalizedX);
      const index = y * width + x;
      const fallbackRelief = main ? 0 : (softMask[index] ?? 0) * .16;
      const textureSupport = clamp01(
        (detail[index] ?? 0) * .62 + (localDetailSupport[index] ?? 0) * .38,
      );
      const segmentedForeground = Math.max(softened[index] ?? 0, fallbackRelief) *
        (.76 + (saliency[index] ?? 0) * .24) *
        (.36 + textureSupport * .64);
      const foreground = Math.max(
        segmentedForeground,
        (portraitInterior[index] ?? 0) * .88,
      ) * horizontalFalloff * verticalFalloff;
      rawDepth[index] = .1 +
        foreground * .81 * dynamicRange +
        (detail[index] ?? 0) * foreground * .055 * dynamicRange;
    }
  }

  const finalDepth = boxBlur(rawDepth, width, height, 1);
  const values = new Uint8ClampedArray(pixelCount);
  let minimum = 1;
  let maximum = 0;
  let sum = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    const depth = clamp01(finalDepth[index] ?? .1);
    values[index] = Math.round(depth * 255);
    minimum = Math.min(minimum, depth);
    maximum = Math.max(maximum, depth);
    sum += depth;
  }

  return {
    values,
    stats: { minimum, maximum, mean: sum / pixelCount },
    confidence,
  };
}

export function createReliefDepthCanvas(
  artwork: HTMLCanvasElement,
): { canvas: HTMLCanvasElement; confidence: number } {
  const canvas = makeCanvas(DEPTH_TEXTURE_WIDTH, DEPTH_TEXTURE_HEIGHT);
  const context = getContext(canvas);
  context.drawImage(artwork, 0, 0, canvas.width, canvas.height);
  try {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const depth = generateReliefDepthMap(imageData.data, canvas.width, canvas.height);
    for (let index = 0; index < depth.values.length; index += 1) {
      const pixelIndex = index * 4;
      const value = depth.values[index] ?? 0;
      imageData.data[pixelIndex] = value;
      imageData.data[pixelIndex + 1] = value;
      imageData.data[pixelIndex + 2] = value;
      imageData.data[pixelIndex + 3] = 255;
    }
    context.putImageData(imageData, 0, 0);
    return { canvas, confidence: depth.confidence };
  } catch {
    // A tainted/unsupported pixel read must not discard an otherwise usable
    // high-resolution card. A tainted canvas stays tainted even after being
    // painted over, so return a separate clean neutral texture instead.
    const neutralCanvas = makeCanvas(DEPTH_TEXTURE_WIDTH, DEPTH_TEXTURE_HEIGHT);
    const neutralContext = getContext(neutralCanvas);
    neutralContext.fillStyle = '#808080';
    neutralContext.fillRect(0, 0, neutralCanvas.width, neutralCanvas.height);
    return { canvas: neutralCanvas, confidence: 0 };
  }
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  focalX = .5,
): void {
  const crop = resolveCoverCrop(
    image.naturalWidth,
    image.naturalHeight,
    width,
    height,
    focalX,
  );
  context.drawImage(
    image,
    crop.sourceX,
    crop.sourceY,
    crop.sourceWidth,
    crop.sourceHeight,
    x,
    y,
    width,
    height,
  );
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

function drawArtwork(
  canvas: HTMLCanvasElement,
  artwork: HTMLImageElement,
  focalX: number,
): void {
  const context = getContext(canvas);
  drawImageCover(context, artwork, 0, 0, canvas.width, canvas.height, focalX);
}

function drawFrontOverlay(
  canvas: HTMLCanvasElement,
  champion: ChampionCard,
  skin: SkinEdition,
): void {
  const context = getContext(canvas);

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

function composeFront(
  canvas: HTMLCanvasElement,
  artwork: HTMLCanvasElement,
  overlay: HTMLCanvasElement,
): void {
  const context = getContext(canvas);
  context.drawImage(artwork, 0, 0);
  context.drawImage(overlay, 0, 0);
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
  // The portrait supplies Riot's intended composition while the splash supplies
  // the pixels. Low-confidence matches fall back to the portrait instead of
  // risking a sharp card that crops the featured champion out of frame.
  const artworkPromise = loadCardArtworkSources(skin, signal);
  const iconPromises = abilities.map((ability) => loadOptionalImage(ability.iconUrl, signal));
  const [artworkSources, icons] = await Promise.all([artworkPromise, Promise.all(iconPromises)]);
  if (signal?.aborted) throw new DOMException('卡面生成已取消。', 'AbortError');
  const artwork = createArtworkRenderPlan(artworkSources);

  const artworkCanvas = makeCanvas();
  const overlay = makeCanvas();
  drawArtwork(artworkCanvas, artwork.image, artwork.fit.focalX);
  drawFrontOverlay(overlay, champion, skin);
  const depth = createReliefDepthCanvas(artworkCanvas);

  const front = makeCanvas();
  const back = makeCanvas();
  composeFront(front, artworkCanvas, overlay);
  drawBack(back, champion, abilities, icons);
  return {
    front,
    back,
    artwork: artworkCanvas,
    overlay,
    depth: depth.canvas,
    depthConfidence: depth.confidence,
    artworkFit: artwork.fit,
  };
}
