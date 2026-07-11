import { Search, SlidersHorizontal } from "lucide-react";
import type { ChampionCard, ChampionTag } from "../types/cards";
import { CardMini, tagLabels } from "./CardMini";

interface GallerySectionProps {
  champions: ChampionCard[];
  totalCount: number;
  query: string;
  activeTag: ChampionTag | "all";
  onQueryChange: (value: string) => void;
  onTagChange: (value: ChampionTag | "all") => void;
  onOpenChampion: (champion: ChampionCard) => void;
  onAddCompare: (champion: ChampionCard) => void;
}

const tags: Array<ChampionTag | "all"> = ["all", "Fighter", "Mage", "Assassin", "Tank", "Marksman", "Support"];

export function GallerySection({
  champions,
  totalCount,
  query,
  activeTag,
  onQueryChange,
  onTagChange,
  onOpenChampion,
  onAddCompare,
}: GallerySectionProps) {
  return (
    <section id="gallery" className="section-shell gallery-section" aria-labelledby="gallery-heading">
      <div className="section-heading">
        <div>
          <p className="section-kicker">CHAMPION CATALOGUE</p>
          <h2 id="gallery-heading">英雄图鉴</h2>
        </div>
        <p>收录 {totalCount} 位英雄 · 当前显示 {champions.length} 位</p>
      </div>

      <div className="gallery-toolbar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">搜索英雄</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索中文名、称号或英文 ID"
          />
          {query && (
            <button type="button" onClick={() => onQueryChange("")} aria-label="清空搜索">
              清除
            </button>
          )}
        </label>

        <div className="filter-row" aria-label="按英雄类型筛选">
          <SlidersHorizontal size={17} aria-hidden="true" />
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={activeTag === tag ? "is-active" : ""}
              aria-pressed={activeTag === tag}
              onClick={() => onTagChange(tag)}
            >
              {tag === "all" ? "全部" : tagLabels[tag]}
            </button>
          ))}
        </div>
      </div>

      {champions.length ? (
        <div className="gallery-grid">
          {champions.map((champion) => {
            const skin = champion.skins[0];
            if (!skin) return null;
            return (
              <article key={champion.id} className="gallery-item">
                <button type="button" className="gallery-item__card" onClick={() => onOpenChampion(champion)}>
                  <CardMini champion={champion} skin={skin} compact />
                  <span className="sr-only">鉴赏 {champion.title}</span>
                </button>
                <div className="gallery-item__meta">
                  <button type="button" onClick={() => onOpenChampion(champion)}>
                    <span>{champion.name}</span>
                    <strong>{champion.title}</strong>
                  </button>
                  <div>
                    <span>{champion.skins.length} 款皮肤</span>
                    <button type="button" onClick={() => onAddCompare(champion)} aria-label={`将${champion.title}加入对比`}>
                      + 对比
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <span>NO MATCHES</span>
          <h3>暂未找到相符英雄</h3>
          <p>试试清空关键词或切换其他英雄类型。</p>
          <button type="button" onClick={() => { onQueryChange(""); onTagChange("all"); }}>
            查看全部英雄
          </button>
        </div>
      )}
    </section>
  );
}
