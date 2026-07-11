#!/usr/bin/env node

import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_BASE_URL = "https://ddragon.leagueoflegends.com";
export const DEFAULT_LOCALE = "zh_CN";
const scriptPath = import.meta.url.startsWith("file:")
  ? fileURLToPath(import.meta.url)
  : undefined;
export const DEFAULT_OUTPUT_PATH = scriptPath
  ? resolve(dirname(scriptPath), "../src/data/champions.generated.json")
  : resolve(process.cwd(), "src/data/champions.generated.json");

const ABILITY_SLOTS = ["Q", "W", "E", "R"];
const RETRY_DELAYS_MS = [0, 350, 1_000];

function decodeEntity(entity) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  if (entity[0] === "#") {
    const isHex = entity[1]?.toLowerCase() === "x";
    const value = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
    return Number.isFinite(value) ? String.fromCodePoint(value) : `&${entity};`;
  }

  return named[entity.toLowerCase()] ?? `&${entity};`;
}

/** Convert Data Dragon's lightweight HTML descriptions to compact plain text. */
export function cleanHtml(value) {
  if (typeof value !== "string" || value.length === 0) return "";

  return value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(?:p|div|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (_, entity) => decodeEntity(entity))
    .replace(/\r/g, "")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n+ */g, "\n")
    .trim();
}

export function parseArgs(argv) {
  let version;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--version") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--version 后必须提供 Data Dragon 版本号");
      }
      version = value;
      index += 1;
    } else if (argument?.startsWith("--version=")) {
      version = argument.slice("--version=".length);
    } else {
      throw new Error(`未知参数：${argument}`);
    }
  }

  if (version !== undefined && !/^[a-z0-9._-]+$/i.test(version)) {
    throw new Error("--version 必须是合法的 Data Dragon 版本号");
  }

  return { version };
}

const wait = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

