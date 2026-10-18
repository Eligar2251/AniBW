import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Brush,
  ChevronDown,
  CircleHelp,
  Eraser,
  Globe2,
  Hand,
  Layers,
  MapPinned,
  Maximize2,
  Minimize2,
  Minus,
  Mountain,
  PaintBucket,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Undo2,
  Upload,
} from "lucide-react";
import { supabase } from "@lib/supabase";
import { uploadToCloudinary } from "@lib/cloudinary";
import WorldMapCanvas2D from "./WorldMapCanvas2D";

const WorldMap3D = lazy(() => import("./WorldMap3D"));
import {
  MAP_SIZE_PRESETS,
  getAllMapTextures,
  normalizeMapState,
} from "./mapTextures";
import styles from "./WorldMapBuilder.module.css";

function useMapSettings(workId) {
  return useQuery({
    queryKey: ["world-map-background", workId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("world_map_settings")
        .select("work_id, background_url, is_published, map_state, updated_at")
        .eq("work_id", workId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!workId,
  });
}

function createId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
}

function validateImage(file) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file?.type)) {
    throw new Error("Поддерживаются PNG, JPEG и WebP.");
  }
  if (file.size > 15 * 1024 * 1024) throw new Error("Размер изображения не должен превышать 15 МБ.");
}

export default function WorldMapBuilder({ workId }) {
  const { data: settings, isLoading, error, refetch } = useMapSettings(workId);

  if (isLoading) {
    return <div className={styles.status}>Загружаем редактор карты…</div>;
  }

  if (error) {
    return (
      <div className={styles.status} role="alert">
        <span>Не удалось загрузить карту: {error.message}</span>
        <button type="button" className={styles.secondaryButton} onClick={() => refetch()}>
          <RotateCcw size={14} /> Повторить
        </button>
      </div>
    );
  }

  return (
    <MapBuilderEditor
      key={workId}
      workId={workId}
      settings={settings}
    />
  );
}

