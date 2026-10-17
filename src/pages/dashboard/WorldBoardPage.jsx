// src/pages/dashboard/WorldBoardPage.jsx
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Clock,
  StickyNote,
  BookMarked,
  BookOpen,
  Map,
  GitBranch,
  Trash2,
  Save,
  X,
  Layout,
  ExternalLink,
  RotateCcw,
  Mountain,
} from "lucide-react";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
import WorldMap from "./board/WorldMap";
import CharacterGraph from "./board/CharacterGraph";
import FreeCanvas from "./board/FreeCanvas";
import WorldCodex from "@components/worldbuilding/WorldCodex";
import WorldMapBuilder from "@components/worldbuilding/WorldMapBuilder";
import styles from "./WorldBoardPage.module.css";

const TABS = [
  { id: "timeline", icon: Clock, label: "Таймлайн", dbType: "timeline_event" },
  { id: "notes", icon: StickyNote, label: "Заметки", dbType: "note" },
  { id: "lore", icon: BookMarked, label: "Лор", dbType: "lore_page" },
  { id: "codex", icon: BookOpen, label: "Кодекс", dbType: null },
  { id: "terrain", icon: Mountain, label: "Карта 2D/3D", dbType: null },
  { id: "map", icon: Map, label: "Метки", dbType: null },
  { id: "graph", icon: GitBranch, label: "Связи", dbType: null },
  { id: "canvas", icon: Layout, label: "Канвас", dbType: null },
];

