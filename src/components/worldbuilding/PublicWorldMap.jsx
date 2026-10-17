import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Globe2, Layers, MapPin, RotateCcw } from "lucide-react";
import { supabase } from "@lib/supabase";
import WorldMapCanvas2D from "./WorldMapCanvas2D";

const WorldMap3D = lazy(() => import("./WorldMap3D"));
import { normalizeMapState } from "./mapTextures";
import styles from "./PublicWorldMap.module.css";

export default function PublicWorldMap({
  workId,
  backgroundUrl,
  mapState,
  settingsError,
  onOpenEntry,
}) {
  const queryClient = useQueryClient();
  const [selectedMarkerId, setSelectedMarkerId] = useState(null);
  const [mapView, setMapView] = useState("2d");

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

  const hasTerrainMap =
    Array.isArray(mapState?.strokes) ||
    Array.isArray(mapState?.tiles) ||
    Array.isArray(mapState?.stamps) ||
    Array.isArray(mapState?.countries);
  const normalizedMapState = useMemo(
    () => hasTerrainMap ? normalizeMapState(mapState) : null,
    [hasTerrainMap, mapState],
  );
  const selectedMarker =
    markers.find((marker) => marker.id === selectedMarkerId) || markers[0] || null;
  const linkedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedMarker?.world_entry_id) || null,
    [entries, selectedMarker],
  );

  if (settingsError || markersError || entriesError) {
    const error = settingsError || markersError || entriesError;
    return (
      <div className={styles.error} role="alert">
        <span>Не удалось загрузить карту мира: {error.message}</span>
        <button
          type="button"
          onClick={() => {
            if (settingsError) queryClient.refetchQueries({ queryKey: ["public-world-map-settings", workId] });
            if (markersError) queryClient.refetchQueries({ queryKey: ["public-map-markers", workId] });
            if (entriesError) queryClient.refetchQueries({ queryKey: ["public-map-world-entries", workId] });
          }}
        >
          <RotateCcw size={14} /> Повторить
        </button>
      </div>
    );
  }

  if (markersLoading || entriesLoading) {
    return <div className={styles.loading}>Загружаем атлас мира…</div>;
  }

  if (!backgroundUrl && markers.length === 0 && !hasTerrainMap) {
    return (
      <div className={styles.empty}>
        Автор пока не опубликовал карту или точки интереса.
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {hasTerrainMap && (
        <div className={styles.viewControls} role="group" aria-label="Режим карты">
          <button
            type="button"
            className={mapView === "2d" ? styles.viewActive : ""}
            onClick={() => setMapView("2d")}
            aria-pressed={mapView === "2d"}
          >
            <Layers size={14} /> 2D
          </button>
          <button
            type="button"
            className={mapView === "3d" ? styles.viewActive : ""}
            onClick={() => setMapView("3d")}
            aria-pressed={mapView === "3d"}
          >
            <Globe2 size={14} /> Вращать в 3D
          </button>
        </div>
      )}

      {hasTerrainMap ? (
        mapView === "3d" ? (
          <div className={styles.terrain3d}>
            <Suspense fallback={<div className={styles.loading}>Загружаем 3D-сцену…</div>}>
              <WorldMap3D
                mapState={normalizedMapState}
                markers={markers}
                onSelectMarker={setSelectedMarkerId}
              />
            </Suspense>
          </div>
        ) : (
          <div className={styles.terrainViewport} aria-label="Карта мира сверху">
            <div
              className={styles.terrainPlane}
              style={{
                width: `${normalizedMapState.width}px`,
                height: `${normalizedMapState.height}px`,
              }}
            >
              <WorldMapCanvas2D mapState={normalizedMapState} />
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
                  <MapPin size={20} fill="currentColor" strokeWidth={1.8} />
                  <span className={styles.markerLabel}>{marker.label}</span>
                </button>
              ))}
            </div>
          </div>
        )
      ) : (
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
      )}

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
