import { describe, expect, it, vi } from "vitest";
import {
  createReliefDepthCanvas,
  estimateSplashFocalX,
  generateReliefDepthMap,
  resolveCoverCrop,
  type PixelPlane,
} from "../src/lib/cardTexture";

function panorama(width: number, height: number): PixelPlane {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      rgba[index] = (x * 29 + y * 47 + x * y * 3) % 256;
      rgba[index + 1] = (x * 11 + y * 31 + x * y * 7) % 256;
      rgba[index + 2] = (x * 43 + y * 13 + x * y * 5) % 256;
      rgba[index + 3] = 255;
    }
  }
  return { width, height, rgba };
}

function slicePlane(source: PixelPlane, startX: number, width: number): PixelPlane {
  const rgba = new Uint8ClampedArray(width * source.height * 4);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = (y * source.width + startX + x) * 4;
      const targetIndex = (y * width + x) * 4;
      rgba.set(source.rgba.subarray(sourceIndex, sourceIndex + 4), targetIndex);
    }
  }
  return { width, height: source.height, rgba };
}

function solidPlane(width: number, height: number, value = 40): PixelPlane {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    rgba.set([value, value, value, 255], index * 4);
  }
  return { width, height, rgba };
}

function recomposedColorExample(): { reference: PixelPlane; source: PixelPlane } {
  const width = 8;
  const height = 12;
  const reference = solidPlane(width, height, 0);
  const source = solidPlane(40, height, 8);
  const palette = [
    [224, 45, 35],
    [35, 202, 72],
    [35, 86, 224],
    [230, 184, 38],
  ] as const;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = palette[(x + y) % palette.length]!;
      const referenceIndex = (y * width + x) * 4;
      reference.rgba.set([...color, 255], referenceIndex);

      const luminance = Math.round(color[0] * .2126 + color[1] * .7152 + color[2] * .0722);
      const distractorIndex = (y * source.width + x) * 4;
      source.rgba.set([luminance, luminance, luminance, 255], distractorIndex);

      const recomposedIndex = (y * source.width + 30 + (width - 1 - x)) * 4;
      source.rgba.set([...color, 255], recomposedIndex);
    }
  }
  return { reference, source };
}

function portraitWithSubject(width = 64, height = 96): PixelPlane {
  const plane = solidPlane(width, height, 0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const normalizedX = (x / (width - 1) - .5) / .28;
      const normalizedY = (y / (height - 1) - .44) / .42;
      const insideSubject = normalizedX * normalizedX + normalizedY * normalizedY <= 1;
      const index = (y * width + x) * 4;
      const background = [15 + Math.round(y * .12), 35, 58 + Math.round(x * .08), 255];
      const subject = [174 + (x % 5) * 8, 84 + (y % 7) * 6, 42 + ((x + y) % 3) * 9, 255];
      plane.rgba.set(insideSubject ? subject : background, index);
    }
  }
  return plane;
}

function edgeWrappingSubject(width = 128, height = 213): PixelPlane {
  const plane = solidPlane(width, height, 0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const subject = y > 22 && y < 205 && (x < 38 || x > 90 || y > 150);
      const centerSky = x >= 38 && x <= 90 && y > 22 && y <= 150;
      const index = (y * width + x) * 4;
      const background = centerSky ? [70, 210, 220, 255] : [20, 45, 80, 255];
      const foreground = [150, 35, 35, 255];
      plane.rgba.set(subject ? foreground : background, index);
    }
  }
  return plane;
}

function sparseSubject(width = 64, height = 96): PixelPlane {
  const plane = solidPlane(width, height, 0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const subject = y >= height * .4 && y < height * .49;
      const index = (y * width + x) * 4;
      const background = [18, 45, 78, 255];
      const foreground = [185 + ((x + y) % 35), 72 + ((x * 3 + y) % 24), 36, 255];
      plane.rgba.set(subject ? foreground : background, index);
    }
  }
  return plane;
}

function mean(values: Uint8ClampedArray, indices: number[]): number {
  return indices.reduce((sum, index) => sum + (values[index] ?? 0), 0) /
    Math.max(1, indices.length);
}

describe("卡面智能焦点", () => {
  it.each([
    [0, .2],
    [4, .4],
    [12, .8],
  ])("能从全景图中找回横向裁切起点 %i", (startX, expectedFocalX) => {
    const source = panorama(20, 12);
    const reference = slicePlane(source, startX, 8);
    const match = estimateSplashFocalX(reference, source);

    expect(match.focalX).toBeCloseTo(expectedFocalX, 5);
    expect(match.score).toBeCloseTo(1, 5);
    expect(match.margin).toBeGreaterThan(.02);
    expect(match.confident).toBe(true);
  });

  it("平坦参考图不会仅凭颜色命中非平坦全景", () => {
    const source = panorama(24, 12);
    const reference = solidPlane(8, 12);
    const match = estimateSplashFocalX(reference, source);

    expect(match.confident).toBe(false);
    expect(match.margin).toBe(0);
  });

  it("重排构图后仍由颜色特征锁定右侧主角，而非左侧灰度干扰", () => {
    const { reference, source } = recomposedColorExample();
    const match = estimateSplashFocalX(reference, source);

    expect(match.focalX).toBeGreaterThan(.75);
    expect(match.score).toBeGreaterThan(.67);
    expect(match.confident).toBe(true);
  });

  it("输入无效时安全回到居中裁切", () => {
    const match = estimateSplashFocalX(solidPlane(8, 8), solidPlane(8, 8));
    expect(match).toMatchObject({ focalX: .5, confidence: 0, confident: false });
  });

  it("把焦点转换为边界内且比例一致的 Canvas 裁切", () => {
    const crop = resolveCoverCrop(1215, 717, 768, 1280, .743);

    expect(crop.sourceWidth).toBeCloseTo(430.2, 1);
    expect(crop.sourceHeight).toBe(717);
    expect(crop.sourceX).toBeGreaterThan(680);
    expect(crop.sourceX + crop.sourceWidth).toBeLessThanOrEqual(1215);
    expect(crop.positionX).toBeCloseTo(crop.sourceX / (1215 - crop.sourceWidth), 5);
  });
});

