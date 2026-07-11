import {
  Suspense,
  lazy,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Archive, GitCompareArrows, MousePointer2, Plus, X } from "lucide-react";
import { ChampionDetail } from "./components/ChampionDetail";
import { GallerySection } from "./components/GallerySection";
import type { ComparisonItem } from "./components/ComparisonSection";
import { champions, dataVersion, getChampionById, getSkinByNum } from "./data/champions";
import { searchChampions } from "./lib/search";
import {
  MAX_COMPARE_CARDS,
  parseCardEditionKey,
  parseUrlState,
  serializeUrlState,
  toCardEditionKey,
  type UrlState,
} from "./lib/urlState";
import type { CardEditionKey, ChampionCard, ChampionTag, SkinEdition } from "./types/cards";

const CardViewer3D = lazy(() =>
  import("./components/CardViewer3D").then((module) => ({ default: module.CardViewer3D })),
);
const ComparisonSection = lazy(() =>
  import("./components/ComparisonSection").then((module) => ({ default: module.ComparisonSection })),
);

function initialUrlState(): UrlState {
  if (typeof window === "undefined") {
    return { championId: "Ahri", skinNum: 0, compareKeys: [] };
  }
  return parseUrlState(window.location.search, champions);
}

function resolveEdition(key: CardEditionKey): ComparisonItem | null {
  const parsed = parseCardEditionKey(key);
  if (!parsed) return null;
  const champion = getChampionById(parsed.championId);
  if (!champion) return null;
  const skin = getSkinByNum(champion, parsed.skinNum);
  return skin ? { key, champion, skin } : null;
}