function useWork(id) {
  return useQuery({
    queryKey: ["board-work", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("works")
        .select("id, title")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

function useBoardItems(workId, dbType) {
  return useQuery({
    queryKey: ["board", workId, dbType],
    enabled: !!workId && !!dbType,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("world_board_items")
        .select("*")
        .eq("work_id", workId)
        .eq("type", dbType)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export default function WorldBoardPage() {
  const { workId } = useParams();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("timeline");
  const [actionError, setActionError] = useState("");

  const {
    data: work,
    error: workError,
  } = useWork(workId);
  const currentTab = TABS.find((t) => t.id === activeTab);
  const dbType = currentTab?.dbType || null;
  const {
    data: items = [],
    isLoading,
    error: itemsError,
  } = useBoardItems(workId, dbType);

  const addItem = useMutation({
    mutationFn: async () => {
      if (!dbType) throw new Error("Недоступно");
      const { error } = await supabase.from("world_board_items").insert({
        work_id: workId,
        author_id: user.id,
        type: dbType,
        title: "Новый элемент",
        content: "",
        color: "#F0A830",
        sort_order: items.length,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["board", workId] }),
    onError: (err) => setActionError(err.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id) => {
      const { data, error } = await supabase
        .from("world_board_items")
        .delete()
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Элемент не найден или у вас нет доступа к нему.");
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["board", workId] }),
    onError: (err) => setActionError(err.message || "Не удалось удалить элемент."),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...fields }) => {
      const { data, error } = await supabase
        .from("world_board_items")
        .update(fields)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Элемент не найден или у вас нет доступа к нему.");
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["board", workId] }),
    onError: (err) => setActionError(err.message || "Не удалось сохранить элемент."),
  });

  const isDataTab = !!dbType;
  const showAddBtn = isDataTab;

  return (
    <div className={styles.page}>
      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className={styles.headerLeft}>
          <span className={styles.headerKanji} aria-hidden>
            世
          </span>
          <div>
            <h1 className={styles.title}>Доска мира</h1>
            {work && <p className={styles.subtitle}>{work.title}</p>}
          </div>
        </div>
        <div className={styles.headerActions}>
          {(activeTab === "codex" || activeTab === "terrain" || activeTab === "map") && work && (
            <Link
              className={styles.previewBtn}
              to={activeTab === "codex" ? `/works/${work.id}/world` : `/works/${work.id}/world?view=map`}
            >
              <ExternalLink size={14} strokeWidth={1.5} />
              Публичный вид
            </Link>
          )}
          {showAddBtn && (
            <motion.button
              className={styles.addBtn}
              onClick={() => addItem.mutate()}
              disabled={addItem.isPending}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              <Plus size={16} strokeWidth={1.5} />
              Добавить
            </motion.button>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {(actionError || workError || itemsError) && (
          <motion.div
            className={styles.errorBanner}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <span>{actionError || workError?.message || itemsError?.message}</span>
            <button
              type="button"
              onClick={() => {
                setActionError("");
                if (workError) {
                  queryClient.refetchQueries({ queryKey: ["board-work", workId] });
                }
                if (itemsError && dbType) {
                  queryClient.refetchQueries({ queryKey: ["board", workId, dbType] });
                }
              }}
              aria-label={workError || itemsError ? "Повторить загрузку" : "Закрыть сообщение"}
            >
              {workError || itemsError ? <RotateCcw size={14} /> : <X size={14} />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.tabs}>
        {TABS.map((tab, i) => (
          <motion.button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
            onClick={() => {
              setActiveTab(tab.id);
              setActionError("");
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.5 }}
          >
            <tab.icon size={15} strokeWidth={1.5} />
            <span>{tab.label}</span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === "timeline" && (
            <TimelineView
              items={items}
              loading={isLoading}
              onUpdate={(id, f) => updateItem.mutate({ id, ...f })}
              onRemove={(id) => removeItem.mutate(id)}
            />
          )}
          {activeTab === "notes" && (
            <NotesView
              items={items}
              loading={isLoading}
              onUpdate={(id, f) => updateItem.mutate({ id, ...f })}
              onRemove={(id) => removeItem.mutate(id)}
            />
          )}
          {activeTab === "lore" && (
            <LoreView
              items={items}
              loading={isLoading}
              onUpdate={(id, f) => updateItem.mutate({ id, ...f })}
              onRemove={(id) => removeItem.mutate(id)}
            />
          )}
          {activeTab === "codex" && <WorldCodex workId={workId} />}
          {activeTab === "terrain" && <WorldMapBuilder workId={workId} />}
          {activeTab === "map" && <WorldMap workId={workId} />}
          {activeTab === "graph" && <CharacterGraph workId={workId} />}
          {activeTab === "canvas" && <FreeCanvas workId={workId} />}
        </motion.div>
      </AnimatePresence>

      <span className={styles.pageBgKanji} aria-hidden>
        界
      </span>
    </div>
  );
}

/* ══ Timeline / Notes / Lore — сокращённо, логика та же ══ */

function TimelineView({ items, loading, onUpdate, onRemove }) {
  if (loading) return <Skeletons count={3} cls={styles.skeletonLore} />;
  if (!items.length) return <EmptyState kanji="時" label="событий" />;

  return (
    <div className={styles.timeline}>
      <div className={styles.timelineRail} />
      {items.map((item, i) => (
        <EditableCard
          key={item.id}
          item={item}
          index={i}
          onSave={(f) => onUpdate(item.id, f)}
          onRemove={() => onRemove(item.id)}
          type="timeline"
        />
      ))}
    </div>
  );
}

function NotesView({ items, loading, onUpdate, onRemove }) {
  if (loading)
    return (
      <Skeletons count={4} cls={styles.skeletonNote} wrap={styles.notesGrid} />
    );
  if (!items.length) return <EmptyState kanji="記" label="заметок" />;

  return (
    <div className={styles.notesGrid}>
      {items.map((item, i) => (
        <EditableCard
          key={item.id}
          item={item}
          index={i}
          onSave={(f) => onUpdate(item.id, f)}
          onRemove={() => onRemove(item.id)}
          type="note"
        />
      ))}
    </div>
  );
}

function LoreView({ items, loading, onUpdate, onRemove }) {
  if (loading) return <Skeletons count={3} cls={styles.skeletonLore} />;
  if (!items.length) return <EmptyState kanji="典" label="лор-статей" />;

  return (
    <div className={styles.loreList}>
      {items.map((item, i) => (
        <EditableCard
          key={item.id}
          item={item}
          index={i}
          onSave={(f) => onUpdate(item.id, f)}
          onRemove={() => onRemove(item.id)}
          type="lore"
        />
      ))}
    </div>
  );
}

const NOTE_COLORS = [
  "#F0A830",
  "#E8354A",
  "#10B981",
  "#5B9BD5",
  "#8B5CF6",
  "#EC4899",
];

function EditableCard({ item, index, onSave, onRemove, type }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content || "");
  const [date, setDate] = useState(item.timeline_date || "");
  const [color, setColor] = useState(item.color || "#F0A830");

  const save = () => {
    onSave({ title, content, timeline_date: date, color });
    setEditing(false);
  };

  const cancel = () => {
    setTitle(item.title);
    setContent(item.content || "");
    setDate(item.timeline_date || "");
    setColor(item.color || "#F0A830");
    setEditing(false);
  };

  if (editing) {
    return (
      <motion.div
        className={
          type === "timeline"
            ? styles.timelineItem
            : type === "note"
              ? styles.noteCard
              : styles.loreCard
        }
        style={type === "note" ? { "--note-color": color } : undefined}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {type === "note" && <div className={styles.noteAccent} />}
        <div className={styles.editForm}>
          {type === "timeline" && (
            <input
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={styles.editInput}
              placeholder="Дата / период..."
            />
          )}
          {type === "note" && (
            <div className={styles.noteColorPalette}>
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  className={`${styles.noteColorDot} ${color === c ? styles.noteColorDotActive : ""}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          )}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={styles.editInputTitle}
            placeholder="Название..."
            autoFocus
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={styles.editTextarea}
            placeholder="Описание..."
            rows={type === "lore" ? 8 : 4}
          />
          <div className={styles.editActions}>
            <button className={styles.editCancel} onClick={cancel}>
              Отмена
            </button>
            <button className={styles.editSave} onClick={save}>
              <Save size={13} strokeWidth={1.5} /> Сохранить
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (type === "timeline") {
    return (
      <motion.div
        className={styles.timelineItem}
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{
          delay: index * 0.07,
          duration: 0.6,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <div className={styles.timelineDotWrap}>
          <div className={styles.timelineDot} />
          <span className={styles.timelineIndex}>
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <div className={styles.timelineCard} onClick={() => setEditing(true)}>
          {date && <span className={styles.timelineDate}>{date}</span>}
          <h4 className={styles.timelineTitle}>{title}</h4>
          {content && <p className={styles.timelineText}>{content}</p>}
          <button
            className={styles.removeFloating}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </button>
        </div>
      </motion.div>
    );
  }

  if (type === "note") {
    return (
      <motion.div
        className={styles.noteCard}
        style={{ "--note-color": color }}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.06, duration: 0.6 }}
        whileHover={{ y: -4 }}
      >
        <div className={styles.noteAccent} />
        <div className={styles.noteBody} onClick={() => setEditing(true)}>
          <h4 className={styles.noteTitle} style={{ color }}>
            {title}
          </h4>
          {content ? (
            <p className={styles.noteText}>{content}</p>
          ) : (
            <p className={styles.noteEmpty}>Нажми для редактирования...</p>
          )}
        </div>
        <button
          className={styles.noteRemoveBtn}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 size={12} strokeWidth={1.5} />
        </button>
        <span
          className={styles.noteKanji}
          style={{ color: color + "0A" }}
          aria-hidden
        >
          記
        </span>
      </motion.div>
    );
  }

  // lore
  return (
    <motion.div
      className={styles.loreCard}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.6 }}
    >
      <div className={styles.loreView} onClick={() => setEditing(true)}>
        <span className={styles.loreIcon} aria-hidden>
          典
        </span>
        <div className={styles.loreMeta}>
          <span className={styles.loreNum}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <h4 className={styles.loreTitle}>{title}</h4>
          {content && (
            <p className={styles.lorePreview}>
              {content.slice(0, 200)}
              {content.length > 200 ? "..." : ""}
            </p>
          )}
        </div>
        <button
          className={styles.removeFloating}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 size={13} strokeWidth={1.5} />
        </button>
      </div>
    </motion.div>
  );
}

function EmptyState({ kanji, label }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyKanji}>{kanji}</span>
      <p>Нет {label}</p>
      <span className={styles.emptyHint}>Нажми «Добавить»</span>
    </div>
  );
}

function Skeletons({ count, cls, wrap }) {
  const inner = Array.from({ length: count }, (_, i) => (
    <div key={i} className={`skeleton ${cls}`} />
  ));
  return wrap ? <div className={wrap}>{inner}</div> : <>{inner}</>;
}
