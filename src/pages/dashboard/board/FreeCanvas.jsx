// src/pages/dashboard/board/FreeCanvas.jsx
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Trash2,
  StickyNote,
  Type,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Bold,
  Italic,
  Copy,
  X,
} from "lucide-react";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
import { uploadToCloudinary } from "@lib/cloudinary";
import styles from "./FreeCanvas.module.css";

const STICKY_COLORS = [
  "#F0A830",
  "#E8354A",
  "#10B981",
  "#5B9BD5",
  "#8B5CF6",
  "#EC4899",
  "#6B7280",
  "#1E293B",
];

const FONT_OPTIONS = [
  { label: "UI (по умолчанию)", value: "var(--font-ui)" },
  { label: "Display", value: "var(--font-display)" },
  { label: "Body", value: "var(--font-body)" },
  { label: "Mono", value: "var(--font-mono)" },
  { label: "Japanese", value: "var(--font-japanese)" },
  { label: "Retronom Regular", value: "Retronom Regular, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Impact", value: "Impact, sans-serif" },
  { label: "Courier New", value: "Courier New, monospace" },
  { label: "Comic Sans", value: "Comic Sans MS, cursive" },
];

function useCanvasItems(workId) {
  return useQuery({
    queryKey: ["canvas-items", workId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("canvas_items")
        .select("*")
        .eq("work_id", workId)
        .order("z_index");
      if (error) throw error;
      return data || [];
    },
    enabled: !!workId,
  });
}

