// src/pages/dashboard/board/WorldMap.jsx
import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ImagePlus, MapPin, Trash2, Save, X, RotateCcw } from "lucide-react";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
import { uploadToCloudinary } from "@lib/cloudinary";
import styles from "./WorldMap.module.css";

const MARKER_COLORS = [
  "#E8354A",
  "#F0A830",
  "#10B981",
  "#5B9BD5",
  "#8B5CF6",
  "#EC4899",
];

function useMapMarkers(workId) {
  return useQuery({
    queryKey: ["map-markers", workId],
    enabled: !!workId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("map_markers")
        .select("*")
        .eq("work_id", workId)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });
}

function useMapBackground(workId) {
  return useQuery({
    queryKey: ["world-map-background", workId],
    enabled: !!workId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("world_map_settings")
        .select("background_url, is_published")
        .eq("work_id", workId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function useMapEntries(workId) {
  return useQuery({
    queryKey: ["map-world-entries", workId],
    enabled: !!workId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("world_entries")
        .select("id, title, entry_type")
        .eq("work_id", workId)
        .order("title", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export default function WorldMap({ workId }) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const markerDragRef = useRef(null);
  const viewRef = useRef({ pan: { x: 0, y: 0 }, zoom: 1 });

  const {
    data: markers = [],
    isLoading: markersLoading,
    error: markersError,
  } = useMapMarkers(workId);
  const {
    data: mapBackground,
    error: backgroundError,
  } = useMapBackground(workId);
  const backgroundUrl = mapBackground?.background_url || null;
  const backgroundPublished = mapBackground?.is_published || false;
  const {
    data: entries = [],
    error: entriesError,
  } = useMapEntries(workId);

  const [selectedId, setSelectedId] = useState(null);
  const [addMode, setAddMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState("");

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const panRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    sPX: 0,
    sPY: 0,
  });

  useEffect(() => {
    viewRef.current = { pan, zoom };
  }, [pan, zoom]);

  const selected = markers.find((m) => m.id === selectedId);

  // Optimistic
  const optRemove = (id) =>
    queryClient.setQueryData(["map-markers", workId], (old) =>
      (old || []).filter((m) => m.id !== id),
    );

  const addMarker = useMutation({
    mutationFn: async ({ posX, posY }) => {
      const { error } = await supabase.from("map_markers").insert({
        work_id: workId,
        author_id: user.id,
        label: "Новая метка",
        pos_x: posX,
        pos_y: posY,
        color: "#E8354A",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["map-markers", workId] });
      setActionError("");
      setAddMode(false);
    },
    onError: (error) => setActionError(error.message || "Не удалось добавить метку."),
  });

  const updateMarker = useMutation({
    mutationFn: async ({ id, ...fields }) => {
      const { data, error } = await supabase
        .from("map_markers")
        .update(fields)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Метка не найдена или у вас нет доступа к ней.");
    },
    onSuccess: () => {
      setActionError("");
      queryClient.invalidateQueries({ queryKey: ["map-markers", workId] });
    },
    onError: (error) => {
      setActionError(error.message || "Не удалось сохранить метку.");
      queryClient.invalidateQueries({ queryKey: ["map-markers", workId] });
    },
  });

  const updateMarkerRef = useRef(null);
  useEffect(() => {
    updateMarkerRef.current = updateMarker.mutate;
  }, [updateMarker]);

  const removeMarker = useMutation({
    mutationFn: async (id) => {
      optRemove(id);
      const { data, error } = await supabase
        .from("map_markers")
        .delete()
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Метка не найдена или у вас нет доступа к ней.");
    },
    onSuccess: () => {
      setSelectedId(null);
      setActionError("");
    },
    onError: (error) => setActionError(error.message || "Не удалось удалить метку."),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["map-markers", workId] }),
  });

  const updateBackground = useMutation({
    mutationFn: async (fields) => {
      const { error } = await supabase
        .from("world_map_settings")
        .upsert({ work_id: workId, ...fields }, { onConflict: "work_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      setActionError("");
      queryClient.invalidateQueries({ queryKey: ["world-map-background", workId] });
    },
    onError: (error) => setActionError(error.message || "Не удалось сохранить фон карты."),
  });

  useEffect(() => {
    if (!workId) return undefined;
    const channel = supabase
      .channel(`world-map:${workId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "map_markers", filter: `work_id=eq.${workId}` },
        () => queryClient.invalidateQueries({ queryKey: ["map-markers", workId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "world_map_settings", filter: `work_id=eq.${workId}` },
        () => queryClient.invalidateQueries({ queryKey: ["world-map-background", workId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, workId]);

  const handleBackgroundUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setActionError("Выберите файл изображения.");
      event.target.value = "";
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setActionError("Изображение карты должно быть не больше 15 МБ.");
      event.target.value = "";
      return;
    }

    setUploading(true);
    setActionError("");
    try {
      const uploaded = await uploadToCloudinary(file, "aniscript/maps");
      if (!uploaded.secure_url) throw new Error("Не удалось получить адрес загруженной карты.");
      await updateBackground.mutateAsync({ background_url: uploaded.secure_url });
    } catch (error) {
      setActionError(error.message || "Не удалось загрузить фон карты.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleMapClick = useCallback(
    (e) => {
      if (!addMode) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const posX =
        ((e.clientX - rect.left - pan.x) / (rect.width * zoom)) * 100;
      const posY =
        ((e.clientY - rect.top - pan.y) / (rect.height * zoom)) * 100;

      addMarker.mutate({
        posX: Math.round(Math.max(0, Math.min(100, posX)) * 10) / 10,
        posY: Math.round(Math.max(0, Math.min(100, posY)) * 10) / 10,
      });
    },
    [addMode, pan, zoom, addMarker],
  );

  const handleMarkerPointerDown = (event, marker) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    markerDragRef.current = {
      id: marker.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      pos_x: Number(marker.pos_x),
      pos_y: Number(marker.pos_y),
    };
    setSelectedId(marker.id);
    setAddMode(false);
  };

  // Pan
  const handleBgDown = useCallback(
    (e) => {
      if (addMode) return;
      const target = e.target;
      if (
        target.closest(`.${styles.marker}`) ||
        target.closest(`.${styles.editorPanel}`)
      )
        return;
      e.preventDefault();
      panRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        sPX: pan.x,
        sPY: pan.y,
      };
    },
    [addMode, pan],
  );

  useEffect(() => {
    const onMove = (event) => {
      const drag = markerDragRef.current;
      if (drag) {
        if (drag.pointerId !== event.pointerId) return;
        const movedDistance = Math.hypot(
          event.clientX - drag.startX,
          event.clientY - drag.startY,
        );
        if (!drag.moved && movedDistance < 3) return;

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || !rect.width || !rect.height) return;
        const { pan: currentPan, zoom: currentZoom } = viewRef.current;
        const posX =
          ((event.clientX - rect.left - currentPan.x) /
            (rect.width * currentZoom)) *
          100;
        const posY =
          ((event.clientY - rect.top - currentPan.y) /
            (rect.height * currentZoom)) *
          100;
        const nextDrag = {
          ...drag,
          moved: true,
          pos_x: Math.round(Math.max(0, Math.min(100, posX)) * 10) / 10,
          pos_y: Math.round(Math.max(0, Math.min(100, posY)) * 10) / 10,
        };
        markerDragRef.current = nextDrag;
        queryClient.setQueryData(["map-markers", workId], (old) =>
          (old || []).map((marker) =>
            marker.id === nextDrag.id
              ? { ...marker, pos_x: nextDrag.pos_x, pos_y: nextDrag.pos_y }
              : marker,
          ),
        );
        return;
      }

      if (!panRef.current.active) return;
      setPan({
        x: panRef.current.sPX + (event.clientX - panRef.current.startX),
        y: panRef.current.sPY + (event.clientY - panRef.current.startY),
      });
    };
    const finishPointer = (event) => {
      const drag = markerDragRef.current;
      if (drag && (!event || event.pointerId === drag.pointerId)) {
        markerDragRef.current = null;
        if (drag.moved) {
          updateMarkerRef.current?.({
            id: drag.id,
            pos_x: drag.pos_x,
            pos_y: drag.pos_y,
          });
        }
      }
      panRef.current.active = false;
    };
    const onMouseMove = (event) => {
      if (!markerDragRef.current) onMove(event);
    };
    const onPointerCancel = () => {
      markerDragRef.current = null;
      panRef.current.active = false;
      queryClient.invalidateQueries({ queryKey: ["map-markers", workId] });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finishPointer);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", finishPointer);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finishPointer);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", finishPointer);
    };
  }, [queryClient, workId]);

  // Zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      setZoom((z) =>
        Math.min(3, Math.max(0.3, z + (e.deltaY > 0 ? -0.1 : 0.1))),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={`${styles.toolBtn} ${addMode ? styles.toolBtnActive : ""}`}
          onClick={() => {
            setAddMode(!addMode);
            setSelectedId(null);
          }}
        >
          <MapPin size={15} strokeWidth={1.5} />
          {addMode ? "Отмена" : "Метка"}
        </button>
        <span className={styles.toolInfo}>
          {markersLoading ? "Загружаем точки…" : `${markers.length} меток`} · {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => {
            setPan({ x: 0, y: 0 });
            setZoom(1);
          }}
        >
          Сброс
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className={styles.fileInput}
          onChange={handleBackgroundUpload}
          aria-label="Загрузить изображение карты"
        />
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || updateBackground.isPending}
        >
          <ImagePlus size={14} />
          {uploading ? "Загрузка…" : backgroundUrl ? "Сменить фон" : "Загрузить фон"}
        </button>
        {backgroundUrl && (
          <label className={styles.publishMapToggle}>
            <input
              type="checkbox"
              checked={backgroundPublished}
              onChange={(event) =>
                updateBackground.mutate({
                  is_published: event.target.checked,
                })
              }
              disabled={updateBackground.isPending}
            />
            <span>Открытая карта</span>
          </label>
        )}
        {backgroundUrl && (
          <button
            type="button"
            className={`${styles.toolBtn} ${styles.toolBtnDanger}`}
            onClick={() => {
              if (window.confirm("Убрать фоновое изображение карты?")) {
                updateBackground.mutate({
                  background_url: null,
                  is_published: false,
                });
              }
            }}
            disabled={updateBackground.isPending}
            title="Убрать фон карты"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {(actionError || markersError || backgroundError || entriesError) && (
        <div className={styles.errorBanner} role="alert">
          <span>
            {actionError || markersError?.message || backgroundError?.message || entriesError?.message}
          </span>
          <button
            type="button"
            onClick={() => {
              setActionError("");
              if (markersError) queryClient.refetchQueries({ queryKey: ["map-markers", workId] });
              if (backgroundError) queryClient.refetchQueries({ queryKey: ["world-map-background", workId] });
              if (entriesError) queryClient.refetchQueries({ queryKey: ["map-world-entries", workId] });
            }}
            aria-label={
              markersError || backgroundError || entriesError
                ? "Повторить загрузку"
                : "Закрыть сообщение"
            }
          >
            {markersError || backgroundError || entriesError
              ? <RotateCcw size={14} />
              : <X size={14} />}
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className={`${styles.mapContainer} ${addMode ? styles.mapAddMode : ""}`}
        onClick={handleMapClick}
        onMouseDown={handleBgDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className={styles.mapGrid}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
          >
          {backgroundUrl && (
            <img
              className={styles.mapBackground}
              src={backgroundUrl}
              alt=""
              draggable="false"
            />
          )}
          <svg
            className={styles.gridSvg}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {Array.from({ length: 11 }, (_, i) => (
              <line
                key={`h${i}`}
                x1="0"
                y1={i * 10}
                x2="100"
                y2={i * 10}
                stroke="rgba(240,237,232,0.04)"
                strokeWidth="0.2"
              />
            ))}
            {Array.from({ length: 11 }, (_, i) => (
              <line
                key={`v${i}`}
                x1={i * 10}
                y1="0"
                x2={i * 10}
                y2="100"
                stroke="rgba(240,237,232,0.04)"
                strokeWidth="0.2"
              />
            ))}
          </svg>

          {markers.map((marker) => (
            <div
              key={marker.id}
              className={`${styles.marker} ${selectedId === marker.id ? styles.markerSelected : ""}`}
              style={{
                left: `${marker.pos_x}%`,
                top: `${marker.pos_y}%`,
                "--marker-color": marker.color,
              }}
              role="button"
              tabIndex={0}
              aria-label={`${marker.label}; перетащите, чтобы переместить`}
              onPointerDown={(event) => handleMarkerPointerDown(event, marker)}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedId(marker.id);
                setAddMode(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedId(marker.id);
                  setAddMode(false);
                }
              }}
            >
              <MapPin
                size={20}
                strokeWidth={2}
                fill={marker.color}
                color={marker.color}
              />
              <span className={styles.markerLabel}>{marker.label}</span>
              <div className={styles.markerPulse} />
            </div>
          ))}
        </div>

        {addMode && (
          <div className={styles.mapHint}>
            <MapPin size={14} /> Кликни чтобы поставить метку
          </div>
        )}

        <span className={styles.mapBgKanji} aria-hidden>
          地
        </span>
      </div>

      <AnimatePresence>
        {selected && (
          <MarkerEditor
            key={selected.id}
            marker={selected}
            entries={entries}
            isSaving={updateMarker.isPending}
            isRemoving={removeMarker.isPending}
            onSave={(fields) =>
              updateMarker.mutateAsync({ id: selected.id, ...fields })
            }
            onRemove={() => removeMarker.mutateAsync(selected.id)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MarkerEditor({
  marker,
  entries,
  isSaving,
  isRemoving,
  onSave,
  onRemove,
  onClose,
}) {
  const [label, setLabel] = useState(marker.label);
  const [description, setDescription] = useState(marker.description || "");
  const [color, setColor] = useState(marker.color);
  const [worldEntryId, setWorldEntryId] = useState(marker.world_entry_id || "");
  const [isPublished, setIsPublished] = useState(marker.is_published || false);

  const save = async () => {
    if (!label.trim()) return;
    try {
      await onSave({
        label: label.trim(),
        description,
        color,
        world_entry_id: worldEntryId || null,
        is_published: isPublished,
      });
      onClose();
    } catch {
      // The parent shows the Supabase error and keeps the editor open.
    }
  };

  const remove = async () => {
    if (!window.confirm(`Удалить метку «${marker.label}»?`)) return;
    try {
      await onRemove();
    } catch {
      // The parent shows the Supabase error.
    }
  };

  return (
    <motion.div
      className={styles.editorPanel}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      <div className={styles.editorHeader}>
        <h3>Редактирование</h3>
        <button type="button" onClick={onClose} aria-label="Закрыть редактор">
          <X size={16} />
        </button>
      </div>
      <div className={styles.editorBody}>
        <input
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className={styles.editorInput}
          placeholder="Название..."
          maxLength={120}
          aria-label="Название метки"
        />

        <div className={styles.editorColors} aria-label="Цвет метки">
          {MARKER_COLORS.map((candidateColor) => (
            <button
              key={candidateColor}
              type="button"
              className={`${styles.editorColorDot} ${color === candidateColor ? styles.editorColorDotActive : ""}`}
              style={{ background: candidateColor }}
              onClick={() => setColor(candidateColor)}
              aria-label={`Выбрать цвет ${candidateColor}`}
              aria-pressed={color === candidateColor}
            />
          ))}
        </div>

        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={styles.editorTextarea}
          placeholder="Описание..."
          rows={4}
          maxLength={2000}
          aria-label="Описание метки"
        />

        <label className={styles.editorFieldLabel}>
          Статья кодекса
          <select
            value={worldEntryId}
            onChange={(event) => setWorldEntryId(event.target.value)}
            className={styles.editorInput}
          >
            <option value="">Без связанной статьи</option>
            {entries.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.title}</option>
            ))}
          </select>
        </label>

        <label className={styles.editorPublish}>
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(event) => setIsPublished(event.target.checked)}
          />
          <span>Показать на публичной карте</span>
        </label>

        <div className={styles.editorActions}>
          <button
            type="button"
            className={styles.editorRemove}
            onClick={remove}
            disabled={isRemoving}
          >
            <Trash2 size={13} /> {isRemoving ? "Удаляем…" : "Удалить"}
          </button>
          <button
            type="button"
            className={styles.editorSave}
            onClick={save}
            disabled={!label.trim() || isSaving}
          >
            <Save size={13} /> {isSaving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
