import { CARD_NAMES } from "../data/copy";
import { getGameChampion } from "../data/champions";
import { drawCards, judgeCard } from "./deck";
import { equipmentList, inAttackRange } from "./distance";
import { alivePlayers, log, nextAlive, player } from "./helpers";
import { applyDeath, checkWinner, seatName } from "./win";
import type {
  EffectFrame,
  GameCard,
  GameState,
  PlayerId,
  Prompt,
} from "./types";

const TRICKS = new Set(["barrier", "supply", "smite", "plunder", "duel", "stun", "minionWave", "volley"]);
const EQUIP = {
  doransBlade: "weapon",
  infinityEdge: "weapon",
  adaptiveHelm: "armor",
  thornmail: "armor",
  boots: "offensiveMount",
  gargoyle: "defensiveMount",
} as const;

export function isRed(card: GameCard): boolean {
  return card.suit === "heart" || card.suit === "diamond";
}

export function isTrick(kind: string): boolean {
  return TRICKS.has(kind);
}

export function isEquip(kind: string): kind is keyof typeof EQUIP {
  return kind in EQUIP;
}

export function playPhasePrompt(state: GameState): void {
  state.phase = "play";
  state.prompt = {
    kind: "playCard",
    actor: state.currentPlayer,
    legalCardIds: [],
    legalTargetIds: [],
    canCancel: false,
    message: "出牌阶段：打出一张牌、发动技能或结束出牌",
  };
}

export function beginTurn(state: GameState, id: PlayerId): GameState {
  if (state.winner) return state;
  const seat = player(state, id);
  if (!seat.alive) return beginTurn(state, nextAlive(state, id));
  state.currentPlayer = id;
  state.turnCount += 1;
  state.strikeUsedThisTurn = false;
  state.skipPlayPhase = false;
  seat.skillUsedThisTurn = false;
  seat.damagedThisTurn = false;
  seat.cannotDodgeUntilTurnEnd = false;
  seat.extraDodgeRequired = 0;
  seat.unlimitedStrikeThisTurn = false;
  for (const other of state.players) {
    if (other.id !== id) other.cannotDodgeUntilTurnEnd = false;
  }
  state.phase = "judge";
  const stun = seat.judged.find((card) => card.kind === "stun");
  if (stun) {
    const judged = judgeCard(state);
    seat.judged = seat.judged.filter((card) => card.id !== stun.id);
    state.discard.push(stun);
    if (judged && judged.suit !== "heart") {
      state.skipPlayPhase = true;
      log(state, `${seatName(state, id)} 判定晕眩，跳过出牌阶段。`);
    } else {
      log(state, `${seatName(state, id)} 判定晕眩，红桃结算，照常出牌。`);
    }
  }
  state.phase = "draw";
  const before = seat.hand.length;
  drawCards(state, id, 2);
  log(state, `${seatName(state, id)} 摸了 ${seat.hand.length - before} 张牌。`);
  if (state.skipPlayPhase) return enterDiscard(state);
  playPhasePrompt(state);
  return state;
}

export function enterDiscard(state: GameState): GameState {
  const seat = player(state, state.currentPlayer);
  if (seat.hand.length > seat.hp) {
    state.phase = "discard";
    state.prompt = {
      kind: "discardToHp",
      actor: seat.id,
      legalCardIds: seat.hand.map((card) => card.id),
      legalTargetIds: [],
      canCancel: false,
      message: `弃牌至 ${seat.hp} 张`,
    };
    return state;
  }
  return finishTurn(state);
}

export function finishTurn(state: GameState): GameState {
  state.phase = "end";
  const seat = player(state, state.currentPlayer);
  const def = getGameChampion(seat.championId);
  if (def?.skillId === "garen-perseverance" && seat.alive && !seat.damagedThisTurn && seat.hp < seat.maxHp) {
    seat.hp += 1;
    log(state, `${seatName(state, seat.id)} 发动坚韧，回复 1 点体力。`);
  }
  if (state.winner) return state;
  return beginTurn(state, nextAlive(state, state.currentPlayer));
}

export function takeCardFromHand(seat: ReturnType<typeof player>, cardId: string): GameCard | undefined {
  const index = seat.hand.findIndex((card) => card.id === cardId);
  if (index < 0) return undefined;
  return seat.hand.splice(index, 1)[0];
}

