import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, MapPin } from "lucide-react";
import { supabase } from "@lib/supabase";
import styles from "./PublicWorldMap.module.css";

export default function PublicWorldMap({
  workId,
  backgroundUrl,
  settingsError,
  onOpenEntry,
}) {
  const [selectedMarkerId, setSelectedMarkerId] = useState(null);

  const {
    data: markers = [],
    isLoading: markersLoading,
    error: markersError,
  } = useQuery({
    queryKey: ["public-map-markers", workId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("map_markers")
        .select("id, world_entry_id, label, description, pos_x, pos_y, color")
        .eq("work_id", workId)
        .eq("is_published", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!workId,
  });

  const {
    data: entries = [],
    isLoading: entriesLoading,
    error: entriesError,
  } = useQuery({
    queryKey: ["public-map-world-entries", workId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("world_entries")
        .select("id, title, entry_type")
        .eq("work_id", workId)
        .eq("is_published", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!workId,
  });

  const selectedMarker =
    markers.find((marker) => marker.id === selectedMarkerId) || markers[0] || null;
  const linkedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedMarker?.world_entry_id) || null,
    [entries, selectedMarker],
  );

  if (settingsError || markersError || entriesError) {
    return (
      <div className={styles.error} role="alert">
        Не удалось загрузить карту мира: {
          settingsError?.message || markersError?.message || entriesError?.message
        }
      </div>
    );
  }

  if (markersLoading || entriesLoading) {
    return <div className={styles.loading}>Загружаем атлас мира…</div>;
  }

  if (!backgroundUrl && markers.length === 0) {
    return (
      <div className={styles.empty}>
        Автор пока не опубликовал карту или точки интереса.
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.canvas} aria-label="Интерактивная карта мира">
        {backgroundUrl && <img className={styles.background} src={backgroundUrl} alt="" />}
        {markers.map((marker) => (
          <button
            key={marker.id}
            type="button"
            className={`${styles.marker} ${selectedMarkerId === marker.id ? styles.markerActive : ""}`}
            style={{ left: `${marker.pos_x}%`, top: `${marker.pos_y}%`, "--marker-color": marker.color }}
            onClick={() => setSelectedMarkerId(marker.id)}
            aria-label={`Метка на карте: ${marker.label}`}
            aria-pressed={selectedMarkerId === marker.id}
            title={marker.label}
          >
            <MapPin size={22} fill="currentColor" strokeWidth={1.8} />
            <span className={styles.markerLabel}>{marker.label}</span>
          </button>
        ))}
        {markers.length === 0 && (
          <span className={styles.hint}>Автор пока не отметил на карте открытые локации</span>
        )}
      </div>

      {selectedMarker && (
        <section className={styles.infoCard} aria-live="polite">
          <div className={styles.infoMain}>
            <h3 className={styles.infoTitle}>{selectedMarker.label}</h3>
            {selectedMarker.description && (
              <p className={styles.infoText}>{selectedMarker.description}</p>
            )}
            {linkedEntry && (
              <button
                className={styles.entryLink}
                type="button"
                onClick={() => onOpenEntry?.(linkedEntry.id)}
              >
                <BookOpen size={14} />
                Открыть статью «{linkedEntry.title}»
              </button>
            )}
          </div>
          <span className={styles.infoMeta}>
            <MapPin size={13} /> Точка атласа
          </span>
        </section>
      )}
    </div>
  );
}
