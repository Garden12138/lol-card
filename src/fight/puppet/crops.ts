import type { FighterId } from "../engine/types";

export type Crop = { x: number; y: number; w: number; h: number };

/** 相对 loading 图 (308x560) 的头像裁切，按官方竖构图估算。 */
export const FACE_CROPS: Record<FighterId, Crop> = {
  Ahri: { x: 90, y: 36, w: 130, h: 140 },
  Garen: { x: 86, y: 28, w: 140, h: 150 },
  Yasuo: { x: 88, y: 40, w: 132, h: 148 },
  Lux: { x: 92, y: 42, w: 124, h: 138 },
  LeeSin: { x: 84, y: 48, w: 140, h: 150 },
  Katarina: { x: 94, y: 38, w: 122, h: 136 },
  Ezreal: { x: 90, y: 44, w: 128, h: 140 },
  Thresh: { x: 78, y: 22, w: 150, h: 160 },
};
