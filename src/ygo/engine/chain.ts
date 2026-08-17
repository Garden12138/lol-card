import { getCardDef } from "../data/cards";
import { applyResolve, consumeActivatedCard } from "./effects";
import { log } from "./helpers";
import { resolveBattle } from "./battle";
import { detachOverlays } from "./xyz";
import type { Action, DuelState } from "./types";

export function pushChain(state: DuelState, action: Extract<Action, { type: "activate" }>): void {
  const card =
    findCard(state, action.uid) ??
    (() => {
      throw new Error("missing card");
    })();
  const def = getCardDef(card.defId);
  if ((def.detachCost ?? 0) > 0) detachOverlays(state, card, def.detachCost ?? 0);
  state.chain.push({
    uid: action.uid,
    defId: card.defId,
    effect: def.resolve,
    controller: card.owner,
    targets: action.targets,
    fusionId: action.fusionId,
    materials: action.materials,
  });
  consumeActivatedCard(state, action.uid);
  state.respondPassed = 0;
  state.prompt = { kind: "respond", actor: card.owner === 0 ? 1 : 0 };
  log(state, `发动 ${def.name}`);
}

function findCard(state: DuelState, uid: string) {
  for (const player of state.players) {
    const singles = [...player.hand, ...player.gy, ...player.extra, ...player.monsters, ...player.spells, player.field];
    for (const card of singles) {
      if (card && card.uid === uid) return card;
    }
  }
  return null;
}

export function passResponse(state: DuelState): void {
  state.respondPassed += 1;
  if (state.respondPassed < 2 && state.chain.length > 0) {
    state.prompt = { kind: "respond", actor: state.prompt.actor === 0 ? 1 : 0 };
    return;
  }
  while (state.chain.length > 0) {
    const link = state.chain.pop()!;
    applyResolve(state, link);
  }
  state.respondPassed = 0;
  if (state.attack) resolveBattle(state);
  if (state.phase !== "gameOver") {
    state.prompt = { kind: "free", actor: state.turnPlayer };
  }
}

export function openRespondAfterAttack(state: DuelState): void {
  state.respondPassed = 0;
  state.prompt = { kind: "respond", actor: state.turnPlayer === 0 ? 1 : 0 };
}
