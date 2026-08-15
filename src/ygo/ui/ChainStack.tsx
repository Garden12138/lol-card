import { getCardDef } from "../data/cards";
import type { DuelState } from "../engine/types";

export function ChainStack({ state }: { state: DuelState }) {
  if (state.chain.length === 0 && !state.attack) return null;
  return (
    <ol className="ygo-chain">
      {state.attack ? <li>攻击宣言</li> : null}
      {[...state.chain].reverse().map((link, index) => (
        <li key={`${link.uid}-${index}`}>{getCardDef(link.defId).name}</li>
      ))}
    </ol>
  );
}
