import { shuffleInPlace } from "./rng";
import { player } from "./helpers";
import type { CardKind, GameCard, GameState, PlayerId, Suit } from "./types";

const SUITS: Suit[] = ["spade", "heart", "club", "diamond"];

function cards(kind: CardKind, count: number, startId: number): GameCard[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${kind}-${startId + i}`,
    kind,
    suit: SUITS[(startId + i) % 4]!,
    rank: ((startId + i) % 13) + 1,
  }));
}

export function buildDeck(): GameCard[] {
  return [
    ...cards("strike", 24, 0),
    ...cards("dodge", 12, 100),
    ...cards("heal", 8, 200),
    ...cards("barrier", 4, 300),
    ...cards("supply", 4, 400),
    ...cards("smite", 4, 500),
    ...cards("plunder", 4, 600),
    ...cards("duel", 2, 700),
    ...cards("stun", 2, 800),
    ...cards("minionWave", 2, 900),
    ...cards("volley", 2, 1000),
    {
      id: "doransBlade-0",
      kind: "doransBlade",
      suit: "diamond",
      rank: 1,
    },
    {
      id: "infinityEdge-0",
      kind: "infinityEdge",
      suit: "spade",
      rank: 2,
    },
    {
      id: "adaptiveHelm-0",
      kind: "adaptiveHelm",
      suit: "club",
      rank: 3,
    },
    {
      id: "thornmail-0",
      kind: "thornmail",
      suit: "spade",
      rank: 4,
    },
    {
      id: "boots-0",
      kind: "boots",
      suit: "heart",
      rank: 5,
    },
    {
      id: "gargoyle-0",
      kind: "gargoyle",
      suit: "club",
      rank: 6,
    },
  ];
}

export const DECK_SIZE = 74;

export function shuffleDeck(deck: GameCard[], rngState: number): { deck: GameCard[]; rngState: number } {
  const copy = [...deck];
  const next = shuffleInPlace(copy, rngState);
  return { deck: copy, rngState: next };
}

export function drawCards(state: GameState, id: PlayerId, count: number): void {
  const seat = player(state, id);
  for (let i = 0; i < count; i += 1) {
    if (state.deck.length === 0) {
      if (state.discard.length === 0) break;
      const shuffled = shuffleDeck(state.discard, state.rngState);
      state.deck = shuffled.deck;
      state.discard = [];
      state.rngState = shuffled.rngState;
    }
    const card = state.deck.shift();
    if (!card) break;
    seat.hand.push(card);
  }
}

export function judgeCard(state: GameState): GameCard | undefined {
  if (state.deck.length === 0) {
    if (state.discard.length === 0) return undefined;
    const shuffled = shuffleDeck(state.discard, state.rngState);
    state.deck = shuffled.deck;
    state.discard = [];
    state.rngState = shuffled.rngState;
  }
  const card = state.deck.shift();
  if (card) state.discard.push(card);
  return card;
}
