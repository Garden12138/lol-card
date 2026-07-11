import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, Grip, RotateCcw, Trash2, X } from "lucide-react";
import type { CardEditionKey, ChampionCard, SkinEdition } from "../types/cards";
import { CardMini } from "./CardMini";

export interface ComparisonItem {
  key: CardEditionKey;
  champion: ChampionCard;
  skin: SkinEdition;
}

interface ComparisonSectionProps {
  items: ComparisonItem[];
  onReorder: (keys: CardEditionKey[]) => void;
  onRemove: (key: CardEditionKey) => void;
  onClear: () => void;
  onOpen: (item: ComparisonItem) => void;
}

interface SortableCardProps {
  item: ComparisonItem;
  flipped: boolean;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: (key: CardEditionKey) => void;
  onOpen: (item: ComparisonItem) => void;
}

function SortableCard({ item, flipped, index, count, onMove, onRemove, onOpen }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article ref={setNodeRef} style={style} className={`comparison-card ${isDragging ? "is-dragging" : ""}`}>
      <button type="button" className="comparison-card__preview" onClick={() => onOpen(item)}>
        <CardMini champion={item.champion} skin={item.skin} compact flipped={flipped} />
        <span className="sr-only">鉴赏 {item.champion.title} {item.skin.name}</span>
      </button>
      <div className="comparison-card__caption">
        <span>{item.champion.title}</span>
        <strong>{item.skin.name}</strong>
      </div>
      <div className="comparison-card__actions">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
          aria-label={`将${item.champion.title}${item.skin.name}左移`}
        >
          <ArrowLeft size={15} />
        </button>
        <button
          type="button"
          className="comparison-card__drag"
          {...attributes}
          {...listeners}
          aria-label={`拖动${item.champion.title}${item.skin.name}排序`}
        >
          <Grip size={16} />
        </button>
        <button
          type="button"
          disabled={index === count - 1}
          onClick={() => onMove(index, index + 1)}
          aria-label={`将${item.champion.title}${item.skin.name}右移`}
        >
          <ArrowRight size={15} />
        </button>
        <button type="button" onClick={() => onRemove(item.key)} aria-label={`移除${item.champion.title}${item.skin.name}`}>
          <X size={16} />
        </button>
      </div>
    </article>
  );
}

export function ComparisonSection({ items, onReorder, onRemove, onClear, onOpen }: ComparisonSectionProps) {
  const [flipped, setFlipped] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const keys = useMemo(() => items.map((item) => item.key), [items]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const moved = arrayMove(keys, from, to) as CardEditionKey[];
    onReorder(moved);
    setAnnouncement(`${items[from]?.champion.title ?? "卡片"}已移动到第 ${to + 1} 位`);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = keys.indexOf(active.id as CardEditionKey);
    const to = keys.indexOf(over.id as CardEditionKey);
    move(from, to);
  };

  return (
    <section id="comparison" className="section-shell comparison-section" aria-labelledby="comparison-heading">
      <div className="section-heading comparison-heading">
        <div>
          <p className="section-kicker">SIDE-BY-SIDE STUDY</p>
          <h2 id="comparison-heading">卡面对比</h2>
        </div>
        <p>{items.length}/6 张藏品 · 可混排同一英雄的不同皮肤</p>
      </div>

      <div className="comparison-toolbar">
        <button type="button" onClick={() => setFlipped((value) => !value)} aria-pressed={flipped}>
          <RotateCcw size={17} aria-hidden="true" />
          {flipped ? "查看正面" : "统一翻面"}
        </button>
        <button type="button" onClick={onClear} disabled={!items.length}>
          <Trash2 size={17} aria-hidden="true" />
          清空对比
        </button>
      </div>

      {items.length ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={keys} strategy={rectSortingStrategy}>
            <div className="comparison-grid">
              {items.map((item, index) => (
                <SortableCard
                  key={item.key}
                  item={item}
                  flipped={flipped}
                  index={index}
                  count={items.length}
                  onMove={move}
                  onRemove={onRemove}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="empty-state comparison-empty">
          <span>0 / 6</span>
          <h3>对比席位等待入藏</h3>
          <p>在鉴赏区或英雄图鉴中点击“加入对比”，同一英雄的不同皮肤也可以并排展示。</p>
          <a href="#gallery">前往英雄图鉴</a>
        </div>
      )}
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </section>
  );
}