export default function FreeCanvas({ workId }) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const containerRef = useRef(null);
  const innerRef = useRef(null);
  const fileInputRef = useRef(null);

  const {
    data: items = [],
    isLoading: itemsLoading,
    error: itemsError,
  } = useCanvasItems(workId);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [imageUploading, setImageUploading] = useState(false);

  const [toolbarFontSize, setToolbarFontSize] = useState(14);
  const [toolbarBold, setToolbarBold] = useState(false);
  const [toolbarItalic, setToolbarItalic] = useState(false);
  const [toolbarColor, setToolbarColor] = useState("#F0EDE8");
  const [toolbarFont, setToolbarFont] = useState("var(--font-ui)");
  const [toolbarStroke, setToolbarStroke] = useState(0);
  const [toolbarStrokeColor, setToolbarStrokeColor] = useState("#000000");

  const panRef = useRef({ active: false, sX: 0, sY: 0, sPX: 0, sPY: 0 });
  const maxZRef = useRef(0);

  useEffect(() => {
    if (items.length) {
      maxZRef.current = Math.max(...items.map((i) => i.z_index || 0));
    }
  }, [items]);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId),
    [items, selectedId],
  );
  const tbFontSize = selectedItem
    ? selectedItem.font_size ?? (selectedItem.item_type === "sticky" ? 14 : 24)
    : toolbarFontSize;
  const tbBold = selectedItem ? Boolean(selectedItem.bold) : toolbarBold;
  const tbItalic = selectedItem ? Boolean(selectedItem.italic) : toolbarItalic;
  const tbColor =
    selectedItem?.item_type === "sticky"
      ? selectedItem.color || "#F0A830"
      : selectedItem?.item_type === "text"
        ? selectedItem.font_color || "#F0EDE8"
        : toolbarColor;
  const tbFont =
    selectedItem?.font_family ||
    (selectedItem?.item_type === "sticky"
      ? "var(--font-ui)"
      : selectedItem?.item_type === "text"
        ? "var(--font-display)"
        : toolbarFont);
  const tbStroke = selectedItem?.stroke_width ?? toolbarStroke;
  const tbStrokeColor = selectedItem?.stroke_color || toolbarStrokeColor;

  // ── Optimistic ──
  const optSet = (id, fields) => {
    queryClient.setQueryData(["canvas-items", workId], (old) =>
      (old || []).map((i) => (i.id === id ? { ...i, ...fields } : i)),
    );
  };
  const optRemove = (id) => {
    queryClient.setQueryData(["canvas-items", workId], (old) =>
      (old || []).filter((i) => i.id !== id),
    );
  };
  const optAdd = (item) => {
    queryClient.setQueryData(["canvas-items", workId], (old) => [
      ...(old || []),
      item,
    ]);
  };

  // ── Mutations ──
  const addMut = useMutation({
    mutationFn: async (payload) => {
      const tempId = `temp-${Date.now()}`;
      const full = {
        ...payload,
        work_id: workId,
        author_id: user.id,
        z_index: maxZRef.current + 1,
        id: tempId,
      };
      optAdd(full);
      const { id: _id, ...rest } = full;
      const { data, error } = await supabase
        .from("canvas_items")
        .insert(rest)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (item) => {
      setSelectedId(item.id);
      setActionError("");
    },
    onError: (error) => setActionError(error.message || "Не удалось добавить элемент."),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["canvas-items", workId] }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...fields }) => {
      optSet(id, fields);
      const { data, error } = await supabase
        .from("canvas_items")
        .update(fields)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Элемент не найден или у вас нет доступа к нему.");
    },
    onSuccess: () => setActionError(""),
    onError: (error) => setActionError(error.message || "Не удалось сохранить элемент."),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["canvas-items", workId] }),
  });

  const removeMut = useMutation({
    mutationFn: async (id) => {
      optRemove(id);
      const { data, error } = await supabase
        .from("canvas_items")
        .delete()
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Элемент не найден или у вас нет доступа к нему.");
    },
    onSuccess: () => {
      setSelectedId(null);
      setEditingId(null);
      setActionError("");
    },
    onError: (error) => setActionError(error.message || "Не удалось удалить элемент."),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["canvas-items", workId] }),
  });

  const bringToFront = useCallback(
    (id, currentZ) => {
      if (currentZ >= maxZRef.current) return;
      const newZ = maxZRef.current + 1;
      maxZRef.current = newZ;
      updateMut.mutate({ id, z_index: newZ });
    },
    [updateMut],
  );

  // ── Add helpers ──
  const addSticky = () => {
    addMut.mutate({
      item_type: "sticky",
      title: "",
      content: "",
      color: "#F0A830",
      font_size: 14,
      bold: false,
      italic: false,
      font_color: "#1a1a1a",
      font_family: "var(--font-ui)",
      stroke_width: 0,
      stroke_color: "#000000",
      pos_x: 150 + Math.random() * 200,
      pos_y: 100 + Math.random() * 150,
      width: 200,
      height: 200,
    });
  };

  const addText = () => {
    addMut.mutate({
      item_type: "text",
      title: "Текст",
      content: "",
      color: "",
      font_size: 24,
      bold: false,
      italic: false,
      font_color: "#F0EDE8",
      font_family: "var(--font-display)",
      stroke_width: 0,
      stroke_color: "#000000",
      pos_x: 150 + Math.random() * 200,
      pos_y: 100 + Math.random() * 150,
      width: 240,
      height: 40,
    });
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setActionError("Выберите файл изображения.");
      event.target.value = "";
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setActionError("Изображение должно быть не больше 15 МБ.");
      event.target.value = "";
      return;
    }

    setImageUploading(true);
    setActionError("");
    try {
      const result = await uploadToCloudinary(file, "aniscript/canvas");
      if (!result.secure_url) throw new Error("Не удалось получить адрес изображения.");
      await addMut.mutateAsync({
        item_type: "image",
        title: "",
        content: "",
        color: "",
        image_url: result.secure_url,
        pos_x: 120 + Math.random() * 200,
        pos_y: 80 + Math.random() * 150,
        width: 300,
        height: 220,
      });
    } catch (error) {
      setActionError(error.message || "Не удалось загрузить изображение.");
    } finally {
      setImageUploading(false);
      event.target.value = "";
    }
  };

  // ── Тулбар ──
  const applyFormat = (field, value) => {
    if (!selectedItem) return;

    if (field === "font_size") {
      const next = Math.min(200, Math.max(6, Number(value) || 14));
      setToolbarFontSize(next);
      updateMut.mutate({ id: selectedItem.id, font_size: next });
    } else if (field === "bold") {
      const next = !tbBold;
      setToolbarBold(next);
      updateMut.mutate({ id: selectedItem.id, bold: next });
    } else if (field === "italic") {
      const next = !tbItalic;
      setToolbarItalic(next);
      updateMut.mutate({ id: selectedItem.id, italic: next });
    } else if (field === "color") {
      setToolbarColor(value);
      if (selectedItem.item_type === "sticky") {
        updateMut.mutate({ id: selectedItem.id, color: value });
      } else {
        updateMut.mutate({ id: selectedItem.id, font_color: value });
      }
    } else if (field === "font_family") {
      setToolbarFont(value);
      updateMut.mutate({ id: selectedItem.id, font_family: value });
    } else if (field === "stroke_width") {
      const next = Math.min(20, Math.max(0, Number(value) || 0));
      setToolbarStroke(next);
      updateMut.mutate({ id: selectedItem.id, stroke_width: next });
    } else if (field === "stroke_color") {
      setToolbarStrokeColor(value);
      updateMut.mutate({ id: selectedItem.id, stroke_color: value });
    }
  };

  const handleDuplicate = () => {
    if (!selectedItem) return;
    const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = selectedItem;
    addMut.mutate({ ...rest, pos_x: rest.pos_x + 20, pos_y: rest.pos_y + 20 });
  };

  const handleDelete = () => {
    if (!selectedItem) return;
    removeMut.mutate(selectedItem.id);
  };

  // ── Pan ──
  const handleBgDown = useCallback(
    (e) => {
      const t = e.target;
      const isBg =
        t === containerRef.current ||
        t === innerRef.current ||
        t.tagName === "svg" ||
        t.tagName === "line";
      if (!isBg) return;
      e.preventDefault();
      panRef.current = {
        active: true,
        sX: e.clientX,
        sY: e.clientY,
        sPX: pan.x,
        sPY: pan.y,
      };
      setSelectedId(null);
      setEditingId(null);
    },
    [pan],
  );

  useEffect(() => {
    const onMove = (e) => {
      if (!panRef.current.active) return;
      setPan({
        x: panRef.current.sPX + (e.clientX - panRef.current.sX),
        y: panRef.current.sPY + (e.clientY - panRef.current.sY),
      });
    };
    const onUp = () => {
      panRef.current.active = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // ── Zoom ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      setZoom((z) =>
        Math.min(3, Math.max(0.15, z + (e.deltaY > 0 ? -0.08 : 0.08))),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── Keyboard ──
  useEffect(() => {
    const onKey = (e) => {
      if (!selectedId || editingId || e.repeat) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeMut.mutate(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, editingId, removeMut]);

  const showTextControls =
    selectedItem &&
    (selectedItem.item_type === "text" || selectedItem.item_type === "sticky");

  return (
    <div className={styles.wrap}>
      {(actionError || itemsError) && (
        <div className={styles.errorBanner} role="alert">
          <span>{actionError || itemsError?.message || "Не удалось загрузить канвас."}</span>
          {actionError ? (
            <button type="button" onClick={() => setActionError("")} aria-label="Закрыть сообщение">
              <X size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["canvas-items", workId] })}
            >
              Повторить
            </button>
          )}
        </div>
      )}
      {itemsLoading && <div className={styles.loadingNotice}>Загружаем элементы канваса…</div>}

      {/* Тулбар */}
      <div className={styles.toolbar}>
        <button className={styles.toolBtn} onClick={addSticky}>
          <StickyNote size={14} /> Стикер
        </button>
        <button className={styles.toolBtn} onClick={addText}>
          <Type size={14} /> Текст
        </button>
        <button
          className={styles.toolBtn}
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={imageUploading || addMut.isPending}
        >
          <ImageIcon size={14} /> {imageUploading ? "Загрузка…" : "Фото"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageUpload}
        />

        {showTextControls && (
          <>
            <div className={styles.toolSep} />

            <div className={styles.formatGroup}>
              {/* Шрифт */}
              <select
                className={styles.fontSelect}
                value={tbFont}
                onChange={(e) => applyFormat("font_family", e.target.value)}
                title="Шрифт"
              >
                {FONT_OPTIONS.map((f) => (
                  <option
                    key={f.value}
                    value={f.value}
                    style={{ fontFamily: f.value }}
                  >
                    {f.label}
                  </option>
                ))}
              </select>

              {/* Размер */}
              <input
                type="number"
                className={styles.fontSizeInput}
                value={tbFontSize}
                onChange={(e) =>
                  applyFormat("font_size", Number(e.target.value))
                }
                min={8}
                max={200}
                title="Размер текста"
              />
              <span className={styles.fontSizeLabel}>px</span>

              {/* Bold */}
              <button
                className={`${styles.formatBtn} ${tbBold ? styles.formatBtnActive : ""}`}
                onClick={() => applyFormat("bold")}
                title="Жирный"
              >
                <Bold size={14} />
              </button>

              {/* Italic */}
              <button
                className={`${styles.formatBtn} ${tbItalic ? styles.formatBtnActive : ""}`}
                onClick={() => applyFormat("italic")}
                title="Курсив"
              >
                <Italic size={14} />
              </button>

              {/* Цвет */}
              <div
                className={styles.colorPickerWrapper}
                title={
                  selectedItem?.item_type === "sticky"
                    ? "Цвет стикера"
                    : "Цвет текста"
                }
              >
                <div
                  className={styles.colorPreview}
                  style={{ background: tbColor }}
                />
                <input
                  type="color"
                  className={styles.colorPicker}
                  value={tbColor}
                  onChange={(e) => applyFormat("color", e.target.value)}
                />
              </div>

              <div className={styles.toolSep} />

              {/* Обводка — только для text */}
              {selectedItem?.item_type === "text" && (
                <>
                  <span className={styles.strokeLabel}>Обводка</span>

                  <input
                    type="number"
                    className={styles.fontSizeInput}
                    value={tbStroke}
                    onChange={(e) =>
                      applyFormat("stroke_width", Number(e.target.value))
                    }
                    min={0}
                    max={20}
                    title="Толщина обводки (px)"
                  />
                  <span className={styles.fontSizeLabel}>px</span>

                  <div
                    className={styles.colorPickerWrapper}
                    title="Цвет обводки"
                  >
                    <div
                      className={styles.colorPreview}
                      style={{ background: tbStrokeColor }}
                    />
                    <input
                      type="color"
                      className={styles.colorPicker}
                      value={tbStrokeColor}
                      onChange={(e) =>
                        applyFormat("stroke_color", e.target.value)
                      }
                    />
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {selectedItem && (
          <>
            <div className={styles.toolSep} />
            <button className={styles.toolBtn} onClick={handleDuplicate}>
              <Copy size={14} /> Копия
            </button>
            <button className={styles.toolBtnDanger} onClick={handleDelete}>
              <Trash2 size={14} /> Удалить
            </button>
          </>
        )}

        <div className={styles.toolSep} />

        <button
          className={styles.toolBtnSm}
          onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
        >
          <ZoomIn size={14} />
        </button>
        <span className={styles.toolZoom}>{Math.round(zoom * 100)}%</span>
        <button
          className={styles.toolBtnSm}
          onClick={() => setZoom((z) => Math.max(0.15, z - 0.15))}
        >
          <ZoomOut size={14} />
        </button>
        <button
          className={styles.toolBtnSm}
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Канвас */}
      <div
        ref={containerRef}
        className={styles.canvas}
        onMouseDown={handleBgDown}
      >
        <div
          ref={innerRef}
          className={styles.canvasInner}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <svg className={styles.grid} viewBox="0 0 3000 3000">
            {Array.from({ length: 61 }, (_, i) => (
              <line
                key={`h${i}`}
                x1="0"
                y1={i * 50}
                x2="3000"
                y2={i * 50}
                stroke="rgba(240,237,232,0.025)"
                strokeWidth="1"
              />
            ))}
            {Array.from({ length: 61 }, (_, i) => (
              <line
                key={`v${i}`}
                x1={i * 50}
                y1="0"
                x2={i * 50}
                y2="3000"
                stroke="rgba(240,237,232,0.025)"
                strokeWidth="1"
              />
            ))}
          </svg>

          {items.map((item) => (
            <CanvasNode
              key={item.id}
              item={item}
              isSelected={selectedId === item.id}
              isEditing={editingId === item.id}
              zoom={zoom}
              onSelect={() => {
                setSelectedId(item.id);
                bringToFront(item.id, Number(item.z_index) || 0);
              }}
              onStartEdit={() => setEditingId(item.id)}
              onStopEdit={() => setEditingId(null)}
              onUpdate={(f) => updateMut.mutate({ id: item.id, ...f })}
            />
          ))}
        </div>

        <span className={styles.bgKanji} aria-hidden>
          板
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Canvas Node
   ═══════════════════════════════════════ */
function CanvasNode({
  item,
  isSelected,
  isEditing,
  zoom,
  onSelect,
  onStartEdit,
  onStopEdit,
  onUpdate,
}) {
  const elRef = useRef(null);
  const dragRef = useRef({ active: false, sX: 0, sY: 0, oX: 0, oY: 0 });

  const [localTitle, setLocalTitle] = useState(item.title);
  const [localContent, setLocalContent] = useState(item.content || "");

  // ── Drag ──
  const handleMouseDown = useCallback(
    (e) => {
      if (isEditing) return;
      if (e.target.closest(`.${styles.resizeHandle}`)) return;
      e.stopPropagation();
      onSelect();

      dragRef.current = {
        active: true,
        sX: e.clientX,
        sY: e.clientY,
        oX: item.pos_x,
        oY: item.pos_y,
      };

      const onMove = (me) => {
        if (!dragRef.current.active) return;
        const dx = (me.clientX - dragRef.current.sX) / zoom;
        const dy = (me.clientY - dragRef.current.sY) / zoom;
        if (elRef.current) {
          elRef.current.style.left = `${dragRef.current.oX + dx}px`;
          elRef.current.style.top = `${dragRef.current.oY + dy}px`;
        }
      };

      const onUp = (me) => {
        if (!dragRef.current.active) return;
        dragRef.current.active = false;
        const dx = (me.clientX - dragRef.current.sX) / zoom;
        const dy = (me.clientY - dragRef.current.sY) / zoom;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          onUpdate({
            pos_x: dragRef.current.oX + dx,
            pos_y: dragRef.current.oY + dy,
          });
        }
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [isEditing, item.pos_x, item.pos_y, zoom, onSelect, onUpdate],
  );

  // ── Resize ──
  const handleResize = useCallback(
    (e, corner) => {
      e.stopPropagation();
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = item.width;
      const startH = item.height;
      const startPosX = item.pos_x;
      const startPosY = item.pos_y;
      const ratio = startW / startH;

      const onMove = (me) => {
        const dx = (me.clientX - startX) / zoom;
        const dy = (me.clientY - startY) / zoom;

        let newW = startW;
        let newH = startH;
        let newX = startPosX;
        let newY = startPosY;

        if (corner.includes("r")) newW = Math.max(40, startW + dx);
        if (corner.includes("l")) {
          newW = Math.max(40, startW - dx);
          newX = startPosX + (startW - newW);
        }
        if (corner.includes("b")) newH = Math.max(20, startH + dy);
        if (corner.includes("t")) {
          newH = Math.max(20, startH - dy);
          newY = startPosY + (startH - newH);
        }

        if (me.shiftKey && item.item_type === "image") {
          if (corner.includes("r") || corner.includes("l")) {
            newH = newW / ratio;
          } else {
            newW = newH * ratio;
          }
        }

        if (elRef.current) {
          elRef.current.style.width = `${newW}px`;
          if (item.item_type !== "text") {
            elRef.current.style.height = `${newH}px`;
          }
          elRef.current.style.left = `${newX}px`;
          elRef.current.style.top = `${newY}px`;
        }
      };

      const onUp = () => {
        if (!elRef.current) return;
        const s = elRef.current.style;
        const updates = {
          width: parseFloat(s.width),
          pos_x: parseFloat(s.left),
          pos_y: parseFloat(s.top),
        };
        if (item.item_type !== "text") {
          updates.height = parseFloat(s.height);
        }
        onUpdate(updates);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [item, zoom, onUpdate],
  );

  const handleDblClick = (e) => {
    e.stopPropagation();
    if (item.item_type === "image") return;
    setLocalTitle(item.title || "");
    setLocalContent(item.content || "");
    onStartEdit();
  };

  const commitEdit = () => {
    if (item.item_type === "sticky") {
      onUpdate({ content: localContent });
    } else {
      onUpdate({ title: localTitle });
    }
    onStopEdit();
  };

  // ── Render ──
  const renderContent = () => {
    // ── IMAGE ──
    if (item.item_type === "image") {
      return (
        <img
          src={item.image_url}
          alt=""
          className={styles.nodeImage}
          draggable={false}
        />
      );
    }

    // ── STICKY ──
    if (item.item_type === "sticky") {
      const textColor = isDark(item.color) ? "#F0EDE8" : "#1a1a1a";
      const textStyle = {
        fontSize: (item.font_size || 14) + "px",
        fontWeight: item.bold ? 700 : 400,
        fontStyle: item.italic ? "italic" : "normal",
        fontFamily: item.font_family || "var(--font-ui)",
        color: textColor,
      };

      if (isEditing) {
        return (
          <div
            className={styles.stickyEdit}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <textarea
              value={localContent}
              onChange={(e) => setLocalContent(e.target.value)}
              className={styles.stickyTextarea}
              style={textStyle}
              placeholder="Заметка..."
              autoFocus
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Escape") commitEdit();
              }}
            />
          </div>
        );
      }

      return (
        <div className={styles.stickyBody}>
          <p className={styles.stickyText} style={textStyle}>
            {item.content || "Двойной клик..."}
          </p>
        </div>
      );
    }

    // ── TEXT ──
    const strokeW = item.stroke_width || 0;
    const strokeC = item.stroke_color || "#000000";

    // CSS text-stroke для обводки
    const strokeStyle =
      strokeW > 0 ? { WebkitTextStroke: `${strokeW}px ${strokeC}` } : {};

    const tStyle = {
      fontSize: (item.font_size || 24) + "px",
      fontWeight: item.bold ? 700 : 400,
      fontStyle: item.italic ? "italic" : "normal",
      color: item.font_color || "#F0EDE8",
      fontFamily: item.font_family || "var(--font-display)",
      ...strokeStyle,
    };

    if (isEditing) {
      return (
        <div
          className={styles.textEdit}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            className={styles.textInput}
            style={tStyle}
            autoFocus
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") commitEdit();
            }}
          />
        </div>
      );
    }

    return (
      <div className={styles.textBody}>
        <span className={styles.textContent} style={tStyle}>
          {item.title || "Текст"}
        </span>
      </div>
    );
  };

  const nodeClass = [
    styles.node,
    styles[`node-${item.item_type}`],
    isSelected ? styles.nodeSelected : "",
  ].join(" ");

  const nodeStyle = {
    left: item.pos_x,
    top: item.pos_y,
    width: item.width,
    height: item.item_type === "text" ? "auto" : item.height,
    zIndex: item.z_index,
  };

  if (item.item_type === "sticky") {
    nodeStyle.background = item.color || "#F0A830";
  }

  return (
    <div
      ref={elRef}
      className={nodeClass}
      style={nodeStyle}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDblClick}
    >
      {renderContent()}

      {isSelected && !isEditing && (
        <>
          {["tl", "tr", "bl", "br", "t", "r", "b", "l"].map((corner) => (
            <div
              key={corner}
              className={`${styles.resizeHandle} ${styles[`rh-${corner}`]}`}
              onMouseDown={(e) => handleResize(e, corner)}
            />
          ))}
        </>
      )}
    </div>
  );
}

function isDark(hex) {
  if (!hex) return true;
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 < 140;
}