function MapBuilderEditor({ workId, settings }) {
  const queryClient = useQueryClient();
  const sheetInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const workspaceRef = useRef(null);
  const revisionRef = useRef(0);
  const mapStateRef = useRef(null);
  const historyRef = useRef({ undo: [], redo: [] });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [mapState, setMapState] = useState(() => normalizeMapState(settings?.map_state));
  useEffect(() => {
    mapStateRef.current = mapState;
  }, [mapState]);
  const [selectedTextureId, setSelectedTextureId] = useState("grass");
  const [tool, setTool] = useState("brush");
  const [brushSize, setBrushSize] = useState(0.055);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [forestDensity, setForestDensity] = useState(0.92);
  const [brushSmoothing, setBrushSmoothing] = useState(0.72);
  const [textureRotation, setTextureRotation] = useState(0);
  const [stampSize, setStampSize] = useState(0.1);
  const [stampRotation, setStampRotation] = useState(0);
  const [citySize, setCitySize] = useState(0.3);
  const [cityType, setCityType] = useState("city");
  const [selectedCountryId, setSelectedCountryId] = useState(null);
  const [countryName, setCountryName] = useState("Новая страна");
  const [countryColor, setCountryColor] = useState("#d9895b");
  const [countryDraftCount, setCountryDraftCount] = useState(0);
  const [countryFinishSignal, setCountryFinishSignal] = useState(0);
  const [countryCancelSignal, setCountryCancelSignal] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState("2d");
  const [zoom, setZoom] = useState(0.95);
  const [mapRotation, setMapRotation] = useState(0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [terrainTool, setTerrainTool] = useState("orbit");
  const [terrainBrushSize, setTerrainBrushSize] = useState(0.05);
  const [terrainStrength, setTerrainStrength] = useState(0.04);
  const [sheetColumns, setSheetColumns] = useState(4);
  const [sheetRows, setSheetRows] = useState(4);
  const [uploading, setUploading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [hasSavedMap, setHasSavedMap] = useState(
    Array.isArray(settings?.map_state?.strokes) || Array.isArray(settings?.map_state?.tiles) || Array.isArray(settings?.map_state?.stamps),
  );
  const [isPublished, setIsPublished] = useState(Boolean(settings?.is_published));
  const [actionError, setActionError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const textures = useMemo(
    () => getAllMapTextures(mapState.textures),
    [mapState.textures],
  );
  const selectedTexture = textures.find((texture) => texture.id === selectedTextureId) || textures[0];
  const isForestTexture = selectedTexture?.brushMode === "forest" || selectedTexture?.brushMode === "cluster";

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === workspaceRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const saveMap = useMutation({
    mutationFn: async () => {
      const { data, error: saveError } = await supabase
        .from("world_map_settings")
        .upsert(
          { work_id: workId, map_state: mapState },
          { onConflict: "work_id" },
        )
        .select("work_id, background_url, is_published, map_state, updated_at")
        .single();
      if (saveError) throw saveError;
      return { data, revision: revisionRef.current };
    },
    onSuccess: ({ data, revision }) => {
      setHasSavedMap(true);
      const hasNewerEdits = revisionRef.current !== revision;
      setIsDirty(hasNewerEdits);
      setStatusMessage(hasNewerEdits ? "Снимок сохранён. Сохраните последние изменения ещё раз." : "Карта сохранена.");
      setActionError("");
      queryClient.setQueryData(["world-map-background", workId], (current) => ({
        ...current,
        ...data,
      }));
      queryClient.invalidateQueries({ queryKey: ["public-world-map-settings", workId] });
      queryClient.invalidateQueries({ queryKey: ["public-world-availability", workId] });
    },
    onError: (saveError) => setActionError(saveError.message || "Не удалось сохранить карту."),
  });

  const togglePublication = useMutation({
    mutationFn: async (nextPublished) => {
      const { data, error: publishError } = await supabase
        .from("world_map_settings")
        .update({ is_published: nextPublished })
        .eq("work_id", workId)
        .select("work_id, is_published, updated_at")
        .maybeSingle();
      if (publishError) throw publishError;
      if (!data) throw new Error("Сначала сохраните карту.");
      return data;
    },
    onSuccess: (data) => {
      setIsPublished(data.is_published);
      setStatusMessage(data.is_published ? "Атлас опубликован." : "Атлас скрыт от читателей.");
      setActionError("");
      queryClient.setQueryData(["world-map-background", workId], (current) => ({
        ...current,
        ...data,
      }));
      queryClient.invalidateQueries({ queryKey: ["public-world-map-settings", workId] });
      queryClient.invalidateQueries({ queryKey: ["public-world-availability", workId] });
    },
    onError: (publishError) => setActionError(publishError.message || "Не удалось изменить публикацию."),
  });

  const updateMap = (change) => {
    const current = mapStateRef.current || mapState;
    const next = typeof change === "function" ? change(current) : change;
    if (!next || next === current) return;
    historyRef.current.undo.push(current);
    if (historyRef.current.undo.length > 60) historyRef.current.undo.shift();
    historyRef.current.redo = [];
    mapStateRef.current = next;
    setCanUndo(historyRef.current.undo.length > 0);
    setCanRedo(false);
    revisionRef.current += 1;
    setMapState(next);
    setIsDirty(true);
    setStatusMessage("");
    setActionError("");
  };

  const undoMap = useCallback(() => {
    const previous = historyRef.current.undo.pop();
    if (!previous) return;
    historyRef.current.redo.push(mapStateRef.current);
    mapStateRef.current = previous;
    setCanUndo(historyRef.current.undo.length > 0);
    setCanRedo(true);
    revisionRef.current += 1;
    setMapState(previous);
    setIsDirty(true);
    setStatusMessage("Изменение отменено.");
    setActionError("");
  }, []);

  const redoMap = useCallback(() => {
    const next = historyRef.current.redo.pop();
    if (!next) return;
    historyRef.current.undo.push(mapStateRef.current);
    mapStateRef.current = next;
    setCanUndo(true);
    setCanRedo(historyRef.current.redo.length > 0);
    revisionRef.current += 1;
    setMapState(next);
    setIsDirty(true);
    setStatusMessage("Изменение восстановлено.");
    setActionError("");
  }, []);

  useEffect(() => {
    const handleHistoryShortcut = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redoMap();
        else undoMap();
      } else if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoMap();
      }
    };
    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, [redoMap, undoMap]);

  const addStroke = (stroke) => {
    if (!stroke?.points?.length) return;
    updateMap((current) => ({
      ...current,
      strokes: [...current.strokes, stroke].slice(-2000),
    }));
  };

  const addStamp = (stamp) => {
    if (!stamp?.textureId) return;
    updateMap((current) => ({ ...current, stamps: [...(current.stamps || []), stamp].slice(-3000) }));
  };

  const addStamps = (stamps) => {
    if (!stamps?.length) return;
    updateMap((current) => ({
      ...current,
      stamps: [...(current.stamps || []), ...stamps].slice(-3000),
    }));
  };

  const addCountry = (points) => {
    const name = countryName.trim() || `Страна ${(mapState.countries || []).length + 1}`;
    if (points?.length < 3) {
      setActionError("Для границы страны нужно не менее трёх точек.");
      return;
    }
    const country = {
      id: createId("country"),
      name: name.slice(0, 80),
      color: countryColor,
      points: points.map((point) => ({ x: point.x, y: point.y })),
    };
    updateMap((current) => ({
      ...current,
      countries: [...(current.countries || []), country].slice(-100),
    }));
    setSelectedCountryId(country.id);
    setCountryName("Новая страна");
    setStatusMessage(`Граница «${country.name}» добавлена.`);
  };

  const deleteStamp = (stampId) => {
    updateMap((current) => ({
      ...current,
      stamps: (current.stamps || []).filter((stamp) => stamp.id !== stampId),
      cities: current.cities.filter((city) => city.stampId !== stampId),
    }));
  };

  const deleteCountry = (countryId) => {
    updateMap((current) => ({
      ...current,
      countries: (current.countries || []).filter((country) => country.id !== countryId),
    }));
    setSelectedCountryId((current) => (current === countryId ? null : current));
  };

  const selectTexture = (texture) => {
    setSelectedTextureId(texture.id);
    setStampSize(texture.defaultSize || 0.08);
    if (texture.brushMode === "forest" || texture.brushMode === "cluster") {
      setForestDensity(texture.forestDensity || 0.92);
    }
    if (texture.brushMode === "wall") setTool("wall");
    else if (texture.placement === "stamp") setTool("stamp");
    else if (texture.placement === "scatter") setTool("scatter");
    else if (["stamp", "scatter", "wall"].includes(tool)) setTool("brush");
  };

  const toggleFullscreen = async () => {
    const target = workspaceRef.current;
    if (!target) return;
    try {
      if (document.fullscreenElement === target) await document.exitFullscreen();
      else if (target.requestFullscreen) await target.requestFullscreen();
      else throw new Error("Полноэкранный режим не поддерживается этим браузером.");
    } catch (fullscreenError) {
      setActionError(fullscreenError.message || "Не удалось открыть редактор на весь экран.");
    }
  };

  const changeViewMode = (nextMode) => {
    setViewMode(nextMode);
    if (nextMode === "3d") setTerrainTool("orbit");
    if (nextMode !== "2d" && countryDraftCount) {
      setCountryDraftCount(0);
      setCountryCancelSignal((value) => value + 1);
    }
  };

  const changeCamera = (camera) => {
    if (Number.isFinite(camera.zoom)) setZoom(camera.zoom);
    if (Number.isFinite(camera.rotation)) setMapRotation(camera.rotation);
    if (Number.isFinite(camera.panX)) setPanX(camera.panX);
    if (Number.isFinite(camera.panY)) setPanY(camera.panY);
  };

  const rotateMap = (amount) => {
    setMapRotation((value) => ((value + amount) % 360 + 360) % 360);
  };

  const resetMapView = () => {
    setZoom(0.95);
    setMapRotation(0);
    setPanX(0);
    setPanY(0);
  };

  const addCity = (x, y) => {
    const isVillage = cityType === "village";
    const cityName = window.prompt(
      isVillage ? "Название поселения" : "Название города",
      isVillage ? "Новая деревня" : "Новый город",
    );
    if (!cityName?.trim()) return;
    const id = createId("city");
    const textureId = isVillage ? "village" : "city";
    const size = isVillage ? Math.min(citySize, 0.24) : citySize;
    const stamp = {
      id: createId("stamp"),
      textureId,
      x,
      y,
      size,
      rotation: stampRotation,
    };
    updateMap((current) => ({
      ...current,
      cities: [
        ...current.cities,
        { id, stampId: stamp.id, name: cityName.trim().slice(0, 80), x, y, type: cityType },
      ],
      stamps: [...(current.stamps || []), stamp].slice(-3000),
    }));
  };

  const addHeightStroke = (stroke) => {
    if (!stroke?.points?.length) return;
    updateMap((current) => ({
      ...current,
      heightStrokes: [...(current.heightStrokes || []), stroke].slice(-1000),
    }));
  };

  const setBaseTexture = (textureId, rotation = textureRotation) => {
    if (mapState.baseTextureId === textureId && mapState.baseTextureRotation === rotation) return;
    updateMap((current) => ({ ...current, baseTextureId: textureId, baseTextureRotation: rotation }));
  };

  const resizeMap = (width, height) => {
    updateMap((current) => ({ ...current, width, height }));
  };

  const importSpriteSheet = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setActionError("");
    setStatusMessage("");
    try {
      validateImage(file);
      const cols = Math.min(12, Math.max(1, Number(sheetColumns) || 1));
      const rows = Math.min(12, Math.max(1, Number(sheetRows) || 1));
      if (cols * rows > 144) throw new Error("В одном листе можно нарезать не больше 144 тайлов.");
      if (mapState.textures.length + cols * rows > 256) {
        throw new Error("В атлас можно добавить не больше 256 пользовательских текстур.");
      }
      const uploaded = await uploadToCloudinary(file, "aniscript/world-maps/tilesheets");
      if (!uploaded.secure_url) throw new Error("Не удалось получить адрес листа текстур.");
      const batchId = createId("atlas");
      const newTextures = Array.from({ length: cols * rows }, (_, index) => ({
        id: `${batchId}-${index + 1}`,
        label: `Лист ${mapState.textures.length + index + 1}`,
        src: uploaded.secure_url,
        sourceType: "sheet",
        col: index % cols,
        row: Math.floor(index / cols),
        cols,
        rows,
        elevation: 0.22,
        category: "земля",
      }));
      updateMap((current) => ({
        ...current,
        textures: [...current.textures, ...newTextures],
      }));
      setSelectedTextureId(newTextures[0].id);
      setTool("brush");
      setStatusMessage(`Лист разделён на ${newTextures.length} текстур.`);
    } catch (uploadError) {
      setActionError(uploadError.message || "Не удалось импортировать лист текстур.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const replaceSelectedTexture = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedTexture) return;
    setUploading(true);
    setActionError("");
    setStatusMessage("");
    try {
      validateImage(file);
      const uploaded = await uploadToCloudinary(file, "aniscript/world-maps/tiles");
      if (!uploaded.secure_url) throw new Error("Не удалось получить адрес текстуры.");
      const replacement = {
        ...selectedTexture,
        src: uploaded.secure_url,
        sourceType: "image",
        col: 0,
        row: 0,
        cols: 1,
        rows: 1,
      };
      updateMap((current) => ({
        ...current,
        textures: [
          ...current.textures.filter((texture) => texture.id !== replacement.id),
          replacement,
        ],
      }));
      setStatusMessage(`Текстура «${selectedTexture.label}» заменена.`);
    } catch (uploadError) {
      setActionError(uploadError.message || "Не удалось заменить текстуру.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const deleteCity = (cityId) => {
    updateMap((current) => {
      const city = current.cities.find((item) => item.id === cityId);
      return {
        ...current,
        cities: current.cities.filter((item) => item.id !== cityId),
        stamps: city?.stampId
          ? (current.stamps || []).filter((stamp) => stamp.id !== city.stampId)
          : current.stamps,
      };
    });
  };

  const selectSize = (event) => {
    const preset = MAP_SIZE_PRESETS.find((item) => `${item.width}x${item.height}` === event.target.value);
    if (preset) resizeMap(preset.width, preset.height);
  };

  const saveDisabled = saveMap.isPending || (!isDirty && hasSavedMap);
  const publicationDisabled = !hasSavedMap || isDirty || togglePublication.isPending;
  const currentPreset = `${mapState.width}x${mapState.height}`;

  return (
    <section className={styles.editor} ref={workspaceRef}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.headingIcon}><Mountain size={17} /></span>
          <div>
            <h2>Мастерская карт</h2>
            <p>Плавная свободная кисть, соединяемые текстурные стены и редактируемый 3D-рельеф.</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.toolButton}
            type="button"
            onClick={undoMap}
            disabled={!canUndo}
            title="Отменить последнее действие · Ctrl+Z"
            aria-label="Отменить последнее действие"
          >
            <Undo2 size={14} />
          </button>
          <button
            className={styles.toolButton}
            type="button"
            onClick={redoMap}
            disabled={!canRedo}
            title="Повторить действие · Ctrl+Shift+Z"
            aria-label="Повторить действие"
          >
            <Redo2 size={14} />
          </button>
          <label className={`${styles.publishToggle} ${publicationDisabled ? styles.disabled : ""}`}>
            <input
              type="checkbox"
              checked={isPublished}
              disabled={publicationDisabled}
              onChange={(event) => togglePublication.mutate(event.target.checked)}
            />
            <span>{togglePublication.isPending ? "Публикация…" : "Открытый атлас"}</span>
          </label>
          <button
            className={styles.saveButton}
            type="button"
            onClick={() => saveMap.mutate()}
            disabled={saveDisabled}
          >
            {saveMap.isPending ? <RotateCcw size={15} className={styles.spinning} /> : <Save size={15} />}
            {saveMap.isPending ? "Сохраняем…" : isDirty || !hasSavedMap ? "Сохранить" : "Сохранено"}
          </button>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.toolGroup} role="group" aria-label="Инструменты карты">
          <button type="button" className={`${styles.toolButton} ${tool === "brush" ? styles.active : ""}`} onClick={() => setTool("brush")}>
            <Brush size={14} /> Кисть
          </button>
          <button type="button" className={`${styles.toolButton} ${tool === "pan" ? styles.active : ""}`} onClick={() => setTool("pan")} title="Перемещать карту · пробел или правая кнопка тоже работают">
            <Hand size={14} /> Перемещение
          </button>
          <button type="button" className={`${styles.toolButton} ${tool === "fill" ? styles.active : ""}`} onClick={() => setTool("fill")}>
            <PaintBucket size={14} /> Основа
          </button>
          <button type="button" className={`${styles.toolButton} ${tool === "erase" ? styles.active : ""}`} onClick={() => setTool("erase")}>
            <Eraser size={14} /> Ластик
          </button>
          <button type="button" className={`${styles.toolButton} ${tool === "wall" ? styles.active : ""}`} onClick={() => setTool("wall")}>
            <Mountain size={14} /> Стена
          </button>
          <button type="button" className={`${styles.toolButton} ${tool === "city" ? styles.active : ""}`} onClick={() => setTool("city")}>
            <MapPinned size={14} /> Город / деревня
          </button>
          <button type="button" className={`${styles.toolButton} ${tool === "country" ? styles.active : ""}`} onClick={() => setTool("country")}>
            <Globe2 size={14} /> Граница
          </button>
          <button type="button" className={`${styles.toolButton} ${tool === "select-country" ? styles.active : ""}`} onClick={() => setTool("select-country")}>
            <MapPinned size={14} /> Выбрать страну
          </button>
          {selectedTexture?.placement && (
            <button
              type="button"
              className={`${styles.toolButton} ${tool === selectedTexture.placement ? styles.active : ""}`}
              onClick={() => setTool(selectedTexture.placement)}
              title={selectedTexture.placement === "scatter" ? "Рассаживать деревья без наложения" : "Разместить один объект за щелчок"}
            >
              <MapPinned size={14} /> {selectedTexture.placement === "scatter" ? "Деревья" : "Один штамп"}
            </button>
          )}
        </div>

        {(tool === "brush" || tool === "erase" || tool === "wall" || tool === "fill") && (
          <div className={styles.brushControls}>
            {tool !== "fill" && (
              <label className={styles.brushControl}>
                <span>
                  {tool === "wall" ? "Толщина стены" : isForestTexture ? "Ширина леса" : "Размер кисти"}
                  <b>
                    {Math.round(isForestTexture && tool !== "wall"
                      ? Math.max(56, Math.min(340, brushSize * mapState.height * 2.15))
                      : brushSize * mapState.height)} px
                  </b>
                </span>
                <input
                  type="range"
                  min="0.005"
                  max="0.22"
                  step="0.005"
                  value={brushSize}
                  onChange={(event) => setBrushSize(Number(event.target.value))}
                  aria-label={tool === "wall" ? "Толщина стены" : isForestTexture ? "Ширина лесной кисти" : "Размер кисти"}
                />
              </label>
            )}
            {tool === "brush" && isForestTexture && (
              <label className={styles.brushControl}>
                <span>Плотность леса <b>{Math.round(forestDensity * 100)}%</b></span>
                <input
                  type="range"
                  min="0.65"
                  max="1"
                  step="0.01"
                  value={forestDensity}
                  onChange={(event) => setForestDensity(Number(event.target.value))}
                  aria-label="Плотность леса"
                />
              </label>
            )}
            {(tool === "brush" || tool === "wall") && (
              <label className={styles.brushControl}>
                <span>Непрозрачность <b>{Math.round(brushOpacity * 100)}%</b></span>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={Math.round(brushOpacity * 100)}
                  onChange={(event) => setBrushOpacity(Number(event.target.value) / 100)}
                  aria-label="Непрозрачность кисти"
                />
              </label>
            )}
            {(tool === "brush" || tool === "wall") && (
              <label className={styles.brushControl}>
                <span>Сглаживание <b>{Math.round(brushSmoothing * 100)}%</b></span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round(brushSmoothing * 100)}
                  onChange={(event) => setBrushSmoothing(Number(event.target.value) / 100)}
                  aria-label="Сглаживание линии кисти"
                />
              </label>
            )}
            {(tool === "brush" || tool === "wall" || tool === "fill") && !isForestTexture && (
              <label className={styles.brushControl}>
                <span>Поворот текстуры <b>{Math.round(textureRotation)}°</b></span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  value={textureRotation}
                  onChange={(event) => setTextureRotation(Number(event.target.value))}
                  aria-label="Поворот текстуры"
                />
              </label>
            )}
          </div>
        )}

        {tool === "city" && (
          <>
            <label className={styles.selectWrap}>
              Тип
              <select
                value={cityType}
                onChange={(event) => {
                  const nextType = event.target.value;
                  setCityType(nextType);
                  setCitySize(nextType === "village" ? 0.22 : 0.3);
                }}
              >
                <option value="city">Город</option>
                <option value="village">Посёлок</option>
              </select>
              <ChevronDown size={12} />
            </label>
            <label className={styles.brushControl}>
              <span>Размер штампа <b>{Math.round(citySize * mapState.height)} px</b></span>
              <input
                type="range"
                min="0.12"
                max="0.48"
                step="0.01"
                value={citySize}
                onChange={(event) => setCitySize(Number(event.target.value))}
                aria-label="Размер города или поселения"
              />
            </label>
            <label className={styles.brushControl}>
              <span>Поворот <b>{Math.round(stampRotation)}°</b></span>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={stampRotation}
                onChange={(event) => setStampRotation(Number(event.target.value))}
                aria-label="Поворот штампа города"
              />
            </label>
          </>
        )}

        {(tool === "stamp" || tool === "scatter") && (
          <label className={styles.brushControl}>
            <span>{tool === "scatter" ? "Размер дерева" : "Размер штампа"} <b>{Math.round(stampSize * mapState.height)} px</b></span>
            <input
              type="range"
              min="0.035"
              max="0.38"
              step="0.005"
              value={stampSize}
              onChange={(event) => setStampSize(Number(event.target.value))}
              aria-label="Размер штампа"
            />
          </label>
        )}
        {tool === "stamp" && (
          <label className={styles.brushControl}>
            <span>Поворот штампа <b>{Math.round(stampRotation)}°</b></span>
            <input
              type="range"
              min="-180"
              max="180"
              step="5"
              value={stampRotation}
              onChange={(event) => setStampRotation(Number(event.target.value))}
              aria-label="Поворот текстуры-штампа"
            />
          </label>
        )}

        {tool === "country" && viewMode === "2d" && (
          <div className={styles.countryControls}>
            <label>
              Название
              <input maxLength={80} value={countryName} onChange={(event) => setCountryName(event.target.value)} />
            </label>
            <label className={styles.countryColorControl} title="Цвет границы">
              <input type="color" value={countryColor} onChange={(event) => setCountryColor(event.target.value)} aria-label="Цвет страны" />
            </label>
            <span>{countryDraftCount} точек · щёлкните по карте, затем Enter</span>
            <button
              className={styles.finishCountryButton}
              type="button"
              disabled={countryDraftCount < 3}
              onClick={() => setCountryFinishSignal((value) => value + 1)}
            >
              Завершить
            </button>
            <button
              className={styles.cancelCountryButton}
              type="button"
              disabled={!countryDraftCount}
              onClick={() => setCountryCancelSignal((value) => value + 1)}
            >
              Отмена
            </button>
          </div>
        )}
        {tool === "country" && viewMode === "3d" && (
          <span className={styles.countryHint}>Создание границ доступно в режиме 2D.</span>
        )}

        <label className={styles.selectWrap}>
          Холст
          <select value={currentPreset} onChange={selectSize}>
            {MAP_SIZE_PRESETS.map((preset) => (
              <option key={`${preset.width}x${preset.height}`} value={`${preset.width}x${preset.height}`}>
                {preset.label}
              </option>
            ))}
          </select>
          <ChevronDown size={12} />
        </label>

        <span className={styles.toolbarSpacer} />
        <div className={styles.viewSwitch} role="group" aria-label="Режим просмотра">
          <button type="button" className={viewMode === "2d" ? styles.viewActive : ""} onClick={() => changeViewMode("2d")}>
            <Layers size={14} /> 2D
          </button>
          <button type="button" className={viewMode === "3d" ? styles.viewActive : ""} onClick={() => changeViewMode("3d")}>
            <Globe2 size={14} /> 3D
          </button>
        </div>
        {viewMode === "2d" && (
          <div className={styles.zoomControls} aria-label="Навигация по карте">
            <button type="button" onClick={() => setZoom((value) => Math.max(0.3, value - 0.1))} aria-label="Уменьшить масштаб"><Minus size={13} /></button>
            <span>{Math.round(zoom * 100)}% · {Math.round(mapRotation)}°</span>
            <button type="button" onClick={() => setZoom((value) => Math.min(2.5, value + 0.1))} aria-label="Увеличить масштаб"><Plus size={13} /></button>
            <button type="button" onClick={() => rotateMap(-15)} aria-label="Повернуть карту влево"><RotateCcw size={13} /></button>
            <button type="button" onClick={() => rotateMap(15)} aria-label="Повернуть карту вправо"><RotateCw size={13} /></button>
            <button type="button" onClick={resetMapView} aria-label="Сбросить поворот и положение карты"><MapPinned size={13} /></button>
          </div>
        )}
        {viewMode === "3d" && (
          <>
            <div className={styles.toolGroup} role="group" aria-label="Инструменты рельефа 3D">
              <button type="button" className={`${styles.toolButton} ${terrainTool === "orbit" ? styles.active : ""}`} onClick={() => setTerrainTool("orbit")}>
                <Hand size={14} /> Вращать
              </button>
              <button type="button" className={`${styles.toolButton} ${terrainTool === "raise" ? styles.active : ""}`} onClick={() => setTerrainTool("raise")}>
                <Plus size={14} /> Поднять
              </button>
              <button type="button" className={`${styles.toolButton} ${terrainTool === "lower" ? styles.active : ""}`} onClick={() => setTerrainTool("lower")}>
                <Minus size={14} /> Углубить
              </button>
            </div>
            {(terrainTool === "raise" || terrainTool === "lower") && (
              <div className={styles.brushControls}>
                <label className={styles.brushControl}>
                  <span>Радиус <b>{Math.round(terrainBrushSize * mapState.height)} px</b></span>
                  <input
                    type="range"
                    min="0.01"
                    max="0.22"
                    step="0.005"
                    value={terrainBrushSize}
                    onChange={(event) => setTerrainBrushSize(Number(event.target.value))}
                    aria-label="Радиус кисти рельефа"
                  />
                </label>
                <label className={styles.brushControl}>
                  <span>Сила рельефа <b>{Math.round(terrainStrength * 100)}%</b></span>
                  <input
                    type="range"
                    min="0.01"
                    max="0.12"
                    step="0.005"
                    value={terrainStrength}
                    onChange={(event) => setTerrainStrength(Number(event.target.value))}
                    aria-label="Сила кисти рельефа"
                  />
                </label>
                <label className={styles.brushControl}>
                  <span>Сглаживание <b>{Math.round(brushSmoothing * 100)}%</b></span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={Math.round(brushSmoothing * 100)}
                    onChange={(event) => setBrushSmoothing(Number(event.target.value) / 100)}
                    aria-label="Сглаживание кисти рельефа"
                  />
                </label>
              </div>
            )}
          </>
        )}
        <button
          type="button"
          className={`${styles.toolButton} ${styles.fullscreenButton}`}
          onClick={toggleFullscreen}
          aria-pressed={isFullscreen}
          title={isFullscreen ? "Выйти из полноэкранного режима" : "Развернуть рабочее пространство"}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          {isFullscreen ? "Свернуть" : "На весь экран"}
        </button>
      </div>

      {(actionError || statusMessage) && (
        <div className={actionError ? styles.errorNotice : styles.successNotice} role={actionError ? "alert" : "status"}>
          {actionError || statusMessage}
          {actionError && <button type="button" onClick={() => setActionError("")} aria-label="Закрыть сообщение">×</button>}
        </div>
      )}

      {!hasSavedMap && (
        <p className={styles.publishHint}>
          Сначала сохраните карту, чтобы открыть переключатель публикации.
        </p>
      )}

      <div className={styles.workspace}>
        <main className={styles.mapPanel}>
          <div className={`${styles.mapViewport} ${viewMode === "2d" ? styles.mapViewport2d : ""}`} data-tool={viewMode === "2d" ? tool : terrainTool}>
            {viewMode === "2d" ? (
              <WorldMapCanvas2D
                mapState={mapState}
                zoom={zoom}
                rotation={mapRotation}
                panX={panX}
                panY={panY}
                onCameraChange={changeCamera}
                editable
                activeTool={tool}
                selectedTextureId={selectedTextureId}
                brushSize={brushSize}
                brushOpacity={brushOpacity}
                brushSmoothing={brushSmoothing}
                textureRotation={textureRotation}
                forestDensity={forestDensity}
                stampSize={stampSize}
                stampRotation={stampRotation}
                selectedCountryId={selectedCountryId}
                countryFinishSignal={countryFinishSignal}
                countryCancelSignal={countryCancelSignal}
                onStrokeComplete={addStroke}
                onPlaceCity={addCity}
                onSetBaseTexture={setBaseTexture}
                onStampPlace={addStamp}
                onStampsComplete={addStamps}
                onCountryComplete={addCountry}
                onCountryDraftChange={setCountryDraftCount}
                onSelectCountry={setSelectedCountryId}
              />
            ) : (
              <Suspense fallback={<div className={styles.status}>Загружаем 3D-сцену…</div>}>
                <WorldMap3D
                  mapState={mapState}
                  editable
                  sculptMode={terrainTool === "raise" || terrainTool === "lower" ? terrainTool : null}
                  sculptSize={terrainBrushSize}
                  sculptStrength={terrainStrength}
                  sculptSmoothing={brushSmoothing}
                  onHeightStrokeComplete={addHeightStroke}
                />
              </Suspense>
            )}
          </div>
          <div className={styles.mapFooter}>
            <span>{mapState.width} × {mapState.height} px</span>
            <span>{mapState.strokes.length} мазков · {(mapState.heightStrokes || []).length} правок рельефа · {(mapState.stamps || []).length} объектов · {(mapState.countries || []).length} стран · {mapState.cities.length} меток</span>
            <span><CircleHelp size={13} /> Колесо — масштаб · пробел/правая кнопка — перемещение · 2D-поворот — кнопки рядом с масштабом · сглаживание линии на панели · город или деревня — один крупный штамп · 3D: «Поднять/Углубить» и тяните по рельефу</span>
          </div>
        </main>

        <aside className={styles.palette}>
          <div className={styles.paletteHeading}>
            <div>
              <h3>Текстуры</h3>
              <span>{textures.length} текстур · выбрана: {selectedTexture?.label}</span>
            </div>
          </div>
          <div className={styles.textureGrid}>
            {textures.map((texture) => (
              <button
                key={texture.id}
                type="button"
                className={`${styles.textureButton} ${selectedTextureId === texture.id ? styles.textureSelected : ""}`}
                onClick={() => selectTexture(texture)}
                title={texture.brushMode === "forest" || texture.brushMode === "cluster"
                  ? `${texture.label}: отдельные деревья рассаживаются вдоль свободного штриха без наложения`
                  : texture.label}
                aria-pressed={selectedTextureId === texture.id}
              >
                <span
                  className={styles.textureThumb}
                  style={{
                    backgroundImage: `url("${texture.src}")`,
                    backgroundSize: texture.sourceType === "sheet"
                      ? `${texture.cols * 100}% ${texture.rows * 100}%`
                      : texture.placement ? "contain" : "cover",
                    backgroundColor: texture.placement ? "#18201b" : undefined,
                    backgroundPosition: texture.sourceType === "sheet"
                      ? `${texture.cols > 1 ? (texture.col / (texture.cols - 1)) * 100 : 0}% ${texture.rows > 1 ? (texture.row / (texture.rows - 1)) * 100 : 0}%`
                      : "center",
                  }}
                />
                <span className={styles.textureLabel}>{texture.label}</span>
              </button>
            ))}
          </div>

          <div className={styles.replacePanel}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => replaceInputRef.current?.click()}
              disabled={uploading}
            >
              <RotateCcw size={13} /> Заменить выбранный PNG
            </button>
            <input
              ref={replaceInputRef}
              className={styles.hiddenInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={replaceSelectedTexture}
              aria-label="Заменить выбранную текстуру"
            />
          </div>

          <div className={styles.importPanel}>
            <h4><Upload size={13} /> Нарезать лист текстур</h4>
            <p>Загрузите спрайт-лист, программа разделит его на равные тайлы.</p>
            <div className={styles.gridSizeInputs}>
              <label>Колонки <input type="number" min="1" max="12" value={sheetColumns} onChange={(event) => setSheetColumns(event.target.value)} /></label>
              <span>×</span>
              <label>Строки <input type="number" min="1" max="12" value={sheetRows} onChange={(event) => setSheetRows(event.target.value)} /></label>
            </div>
            <button
              className={styles.importButton}
              type="button"
              onClick={() => sheetInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={14} /> {uploading ? "Загрузка…" : "Импортировать PNG-лист"}
            </button>
            <input
              ref={sheetInputRef}
              className={styles.hiddenInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={importSpriteSheet}
              aria-label="Импортировать лист текстур"
            />
          </div>

          <div className={styles.cityList}>
            <h4><Globe2 size={13} /> Страны <span>{(mapState.countries || []).length}</span></h4>
            {(mapState.countries || []).length ? (
              <ul>
                {mapState.countries.map((country) => (
                  <li key={country.id}>
                    <button
                      type="button"
                      className={`${styles.countrySelectButton} ${selectedCountryId === country.id ? styles.countrySelected : ""}`}
                      onClick={() => setSelectedCountryId(country.id)}
                      aria-pressed={selectedCountryId === country.id}
                    >
                      <span className={styles.countrySwatch} style={{ backgroundColor: country.color }} />
                      <span className={styles.cityName}>{country.name}</span>
                    </button>
                    <button type="button" onClick={() => deleteCountry(country.id)} aria-label={`Удалить страну ${country.name}`}>×</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Выберите «Граница», задайте название и отметьте точки контура.</p>
            )}
          </div>

          <div className={styles.cityList}>
            <h4><MapPinned size={13} /> Объекты <span>{(mapState.stamps || []).length}</span></h4>
            {(mapState.stamps || []).length ? (
              <ul>
                {[...(mapState.stamps || [])].slice(-12).reverse().map((stamp) => (
                  <li key={stamp.id}>
                    <span className={styles.stampDot}>◆</span>
                    <span className={styles.cityName}>{textures.find((texture) => texture.id === stamp.textureId)?.label || stamp.textureId}</span>
                    <small>{Math.round(stamp.x * 100)}%, {Math.round(stamp.y * 100)}%</small>
                    <button type="button" onClick={() => deleteStamp(stamp.id)} aria-label={`Удалить объект ${stamp.id}`}>×</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Города, замки и деревья появятся здесь после размещения на карте.</p>
            )}
          </div>

          <div className={styles.cityList}>
            <h4><MapPinned size={13} /> Города и поселения <span>{mapState.cities.length}</span></h4>
            {mapState.cities.length ? (
              <ul>
                {mapState.cities.map((city) => (
                  <li key={city.id}>
                    <span className={styles.cityDot}>{city.type === "village" ? "Д" : "Г"}</span>
                    <span className={styles.cityName}>{city.name}</span>
                    <small>{Math.round(city.x * 100)}%, {Math.round(city.y * 100)}%</small>
                    <button type="button" onClick={() => deleteCity(city.id)} aria-label={`Удалить ${city.name}`}>×</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Выберите инструмент «Город» и щёлкните по карте, чтобы поставить метку.</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
