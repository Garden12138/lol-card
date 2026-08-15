import { legalActions } from "../engine/reduce";
import type { Action, DuelState } from "../engine/types";
import { ChainStack } from "./ChainStack";
import { FieldBoard, PileCounts } from "./FieldBoard";
import { HandDock } from "./HandDock";
import { PromptBar } from "./PromptBar";

const PHASE_LABEL: Record<string, string> = {
  main1: "主要阶段 1",
  battle: "战斗阶段",
  main2: "主要阶段 2",
  draw: "抽卡阶段",
  respond: "连锁响应",
};

export function DuelScreen({
  state,
  onAct,
  onExit,
}: {
  state: DuelState;
  onAct: (action: Action) => void;
  onExit: () => void;
}) {
  const actions = legalActions(state);
  const foe = state.players[1];
  const me = state.players[0];
  const label =
    state.prompt.kind === "respond"
      ? "连锁窗口：可以发动速攻魔法 / 陷阱，或通过"
      : `${PHASE_LABEL[state.phase] ?? state.phase} · ${state.prompt.actor === 0 ? "轮到你" : "对方行动"}`;
  return (
    <div className="ygo-duel">
      <header className="ygo-header">
        <div>
          <strong>
            LP {foe.lp} — 你 {me.lp}
          </strong>
          <small>
            回合 {state.turn} · {PHASE_LABEL[state.phase] ?? state.phase}
          </small>
        </div>
        <button type="button" onClick={onExit}>
          离开
        </button>
      </header>
      <p className="ygo-hand-backs">对方手牌 {foe.hand.length}</p>
      <PileCounts state={state} id={1} />
      <FieldBoard state={state} me={0} actions={actions} onAct={onAct} />
      <PileCounts state={state} id={0} actions={actions} onAct={onAct} />
      <ChainStack state={state} />
      <PromptBar actions={actions} onAct={onAct} label={label} />
      <HandDock state={state} actions={actions} onAct={onAct} />
      <ol className="ygo-log">
        {state.log.slice(-8).map((line, index) => (
          <li key={`${line}-${index}`}>{line}</li>
        ))}
      </ol>
    </div>
  );
}
