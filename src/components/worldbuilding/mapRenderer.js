import { getMapTexture } from "./mapTextures";

const FALLBACK_COLORS = {
  вода: "#2b7189",
  лес: "#31523b",
  горы: "#77766e",
  город: "#9a7046",
  земля: "#61824b",
};

function sourceCrop(image, texture) {
  if (texture.sourceType !== "sheet") {
    return [0, 0, image.naturalWidth, image.naturalHeight];
  }
  const cols = Math.max(1, Number(texture.cols) || 1);
  const rows = Math.max(1, Number(texture.rows) || 1);
  const col = Math.min(cols - 1, Math.max(0, Number(texture.col) || 0));
  const row = Math.min(rows - 1, Math.max(0, Number(texture.row) || 0));
  return [
    (col * image.naturalWidth) / cols,
    (row * image.naturalHeight) / rows,
    image.naturalWidth / cols,
    image.naturalHeight / rows,
  ];
}

function makeTexturePattern(context, texture, image, scale) {
  const tile = document.createElement("canvas");
  tile.width = 128;
  tile.height = 128;
  const tileContext = tile.getContext("2d");
  if (!tileContext) return null;

  if (image?.naturalWidth) {
    try {
      tileContext.drawImage(image, ...sourceCrop(image, texture), 0, 0, tile.width, tile.height);
    } catch {
      tileContext.fillStyle = FALLBACK_COLORS[texture.category] || FALLBACK_COLORS.земля;
      tileContext.fillRect(0, 0, tile.width, tile.height);
    }
  } else {
    tileContext.fillStyle = FALLBACK_COLORS[texture.category] || FALLBACK_COLORS.земля;
    tileContext.fillRect(0, 0, tile.width, tile.height);
  }

  const pattern = context.createPattern(tile, "repeat");
  if (pattern?.setTransform && typeof DOMMatrix !== "undefined") {
    pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, 0, 0]));
  }
  return pattern;
}

function toPixels(points, width, height) {
  return points.map((point) => ({ x: point.x * width, y: point.y * height }));
}

function traceSmoothPath(context, points, width, height, close = false) {
  const pixels = toPixels(points, width, height);
  context.beginPath();
  if (pixels.length === 0) return pixels;
  if (pixels.length === 1) {
    context.arc(pixels[0].x, pixels[0].y, 1, 0, Math.PI * 2);
    return pixels;
  }

  if (close && pixels.length > 2) {
    const first = pixels[0];
    const last = pixels[pixels.length - 1];
    context.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);
    for (let index = 0; index < pixels.length; index += 1) {
      const current = pixels[index];
      const next = pixels[(index + 1) % pixels.length];
      context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
    }
    context.closePath();
    return pixels;
  }

  context.moveTo(pixels[0].x, pixels[0].y);
  if (pixels.length === 2) {
    context.lineTo(pixels[1].x, pixels[1].y);
    return pixels;
  }
  for (let index = 1; index < pixels.length - 1; index += 1) {
    const current = pixels[index];
    const next = pixels[index + 1];
    context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  const last = pixels[pixels.length - 1];
  context.lineTo(last.x, last.y);
  return pixels;
}

function getPattern(context, textureId, mapState, images, cache, scale) {
  const texture = getMapTexture(textureId, mapState.textures || []);
  const key = `${texture.id}:${texture.src}:${texture.sourceType}:${texture.col}:${texture.row}:${scale}`;
  if (!cache.has(key)) {
    cache.set(key, makeTexturePattern(context, texture, images?.[texture.src], scale));
  }
  return cache.get(key) || null;
}

function drawWallPath(context, points, width, height, lineWidth) {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  traceSmoothPath(context, points, width, height);
  context.strokeStyle = "#342d25";
  context.lineWidth = lineWidth * 1.22;
  context.stroke();
  context.strokeStyle = "#8e8069";
  context.lineWidth = lineWidth * 0.88;
  context.stroke();
  context.setLineDash([Math.max(5, lineWidth * 0.48), Math.max(2, lineWidth * 0.1)]);
  context.lineDashOffset = 0;
  context.strokeStyle = "#c2b28e";
  context.lineWidth = Math.max(2, lineWidth * 0.18);
  context.stroke();
  context.restore();
}

