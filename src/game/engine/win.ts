import { IDENTITY_NAMES } from "../data/copy";
import { getGameChampion } from "../data/champions";
import { drawCards } from "./deck";
import { alivePlayers, log, player } from "./helpers";
import type { GameState, PlayerId } from "./types";

export function checkWinner(state: GameState): GameState {
  const living = alivePlayers(state);
  const baronAlive = living.some((item) => item.identity === "baron");
  const threatAlive = living.some(
    (item) => item.identity === "invader" || item.identity === "shadow",
  );
  if (!threatAlive && baronAlive) {
    state.winner = "baronSide";
    state.phase = "gameOver";
    state.prompt = {
      kind: "gameOver",
      actor: 0,
      legalCardIds: [],
      legalTargetIds: [],
      canCancel: false,
      message: "男爵阵营胜利",
    };
    return state;
  }
  if (!baronAlive) {
    const onlyShadow = living.length === 1 && living[0]!.identity === "shadow";
    state.winner = onlyShadow ? "shadow" : "invaders";
    state.phase = "gameOver";
    state.prompt = {
      kind: "gameOver",
      actor: 0,
      legalCardIds: [],
      legalTargetIds: [],
      canCancel: false,
      message: onlyShadow ? "影刃胜利" : "入侵者胜利",
    };
  }
  return state;
}

export function applyDeath(state: GameState, victimId: PlayerId, killerId?: PlayerId): GameState {
  const victim = player(state, victimId);
  if (!victim.alive) return checkWinner(state);
  victim.alive = false;
  victim.hp = 0;
  log(state, `${seatName(state, victimId)}（${IDENTITY_NAMES[victim.identity]}）阵亡。`);
  if (killerId !== undefined && player(state, killerId).alive) {
    const killer = player(state, killerId);
    if (victim.identity === "invader") {
      drawCards(state, killerId, 3);
      log(state, `${seatName(state, killerId)} 击杀入侵者，摸 3 张牌。`);
    }
    if (victim.identity === "vanguard" && killer.identity === "baron") {
      state.discard.push(...killer.hand);
      killer.hand = [];
      log(state, "男爵击杀先锋，弃置所有手牌。");
    }
    const def = getGameChampion(killer.championId);
    if (def?.skillId === "jinx-get-excited") {
      drawCards(state, killerId, 3);
      log(state, `${seatName(state, killerId)} 发动暴走，再摸 3 张牌。`);
    }
  }
  return checkWinner(state);
}

export function seatName(state: GameState, id: PlayerId): string {
  const champ = player(state, id).championId || `座位${id}`;
  return champ;
}
