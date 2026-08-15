import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "../../src/App";
import { createMatch } from "../../src/game/engine/createMatch";
import { GameApp } from "../../src/game/ui/GameApp";
import { PickScreen } from "../../src/game/ui/PickScreen";
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
    expect(screen.getByText(/等待 光辉女郎/)).toBeInTheDocument();
  });

  it("shows Chinese names on pick cards", () => {
    const state = createMatch(2);
    state.prompt.actor = 0;
    state.players[0]!.candidates = ["Garen", "Ahri", "Lux"];
    render(<PickScreen state={state} mySeat={0} onPick={() => undefined} />);
    expect(screen.getByText(/盖伦/)).toBeInTheDocument();
    expect(screen.getByText(/坚韧/)).toBeInTheDocument();
  });

  it("labels blue and red seats in a 2v2 table", () => {
    const started = pickAll(
      createMatch({
        mode: "team",
        seed: 4,
        seatCount: 4,
        controllers: ["human", "ai", "ai", "ai"],
      }),
    );
    render(<GameApp onExit={() => undefined} initialState={started} />);
    expect(screen.getAllByText(/蓝方/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/红方/).length).toBeGreaterThan(0);
  });
});
