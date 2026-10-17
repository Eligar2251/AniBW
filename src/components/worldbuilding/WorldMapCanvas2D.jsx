import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAllMapTextures, getMapTexture } from "./mapTextures";
import {
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

function getStampRadius(stamp, mapState, textures, images) {
  const texture = getMapTexture(stamp.textureId, textures);
  const image = images?.[texture.src];
  const aspect = image?.naturalWidth && image?.naturalHeight ? image.naturalWidth / image.naturalHeight : 1;
  const stampHeight = Math.max(10, (Number(stamp.size) || texture.defaultSize || 0.08) * mapState.height);
  const stampWidth = stampHeight * aspect;
  return Math.hypot(stampWidth, stampHeight) / 2;
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

export default function WorldMapCanvas2D({
  mapState,
  customTextures = mapState?.textures || [],
  zoom = 1,
  editable = false,
  activeTool = "brush",
  selectedTextureId = "grass",
  brushSize = 0.06,
  brushOpacity = 1,
  stampSize,
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
  const pointerRef = useRef({ mode: null });
  const countryDraftRef = useRef([]);
  const finishCountryRef = useRef(null);
  const cancelCountryRef = useRef(null);
  const finishSignalRef = useRef(countryFinishSignal);
  const cancelSignalRef = useRef(countryCancelSignal);
  const [countryDraft, setCountryDraft] = useState([]);
  const [images, setImages] = useState({});
  const textures = useMemo(() => getAllMapTextures(customTextures), [customTextures]);
  const textureSources = useMemo(
    () => JSON.stringify([...new Set(textures.map((texture) => texture.src).filter(Boolean))]),
    [textures],
  );
  const selectedTexture = textures.find((texture) => texture.id === selectedTextureId) || textures[0];

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
    renderMapCanvas(context, mapState, images, true, selectedCountryId);
    drawCountryDraft(context, mapState, countryDraft);
  }, [countryDraft, images, mapState, selectedCountryId, zoom]);

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

  const getMapPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!rect || !mapState || !rect.width || !rect.height) return null;
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const appendBrushPoint = (event) => {
    const active = pointerRef.current;
    if (active.mode !== "brush" || active.pointerId !== event.pointerId) return;
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

  const addScatterStamp = (active, point) => {
    const size = stampSize || selectedTexture?.defaultSize || 0.08;
    const stamp = {
      id: createObjectId("stamp"),
      textureId: selectedTextureId,
      x: point.x,
      y: point.y,
      size,
      rotation: 0,
    };
    const existing = [...(mapState.stamps || []), ...active.stamps];
    if (overlapsExistingStamp(stamp, existing, mapState, textures, images)) return false;
    active.stamps.push(stamp);
    const context = canvasRef.current?.getContext("2d");
    if (context) drawMapStamp(context, mapState, images, stamp);
    return true;
  };

  const appendScatterPoint = (event) => {
    const active = pointerRef.current;
    if (active.mode !== "scatter" || active.pointerId !== event.pointerId) return;
    const point = getMapPoint(event);
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
    appendPointerPoint(event);
    pointerRef.current = { mode: null };
    if (active.mode === "brush") onStrokeComplete?.(active.stroke);
    else if (active.mode === "scatter" && active.stamps.length) onStampsComplete?.(active.stamps);
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
        rotation: 0,
      });
      return;
    }
    if (activeTool === "scatter") {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const active = { mode: "scatter", pointerId: event.pointerId, lastPoint: point, stamps: [] };
      pointerRef.current = active;
      addScatterStamp(active, point);
      return;
    }
    if (activeTool !== "brush" && activeTool !== "erase" && activeTool !== "wall") return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const stroke = {
      id: createObjectId("stroke"),
      textureId: activeTool === "erase" ? mapState.baseTextureId : selectedTextureId,
      size: brushSize,
      opacity: activeTool === "erase" ? 1 : brushOpacity,
      erase: activeTool === "erase",
      kind: activeTool === "wall" ? "wall" : "brush",
      points: [point],
    };
    pointerRef.current = {
      mode: "brush",
      pointerId: event.pointerId,
      stroke,
      lastPoint: point,
      patternCache: new Map(),
    };
    const context = canvasRef.current?.getContext("2d");
    if (context) paintBrushSegment(context, mapState, images, stroke, point, point, pointerRef.current.patternCache);
  };

  const handlePointerMove = (event) => {
    if (!pointerRef.current.mode || pointerRef.current.pointerId !== event.pointerId) return;
    const nativeEvent = event.nativeEvent;
    const coalesced = nativeEvent.getCoalescedEvents?.() || [];
    if (coalesced.length) coalesced.forEach(appendPointerPoint);
    else appendPointerPoint(event);
  };

  return (
    <canvas
      ref={canvasRef}
      className={`world-map-canvas ${editable ? "world-map-canvas-editable" : ""}`}
      aria-label={`${mapState?.width || 0} на ${mapState?.height || 0} пикселей, карта мира`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
    />
  );
}
