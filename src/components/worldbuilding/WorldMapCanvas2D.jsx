import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAllMapTextures, getMapTexture } from "./mapTextures";
import {
  createForestOccupancyForMap,
  drawMapStamp,
  findCountryAtPoint,
  paintBrushSegment,
  paintCountryPreviewSegment,
  renderMapCanvas,
} from "./mapRenderer";

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve([src, image]);
    image.onerror = () => resolve([src, null]);
    image.src = src;
  });
}

function createObjectId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
}

function getTextureAspect(texture, image) {
  if (!image?.naturalWidth || !image?.naturalHeight) return 1;
  if (texture.sourceType !== "sheet") return image.naturalWidth / image.naturalHeight;
  const cols = Math.max(1, Number(texture.cols) || 1);
  const rows = Math.max(1, Number(texture.rows) || 1);
  return (image.naturalWidth / cols) / (image.naturalHeight / rows);
}

function getStampRadius(stamp, mapState, textures, images) {
  const texture = getMapTexture(stamp.textureId, textures);
  const image = images?.[texture.src];
  const aspect = getTextureAspect(texture, image);
  const stampHeight = Math.max(10, (Number(stamp.size) || texture.defaultSize || 0.08) * mapState.height);
  const stampWidth = stampHeight * aspect;
  return texture.footprint === "round"
    ? Math.max(stampWidth, stampHeight) / 2
    : Math.hypot(stampWidth, stampHeight) / 2;
}

function overlapsExistingStamp(candidate, existing, mapState, textures, images) {
  const candidateRadius = getStampRadius(candidate, mapState, textures, images);
  const candidateX = candidate.x * mapState.width;
  const candidateY = candidate.y * mapState.height;
  return existing.some((stamp) => {
    const otherRadius = getStampRadius(stamp, mapState, textures, images);
    const distance = Math.hypot(
      (stamp.x * mapState.width) - candidateX,
      (stamp.y * mapState.height) - candidateY,
    );
    return distance < candidateRadius + otherRadius + 2;
  });
}

function drawCountryDraft(context, mapState, points) {
  if (!points.length) return;
  for (let index = 1; index < points.length; index += 1) {
    paintCountryPreviewSegment(context, mapState, points[index - 1], points[index]);
  }
  if (points.length > 2) {
    context.save();
    context.globalAlpha = 0.55;
    paintCountryPreviewSegment(context, mapState, points[points.length - 1], points[0]);
    context.restore();
  }
  context.save();
  for (const point of points) {
    context.beginPath();
    context.arc(point.x * mapState.width, point.y * mapState.height, Math.max(4, mapState.height * 0.006), 0, Math.PI * 2);
    context.fillStyle = "#ffe0a0";
    context.strokeStyle = "#402e18";
    context.lineWidth = 2;
    context.fill();
    context.stroke();
  }
  context.restore();
}

function getMapPoint(event, stage, mapState, camera) {
  const rect = stage?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height || !mapState) return null;
  const centerX = rect.left + rect.width / 2 + camera.panX;
  const centerY = rect.top + rect.height / 2 + camera.panY;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const angle = (camera.rotation * Math.PI) / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const mapX = (cosine * dx + sine * dy) / camera.zoom + mapState.width / 2;
  const mapY = (-sine * dx + cosine * dy) / camera.zoom + mapState.height / 2;
  return {
    x: Math.min(1, Math.max(0, mapX / mapState.width)),
    y: Math.min(1, Math.max(0, mapY / mapState.height)),
  };
}

function clampPan(value, limit) {
  return Math.min(limit, Math.max(-limit, value));
}

