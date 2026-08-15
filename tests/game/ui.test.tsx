import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/App";
import { createMatch } from "../../src/game/engine/createMatch";
import { GameApp } from "../../src/game/ui/GameApp";
import { pickAll } from "./helpers";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("峡谷身份战入口", () => {
  it("renders the play mode picker instead of the gallery viewer", () => {
    window.history.replaceState(null, "", "?mode=play");
    render(<App />);
    expect(screen.getByRole("heading", { name: /峡谷身份战/ })).toBeInTheDocument();
    expect(screen.queryByText("加入对比")).not.toBeInTheDocument();
  });

  it("lets the human play a legal strike from a seeded table", () => {
    const started = pickAll(createMatch(2));
    started.players[0]!.championId = "Garen";
    started.players[1]!.championId = "Lux";
    started.players[1]!.equipment = {};
    started.players[0]!.equipment = {};
    started.players[0]!.hand = [{ id: "s1", kind: "strike", suit: "spade", rank: 1 }];
    started.currentPlayer = 0;
    started.strikeUsedThisTurn = false;
    started.phase = "play";
    started.prompt = {
      kind: "playCard",
      actor: 0,
      legalCardIds: [],
      legalTargetIds: [],
      canCancel: false,
      message: "出牌阶段：打出一张牌、发动技能或结束出牌",
    };
    render(<GameApp onExit={() => undefined} initialState={started} />);
    fireEvent.click(screen.getByLabelText(/普攻/));
    fireEvent.click(screen.getByLabelText(/座位 1/));
    expect(screen.getByText("请打出闪避（仍需 1 张）或取消")).toBeInTheDocument();
  });
});
