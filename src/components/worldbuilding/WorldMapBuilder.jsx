import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Brush,
  ChevronDown,
  CircleHelp,
  Eraser,
  Globe2,
  Layers,
  MapPinned,
  Minus,
  Mountain,
  PaintBucket,
  Plus,
  RotateCcw,
  Save,
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
  const revisionRef = useRef(0);
  const [mapState, setMapState] = useState(() => normalizeMapState(settings?.map_state));
  const [selectedTextureId, setSelectedTextureId] = useState("grass");
  const [tool, setTool] = useState("paint");
  const [cityType, setCityType] = useState("city");
  const [viewMode, setViewMode] = useState("2d");
  const [zoom, setZoom] = useState(0.85);
  const [sheetColumns, setSheetColumns] = useState(4);
  const [sheetRows, setSheetRows] = useState(4);
  const [uploading, setUploading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [hasSavedMap, setHasSavedMap] = useState(
    Array.isArray(settings?.map_state?.tiles) && settings.map_state.tiles.length > 0,
  );
  const [isPublished, setIsPublished] = useState(Boolean(settings?.is_published));
  const [actionError, setActionError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const textures = useMemo(
    () => getAllMapTextures(mapState.textures),
    [mapState.textures],
  );
  const selectedTexture = textures.find((texture) => texture.id === selectedTextureId) || textures[0];

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
    revisionRef.current += 1;
    setMapState((current) => (typeof change === "function" ? change(current) : change));
    setIsDirty(true);
    setStatusMessage("");
    setActionError("");
  };

  const paintCell = (x, y) => {
    if (tool === "city") {
      const cityName = window.prompt(
        cityType === "village" ? "Название поселения" : "Название города",
        cityType === "village" ? "Новая деревня" : "Новый город",
      );
      if (!cityName?.trim()) return;
      updateMap((current) => {
        const tiles = [...current.tiles];
        tiles[y * current.width + x] = cityType === "village" ? "village" : "city";
        const cities = current.cities.filter((city) => city.x !== x || city.y !== y);
        cities.push({ id: createId("city"), name: cityName.trim().slice(0, 80), x, y, type: cityType });
        return { ...current, tiles, cities };
      });
      setTool("paint");
      return;
    }

    const nextId = tool === "erase" ? "grass" : selectedTextureId;
    const index = y * mapState.width + x;
    if (mapState.tiles[index] === nextId) return;
    updateMap((current) => {
      const tiles = [...current.tiles];
      tiles[index] = nextId;
      const cities = nextId === "grass"
        ? current.cities.filter((city) => city.x !== x || city.y !== y)
        : current.cities;
      return { ...current, tiles, cities };
    });
  };

  const fillRegion = (x, y) => {
    const startIndex = y * mapState.width + x;
    const fromId = mapState.tiles[startIndex];
    const toId = selectedTextureId;
    if (fromId === toId) return;

    updateMap((current) => {
      const tiles = [...current.tiles];
      const queue = [startIndex];
      const visited = new Uint8Array(tiles.length);
      while (queue.length) {
        const index = queue.pop();
        if (index < 0 || index >= tiles.length || visited[index] || tiles[index] !== fromId) continue;
        visited[index] = 1;
        tiles[index] = toId;
        const cellX = index % current.width;
        const cellY = Math.floor(index / current.width);
        if (cellX > 0) queue.push(index - 1);
        if (cellX < current.width - 1) queue.push(index + 1);
        if (cellY > 0) queue.push(index - current.width);
        if (cellY < current.height - 1) queue.push(index + current.width);
      }
      return { ...current, tiles };
    });
  };

  const handleCellClick = (x, y) => {
    if (tool === "fill") fillRegion(x, y);
    else paintCell(x, y);
  };

  const handleCellDrag = (x, y) => {
    if (tool === "paint" || tool === "erase") paintCell(x, y);
  };

  const resizeMap = (width, height) => {
    updateMap((current) => {
      const tiles = Array(width * height).fill("grass");
      const copyWidth = Math.min(width, current.width);
      const copyHeight = Math.min(height, current.height);
      for (let y = 0; y < copyHeight; y += 1) {
        for (let x = 0; x < copyWidth; x += 1) {
          tiles[y * width + x] = current.tiles[y * current.width + x];
        }
      }
      const cities = current.cities.filter((city) => city.x < width && city.y < height);
      return { ...current, width, height, tiles, cities };
    });
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
    updateMap((current) => ({
      ...current,
      cities: current.cities.filter((city) => city.id !== cityId),
    }));
  };

  const selectSize = (event) => {
    const preset = MAP_SIZE_PRESETS.find((item) => `${item.width}x${item.height}` === event.target.value);
    if (preset) resizeMap(preset.width, preset.height);
  };

  const saveDisabled = saveMap.isPending || (!isDirty && hasSavedMap);
  const publicationDisabled = !hasSavedMap || isDirty || togglePublication.isPending;
  const currentPreset = `${mapState.width}x${mapState.height}`;

  return (
    <section className={styles.editor}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.headingIcon}><Mountain size={17} /></span>
          <div>
            <h2>Мастерская карт</h2>
            <p>Рисуйте мир по клеткам, добавляйте города и осматривайте рельеф в 3D.</p>
          </div>
        </div>
        <div className={styles.headerActions}>
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
        <div className={styles.toolGroup} role="group" aria-label="Инструменты рисования">
          <button type="button" className={`${styles.toolButton} ${tool === "paint" ? styles.active : ""}`} onClick={() => setTool("paint")}>
            <Brush size={14} /> Кисть
          </button>
          <button type="button" className={`${styles.toolButton} ${tool === "fill" ? styles.active : ""}`} onClick={() => setTool("fill")}>
            <PaintBucket size={14} /> Заливка
          </button>
          <button type="button" className={`${styles.toolButton} ${tool === "erase" ? styles.active : ""}`} onClick={() => setTool("erase")}>
            <Eraser size={14} /> Ластик
          </button>
          <button type="button" className={`${styles.toolButton} ${tool === "city" ? styles.active : ""}`} onClick={() => setTool("city")}>
            <MapPinned size={14} /> Город
          </button>
        </div>

        {tool === "city" && (
          <label className={styles.selectWrap}>
            Тип
            <select value={cityType} onChange={(event) => setCityType(event.target.value)}>
              <option value="city">Город</option>
              <option value="village">Посёлок</option>
            </select>
            <ChevronDown size={12} />
          </label>
        )}

        <label className={styles.selectWrap}>
          Размер
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
          <button type="button" className={viewMode === "2d" ? styles.viewActive : ""} onClick={() => setViewMode("2d")}>
            <Layers size={14} /> 2D
          </button>
          <button type="button" className={viewMode === "3d" ? styles.viewActive : ""} onClick={() => setViewMode("3d")}>
            <Globe2 size={14} /> 3D
          </button>
        </div>
        {viewMode === "2d" && (
          <div className={styles.zoomControls}>
            <button type="button" onClick={() => setZoom((value) => Math.max(0.45, value - 0.1))} aria-label="Уменьшить масштаб"><Minus size={13} /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((value) => Math.min(1.7, value + 0.1))} aria-label="Увеличить масштаб"><Plus size={13} /></button>
          </div>
        )}
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
          <div className={styles.mapViewport} data-tool={tool}>
            {viewMode === "2d" ? (
              <WorldMapCanvas2D
                mapState={mapState}
                cellSize={36}
                zoom={zoom}
                showGrid
                editable
                onCellClick={handleCellClick}
                onCellDrag={handleCellDrag}
              />
            ) : (
              <Suspense fallback={<div className={styles.status}>Загружаем 3D-сцену…</div>}>
                <WorldMap3D mapState={mapState} />
              </Suspense>
            )}
          </div>
          <div className={styles.mapFooter}>
            <span>{mapState.width} × {mapState.height} клеток</span>
            <span>{mapState.cities.length} {mapState.cities.length === 1 ? "город" : "городов и поселений"}</span>
            <span><CircleHelp size={13} /> В 3D: тяните мышью, чтобы вращать карту</span>
          </div>
        </main>

        <aside className={styles.palette}>
          <div className={styles.paletteHeading}>
            <div>
              <h3>Текстуры</h3>
              <span>{textures.length} тайлов · выбрана: {selectedTexture?.label}</span>
            </div>
          </div>
          <div className={styles.textureGrid}>
            {textures.map((texture) => (
              <button
                key={texture.id}
                type="button"
                className={`${styles.textureButton} ${selectedTextureId === texture.id ? styles.textureSelected : ""}`}
                onClick={() => {
                  setSelectedTextureId(texture.id);
                  if (tool === "city" || tool === "fill") setTool("paint");
                }}
                title={texture.label}
                aria-pressed={selectedTextureId === texture.id}
              >
                <span
                  className={styles.textureThumb}
                  style={{
                    backgroundImage: `url("${texture.src}")`,
                    backgroundSize: texture.sourceType === "sheet" ? `${texture.cols * 100}% ${texture.rows * 100}%` : "cover",
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
            <h4><MapPinned size={13} /> Города и поселения <span>{mapState.cities.length}</span></h4>
            {mapState.cities.length ? (
              <ul>
                {mapState.cities.map((city) => (
                  <li key={city.id}>
                    <span className={styles.cityDot}>{city.type === "village" ? "Д" : "Г"}</span>
                    <span className={styles.cityName}>{city.name}</span>
                    <small>{city.x + 1}, {city.y + 1}</small>
                    <button type="button" onClick={() => deleteCity(city.id)} aria-label={`Удалить ${city.name}`}>×</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Выберите инструмент «Город» и щёлкните по карте.</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
