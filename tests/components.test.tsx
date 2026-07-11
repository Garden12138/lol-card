import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CardMini } from "../src/components/CardMini";
import { ChampionDetail } from "../src/components/ChampionDetail";
import { ComparisonSection } from "../src/components/ComparisonSection";
import { champions } from "../src/data/champions";
import { getCardArtworkCandidates } from "../src/lib/cardTexture";
import { toCardEditionKey } from "../src/lib/urlState";

const ahri = champions.find((champion) => champion.id === "Ahri")!;
const baseSkin = ahri.skins[0]!;

describe("卡片展示", () => {
  it("主卡面优先使用高清 splash 原画并保留竖版回退", () => {
    expect(getCardArtworkCandidates(baseSkin)).toEqual([baseSkin.splashUrl, baseSkin.loadingUrl]);
  });

  it("按受控状态展示正反面，并提供卡面文本替代", () => {
    const { container, rerender } = render(<CardMini champion={ahri} skin={baseSkin} />);
    expect(screen.getByLabelText(`${ahri.title} · ${baseSkin.name}`)).toBeInTheDocument();
    expect(container.querySelector(".card-mini")).not.toHaveClass("is-flipped");

    rerender(<CardMini champion={ahri} skin={baseSkin} flipped />);
    expect(container.querySelector(".card-mini")).toHaveClass("is-flipped");
  });

  it("技能详情按钮暴露展开状态", async () => {
    const user = userEvent.setup();
    render(<ChampionDetail champion={ahri} skin={baseSkin} />);
    const passive = screen.getByRole("button", { name: new RegExp(ahri.passive.name) });
    expect(passive).toHaveAttribute("aria-expanded", "true");

    const firstSpell = screen.getByRole("button", { name: new RegExp(ahri.spells[0]!.name) });
    await user.click(firstSpell);
    expect(firstSpell).toHaveAttribute("aria-expanded", "true");
    expect(passive).toHaveAttribute("aria-expanded", "false");
  });
});

describe("卡面对比", () => {
  it("统一翻面并提供移除和排序替代按钮", () => {
    const onRemove = vi.fn();
    const item = {
      key: toCardEditionKey(ahri.id, baseSkin.num),
      champion: ahri,
      skin: baseSkin,
    };
    const { container } = render(
      <ComparisonSection
        items={[item]}
        onReorder={vi.fn()}
        onRemove={onRemove}
        onClear={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "统一翻面" }));
    expect(container.querySelector(".card-mini")).toHaveClass("is-flipped");
    expect(screen.getByRole("button", { name: new RegExp(`将${ahri.title}.*左移`) })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`移除${ahri.title}`) }));
    expect(onRemove).toHaveBeenCalledWith(item.key);
  });
});