export default function WorldMapCanvas2D({
  mapState,
  customTextures = mapState?.textures || [],
  zoom = 1,
  rotation = 0,
  panX = 0,
  panY = 0,
  onCameraChange,
  editable = false,
  activeTool = "brush",
  selectedTextureId = "grass",
  brushSize = 0.06,
  brushOpacity = 1,
  brushSmoothing = 0.72,
  textureRotation = 0,
  forestDensity = 0.92,
  stampSize,
  stampRotation = 0,
  selectedCountryId = null,
  countryFinishSignal = 0,
  countryCancelSignal = 0,
  onStrokeComplete,
  onPlaceCity,
  onSetBaseTexture,
  onStampPlace,
  onStampsComplete,
  onCountryComplete,
  onCountryDraftChange,
  onSelectCountry,
}) {
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const stageRef = useRef(null);
  const pointerRef = useRef({ mode: null });
  const countryDraftRef = useRef([]);
  const finishCountryRef = useRef(null);
  const cancelCountryRef = useRef(null);
  const finishSignalRef = useRef(countryFinishSignal);
  const cancelSignalRef = useRef(countryCancelSignal);
  const spaceHeldRef = useRef(false);
  const patternCacheRef = useRef(new Map());
  const previewPatternCacheRef = useRef(new Map());
  const pixelRatio = Math.min(
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    1.5,
  );
  const canvasWidth = mapState?.width ?? 0;
  const canvasHeight = mapState?.height ?? 0;
  const [countryDraft, setCountryDraft] = useState([]);
  const [images, setImages] = useState({});
  const textures = useMemo(() => getAllMapTextures(customTextures), [customTextures]);
  const textureSources = useMemo(
    () => JSON.stringify([...new Set(textures.map((texture) => texture.src).filter(Boolean))]),
    [textures],
  );
  const selectedTexture = textures.find((texture) => texture.id === selectedTextureId) || textures[0];
  const camera = useMemo(() => ({
    zoom: Math.min(2.5, Math.max(0.3, Number(zoom) || 1)),
    rotation: Number(rotation) || 0,
    panX: Number(panX) || 0,
    panY: Number(panY) || 0,
  }), [panX, panY, rotation, zoom]);

  const setDraft = useCallback((points) => {
    countryDraftRef.current = points;
    setCountryDraft(points);
    onCountryDraftChange?.(points.length);
  }, [onCountryDraftChange]);

  const finishCountry = useCallback(() => {
    const points = countryDraftRef.current;
    if (points.length < 3) return;
    onCountryComplete?.(points);
    setDraft([]);
  }, [onCountryComplete, setDraft]);

  const cancelCountry = useCallback(() => setDraft([]), [setDraft]);

  useEffect(() => {
    finishCountryRef.current = finishCountry;
    cancelCountryRef.current = cancelCountry;
  }, [cancelCountry, finishCountry]);

  useEffect(() => {
    if (finishSignalRef.current !== countryFinishSignal) {
      finishSignalRef.current = countryFinishSignal;
      finishCountryRef.current?.();
    }
  }, [countryFinishSignal]);

  useEffect(() => {
    if (cancelSignalRef.current !== countryCancelSignal) {
      cancelSignalRef.current = countryCancelSignal;
      cancelCountryRef.current?.();
    }
  }, [countryCancelSignal]);

  useEffect(() => {
    let isCurrent = true;
    patternCacheRef.current.clear();
    previewPatternCacheRef.current.clear();
    const sources = JSON.parse(textureSources);
    Promise.all(sources.map(loadImage)).then((loaded) => {
      if (isCurrent) {
        patternCacheRef.current.clear();
        previewPatternCacheRef.current.clear();
        setImages(Object.fromEntries(loaded));
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [textureSources]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasWidth || !canvasHeight) return;
    const pixelWidth = Math.max(1, Math.round(canvasWidth * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(canvasHeight * pixelRatio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      patternCacheRef.current.clear();
    }
    if (editable && previewCanvasRef.current) {
      const previewCanvas = previewCanvasRef.current;
      if (previewCanvas.width !== pixelWidth || previewCanvas.height !== pixelHeight) {
        previewCanvas.width = pixelWidth;
        previewCanvas.height = pixelHeight;
        previewPatternCacheRef.current.clear();
      }
    }

    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, mapState.width, mapState.height);
    renderMapCanvas(context, mapState, images, true, selectedCountryId, patternCacheRef.current);

    if (previewCanvasRef.current) {
      const previewContext = previewCanvasRef.current.getContext("2d");
      previewContext?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      previewContext?.clearRect(0, 0, mapState.width, mapState.height);
      if (previewContext) drawCountryDraft(previewContext, mapState, countryDraft);
    }
  }, [canvasHeight, canvasWidth, countryDraft, editable, images, mapState, pixelRatio, selectedCountryId]);

  useEffect(() => {
    if (!editable || activeTool !== "country") return undefined;
    const handleKeyDown = (event) => {
      if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
      if (event.key === "Enter") {
        event.preventDefault();
        finishCountryRef.current?.();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelCountryRef.current?.();
      } else if (event.key === "Backspace") {
        event.preventDefault();
        setDraft(countryDraftRef.current.slice(0, -1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTool, editable, setDraft]);

  useEffect(() => {
    if (!editable) return undefined;
    const handleSpace = (event) => {
      if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
      if (event.code === "Space") {
        spaceHeldRef.current = event.type === "keydown";
        if (event.type === "keydown") event.preventDefault();
      }
    };
    window.addEventListener("keydown", handleSpace);
    window.addEventListener("keyup", handleSpace);
    return () => {
      window.removeEventListener("keydown", handleSpace);
      window.removeEventListener("keyup", handleSpace);
      spaceHeldRef.current = false;
    };
  }, [editable]);

  const readMapPoint = (event) => getMapPoint(event, stageRef.current, mapState, camera);

  const beginPan = (event) => {
    const shouldPan = activeTool === "pan" || event.button === 1 || event.button === 2 || spaceHeldRef.current;
    if (!shouldPan) return false;
    event.preventDefault();
    stageRef.current?.setPointerCapture?.(event.pointerId);
    pointerRef.current = {
      mode: "pan",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: camera.panX,
      startPanY: camera.panY,
    };
    return true;
  };

  const getPreviewContext = () => {
    const context = previewCanvasRef.current?.getContext("2d");
    if (!context) return null;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    return context;
  };

  const appendBrushPoint = (event) => {
    const active = pointerRef.current;
    if (active.mode !== "brush" || active.pointerId !== event.pointerId) return;
    const rawPoint = readMapPoint(event);
    if (!rawPoint) return;
    const amount = 1 - Math.min(0.88, Math.max(0, active.stroke.smoothing) * 0.82);
    const point = {
      x: active.filteredPoint.x + (rawPoint.x - active.filteredPoint.x) * amount,
      y: active.filteredPoint.y + (rawPoint.y - active.filteredPoint.y) * amount,
    };
    active.filteredPoint = point;
    const distance = Math.hypot(
      (point.x - active.lastPoint.x) * mapState.width,
      (point.y - active.lastPoint.y) * mapState.height,
    );
    if (distance < 1.15) return;

    const context = getPreviewContext();
    if (!context) return;
    if (active.stroke.points.length < 5000) active.stroke.points.push(point);
    paintBrushSegment(
      context,
      mapState,
      images,
      active.stroke,
      active.lastPoint,
      point,
      active.patternCache,
      active.forestBrushState,
    );
    active.lastPoint = point;
  };

  const addScatterStamp = (active, point) => {
    const size = stampSize || selectedTexture?.defaultSize || 0.08;
    const stamp = {
      id: createObjectId("stamp"),
      textureId: selectedTextureId,
      x: point.x,
      y: point.y,
      size,
      rotation: Math.random() * 360,
    };
    const existing = [...(mapState.stamps || []), ...active.stamps];
    if (overlapsExistingStamp(stamp, existing, mapState, textures, images)) return false;
    active.stamps.push(stamp);
    const context = getPreviewContext();
    if (context) drawMapStamp(context, mapState, images, stamp);
    return true;
  };

  const appendScatterPoint = (event) => {
    const active = pointerRef.current;
    if (active.mode !== "scatter" || active.pointerId !== event.pointerId) return;
    const point = readMapPoint(event);
    if (!point) return;
    const distance = Math.hypot(
      (point.x - active.lastPoint.x) * mapState.width,
      (point.y - active.lastPoint.y) * mapState.height,
    );
    const sampleStamp = { textureId: selectedTextureId, size: stampSize || selectedTexture?.defaultSize || 0.08 };
    const spacing = Math.max(12, getStampRadius(sampleStamp, mapState, textures, images) * 2 + 3);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    for (let step = 1; step <= steps; step += 1) {
      const amount = step / steps;
      addScatterStamp(active, {
        x: active.lastPoint.x + (point.x - active.lastPoint.x) * amount,
        y: active.lastPoint.y + (point.y - active.lastPoint.y) * amount,
      });
    }
    active.lastPoint = point;
  };

  const appendPointerPoint = (event) => {
    if (pointerRef.current.mode === "brush") appendBrushPoint(event);
    else if (pointerRef.current.mode === "scatter") appendScatterPoint(event);
  };

  const finishPointer = (event) => {
    const active = pointerRef.current;
    if (!active.mode || active.pointerId !== event.pointerId) return;
    if (active.mode === "pan") {
      pointerRef.current = { mode: null };
      return;
    }
    if (active.mode === "brush") {
      const endpoint = readMapPoint(event);
      const distance = endpoint ? Math.hypot(
        (endpoint.x - active.lastPoint.x) * mapState.width,
        (endpoint.y - active.lastPoint.y) * mapState.height,
      ) : 0;
      if (endpoint && distance > 0.5) {
        if (active.stroke.points.length < 5000) active.stroke.points.push(endpoint);
        const context = getPreviewContext();
        if (context) paintBrushSegment(
          context,
          mapState,
          images,
          active.stroke,
          active.lastPoint,
          endpoint,
          active.patternCache,
          active.forestBrushState,
        );
        active.lastPoint = endpoint;
      }
    } else {
      appendPointerPoint(event);
    }
    pointerRef.current = { mode: null };
    if (active.mode === "brush") onStrokeComplete?.(active.stroke);
    else if (active.mode === "scatter" && active.stamps.length) onStampsComplete?.(active.stamps);
    const context = getPreviewContext();
    context?.clearRect(0, 0, mapState.width, mapState.height);
  };

  const addCountryPoint = (point, clickCount) => {
    const draft = countryDraftRef.current;
    if (clickCount > 1 && draft.length >= 3) {
      finishCountryRef.current?.();
      return;
    }
    if (draft.length >= 3) {
      const first = draft[0];
      const distance = Math.hypot(
        (point.x - first.x) * mapState.width,
        (point.y - first.y) * mapState.height,
      );
      if (distance < Math.max(12, mapState.height * 0.018)) {
        finishCountryRef.current?.();
        return;
      }
    }
    setDraft([...draft, point]);
  };

  const handlePointerDown = (event) => {
    if (!editable) return;
    if (beginPan(event)) return;
    if (event.target !== canvasRef.current) return;
    const point = readMapPoint(event);
    if (!point) return;

    if (activeTool === "city") {
      event.preventDefault();
      onPlaceCity?.(point.x, point.y);
      return;
    }
    if (activeTool === "fill") {
      event.preventDefault();
      onSetBaseTexture?.(selectedTextureId, textureRotation);
      return;
    }
    if (activeTool === "select-country") {
      event.preventDefault();
      onSelectCountry?.(findCountryAtPoint(mapState.countries || [], point));
      return;
    }
    if (activeTool === "country") {
      event.preventDefault();
      addCountryPoint(point, event.detail);
      return;
    }
    if (activeTool === "stamp") {
      event.preventDefault();
      onStampPlace?.({
        id: createObjectId("stamp"),
        textureId: selectedTextureId,
        x: point.x,
        y: point.y,
        size: stampSize || selectedTexture?.defaultSize || 0.1,
        rotation: stampRotation,
      });
      return;
    }
    if (activeTool === "scatter") {
      event.preventDefault();
      stageRef.current?.setPointerCapture?.(event.pointerId);
      const active = { mode: "scatter", pointerId: event.pointerId, lastPoint: point, stamps: [] };
      pointerRef.current = active;
      addScatterStamp(active, point);
      return;
    }
    if (activeTool !== "brush" && activeTool !== "erase" && activeTool !== "wall") return;

    event.preventDefault();
    stageRef.current?.setPointerCapture?.(event.pointerId);
    const isForest = activeTool === "brush" && (selectedTexture?.brushMode === "forest" || selectedTexture?.brushMode === "cluster");
    const stroke = {
      id: createObjectId("stroke"),
      textureId: activeTool === "erase"
        ? mapState.baseTextureId
        : activeTool === "wall" && selectedTexture?.brushMode !== "wall"
          ? "wall-stone"
          : selectedTextureId,
      size: brushSize,
      opacity: activeTool === "erase" ? 1 : brushOpacity,
      smoothing: brushSmoothing,
      textureRotation: activeTool === "erase" ? mapState.baseTextureRotation : textureRotation,
      erase: activeTool === "erase",
      kind: activeTool === "wall" ? "wall" : "brush",
      ...(isForest ? { forestDensity } : {}),
      points: [point],
    };
    const active = {
      mode: "brush",
      pointerId: event.pointerId,
      stroke,
      lastPoint: point,
      filteredPoint: point,
      patternCache: new Map(),
      forestBrushState: isForest ? { occupancy: createForestOccupancyForMap(mapState, images) } : {},
    };
    pointerRef.current = active;
    const context = getPreviewContext();
    if (context) {
      paintBrushSegment(context, mapState, images, stroke, point, point, active.patternCache, active.forestBrushState);
    }
  };

  const handlePointerMove = (event) => {
    const active = pointerRef.current;
    if (!active.mode || active.pointerId !== event.pointerId) return;
    if (active.mode === "pan") {
      onCameraChange?.({
        zoom: camera.zoom,
        rotation: camera.rotation,
        panX: clampPan(active.startPanX + event.clientX - active.startX, window.innerWidth * 1.5),
        panY: clampPan(active.startPanY + event.clientY - active.startY, window.innerHeight * 1.5),
      });
      return;
    }
    const nativeEvent = event.nativeEvent;
    const coalesced = nativeEvent.getCoalescedEvents?.() || [];
    if (coalesced.length) coalesced.forEach(appendPointerPoint);
    else appendPointerPoint(event);
  };

  const handleWheel = (event) => {
    if (!editable) return;
    event.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextZoom = Math.min(2.5, Math.max(0.3, camera.zoom * Math.exp(-event.deltaY * 0.0012)));
    const cursorX = event.clientX - (rect.left + rect.width / 2);
    const cursorY = event.clientY - (rect.top + rect.height / 2);
    const dx = cursorX - camera.panX;
    const dy = cursorY - camera.panY;
    const angle = (camera.rotation * Math.PI) / 180;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const worldX = (cosine * dx + sine * dy) / camera.zoom;
    const worldY = (-sine * dx + cosine * dy) / camera.zoom;
    const scaledX = nextZoom * (cosine * worldX - sine * worldY);
    const scaledY = nextZoom * (sine * worldX + cosine * worldY);
    onCameraChange?.({
      zoom: nextZoom,
      rotation: camera.rotation,
      panX: clampPan(cursorX - scaledX, window.innerWidth * 1.5),
      panY: clampPan(cursorY - scaledY, window.innerHeight * 1.5),
    });
  };

  const cameraStyle = {
    width: `${mapState.width}px`,
    height: `${mapState.height}px`,
    left: `calc(50% + ${camera.panX}px)`,
    top: `calc(50% + ${camera.panY}px)`,
    transform: `translate(-50%, -50%) rotate(${camera.rotation}deg) scale(${camera.zoom})`,
  };

  const canvas = (
    <canvas
      ref={canvasRef}
      className={`world-map-canvas ${editable ? "world-map-canvas-editable" : ""}`}
      style={!editable ? { width: `${mapState?.width || 0}px`, height: `${mapState?.height || 0}px` } : undefined}
      aria-label={`${mapState?.width || 0} на ${mapState?.height || 0} пикселей, карта мира`}
    />
  );

  if (!editable) return canvas;

  return (
    <div
      className="world-map-canvas-stage"
      ref={stageRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onWheel={handleWheel}
      onContextMenu={(event) => event.preventDefault()}
      aria-label="Рабочая область карты: колесо — масштаб, пробел или правая кнопка — перемещение"
    >
      <div className="world-map-canvas-transform" style={cameraStyle}>
        {canvas}
        <canvas ref={previewCanvasRef} className="world-map-canvas-preview" aria-hidden="true" />
      </div>
    </div>
  );
}