export function discardFromHand(state: GameState, id: PlayerId, cardId: string): GameCard | undefined {
  const card = takeCardFromHand(player(state, id), cardId);
  if (card) state.discard.push(card);
  return card;
}

export function installEquip(state: GameState, id: PlayerId, card: GameCard): void {
  const slot = EQUIP[card.kind as keyof typeof EQUIP];
  const seat = player(state, id);
  const prev = seat.equipment[slot];
  if (prev) state.discard.push(prev);
  seat.equipment[slot] = card;
}

export function recover(state: GameState, id: PlayerId, amount = 1): void {
  const seat = player(state, id);
  if (!seat.alive) return;
  seat.hp = Math.min(seat.maxHp, seat.hp + amount);
}

export function dealDamage(
  state: GameState,
  targetId: PlayerId,
  sourceId: PlayerId | undefined,
  amount: number,
  fromStrike: boolean,
): GameState {
  const target = player(state, targetId);
  if (!target.alive || amount <= 0) return state;
  target.hp -= amount;
  target.damagedThisTurn = true;
  log(state, `${seatName(state, targetId)} 受到 ${amount} 点伤害。`);
  if (fromStrike && sourceId !== undefined && target.equipment.armor?.kind === "thornmail") {
    const source = player(state, sourceId);
    if (source.alive && sourceId !== targetId) {
      source.hp -= 1;
      source.damagedThisTurn = true;
      log(state, `荆棘之甲对 ${seatName(state, sourceId)} 造成 1 点伤害。`);
      if (source.hp <= 0) startDying(state, sourceId, targetId);
    }
  }
  if (target.hp <= 0) startDying(state, targetId, sourceId);
  return checkWinner(state);
}

export function startDying(state: GameState, victimId: PlayerId, killerId?: PlayerId): void {
  const victim = player(state, victimId);
  if (victim.hp > 0 || !victim.alive) return;
  const remaining: PlayerId[] = [];
  for (let step = 0; step < 4; step += 1) {
    const id = ((victimId + step) % 4) as PlayerId;
    if (player(state, id).alive) remaining.push(id);
  }
  state.stack.push({
    kind: "dying",
    source: killerId ?? victimId,
    target: victimId,
    remaining,
  });
  askDying(state);
}

function askDying(state: GameState): void {
  const frame = state.stack[state.stack.length - 1];
  if (!frame || frame.kind !== "dying" || frame.target === undefined) return;
  const victim = player(state, frame.target);
  if (victim.hp > 0) {
    state.stack.pop();
    resumeAfterStack(state);
    return;
  }
  while (frame.remaining.length > 0) {
    const actor = frame.remaining[0]!;
    const heals = player(state, actor).hand.filter((card) => card.kind === "heal");
    if (heals.length === 0) {
      frame.remaining.shift();
      continue;
    }
    state.prompt = {
      kind: "dyingHeal",
      actor,
      source: frame.target,
      legalCardIds: heals.map((card) => card.id),
      legalTargetIds: [],
      canCancel: true,
      message: `${seatName(state, frame.target)} 濒死，是否使用治疗？`,
    };
    return;
  }
  state.stack.pop();
  applyDeath(state, frame.target, frame.source === frame.target ? undefined : frame.source);
  if (!state.winner) resumeAfterStack(state);
}

export function respondHeal(state: GameState, actor: PlayerId, cardId?: string): GameState {
  if (state.prompt.kind !== "dyingHeal" || state.prompt.actor !== actor) return state;
  const frame = state.stack[state.stack.length - 1];
  if (!frame || frame.target === undefined) return state;
  if (cardId) {
    const card = discardFromHand(state, actor, cardId);
    if (!card || card.kind !== "heal") return state;
    recover(state, frame.target, 1);
    log(state, `${seatName(state, actor)} 使用治疗，${seatName(state, frame.target)} 回复 1 点体力。`);
  } else {
    frame.remaining.shift();
  }
  askDying(state);
  return state;
}

function resumeAfterStack(state: GameState): void {
  if (state.winner) return;
  const frame = state.stack[state.stack.length - 1];
  if (!frame) {
    if (state.phase === "play") playPhasePrompt(state);
    else if (state.phase === "discard") enterDiscard(state);
    return;
  }
  if (frame.kind === "dying") askDying(state);
  else if (frame.kind === "aoe") askAoe(state, frame);
  else if (frame.kind === "duel") askDuel(state, frame);
  else playPhasePrompt(state);
}

