import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SelectScreen } from "../../src/fight/ui/SelectScreen";

describe("格斗选人", () => {
  it("可选英雄、对战对象并开始", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    const onP2 = vi.fn();
    const onVersus = vi.fn();
    render(
      <SelectScreen
        p1="Ahri"
        p2="Garen"
        versus="ai"
        difficulty="normal"
        onP1={vi.fn()}
        onP2={onP2}
        onVersus={onVersus}
        onDifficulty={vi.fn()}
        onStart={onStart}
        onExit={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button", { name: /亚索/ }).length).toBe(2);
    await user.click(screen.getByRole("button", { name: "本地双人" }));
    expect(onVersus).toHaveBeenCalledWith("local");
    await user.click(screen.getByRole("button", { name: "开始对战" }));
    expect(onStart).toHaveBeenCalled();
  });
});