export function App() {
  const initialState = useMemo(initialUrlState, []);
  const [championId, setChampionId] = useState(initialState.championId);
  const [skinNum, setSkinNum] = useState(initialState.skinNum);
  const [compareKeys, setCompareKeys] = useState<CardEditionKey[]>(initialState.compareKeys);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<ChampionTag | "all">("all");
  const [toast, setToast] = useState("");
  const [focusOpen, setFocusOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const popstateRef = useRef(false);

  const champion = getChampionById(championId) ?? champions[0]!;
  const skin = getSkinByNum(champion, skinNum) ?? champion.skins[0]!;
  const deferredQuery = useDeferredValue(query);
  const filteredChampions = useMemo(
    () => searchChampions(champions, deferredQuery, activeTag),
    [deferredQuery, activeTag],
  );
  const comparisonItems = useMemo(
    () => compareKeys.map(resolveEdition).filter((item): item is ComparisonItem => Boolean(item)),
    [compareKeys],
  );

  useEffect(() => {
    const state: UrlState = { championId: champion.id, skinNum: skin.num, compareKeys };
    const nextSearch = serializeUrlState(state);
    if (popstateRef.current) {
      popstateRef.current = false;
      return;
    }
    if (window.location.search !== nextSearch) {
      window.history.replaceState(null, "", `${nextSearch}${window.location.hash}`);
    }
  }, [champion.id, skin.num, compareKeys]);

  useEffect(() => {
    const handlePopState = () => {
      const state = parseUrlState(window.location.search, champions);
      popstateRef.current = true;
      setChampionId(state.championId);
      setSkinNum(state.skinNum);
      setCompareKeys(state.compareKeys);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const currentIndex = champion.skins.findIndex((edition) => edition.num === skin.num);
    for (const edition of [champion.skins[currentIndex - 1], champion.skins[currentIndex + 1]]) {
      if (!edition) continue;
      for (const url of [edition.splashUrl, edition.loadingUrl]) {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = url;
      }
    }
  }, [champion, skin.num]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (focusOpen && !dialog.open) dialog.showModal();
    if (!focusOpen && dialog.open) dialog.close();
  }, [focusOpen]);

  const chooseChampion = (nextChampion: ChampionCard, scroll = false) => {
    const baseSkin = nextChampion.skins.find((edition) => edition.isBase) ?? nextChampion.skins[0];
    setChampionId(nextChampion.id);
    setSkinNum(baseSkin?.num ?? 0);
    if (scroll) {
      window.requestAnimationFrame(() => document.getElementById("viewer")?.scrollIntoView({ behavior: "smooth" }));
    }
  };

  const chooseEdition = (nextChampion: ChampionCard, nextSkin: SkinEdition, scroll = false) => {
    setChampionId(nextChampion.id);
    setSkinNum(nextSkin.num);
    if (scroll) {
      window.requestAnimationFrame(() => document.getElementById("viewer")?.scrollIntoView({ behavior: "smooth" }));
    }
  };

  const addToCompare = (nextChampion: ChampionCard, nextSkin: SkinEdition) => {
    const key = toCardEditionKey(nextChampion.id, nextSkin.num);
    if (compareKeys.includes(key)) {
      setToast(`${nextChampion.title} · ${nextSkin.name} 已在对比席位中`);
      return;
    }
    if (compareKeys.length >= MAX_COMPARE_CARDS) {
      setToast("对比席位最多容纳 6 张卡片，请先移除一张");
      return;
    }
    setCompareKeys((current) => [...current, key]);
    setToast(`${nextChampion.title} · ${nextSkin.name} 已加入对比`);
  };

  const heroStyle = { "--hero-art": `url("${skin.splashUrl}")` } as CSSProperties;

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <a className="site-brand" href="#viewer" aria-label="返回峡谷英雄典藏馆首页">
            <span className="site-brand__mark" aria-hidden="true"><span /></span>
            <span>
              <strong>峡谷英雄典藏馆</strong>
              <small>THE RIFT ARCHIVE</small>
            </span>
          </a>
          <nav className="site-nav" aria-label="主导航">
            <a href="#viewer">鉴赏</a>
            <a href="#gallery">图鉴</a>
            <a href="#comparison">对比</a>
          </nav>
          <div className="site-header__meta">
            <span className="patch-chip">PATCH {dataVersion}</span>
            <span className="fan-chip">FAN PROJECT</span>
          </div>
        </div>
      </header>

      <main>
        <section id="viewer" className="hero-section" style={heroStyle} aria-labelledby="viewer-heading">
          <div className="hero-ornament" aria-hidden="true" />
          <div className="hero-layout">
            <div className="viewer-zone">
              <div className="viewer-intro">
                <span className="viewer-intro__index">ARCHIVE {champion.key.padStart(3, "0")}</span>
                <h1 id="viewer-heading">{champion.title}</h1>
                <p className="viewer-intro__title">{champion.name} · {champion.id}</p>
                <p className="viewer-intro__copy">拖动卡片观察光泽与角度，翻到背面阅读英雄档案；你也可以把不同皮肤并排收入对比席位。</p>

                <div className="viewer-controls">
                  <label className="select-field">
                    <span>选择英雄</span>
                    <select
                      value={champion.id}
                      onChange={(event) => {
                        const next = getChampionById(event.target.value);
                        if (next) chooseChampion(next);
                      }}
                    >
                      {champions.map((item) => (
                        <option key={item.id} value={item.id}>{item.title} · {item.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="select-field">
                    <span>皮肤版本 · {champion.skins.length}</span>
                    <select value={skin.num} onChange={(event) => setSkinNum(Number(event.target.value))}>
                      {champion.skins.map((edition) => (
                        <option key={edition.id} value={edition.num}>{edition.name}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="primary-action" onClick={() => addToCompare(champion, skin)}>
                    <Plus size={16} aria-hidden="true" />
                    加入对比
                  </button>
                </div>
              </div>

              <div className="viewer-stage">
                <Suspense fallback={<div className="viewer-loading">正在布置卡片展台</div>}>
                  <CardViewer3D
                    champion={champion}
                    skin={skin}
                    onRequestFullscreen={() => setFocusOpen(true)}
                  />
                </Suspense>
                <p className="viewer-stage__hint"><MousePointer2 size={13} aria-hidden="true" /> 聚焦预览后可用方向键、空格与 +/- 操作</p>
              </div>
            </div>
            <ChampionDetail champion={champion} skin={skin} />
          </div>
        </section>

        <GallerySection
          champions={filteredChampions}
          totalCount={champions.length}
          query={query}
          activeTag={activeTag}
          onQueryChange={setQuery}
          onTagChange={setActiveTag}
          onOpenChampion={(item) => chooseChampion(item, true)}
          onAddCompare={(item) => {
            const edition = item.skins[0];
            if (edition) addToCompare(item, edition);
          }}
        />

        <Suspense fallback={<div className="section-shell viewer-loading">正在整理对比席位</div>}>
          <ComparisonSection
            items={comparisonItems}
            onReorder={setCompareKeys}
            onRemove={(key) => setCompareKeys((current) => current.filter((item) => item !== key))}
            onClear={() => setCompareKeys([])}
            onOpen={(item) => chooseEdition(item.champion, item.skin, true)}
          />
        </Suspense>
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="site-footer__brand">
            <h2>峡谷英雄典藏馆</h2>
            <p>免费、无广告的非官方英雄卡鉴赏项目。数据快照版本 {dataVersion}，英雄与皮肤资料来自 Riot Data Dragon。</p>
            <div className="site-footer__links">
              <a href="https://developer.riotgames.com/docs/lol" target="_blank" rel="noreferrer">Data Dragon</a>
              <a href="https://github.com/Garden12138/lol-card" target="_blank" rel="noreferrer">GitHub</a>
              <a href="https://www.riotgames.com/en/legal" target="_blank" rel="noreferrer">Legal Jibber Jabber</a>
            </div>
          </div>
          <div className="site-footer__legal">
            <strong>非官方粉丝项目声明</strong>
            <p>峡谷英雄典藏馆依据 Riot Games 的“Legal Jibber Jabber”政策制作，使用了 Riot Games 拥有的素材。Riot Games 不认可或赞助本项目。</p>
            <p>The Rift Archive isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
          </div>
        </div>
      </footer>

      <dialog
        ref={dialogRef}
        className="focus-dialog"
        aria-label={`${champion.title}全屏鉴赏`}
        onCancel={(event) => { event.preventDefault(); setFocusOpen(false); }}
        onClose={() => setFocusOpen(false)}
      >
        <div className="focus-dialog__inner">
          <button type="button" className="focus-dialog__close" onClick={() => setFocusOpen(false)} aria-label="关闭全屏鉴赏">
            <X size={20} aria-hidden="true" />
          </button>
          {focusOpen && (
            <Suspense fallback={<div className="viewer-loading">正在进入专注模式</div>}>
              <CardViewer3D champion={champion} skin={skin} fullscreen className="w-full" />
            </Suspense>
          )}
        </div>
      </dialog>

      {toast && <div className="toast" role="status"><Archive size={15} aria-hidden="true" /> {toast}</div>}
      <span className="sr-only" aria-live="polite">当前对比席位 {compareKeys.length} 张</span>
      <span className="sr-only"><GitCompareArrows /> 可比较英雄不同皮肤</span>
    </div>
  );
}
