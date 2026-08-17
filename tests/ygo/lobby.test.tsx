import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LobbyScreen } from "../../src/ygo/ui/LobbyScreen";

describe("峡谷决斗大厅", () => {
  it("lists three precons and starts a duel", async () => {
    const user = userEvent.setup();
    const onDeck = vi.fn();
    const onStart = vi.fn();
    render(
      <LobbyScreen deckId="piltover" onDeck={onDeck} onStart={onStart} onExit={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: /德玛西亚军势/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /皮城工坊/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /暗影虚空/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /符文叠层/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /德玛西亚军势/ }));
    expect(onDeck).toHaveBeenCalledWith("demacia");

    await user.click(screen.getByRole("button", { name: "开始决斗" }));
    expect(onStart).toHaveBeenCalled();
  });
});
