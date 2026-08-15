import { lazy, Suspense } from "react";
import { getChampionById, getSkinByNum } from "../../data/champions";
import type { GameCard } from "../engine/types";
import { SpellCardFace } from "./SpellCardFace";

const CardViewer3D = lazy(() =>
  import("../../components/CardViewer3D").then((module) => ({ default: module.CardViewer3D })),
);

export function CastOverlay({
  championId,
  card,
  onClose,
}: {
  championId?: string;
  card?: GameCard;
  onClose: () => void;
}) {
  const champion = championId ? getChampionById(championId) : undefined;
  const skin = champion ? getSkinByNum(champion, 0) : undefined;
  return (
    <div className="rift-cast" role="dialog" aria-label="卡牌聚焦">
      <button type="button" className="rift-cast__close" onClick={onClose}>
        关闭
      </button>
      {champion && skin ? (
        <Suspense fallback={<p>正在装裱卡片…</p>}>
          <CardViewer3D champion={champion} skin={skin} variant="cast" className="w-full" />
        </Suspense>
      ) : card ? (
        <SpellCardFace card={card} />
      ) : null}
    </div>
  );
}