export function canUseStrikeThisTurn(state: GameState, id: PlayerId): boolean {
  return player(state, id).unlimitedStrikeThisTurn || !state.strikeUsedThisTurn;
}

export function markStrikeUsed(state: GameState, id: PlayerId): void {
  if (!player(state, id).unlimitedStrikeThisTurn) state.strikeUsedThisTurn = true;
}

export function cardCanBeStrike(state: GameState, id: PlayerId, card: GameCard): boolean {
  if (card.kind === "strike") return true;
  return card.kind === "dodge" && getGameChampion(player(state, id).championId)?.skillId === "yasuo-steel-tempest";
}

export function startStrike(
  state: GameState,
  source: PlayerId,
  target: PlayerId,
  card: GameCard | undefined,
  extraDodges: number,
  virtual: boolean,
): GameState {
  const targetSeat = player(state, target);
  const sourceSeat = player(state, source);
  const darius =
    getGameChampion(sourceSeat.championId)?.skillId === "darius-noxian-might" && targetSeat.hp <= 2;
  if (darius || targetSeat.cannotDodgeUntilTurnEnd) {
    log(state, `${seatName(state, target)} 无法闪避此次普攻。`);
    return dealDamage(state, target, source, 1, true);
  }
  if (targetSeat.equipment.armor?.kind === "adaptiveHelm") {
    const judged = judgeCard(state);
    if (judged && isRed(judged)) {
      log(state, `${seatName(state, target)} 自适应头盔判定为红色，视为闪避。`);
      return state;
    }
  }
  state.stack.push({
    kind: "strike",
    card,
    source,
    target,
    remaining: [target],
    extraDodgesNeeded: extraDodges,
    virtualStrike: virtual,
  });
  askDodge(state);
  return state;
}

function askDodge(state: GameState): void {
  const frame = state.stack[state.stack.length - 1];
  if (!frame || frame.kind !== "strike" || frame.target === undefined) return;
  const target = player(state, frame.target);
  if (target.cannotDodgeUntilTurnEnd) {
    state.stack.pop();
    dealDamage(state, frame.target, frame.source, 1, true);
    resumeAfterStack(state);
    return;
  }
  const dodges = target.hand.filter((card) => card.kind === "dodge");
  state.prompt = {
    kind: "respondDodge",
    actor: frame.target,
    source: frame.source,
    legalCardIds: dodges.map((card) => card.id),
    legalTargetIds: [],
    canCancel: true,
    extraDodgesNeeded: frame.extraDodgesNeeded,
    message: `请打出闪避（仍需 ${frame.extraDodgesNeeded ?? 1} 张）或取消`,
  };
}

export function respondDodge(state: GameState, actor: PlayerId, cardId?: string): GameState {
  const frame = state.stack[state.stack.length - 1];
  if (!frame || frame.kind !== "strike" || state.prompt.actor !== actor) return state;
  if (!cardId) {
    state.stack.pop();
    dealDamage(state, frame.target!, frame.source, 1, true);
    resumeAfterStack(state);
    return state;
  }
  const card = discardFromHand(state, actor, cardId);
  if (!card || card.kind !== "dodge") return state;
  frame.extraDodgesNeeded = (frame.extraDodgesNeeded ?? 1) - 1;
  if ((frame.extraDodgesNeeded ?? 0) > 0) {
    askDodge(state);
    return state;
  }
  state.stack.pop();
  log(state, `${seatName(state, actor)} 打出闪避。`);
  resumeAfterStack(state);
  return state;
}

function barrierAskOrder(state: GameState, source: PlayerId): PlayerId[] {
  const order: PlayerId[] = [];
  let cursor = nextAlive(state, source);
  while (cursor !== source) {
    order.push(cursor);
    cursor = nextAlive(state, cursor);
  }
  order.push(source);
  return order;
}

export function startTrick(state: GameState, source: PlayerId, card: GameCard, target?: PlayerId): GameState {
  const remaining = barrierAskOrder(state, source);
  state.stack.push({
    kind: "trick",
    card,
    source,
    target,
    remaining,
  });
  askBarrier(state);
  return state;
}