export function paintWallSegment(context, mapState, stroke, from, to) {
  const points = from.x === to.x && from.y === to.y ? [from] : [from, to];
  context.save();
  context.globalAlpha = Math.min(1, Math.max(0.1, Number(stroke.opacity) || 1));
  drawWallPath(context, points, mapState.width, mapState.height, Math.max(8, stroke.size * mapState.height));
  context.restore();
}

export function paintCountryPreviewSegment(context, mapState, from, to) {
  context.save();
  context.beginPath();
  context.moveTo(from.x * mapState.width, from.y * mapState.height);
  context.lineTo(to.x * mapState.width, to.y * mapState.height);
  context.strokeStyle = "rgba(255, 222, 137, 0.95)";
  context.lineWidth = Math.max(3, mapState.height * 0.0035);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.setLineDash([10, 6]);
  context.stroke();
  context.restore();
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function getForestDabMetrics(stroke, mapState, texture, index) {
  const brushWidth = Math.max(2, (Number(stroke.size) || 0.05) * mapState.height);
  const clusterSize = Math.max(56, Math.min(240, brushWidth * 2.15));
  const random = createSeededRandom(hashString(`${stroke.id || stroke.textureId}:${index}`));
  const spacing = Number(texture.brushSpacing) || 0.46;
  return {
    size: clusterSize * (0.92 + random() * 0.16),
    rotation: random() * 360,
    offsetAcross: (random() - 0.5) * clusterSize * 0.18,
    offsetAlong: (random() - 0.5) * clusterSize * 0.08,
    offsetX: (random() - 0.5) * clusterSize * 0.16,
    offsetY: (random() - 0.5) * clusterSize * 0.16,
    spacing: clusterSize * spacing * (0.92 + random() * 0.16),
  };
}

function drawForestDab(context, mapState, images, stroke, texture, point, from, to, index) {
  const metrics = getForestDabMetrics(stroke, mapState, texture, index);
  const segmentX = (to.x - from.x) * mapState.width;
  const segmentY = (to.y - from.y) * mapState.height;
  const segmentLength = Math.hypot(segmentX, segmentY);
  const tangentX = segmentLength ? segmentX / segmentLength : 0;
  const tangentY = segmentLength ? segmentY / segmentLength : 0;
  const normalX = -tangentY;
  const normalY = tangentX;
  const centerX = point.x * mapState.width + (segmentLength
    ? tangentX * metrics.offsetAlong + normalX * metrics.offsetAcross
    : metrics.offsetX);
  const centerY = point.y * mapState.height + (segmentLength
    ? tangentY * metrics.offsetAlong + normalY * metrics.offsetAcross
    : metrics.offsetY);

  drawMapStamp(context, mapState, images, {
    textureId: stroke.textureId,
    x: centerX / mapState.width,
    y: centerY / mapState.height,
    size: metrics.size / mapState.height,
    rotation: metrics.rotation,
    opacity: stroke.opacity,
  });
}

function paintForestBrushSegment(context, mapState, images, stroke, from, to, brushState) {
  const texture = getMapTexture(stroke.textureId, mapState.textures || []);
  const state = brushState || {};
  const segmentX = (to.x - from.x) * mapState.width;
  const segmentY = (to.y - from.y) * mapState.height;
  const segmentLength = Math.hypot(segmentX, segmentY);

  if (!state.initialized) {
    drawForestDab(context, mapState, images, stroke, texture, from, from, to, 0);
    state.initialized = true;
    state.nextDabIndex = 1;
    state.distanceUntilNext = getForestDabMetrics(stroke, mapState, texture, 0).spacing;
  }
  if (segmentLength < 0.001) return;

  let distanceAlongSegment = 0;
  while (segmentLength - distanceAlongSegment >= state.distanceUntilNext) {
    distanceAlongSegment += state.distanceUntilNext;
    const amount = distanceAlongSegment / segmentLength;
    const point = {
      x: from.x + (to.x - from.x) * amount,
      y: from.y + (to.y - from.y) * amount,
    };
    const dabIndex = state.nextDabIndex;
    drawForestDab(context, mapState, images, stroke, texture, point, from, to, dabIndex);
    state.nextDabIndex += 1;
    state.distanceUntilNext = getForestDabMetrics(stroke, mapState, texture, dabIndex).spacing;
  }
  state.distanceUntilNext -= segmentLength - distanceAlongSegment;
}

function drawForestBrushStroke(context, mapState, images, stroke) {
  if (!stroke.points?.length) return;
  const brushState = {};
  paintForestBrushSegment(context, mapState, images, stroke, stroke.points[0], stroke.points[0], brushState);
  for (let index = 1; index < stroke.points.length; index += 1) {
    paintForestBrushSegment(
      context,
      mapState,
      images,
      stroke,
      stroke.points[index - 1],
      stroke.points[index],
      brushState,
    );
  }
}

export function paintBrushSegment(context, mapState, images, stroke, from, to, cache, brushState) {
  if (stroke.kind === "wall") {
    paintWallSegment(context, mapState, stroke, from, to);
    return;
  }
  const textureId = stroke.erase ? mapState.baseTextureId : stroke.textureId;
  const texture = getMapTexture(textureId, mapState.textures || []);
  if (!stroke.erase && texture.brushMode === "cluster") {
    const forestBrushState = brushState || cache?.forestBrushState || {};
    if (!brushState && cache) cache.forestBrushState = forestBrushState;
    paintForestBrushSegment(context, mapState, images, stroke, from, to, forestBrushState);
    return;
  }
  const points = from.x === to.x && from.y === to.y ? [from] : [from, to];
  const pattern = getPattern(
    context,
    textureId,
    mapState,
    images,
    cache,
    stroke.erase ? 0.66 : Math.min(0.9, Math.max(0.22, (Number(stroke.size) || 0.05) * 5.4)),
  );
  const lineWidth = Math.max(2, (Number(stroke.size) || 0.05) * mapState.height);
  context.save();
  context.globalAlpha = stroke.erase ? 1 : Math.min(1, Math.max(0.05, Number(stroke.opacity) || 1));
  context.fillStyle = pattern || FALLBACK_COLORS.земля;
  context.strokeStyle = pattern || FALLBACK_COLORS.земля;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = lineWidth;
  context.beginPath();
  if (points.length === 1) {
    context.arc(points[0].x * mapState.width, points[0].y * mapState.height, Math.max(1, lineWidth / 2), 0, Math.PI * 2);
    context.fill();
  } else {
    context.moveTo(points[0].x * mapState.width, points[0].y * mapState.height);
    context.lineTo(points[1].x * mapState.width, points[1].y * mapState.height);
    context.stroke();
  }
  context.restore();
}

export function drawMapStamp(context, mapState, images, stamp) {
  const texture = getMapTexture(stamp.textureId, mapState.textures || []);
  const image = images?.[texture.src];
  if (!image?.naturalWidth) return;
  const [sx, sy, sw, sh] = sourceCrop(image, texture);
  const targetHeight = Math.max(10, (Number(stamp.size) || texture.defaultSize || 0.08) * mapState.height);
  const targetWidth = targetHeight * sw / sh;
  const centerX = stamp.x * mapState.width;
  const centerY = stamp.y * mapState.height;
  context.save();
  context.globalAlpha = Math.min(1, Math.max(0.05, Number(stamp.opacity) || 1));
  context.translate(centerX, centerY);
  context.rotate(((Number(stamp.rotation) || 0) * Math.PI) / 180);
  context.drawImage(image, sx, sy, sw, sh, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
  context.restore();
}

function drawCountry(context, mapState, country, selected) {
  const { width, height } = mapState;
  context.save();
  traceSmoothPath(context, country.points, width, height, true);
  context.fillStyle = country.color;
  context.globalAlpha = selected ? 0.2 : 0.09;
  context.fill();
  context.globalAlpha = 1;
  context.strokeStyle = country.color;
  context.lineWidth = Math.max(3, height * (selected ? 0.006 : 0.0032));
  context.setLineDash(selected ? [] : [12, 7]);
  if (selected) {
    context.shadowColor = country.color;
    context.shadowBlur = 12;
  }
  context.stroke();
  context.setLineDash([]);
  context.shadowBlur = 0;

  const center = country.points.reduce(
    (total, point) => ({ x: total.x + point.x / country.points.length, y: total.y + point.y / country.points.length }),
    { x: 0, y: 0 },
  );
  const label = country.name;
  const x = center.x * width;
  const y = center.y * height;
  context.font = `700 ${Math.max(15, Math.min(width, height) * 0.027)}px sans-serif`;
  const labelWidth = context.measureText(label).width + 22;
  const labelHeight = Math.max(28, Math.min(width, height) * 0.052);
  context.fillStyle = "rgba(13, 15, 19, 0.82)";
  context.strokeStyle = country.color;
  context.lineWidth = selected ? 2.5 : 1.4;
  context.beginPath();
  context.roundRect(x - labelWidth / 2, y - labelHeight / 2, labelWidth, labelHeight, 9);
  context.fill();
  context.stroke();
  context.fillStyle = "#fff1d0";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, x, y, labelWidth - 12);
  context.restore();
}

export function findCountryAtPoint(countries, point) {
  if (!Array.isArray(countries) || !point) return null;
  for (let index = countries.length - 1; index >= 0; index -= 1) {
    const country = countries[index];
    let inside = false;
    for (let i = 0, j = country.points.length - 1; i < country.points.length; j = i, i += 1) {
      const a = country.points[i];
      const b = country.points[j];
      const crosses = ((a.y > point.y) !== (b.y > point.y)) &&
        (point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 0.000001) + a.x);
      if (crosses) inside = !inside;
    }
    if (inside) return country.id;
  }
  return null;
}

