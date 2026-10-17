// src/pages/dashboard/board/WorldMap.jsx
import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Trash2, Save, X } from "lucide-react";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
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

export default function WorldMap({ workId }) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const containerRef = useRef(null);

  const { data: markers = [] } = useMapMarkers(workId);

  const [selectedId, setSelectedId] = useState(null);
  const [addMode, setAddMode] = useState(false);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const panRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    sPX: 0,
    sPY: 0,
  });

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
      setAddMode(false);
    },
  });

  const updateMarker = useMutation({
    mutationFn: async ({ id, ...fields }) => {
      const { error } = await supabase
        .from("map_markers")
        .update(fields)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["map-markers", workId] }),
  });

  const removeMarker = useMutation({
    mutationFn: async (id) => {
      optRemove(id);
      setSelectedId(null);
      const { error } = await supabase
        .from("map_markers")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["map-markers", workId] }),
  });

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
    const onMove = (e) => {
      if (!panRef.current.active) return;
      setPan({
        x: panRef.current.sPX + (e.clientX - panRef.current.startX),
        y: panRef.current.sPY + (e.clientY - panRef.current.startY),
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
          {markers.length} меток · {Math.round(zoom * 100)}%
        </span>
        <button
          className={styles.toolBtn}
          onClick={() => {
            setPan({ x: 0, y: 0 });
            setZoom(1);
          }}
        >
          Сброс
        </button>
      </div>

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
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(marker.id);
                setAddMode(false);
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
            marker={selected}
            onSave={(fields) =>
              updateMarker.mutate({ id: selected.id, ...fields })
            }
            onRemove={() => removeMarker.mutate(selected.id)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MarkerEditor({ marker, onSave, onRemove, onClose }) {
  const [label, setLabel] = useState(marker.label);
  const [description, setDescription] = useState(marker.description || "");
  const [color, setColor] = useState(marker.color);

  useEffect(() => {
    setLabel(marker.label);
    setDescription(marker.description || "");
    setColor(marker.color);
  }, [marker.id]);

  return (
    <motion.div
      className={styles.editorPanel}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      <div className={styles.editorHeader}>
        <h3>Редактирование</h3>
        <button onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className={styles.editorBody}>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className={styles.editorInput}
          placeholder="Название..."
        />

        <div className={styles.editorColors}>
          {MARKER_COLORS.map((c) => (
            <button
              key={c}
              className={`${styles.editorColorDot} ${color === c ? styles.editorColorDotActive : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={styles.editorTextarea}
          placeholder="Описание..."
          rows={4}
        />

        <div className={styles.editorActions}>
          <button className={styles.editorRemove} onClick={onRemove}>
            <Trash2 size={13} /> Удалить
          </button>
          <button
            className={styles.editorSave}
            onClick={() => {
              onSave({ label, description, color });
              onClose();
            }}
          >
            <Save size={13} /> Сохранить
          </button>
        </div>
      </div>
    </motion.div>
  );
}