function askBarrier(state: GameState): void {
  const frame = state.stack[state.stack.length - 1];
  if (!frame || frame.kind !== "trick" || !frame.card) return;
  while (frame.remaining.length > 0) {
    const actor = frame.remaining.shift()!;
    const barriers = player(state, actor).hand.filter((card) => card.kind === "barrier");
    if (barriers.length === 0) continue;
    state.prompt = {
      kind: "respondBarrier",
      actor,
      source: frame.source,
      cardId: frame.card.id,
      legalCardIds: barriers.map((card) => card.id),
      legalTargetIds: [],
      canCancel: true,
      message: `是否使用屏障抵消 ${CARD_NAMES[frame.card.kind]}？`,
    };
    return;
  }
  resolveTrick(state, frame);
}

export function respondBarrier(state: GameState, actor: PlayerId, cardId?: string): GameState {
  const frame = state.stack[state.stack.length - 1];
  if (!frame || frame.kind !== "trick" || state.prompt.actor !== actor) return state;
  if (cardId) {
    const card = discardFromHand(state, actor, cardId);
    if (!card || card.kind !== "barrier") return state;
    state.stack.pop();
    if (frame.card?.kind === "stun") state.discard.push(frame.card);
    log(state, `${seatName(state, actor)} 使用屏障，效果被抵消。`);
    resumeAfterStack(state);
    return state;
  }
  askBarrier(state);
  return state;
}

function resolveTrick(state: GameState, frame: EffectFrame): void {
  state.stack.pop();
  const card = frame.card!;
  const source = frame.source;
  const target = frame.target;
  if (card.kind === "supply") {
    drawCards(state, source, 2);
    log(state, `${seatName(state, source)} 补给，摸 2 张牌。`);
  } else if (card.kind === "stun" && target !== undefined) {
    player(state, target).judged.push(card);
    log(state, `${seatName(state, target)} 被晕眩。`);
    resumeAfterStack(state);
    return;
  } else if (card.kind === "smite" && target !== undefined) {
    beginAreaChoice(state, source, target, false);
    return;
  } else if (card.kind === "plunder" && target !== undefined) {
    beginAreaChoice(state, source, target, true);
    return;
  } else if (card.kind === "duel" && target !== undefined) {
    state.stack.push({
      kind: "duel",
      card,
      source,
      target,
      remaining: [target],
    });
    askDuel(state, state.stack[state.stack.length - 1]!);
    return;
  } else if (card.kind === "minionWave" || card.kind === "volley") {
    const others = alivePlayers(state)
      .map((item) => item.id)
      .filter((id) => id !== source);
    state.stack.push({
      kind: "aoe",
      card,
      source,
      remaining: others,
    });
    askAoe(state, state.stack[state.stack.length - 1]!);
    return;
  }
  resumeAfterStack(state);
}

function beginAreaChoice(state: GameState, source: PlayerId, target: PlayerId, take: boolean): void {
  const eq = equipmentList(state, target);
  const hasHand = player(state, target).hand.length > 0;
  const legal = [...eq.map((card) => card.id), ...(hasHand ? ["__hand__"] : [])];
  if (legal.length === 0) {
    resumeAfterStack(state);
    return;
  }
  state.pending = { type: "equipOrHand", source, target, take };
  state.prompt = {
    kind: "chooseCardInArea",
    actor: source,
    source: target,
    legalCardIds: legal,
    legalTargetIds: [],
    canCancel: false,
    message: take ? "选择一张牌收入手牌" : "选择一张牌弃置",
  };
}

export function chooseAreaCard(state: GameState, actor: PlayerId, cardId?: string): GameState {
  const pending = state.pending;
  if (!pending || pending.type !== "equipOrHand" || actor !== pending.source || !cardId) return state;
  const target = player(state, pending.target);
  let taken: GameCard | undefined;
  if (cardId === "__hand__") {
    taken = target.hand.shift();
  } else {
    for (const slot of ["weapon", "armor", "offensiveMount", "defensiveMount"] as const) {
      if (target.equipment[slot]?.id === cardId) {
        taken = target.equipment[slot];
        target.equipment[slot] = undefined;
      }
    }
  }
  state.pending = null;
  if (!taken) {
    resumeAfterStack(state);
    return state;
  }
  if (pending.take) {
    player(state, pending.source).hand.push(taken);
    log(state, `${seatName(state, pending.source)} 获得一张牌。`);
  } else {
    state.discard.push(taken);
    log(state, `${seatName(state, pending.source)} 弃置了 ${CARD_NAMES[taken.kind]}。`);
  }
  resumeAfterStack(state);
  return state;
}