export function renderMapCanvas(context, mapState, images, includeCities = true, selectedCountryId = null) {
  const { width, height } = mapState;
  const patternCache = new Map();
  const baseTexture = getMapTexture(mapState.baseTextureId, mapState.textures || []);
  const basePattern = getPattern(context, mapState.baseTextureId, mapState, images, patternCache, 0.66);
  context.save();
  context.globalAlpha = 1;
  context.fillStyle = FALLBACK_COLORS[baseTexture.category] || FALLBACK_COLORS.земля;
  context.fillRect(0, 0, width, height);
  if (basePattern) {
    context.fillStyle = basePattern;
    context.fillRect(0, 0, width, height);
  }
  context.restore();

  for (const stroke of mapState.strokes) {
    if (stroke.kind === "wall") {
      context.save();
      context.globalAlpha = Math.min(1, Math.max(0.1, Number(stroke.opacity) || 1));
      drawWallPath(context, stroke.points, width, height, Math.max(8, stroke.size * height));
      context.restore();
      continue;
    }
    const textureId = stroke.erase ? mapState.baseTextureId : stroke.textureId;
    const texture = getMapTexture(textureId, mapState.textures || []);
    if (!stroke.erase && texture.brushMode === "cluster") {
      drawForestBrushStroke(context, mapState, images, stroke);
      continue;
    }
    const pattern = getPattern(
      context,
      textureId,
      mapState,
      images,
      patternCache,
      stroke.erase ? 0.66 : Math.min(0.9, Math.max(0.22, (Number(stroke.size) || 0.05) * 5.4)),
    );
    const lineWidth = Math.max(2, (Number(stroke.size) || 0.05) * height);
    context.save();
    context.globalAlpha = stroke.erase ? 1 : Math.min(1, Math.max(0.05, Number(stroke.opacity) || 1));
    context.fillStyle = pattern || FALLBACK_COLORS.земля;
    context.strokeStyle = pattern || FALLBACK_COLORS.земля;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = lineWidth;
    context.beginPath();
    if (stroke.points.length === 1) {
      context.arc(stroke.points[0].x * width, stroke.points[0].y * height, Math.max(1, lineWidth / 2), 0, Math.PI * 2);
      context.fill();
    } else {
      traceSmoothPath(context, stroke.points, width, height);
      context.stroke();
    }
    context.restore();
  }

  for (const stamp of mapState.stamps || []) drawMapStamp(context, mapState, images, stamp);
  for (const country of mapState.countries || []) {
    drawCountry(context, mapState, country, country.id === selectedCountryId);
  }
  if (includeCities) mapState.cities.forEach((city) => drawCity(context, city, width, height));
}

