import { STAGE } from "../data/stages";
import { getFighterDef } from "../data/roster";
import type { FightState } from "../engine/types";
import { drawPuppet, type ArtMap } from "../puppet/renderPuppet";

export function drawStage(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, STAGE.skyTop);
  sky.addColorStop(1, STAGE.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(80, 140, 120, 0.18)";
  ctx.beginPath();
  ctx.moveTo(width * 0.2, height * 0.55);
  ctx.lineTo(width * 0.5, height * 0.22);
  ctx.lineTo(width * 0.8, height * 0.55);
  ctx.fill();

  ctx.fillStyle = STAGE.ground;
  ctx.fillRect(0, height * 0.72, width, height * 0.28);
  ctx.fillStyle = STAGE.grass;
  ctx.fillRect(0, height * 0.72, width, 18);

  ctx.fillStyle = "rgba(180, 190, 160, 0.35)";
  ctx.fillRect(40, height * 0.48, 36, height * 0.24);
  ctx.fillRect(width - 76, height * 0.48, 36, height * 0.24);
}

export function drawMatch(
  ctx: CanvasRenderingContext2D,
  state: FightState,
  art: ArtMap,
  viewW: number,
  viewH: number,
): void {
  ctx.clearRect(0, 0, viewW, viewH);
  drawStage(ctx, viewW, viewH);
  const mid = (state.fighters[0].x + state.fighters[1].x) / 2;
  const cameraX = mid - viewW / 2;
  const groundY = viewH * 0.72;

  for (const shot of state.projectiles) {
    const def = getFighterDef(state.fighters[shot.owner].id);
    ctx.fillStyle = def.color;
    ctx.globalAlpha = shot.delay > 0 ? 0.4 : 0.9;
    if (shot.beam) {
      ctx.fillRect(shot.x - cameraX - shot.w / 2, groundY - shot.y - shot.h / 2, shot.w, shot.h);
    } else {
      ctx.beginPath();
      ctx.ellipse(shot.x - cameraX, groundY - shot.y, shot.w / 2, shot.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawPuppet(ctx, state.fighters[0], cameraX, groundY, art);
  drawPuppet(ctx, state.fighters[1], cameraX, groundY, art);

  if (state.phase === "intro") {
    ctx.fillStyle = "rgba(8, 12, 18, 0.35)";
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = "#e8d5a3";
    ctx.font = "700 48px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(state.phaseFrame < 50 ? "ROUND " + state.round : "FIGHT", viewW / 2, viewH / 2);
  }
  if (state.phase === "ko" || state.phase === "timeout") {
    ctx.fillStyle = "#f2d48a";
    ctx.font = "700 56px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(state.phase === "ko" ? "K.O." : "TIME", viewW / 2, viewH / 2);
  }
}
