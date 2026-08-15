import { getFighterDef } from "../data/roster";
import type { Fighter } from "../engine/types";
import { FACE_CROPS } from "./crops";

export type ArtMap = Map<string, HTMLImageElement>;

function lean(fighter: Fighter): number {
  if (fighter.pose === "walk") return fighter.facing * 0.08 * Math.sin(fighter.poseFrame / 4);
  if (fighter.pose === "attack" || fighter.pose === "special") return fighter.facing * 0.18;
  if (fighter.pose === "hitstun") return -fighter.facing * 0.22;
  if (fighter.pose === "crouch") return 0.04;
  if (fighter.pose === "jump") return fighter.facing * 0.1;
  return fighter.facing * 0.02 * Math.sin(Date.now() / 280);
}

export function drawPuppet(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  cameraX: number,
  groundY: number,
  art: ArtMap,
): void {
  const def = getFighterDef(fighter.id);
  const image = art.get(fighter.id);
  const x = fighter.x - cameraX;
  const y = groundY - fighter.y;
  const height = 210 + (def.height - 170) * 0.4;
  const width = height * 0.55;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(fighter.facing, 1);
  ctx.rotate(lean(fighter) * fighter.facing);
  if (fighter.pose === "crouch") ctx.scale(1.05, 0.78);
  if (fighter.pose === "knockdown" || fighter.pose === "ko") ctx.rotate(-1.15);

  if (fighter.invuln > 0 && fighter.poseFrame % 4 < 2) ctx.globalAlpha = 0.45;
  if (fighter.hitstun > 0) ctx.filter = "brightness(1.8)";

  if (image) {
    ctx.drawImage(image, -width / 2, -height, width, height);
    const crop = FACE_CROPS[fighter.id];
    ctx.drawImage(
      image,
      crop.x,
      crop.y,
      crop.w,
      crop.h,
      -width * 0.22,
      -height - 8,
      width * 0.44,
      width * 0.48,
    );
  } else {
    ctx.fillStyle = def.color;
    ctx.fillRect(-width / 2, -height, width, height);
  }

  if (fighter.pose === "attack" || fighter.pose === "special" || fighter.pose === "super") {
    ctx.fillStyle = def.color;
    ctx.globalAlpha = 0.85;
    const reach = fighter.pose === "super" ? 90 : 58;
    ctx.beginPath();
    ctx.ellipse(reach, -height * 0.45, 22, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(10, -height * 0.5, reach - 10, 10);
  }

  ctx.restore();
}