export function renderHeightMap(context, mapState) {
  const { width, height } = context.canvas;
  const baseTexture = getMapTexture(mapState.baseTextureId, mapState.textures || []);
  const toGray = (elevation) => Math.round(Math.min(255, Math.max(0, ((elevation + 0.25) / 1.2) * 255)));
  const baseGray = toGray(Number(baseTexture.elevation) || 0.13);
  context.fillStyle = `rgb(${baseGray}, ${baseGray}, ${baseGray})`;
  context.fillRect(0, 0, width, height);

  for (const stroke of mapState.strokes) {
    const textureId = stroke.erase ? mapState.baseTextureId : stroke.textureId;
    const texture = getMapTexture(textureId, mapState.textures || []);
    const gray = toGray(Number(texture.elevation) || 0.13);
    context.save();
    context.globalAlpha = stroke.erase ? 1 : Math.min(1, Math.max(0.05, Number(stroke.opacity) || 1));
    context.strokeStyle = `rgb(${gray}, ${gray}, ${gray})`;
    context.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
    if (stroke.kind === "wall") {
      const wallGray = toGray(0.42);
      context.strokeStyle = `rgb(${wallGray}, ${wallGray}, ${wallGray})`;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = Math.max(4, stroke.size * height * 0.78);
      traceSmoothPath(context, stroke.points, width, height);
      context.stroke();
    } else {
      const strokeWidth = texture.brushMode === "cluster"
        ? Math.max(56, Math.min(240, stroke.size * height * 2.15))
        : Math.max(2, stroke.size * height);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = strokeWidth;
      context.beginPath();
      if (stroke.points.length === 1) {
        context.arc(stroke.points[0].x * width, stroke.points[0].y * height, Math.max(1, strokeWidth / 2), 0, Math.PI * 2);
        context.fill();
      } else {
        traceSmoothPath(context, stroke.points, width, height);
        context.stroke();
      }
    }
    context.restore();
  }

  for (const stamp of mapState.stamps || []) {
    const texture = getMapTexture(stamp.textureId, mapState.textures || []);
    const gray = toGray(Number(texture.elevation) || 0.2);
    context.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
    context.beginPath();
    context.ellipse(
      stamp.x * width,
      stamp.y * height,
      Math.max(2, stamp.size * height * 0.45),
      Math.max(2, stamp.size * height * 0.4),
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}

function drawCity(context, city, width, height) {
  const x = city.x * width;
  const y = city.y * height;
  const radius = Math.max(11, Math.min(width, height) * 0.018);
  context.save();
  context.shadowColor = "rgba(0, 0, 0, 0.85)";
  context.shadowBlur = 10;
  context.fillStyle = "#dcae58";
  context.strokeStyle = "#fff0c5";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = "#251e15";
  context.font = `bold ${Math.max(13, Math.min(width, height) * 0.026)}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(city.type === "village" ? "Д" : "Г", x, y + 1);

  const label = city.name;
  context.font = `600 ${Math.max(14, Math.min(width, height) * 0.024)}px sans-serif`;
  const labelWidth = context.measureText(label).width + 22;
  const labelHeight = Math.max(28, Math.min(width, height) * 0.052);
  const labelX = x + radius + 9;
  const labelY = y - labelHeight / 2;
  context.fillStyle = "rgba(12, 14, 18, 0.9)";
  context.strokeStyle = "rgba(220, 174, 88, 0.75)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.roundRect(labelX, labelY, labelWidth, labelHeight, 8);
  context.fill();
  context.stroke();
  context.fillStyle = "#fff2d5";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(label, labelX + 10, y, labelWidth - 17);
  context.restore();
}
