import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
// The production sync command intentionally stays as native ESM so it runs without a build step.
// @ts-expect-error The CLI module has no emitted TypeScript declaration.
import { buildSnapshot, cleanHtml, normalizeChampion, parseArgs, syncData, writeSnapshotAtomically } from "../scripts/sync-data.mjs";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
  };
}

function championFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "Ahri",
    key: "103",
    name: "九尾妖狐",
    title: "魅惑众生",
    lore: "<p>阿狸与魔法产生了共鸣。</p>",
    tags: ["Mage", "Assassin"],
    info: { attack: 3, defense: 4, magic: 8, difficulty: 5 },
    stats: {
      hp: 590,
      mp: 418,
      movespeed: 330,
      armor: 21,
      spellblock: 30,
      attackrange: 550,
      attackdamage: 53,
      attackspeed: 0.668,
    },
    passive: {
      name: "摄魂夺魄",
      description: "<mainText>命中敌人后<healing>回复生命</healing>。</mainText>",
      image: { full: "Ahri_SoulEater2.png" },
    },
    spells: ["Q", "W", "E", "R"].map((slot) => ({
      name: `技能 ${slot}`,
      description: `<p>造成 <magicDamage>10 &amp; 20</magicDamage> 点伤害。</p>`,
      image: { full: `Ahri${slot}.png` },
    })),
    skins: [
      { id: "103000", num: 0, name: "default", chromas: true },
      { id: "103001", num: 1, name: "高丽风情 阿狸", chromas: true },
      {
        id: "1030011",
        num: 11,
        name: "高丽风情 阿狸（炫彩）",
        parentSkin: "103001",
      },
    ],
    image: { full: "Ahri.png" },
    ...overrides,
  };
}

describe("Data Dragon 数据清洗", () => {
  it("移除标签、保留合理分段并解码实体", () => {
    expect(
      cleanHtml("<mainText>第一行<br><stats>10&nbsp;&amp;&nbsp;20</stats></mainText>"),
    ).toBe("第一行\n10 & 20");
  });

  it("过滤 parentSkin 炫彩记录，但保留 chromas:true 的基础皮肤", () => {
    const champion = normalizeChampion(championFixture(), {
      baseUrl: "https://ddragon.example",
      version: "16.13.1",
    });

    expect(champion.skins).toHaveLength(2);
    expect(champion.skins[0]).toMatchObject({
      id: "103000",
      num: 0,
      name: "经典",
      isBase: true,
    });
    expect(champion.passive.description).toBe("命中敌人后回复生命。");
    expect(champion.spells.map(({ slot }: { slot: string }) => slot)).toEqual([
      "Q",
      "W",
      "E",
      "R",
    ]);
    expect(champion.iconUrl).toBe(
      "https://ddragon.example/cdn/16.13.1/img/champion/Ahri.png",
    );
  });
});

describe("Data Dragon 同步", () => {
  it("接受两种固定版本参数，并拒绝缺失或不安全的版本", () => {
    expect(parseArgs(["--version", "16.13.1"])).toEqual({ version: "16.13.1" });
    expect(parseArgs(["--version=16.12.1"])).toEqual({ version: "16.12.1" });
    expect(() => parseArgs(["--version"])).toThrow(/必须提供/);
    expect(() => parseArgs(["--version", "../secret"])).toThrow(/合法/);
  });

  it("未指定版本时固定 versions.json 的首个版本", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith("/api/versions.json")) return response(["16.13.1", "16.12.1"]);
      if (url.endsWith("/champion.json")) {
        return response({ data: { Ahri: { id: "Ahri" } } });
      }
      return response({ data: { Ahri: championFixture() } });
    });

    const snapshot = await buildSnapshot({
      baseUrl: "https://ddragon.example",
      fetchImpl,
      now: () => new Date("2026-07-10T00:00:00.000Z"),
    });

    expect(snapshot).toMatchObject({
      version: "16.13.1",
      locale: "zh_CN",
      generatedAt: "2026-07-10T00:00:00.000Z",
    });
    expect(fetchImpl.mock.calls.some(([url]) => url.includes("/16.13.1/"))).toBe(true);
  });

  it("指定版本时不会请求 versions.json", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith("/champion.json")) {
        return response({ data: { Ahri: { id: "Ahri" } } });
      }
      return response({ data: { Ahri: championFixture() } });
    });

    await buildSnapshot({
      version: "16.12.1",
      baseUrl: "https://ddragon.example",
      fetchImpl,
    });

    expect(fetchImpl.mock.calls.every(([url]) => !url.endsWith("/api/versions.json"))).toBe(
      true,
    );
  });

  it("原子替换完整快照", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lol-card-data-"));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, "nested", "champions.json");
    const snapshot = {
      version: "16.13.1",
      locale: "zh_CN",
      generatedAt: "2026-07-10T00:00:00.000Z",
      champions: [],
    };

    await writeSnapshotAtomically(snapshot, outputPath);

    expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual(snapshot);
  });

  it("网络失败不会破坏旧快照", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lol-card-data-"));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, "champions.json");
    await writeFile(outputPath, "old snapshot\n", "utf8");

    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });

    await expect(
      syncData({ version: "16.13.1", outputPath, fetchImpl }),
    ).rejects.toThrow(/无法获取/);
    expect(await readFile(outputPath, "utf8")).toBe("old snapshot\n");
  });
});
