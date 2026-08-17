import { getChampionById } from "../../data/champions";
import { getCardDef } from "../data/cards";
import { computedAtk, computedDef } from "../engine/helpers";
import type { CardInstance, DuelState } from "../engine/types";

export function cardArt(defId: string): string | undefined {
  const champ = getCardDef(defId).championId;
  if (!champ) return undefined;
  return getChampionById(champ)?.skins.find((skin) => skin.isBase)?.loadingUrl;
}

export function CardView({
  card,
  state,
  hidden,
  onClick,
}: {
  card: CardInstance;
  state: DuelState;
  hidden?: boolean;
  onClick?: () => void;
}) {
  const def = getCardDef(card.defId);
  const art = cardArt(def.id);
  const atk = def.kind === "monster" ? computedAtk(state, card) : null;
  const defStat = def.kind === "monster" ? computedDef(card) : null;
  return (
    <button type="button" className={`ygo-card ${hidden ? "is-hidden" : ""} ${card.face === "down" ? "is-set" : ""}`} onClick={onClick}>
      {hidden || card.face === "down" ? (
        <span className="ygo-card__back">峡谷</span>
      ) : (
        <>
          {art ? <span className="ygo-card__art" style={{ backgroundImage: `url("${art}")` }} /> : null}
          <strong>{def.name}</strong>
          {atk !== null ? (
            <small>
              {def.monsterType === "xyz"
                ? `R${def.rank} ${atk}/${defStat} 素材 ${card.overlays?.length ?? 0}`
                : `${def.level}★ ${atk}/${defStat}`}{" "}
              {card.position === "def" ? "守" : "攻"}
            </small>
          ) : (
            <small>{def.kind === "spell" ? "魔法" : "陷阱"}</small>
          )}
        </>
      )}
    </button>
  );
}