function askDuel(state: GameState, frame: EffectFrame): void {
  const actor = frame.remaining[0]!;
  const strikes = player(state, actor).hand.filter((card) => cardCanBeStrike(state, actor, card));
  state.prompt = {
    kind: "respondDuelStrike",
    actor,
    source: frame.source,
    legalCardIds: strikes.map((card) => card.id),
    legalTargetIds: [],
    canCancel: true,
    duelA: frame.source,
    duelB: frame.target,
    message: "单挑：打出普攻或放弃",
  };
}

export function respondDuel(state: GameState, actor: PlayerId, cardId?: string): GameState {
  const frame = state.stack[state.stack.length - 1];
  if (!frame || frame.kind !== "duel" || state.prompt.actor !== actor) return state;
  if (!cardId) {
    state.stack.pop();
    dealDamage(state, actor, actor === frame.source ? frame.target : frame.source, 1, false);
    resumeAfterStack(state);
    return state;
  }
  const card = discardFromHand(state, actor, cardId);
  if (!card || !cardCanBeStrike(state, actor, card)) return state;
  const nextActor = actor === frame.source ? frame.target! : frame.source;
  frame.remaining = [nextActor];
  askDuel(state, frame);
  return state;
}

function hasDyingFrame(state: GameState): boolean {
  return state.stack.some((frame) => frame.kind === "dying");
}

function askAoe(state: GameState, frame: EffectFrame): void {
  frame.remaining = frame.remaining.filter((id) => player(state, id).alive && player(state, id).hp > 0);
  if (frame.remaining.length === 0) {
    state.stack = state.stack.filter((item) => item !== frame);
    resumeAfterStack(state);
    return;
  }
  const actor = frame.remaining[0]!;
  const need = frame.card?.kind === "minionWave" ? "strike" : "dodge";
  const legal = player(state, actor).hand.filter((card) =>
    need === "strike" ? cardCanBeStrike(state, actor, card) : card.kind === "dodge",
  );
  state.prompt = {
    kind: need === "strike" ? "respondMinionWave" : "respondVolley",
    actor,
    source: frame.source,
    legalCardIds: legal.map((card) => card.id),
    legalTargetIds: [],
    canCancel: true,
    message: need === "strike" ? "打出普攻抵消小兵潮，或取消" : "打出闪避抵消齐射，或取消",
  };
}

export function respondAoe(state: GameState, actor: PlayerId, cardId?: string): GameState {
  const frame = [...state.stack].reverse().find((item) => item.kind === "aoe");
  if (!frame || state.prompt.actor !== actor) return state;
  const need = frame.card?.kind === "minionWave" ? "strike" : "dodge";
  if (cardId) {
    const card = discardFromHand(state, actor, cardId);
    const ok = card && (need === "strike" ? cardCanBeStrike(state, actor, card) : card.kind === "dodge");
    if (!ok) return state;
  } else {
    dealDamage(state, actor, frame.source, 1, false);
  }
  frame.remaining.shift();
  if (hasDyingFrame(state)) {
    askDying(state);
    return state;
  }
  askAoe(state, frame);
  return state;
}

export function handleLuxRespond(state: GameState, actor: PlayerId, cardId?: string): GameState {
  const pending = state.pending;
  if (!pending || pending.type !== "luxDiscard" || actor !== pending.target) return state;
  if (cardId) {
    const card = player(state, actor).hand.find((item) => item.id === cardId);
    if (!card || card.suit !== pending.suit) return state;
    discardFromHand(state, actor, cardId);
    log(state, `${seatName(state, actor)} 弃置同花色牌，免伤。`);
  } else {
    dealDamage(state, actor, pending.source, 1, false);
  }
  state.pending = null;
  playPhasePrompt(state);
  return state;
}

export function emptyTargets(): PlayerId[] {
  return [];
}

export { inAttackRange, CARD_NAMES };