export async function fetchJson(url, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") {
    throw new Error("当前 Node.js 运行时不支持 fetch");
  }

  let lastError;
  for (const delay of RETRY_DELAYS_MS) {
    if (delay) await wait(delay);
    try {
      const response = await fetchImpl(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`.trim());
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`无法获取 ${url}：${reason}`, { cause: lastError });
}

function numeric(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function imageUrl(baseUrl, version, group, fileName) {
  return fileName
    ? `${baseUrl}/cdn/${version}/img/${group}/${encodeURIComponent(fileName)}`
    : "";
}

export function normalizeChampion(rawChampion, { baseUrl, version }) {
  if (!rawChampion || typeof rawChampion.id !== "string") {
    throw new Error("英雄详情缺少有效的 id");
  }

  const id = rawChampion.id;
  const skins = Array.isArray(rawChampion.skins)
    ? rawChampion.skins
        // Chroma records carry parentSkin. A base skin may still advertise chromas: true.
        .filter((skin) => skin && skin.parentSkin == null)
        .map((skin) => {
          const num = numeric(skin.num);
          const isBase = num === 0;
          return {
            id: String(skin.id ?? `${rawChampion.key}${num}`),
            num,
            name:
              isBase && (!skin.name || String(skin.name).toLowerCase() === "default")
                ? "经典"
                : cleanHtml(String(skin.name ?? "未命名皮肤")),
            isBase,
            splashUrl: `${baseUrl}/cdn/img/champion/splash/${id}_${num}.jpg`,
            loadingUrl: `${baseUrl}/cdn/img/champion/loading/${id}_${num}.jpg`,
          };
        })
    : [];

  const rawSpells = Array.isArray(rawChampion.spells) ? rawChampion.spells : [];
  const spells = ABILITY_SLOTS.map((slot, index) => {
    const spell = rawSpells[index] ?? {};
    return {
      slot,
      name: cleanHtml(spell.name),
      description: cleanHtml(spell.description ?? spell.tooltip),
      iconUrl: imageUrl(baseUrl, version, "spell", spell.image?.full),
    };
  });

  const passive = rawChampion.passive ?? {};
  const stats = rawChampion.stats ?? {};
  const info = rawChampion.info ?? {};

  return {
    id,
    key: String(rawChampion.key ?? ""),
    name: cleanHtml(rawChampion.name),
    title: cleanHtml(rawChampion.title),
    lore: cleanHtml(rawChampion.lore ?? rawChampion.blurb),
    tags: Array.isArray(rawChampion.tags) ? rawChampion.tags.map(String) : [],
    info: {
      attack: numeric(info.attack),
      defense: numeric(info.defense),
      magic: numeric(info.magic),
      difficulty: numeric(info.difficulty),
    },
    stats: {
      hp: numeric(stats.hp),
      mp: numeric(stats.mp),
      movespeed: numeric(stats.movespeed),
      armor: numeric(stats.armor),
      spellblock: numeric(stats.spellblock),
      attackrange: numeric(stats.attackrange),
      attackdamage: numeric(stats.attackdamage),
      attackspeed: numeric(stats.attackspeed),
    },
    passive: {
      slot: "P",
      name: cleanHtml(passive.name),
      description: cleanHtml(passive.description),
      iconUrl: imageUrl(baseUrl, version, "passive", passive.image?.full),
    },
    spells,
    skins,
    iconUrl: imageUrl(baseUrl, version, "champion", rawChampion.image?.full),
  };
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const result = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      result[currentIndex] = await mapper(values[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  return result;
}

export async function buildSnapshot({
  version: requestedVersion,
  baseUrl = DEFAULT_BASE_URL,
  locale = DEFAULT_LOCALE,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  let version = requestedVersion;

  if (!version) {
    const versions = await fetchJson(`${normalizedBaseUrl}/api/versions.json`, fetchImpl);
    if (!Array.isArray(versions) || typeof versions[0] !== "string") {
      throw new Error("Data Dragon versions.json 没有返回有效版本");
    }
    version = versions[0];
  }

  const dataBaseUrl = `${normalizedBaseUrl}/cdn`;
  const listUrl = `${dataBaseUrl}/${version}/data/${locale}/champion.json`;
  const listPayload = await fetchJson(listUrl, fetchImpl);
  const summaries = Object.values(listPayload?.data ?? {});
  if (summaries.length === 0) {
    throw new Error(`Data Dragon ${version} 没有返回英雄列表`);
  }

  const champions = await mapWithConcurrency(summaries, 8, async (summary) => {
    if (!summary || typeof summary.id !== "string") {
      throw new Error("英雄列表包含无效条目");
    }
    const detailUrl = `${dataBaseUrl}/${version}/data/${locale}/champion/${encodeURIComponent(summary.id)}.json`;
    const detailPayload = await fetchJson(detailUrl, fetchImpl);
    const detail = detailPayload?.data?.[summary.id];
    return normalizeChampion(detail, { baseUrl: normalizedBaseUrl, version });
  });

  champions.sort((left, right) => left.id.localeCompare(right.id, "en"));

  return {
    version,
    locale,
    generatedAt: now().toISOString(),
    champions,
  };
}

/** Write only after a complete snapshot exists; rename keeps the previous file intact on failure. */
export async function writeSnapshotAtomically(snapshot, outputPath = DEFAULT_OUTPUT_PATH) {
  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;

  try {
    await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export async function syncData(options = {}) {
  const snapshot = await buildSnapshot(options);
  await writeSnapshotAtomically(snapshot, options.outputPath ?? DEFAULT_OUTPUT_PATH);
  return snapshot;
}

async function main() {
  const { version } = parseArgs(process.argv.slice(2));
  const snapshot = await syncData({ version });
  process.stdout.write(
    `已同步 Data Dragon ${snapshot.version}：${snapshot.champions.length} 位英雄，写入 ${DEFAULT_OUTPUT_PATH}\n`,
  );
}

const isMain =
  scriptPath !== undefined &&
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === scriptPath;

if (isMain) {
  main().catch((error) => {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(`数据同步失败，现有快照未被修改：${reason}\n`);
    process.exitCode = 1;
  });
}