describe("卡内人物景深", () => {
  it("把中心主体推向近景并让卡缘留在远景", () => {
    const plane = portraitWithSubject();
    const depth = generateReliefDepthMap(plane.rgba, plane.width, plane.height);
    const subjectIndices: number[] = [];
    const edgeIndices: number[] = [];
    for (let y = 0; y < plane.height; y += 1) {
      for (let x = 0; x < plane.width; x += 1) {
        const index = y * plane.width + x;
        const centered = Math.abs(x / plane.width - .5) < .18 &&
          Math.abs(y / plane.height - .44) < .24;
        if (centered) subjectIndices.push(index);
        if (x < 4 || x >= plane.width - 4 || y < 4) edgeIndices.push(index);
      }
    }

    expect(depth.values).toHaveLength(plane.width * plane.height);
    expect(mean(depth.values, subjectIndices) - mean(depth.values, edgeIndices)).toBeGreaterThan(60);
    expect(depth.stats.maximum - depth.stats.minimum).toBeGreaterThan(.35);
    expect(depth.confidence).toBeGreaterThan(.4);
  });

  it("纯色原画不会凭空生成中央鼓包", () => {
    const plane = solidPlane(40, 60, 80);
    const depth = generateReliefDepthMap(plane.rgba, plane.width, plane.height);
    const range = Math.max(...depth.values) - Math.min(...depth.values);

    expect(range).toBeLessThanOrEqual(2);
    expect(depth.confidence).toBe(0);
  });

  it("主体包住画面边缘时不会把中央平滑背景错误推到最前", () => {
    const plane = edgeWrappingSubject();
    const depth = generateReliefDepthMap(plane.rgba, plane.width, plane.height);
    const subjectIndices: number[] = [];
    const backgroundIndices: number[] = [];
    for (let y = 0; y < plane.height; y += 1) {
      for (let x = 0; x < plane.width; x += 1) {
        const index = y * plane.width + x;
        if (y > 26 && y < 200 && (x < 34 || x > 94 || y > 155)) {
          subjectIndices.push(index);
        } else if (x >= 42 && x <= 86 && y > 30 && y <= 144) {
          backgroundIndices.push(index);
        }
      }
    }

    expect(mean(depth.values, subjectIndices)).toBeGreaterThan(
      mean(depth.values, backgroundIndices) + 5,
    );
  });

  it("小于画面 15% 的稀疏主体仍能形成非零景深", () => {
    const plane = sparseSubject();
    const depth = generateReliefDepthMap(plane.rgba, plane.width, plane.height);

    expect(depth.stats.maximum - depth.stats.minimum).toBeGreaterThan(.08);
    expect(depth.confidence).toBeGreaterThan(0);
  });

  it("同一原画生成确定性的灰度景深", () => {
    const plane = portraitWithSubject(32, 48);
    const first = generateReliefDepthMap(plane.rgba, plane.width, plane.height);
    const second = generateReliefDepthMap(plane.rgba, plane.width, plane.height);

    expect(first.values).toEqual(second.values);
    expect(first.stats).toEqual(second.stats);
  });

  it("拒绝不完整的像素输入", () => {
    expect(() => generateReliefDepthMap(new Uint8ClampedArray(3), 8, 8)).toThrow(/不完整/);
  });

  it("浏览器拒绝读取像素时使用中性景深而不丢弃高清卡面", () => {
    const taintedContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => {
        throw new DOMException("tainted", "SecurityError");
      }),
      fillRect: vi.fn(),
      fillStyle: "",
    } as unknown as CanvasRenderingContext2D;
    const neutralContext = {
      fillRect: vi.fn(),
      fillStyle: "",
    } as unknown as CanvasRenderingContext2D;
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValueOnce(taintedContext as never)
      .mockReturnValueOnce(neutralContext as never);

    try {
      const result = createReliefDepthCanvas(document.createElement("canvas"));
      expect(result.confidence).toBe(0);
      expect(result.canvas).toMatchObject({ width: 96, height: 160 });
      expect(taintedContext.fillRect).not.toHaveBeenCalled();
      expect(neutralContext.fillRect).toHaveBeenCalledWith(0, 0, 96, 160);
    } finally {
      getContext.mockRestore();
    }
  });
});
