import type { Action } from "../engine/types";

export function PromptBar({
  actions,
  onAct,
  label,
}: {
  actions: Action[];
  onAct: (action: Action) => void;
  label: string;
}) {
  const next = actions.find((action) => action.type === "nextPhase");
  const pass = actions.find((action) => action.type === "respondPass");
  const synchro = actions.find((action) => action.type === "synchroSummon");
  return (
    <div className="ygo-prompt">
      <p>{label}</p>
      <div className="ygo-prompt__row">
        {synchro ? (
          <button type="button" onClick={() => onAct(synchro)}>
            同调召唤
          </button>
        ) : null}
        {pass ? (
          <button type="button" onClick={() => onAct(pass)}>
            通过
          </button>
        ) : null}
        {next ? (
          <button type="button" onClick={() => onAct(next)}>
            下一阶段
          </button>
        ) : null}
      </div>
    </div>
  );
}
