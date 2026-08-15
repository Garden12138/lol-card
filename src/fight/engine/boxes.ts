import type { Rect } from "./types";

export function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function worldBox(originX: number, originY: number, facing: 1 | -1, box: Rect): Rect {
  const x = facing === 1 ? originX + box.x : originX - box.x - box.w;
  return { x, y: originY + box.y, w: box.w, h: box.h };
}

export function hurtbox(x: number, y: number, width: number, height: number, crouch: boolean): Rect {
  const h = crouch ? height * 0.62 : height;
  return { x: x - width / 2, y: y, w: width, h };
}
