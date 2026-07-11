import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { champions } from "../src/data/champions";

const mocks = vi.hoisted(() => ({
  createTextures: vi.fn(),
}));

vi.mock("../src/lib/cardTexture", () => ({
  CardTextureError: class CardTextureError extends Error {
    sourceUrl?: string;
  },
  createCardTextureCanvases: mocks.createTextures,
}));

vi.mock("three", () => ({
  WebGLRenderer: class WebGLRenderer {
    constructor() {
      throw new Error("WebGL disabled for test");
    }
  },
}));

import { CardViewer3D } from "../src/components/CardViewer3D";

const draven = champions.find((champion) => champion.id === "Draven")!;
const baseSkin = draven.skins[0]!;

describe("卡面兼容预览", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));

    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as never);

    const front = document.createElement("canvas");
    front.width = 768;
    front.height = 1280;
    const back = document.createElement("canvas");
    back.width = 768;
    back.height = 1280;
    const artwork = document.createElement("canvas");
    artwork.width = 768;
    artwork.height = 1280;
    const overlay = document.createElement("canvas");
    overlay.width = 768;
    overlay.height = 1280;
    const depth = document.createElement("canvas");
    depth.width = 96;
    depth.height = 160;
    mocks.createTextures.mockResolvedValue({
      front,
      back,
      artwork,
      overlay,
      depth,
      depthConfidence: .72,
      artworkFit: { mode: "smart-crop", focalX: .74 },
    });
  });

  it("WebGL 不可用时复用已适配的高清正反面纹理", async () => {
    const { container } = render(<CardViewer3D champion={draven} skin={baseSkin} />);

    expect(await screen.findByText("兼容预览")).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector("section")).toHaveAttribute("data-artwork-fit", "smart-crop");
    });
    expect(container.querySelector("section")).toHaveAttribute("data-depth-effect", "fallback");
    expect(container.querySelectorAll("canvas")).toHaveLength(2);
    expect(container.querySelector("img[src*='Draven_0.jpg']")).not.toBeInTheDocument();
  });
});
