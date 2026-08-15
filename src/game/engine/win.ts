import { IDENTITY_NAMES } from "../data/copy";
import { getGameChampion, isKillDrawSkill } from "../data/champions";
import { drawCards } from "./deck";
import { alivePlayers, log, player, teamOf } from "./helpers";
import type { GameState, PlayerId } from "./types";

function endGame(state: GameState, winner: NonNullable<GameState["winner"]>, message: string, winnerSeat?: PlayerId) {
  state.winner = winner;
  state.winnerSeat = winnerSeat;
  state.phase = "gameOver";
  state.prompt = {
    kind: "gameOver",
    actor: 0,
    legalCardIds: [],
    legalTargetIds: [],
    canCancel: false,
    message,
  };
  return state;
}

export function checkWinner(state: GameState): GameState {
  const living = alivePlayers(state);
  if (state.config.mode === "duel") {
    if (living.length === 1) {
      return endGame(state, "duel", `${living[0]!.championId || `座位${living[0]!.id}`} 获胜`, living[0]!.id);
    }
    if (living.length === 0) return endGame(state, "duel", "双方同尽", 0);
    return state;
  }
  if (state.config.mode === "team") {
    const blue = living.filter((item) => teamOf(item.id) === "blue");
    const red = living.filter((item) => teamOf(item.id) === "red");
    if (blue.length === 0) return endGame(state, "red", "红方胜利");
    if (red.length === 0) return endGame(state, "blue", "蓝方胜利");
    return state;
  }
  const baronAlive = living.some((item) => item.identity === "baron");
  const threatAlive = living.some(
    (item) => item.identity === "invader" || item.identity === "shadow",
  );
  if (!threatAlive && baronAlive) return endGame(state, "baronSide", "男爵阵营胜利");
  if (!baronAlive) {
    const onlyShadow = living.length === 1 && living[0]!.identity === "shadow";
    return endGame(state, onlyShadow ? "shadow" : "invaders", onlyShadow ? "影刃胜利" : "入侵者胜利");
  }
  return state;
}

export function applyDeath(state: GameState, victimId: PlayerId, killerId?: PlayerId): GameState {
  const victim = player(state, victimId);
  if (!victim.alive) return checkWinner(state);
  victim.alive = false;
  victim.hp = 0;
  const role =
    state.config.mode === "identity" ? `（${IDENTITY_NAMES[victim.identity]}）` : "";
  log(state, `${seatName(state, victimId)}${role} 阵亡。`);
  if (killerId !== undefined && player(state, killerId).alive) {
    const killer = player(state, killerId);
    if (state.config.mode === "identity") {
      if (victim.identity === "invader") {
        drawCards(state, killerId, 3);
        log(state, `${seatName(state, killerId)} 击杀入侵者，摸 3 张牌。`);
      }
      if (victim.identity === "vanguard" && killer.identity === "baron") {
        state.discard.push(...killer.hand);
        killer.hand = [];
        log(state, "男爵击杀先锋，弃置所有手牌。");
      }
    }
    const def = getGameChampion(killer.championId);
    if (def && isKillDrawSkill(def.skillId)) {
      drawCards(state, killerId, 3);
      log(state, `${seatName(state, killerId)} 发动暴走，再摸 3 张牌。`);
    }
  }
  return checkWinner(state);
}

export function seatName(state: GameState, id: PlayerId): string {
  return player(state, id).championId || `座位${id}`;
}
