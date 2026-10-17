import { useEffect, useMemo, useRef, useState } from "react";
import { getAllMapTextures } from "./mapTextures";
import { paintBrushSegment, renderMapCanvas } from "./mapRenderer";

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve([src, image]);
    image.onerror = () => resolve([src, null]);
    image.src = src;
  });
}

function createStrokeId() {
  return `stroke-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
}

export default function WorldMapCanvas2D({
  mapState,
  customTextures = mapState?.textures || [],
  zoom = 1,
  editable = false,
  activeTool = "brush",
  selectedTextureId = "grass",
  brushSize = 0.06,
  brushOpacity = 1,
  onStrokeComplete,
  onPlaceCity,
  onSetBaseTexture,
}) {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ active: false, pointerId: null, stroke: null, lastPoint: null, patternCache: null });
  const [images, setImages] = useState({});
  const textures = useMemo(() => getAllMapTextures(customTextures), [customTextures]);
  const textureSources = useMemo(
    () => JSON.stringify([...new Set(textures.map((texture) => texture.src).filter(Boolean))]),
    [textures],
  );

  useEffect(() => {
    let isCurrent = true;
    const sources = JSON.parse(textureSources);
    Promise.all(sources.map(loadImage)).then((loaded) => {
      if (isCurrent) setImages(Object.fromEntries(loaded));
    });
    return () => {
      isCurrent = false;
    };
  }, [textureSources]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapState) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(mapState.width * ratio));
    canvas.height = Math.max(1, Math.round(mapState.height * ratio));
    canvas.style.width = `${mapState.width * zoom}px`;
    canvas.style.height = `${mapState.height * zoom}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = true;
    context.clearRect(0, 0, mapState.width, mapState.height);
    renderMapCanvas(context, mapState, images);
  }, [images, mapState, zoom]);

  const getMapPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!rect || !mapState || !rect.width || !rect.height) return null;
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const appendPointerPoint = (event) => {
    const active = pointerRef.current;
    if (!active.active || active.pointerId !== event.pointerId) return;
    const point = getMapPoint(event);
    if (!point) return;
    const distance = Math.hypot(
      (point.x - active.lastPoint.x) * mapState.width,
      (point.y - active.lastPoint.y) * mapState.height,
    );
    if (distance < 1.25) return;

    const context = canvasRef.current?.getContext("2d");
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
    );
    active.lastPoint = point;
  };

  const finishStroke = (event) => {
    const active = pointerRef.current;
    if (!active.active || active.pointerId !== event.pointerId) return;
    appendPointerPoint(event);
    pointerRef.current = { active: false, pointerId: null, stroke: null, lastPoint: null, patternCache: null };
    onStrokeComplete?.(active.stroke);
  };

  const handlePointerDown = (event) => {
    if (!editable) return;
    const point = getMapPoint(event);
    if (!point) return;

    if (activeTool === "city") {
      event.preventDefault();
      onPlaceCity?.(point.x, point.y);
      return;
    }
    if (activeTool === "fill") {
      event.preventDefault();
      onSetBaseTexture?.(selectedTextureId);
      return;
    }
    if (activeTool !== "brush" && activeTool !== "erase") return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const stroke = {
      id: createStrokeId(),
      textureId: activeTool === "erase" ? mapState.baseTextureId : selectedTextureId,
      size: brushSize,
      opacity: activeTool === "erase" ? 1 : brushOpacity,
      erase: activeTool === "erase",
      points: [point],
    };
    pointerRef.current = {
      active: true,
      pointerId: event.pointerId,
      stroke,
      lastPoint: point,
      patternCache: new Map(),
    };
    const context = canvasRef.current?.getContext("2d");
    if (context) paintBrushSegment(context, mapState, images, stroke, point, point, pointerRef.current.patternCache);
  };

  const handlePointerMove = (event) => {
    if (!pointerRef.current.active || pointerRef.current.pointerId !== event.pointerId) return;
    const nativeEvent = event.nativeEvent;
    const coalesced = nativeEvent.getCoalescedEvents?.() || [];
    if (coalesced.length) coalesced.forEach(appendPointerPoint);
    else appendPointerPoint(event);
  };

  const handlePointerCancel = (event) => finishStroke(event);

  return (
    <canvas
      ref={canvasRef}
      className={`world-map-canvas ${editable ? "world-map-canvas-editable" : ""}`}
      aria-label={`${mapState?.width || 0} на ${mapState?.height || 0} пикселей, карта мира`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={handlePointerCancel}
    />
  );
}
