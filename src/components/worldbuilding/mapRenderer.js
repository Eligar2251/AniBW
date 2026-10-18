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

function makeTextureMosaic(texture, image, mapState) {
  const cellSize = 128;
  const columns = Math.max(10, Math.ceil((mapState.width + cellSize) / cellSize));
  const rows = Math.max(10, Math.ceil((mapState.height + cellSize) / cellSize));
  const mosaic = document.createElement("canvas");
  mosaic.width = columns * cellSize;
  mosaic.height = rows * cellSize;
  const mosaicContext = mosaic.getContext("2d");
  if (!mosaicContext) return null;

  const fallback = FALLBACK_COLORS[texture.category] || FALLBACK_COLORS.земля;
  mosaicContext.fillStyle = fallback;
  mosaicContext.fillRect(0, 0, mosaic.width, mosaic.height);
  const random = createSeededRandom(hashString(`${texture.id}:${texture.src}:${texture.col}:${texture.row}`));
  const crop = image?.naturalWidth ? sourceCrop(image, texture) : null;

  // Scatter feathered texture fragments over the entire map instead of repeating square tiles.
  if (image?.naturalWidth && crop) {
    const patchSize = 192;
    const patch = document.createElement("canvas");
    patch.width = patchSize;
    patch.height = patchSize;
    const patchContext = patch.getContext("2d");
    if (patchContext) {
      try {
        patchContext.drawImage(image, ...crop, 0, 0, patchSize, patchSize);
        patchContext.globalCompositeOperation = "destination-in";
        const feather = patchContext.createRadialGradient(
          patchSize / 2,
          patchSize / 2,
          patchSize * 0.12,
          patchSize / 2,
          patchSize / 2,
          patchSize * 0.5,
        );
        feather.addColorStop(0, "rgba(0, 0, 0, 1)");
        feather.addColorStop(0.72, "rgba(0, 0, 0, 0.92)");
        feather.addColorStop(1, "rgba(0, 0, 0, 0)");
        patchContext.fillStyle = feather;
        patchContext.fillRect(0, 0, patchSize, patchSize);
        patchContext.globalCompositeOperation = "source-over";

        const offsets = (center, size, extent) => {
          const values = [0];
          if (center - size / 2 < 0) values.push(extent);
          if (center + size / 2 > extent) values.push(-extent);
          return values;
        };
        const patchCount = Math.ceil((mosaic.width * mosaic.height / (1280 * 1280)) * 180);
        for (let index = 0; index < patchCount; index += 1) {
          const size = cellSize * (1.25 + random() * 1.45);
          const centerX = random() * mosaic.width;
          const centerY = random() * mosaic.height;
          const angle = random() * Math.PI * 2;
          const offsetX = offsets(centerX, size, mosaic.width);
          const offsetY = offsets(centerY, size, mosaic.height);
          for (const wrapX of offsetX) {
            for (const wrapY of offsetY) {
              mosaicContext.save();
              mosaicContext.globalAlpha = 0.82;
              mosaicContext.translate(centerX + wrapX, centerY + wrapY);
              mosaicContext.rotate(angle);
              mosaicContext.drawImage(patch, -size / 2, -size / 2, size, size);
              mosaicContext.restore();
            }
          }
        }
      } catch {
        mosaicContext.fillStyle = fallback;
        mosaicContext.fillRect(0, 0, mosaic.width, mosaic.height);
      }
    }
  }

  return mosaic;
}

function toPixels(points, width, height) {
  return points.map((point) => ({ x: point.x * width, y: point.y * height }));
}

function traceSmoothPath(context, points, width, height, close = false, smoothing = 0.72) {
  const pixels = toPixels(points, width, height);
  const amount = Math.min(1, Math.max(0, Number(smoothing) || 0));
  context.beginPath();
  if (pixels.length === 0) return pixels;
  if (pixels.length === 1) {
    context.arc(pixels[0].x, pixels[0].y, 1, 0, Math.PI * 2);
    return pixels;
  }

  context.moveTo(pixels[0].x, pixels[0].y);
  if (pixels.length === 2 || amount === 0) {
    for (let index = 1; index < pixels.length; index += 1) {
      context.lineTo(pixels[index].x, pixels[index].y);
    }
    if (close) context.closePath();
    return pixels;
  }

  const segmentCount = close ? pixels.length : pixels.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const firstIndex = index;
    const secondIndex = (index + 1) % pixels.length;
    const previousIndex = close
      ? (index - 1 + pixels.length) % pixels.length
      : Math.max(0, index - 1);
    const nextIndex = close
      ? (index + 2) % pixels.length
      : Math.min(pixels.length - 1, index + 2);
    const previous = pixels[previousIndex];
    const first = pixels[firstIndex];
    const second = pixels[secondIndex];
    const next = pixels[nextIndex];
    const tangent = amount / 6;
    context.bezierCurveTo(
      first.x + (second.x - previous.x) * tangent,
      first.y + (second.y - previous.y) * tangent,
      second.x - (next.x - first.x) * tangent,
      second.y - (next.y - first.y) * tangent,
      second.x,
      second.y,
    );
  }
  if (close) context.closePath();
  return pixels;
}

function getPattern(context, textureId, mapState, images, cache, rotation = 0) {
  const texture = getMapTexture(textureId, mapState.textures || []);
  const normalizedRotation = ((Number(rotation) || 0) % 360 + 360) % 360;
  const key = `${texture.id}:${texture.src}:${texture.sourceType}:${texture.col}:${texture.row}:${mapState.width}x${mapState.height}`;
  if (!cache.has(key)) {
    if (cache.size >= 10) cache.delete(cache.keys().next().value);
    cache.set(key, {
      mosaic: makeTextureMosaic(texture, images?.[texture.src], mapState),
      patterns: new Map(),
    });
  }
  const entry = cache.get(key);
  if (!entry?.mosaic) return null;
  if (!entry.patterns.has(normalizedRotation)) {
    const pattern = context.createPattern(entry.mosaic, "repeat");
    if (pattern?.setTransform && typeof DOMMatrix !== "undefined") {
      const angle = (normalizedRotation * Math.PI) / 180;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      pattern.setTransform(new DOMMatrix([cosine, sine, -sine, cosine, 0, 0]));
    }
    entry.patterns.set(normalizedRotation, pattern);
  }
  return entry.patterns.get(normalizedRotation) || null;
}

function drawWallPath(context, mapState, images, stroke, points, patternCache = new Map()) {
  const lineWidth = Math.max(8, (Number(stroke.size) || 0.06) * mapState.height);
  const pattern = getPattern(
    context,
    stroke.textureId || "wall-stone",
    mapState,
    images,
    patternCache,
    stroke.textureRotation || 0,
  );
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  traceSmoothPath(context, points, mapState.width, mapState.height, false, stroke.smoothing);
  context.strokeStyle = "rgba(35, 32, 27, 0.92)";
  context.lineWidth = lineWidth * 1.16;
  context.stroke();
  context.strokeStyle = pattern || "#827d6c";
  context.lineWidth = lineWidth * 0.9;
  context.stroke();
  context.strokeStyle = "rgba(239, 221, 176, 0.66)";
  context.lineWidth = Math.max(1.5, lineWidth * 0.075);
  context.stroke();
  context.restore();
}

export function paintWallSegment(context, mapState, stroke, from, to, images, patternCache) {
  const points = from.x === to.x && from.y === to.y ? [from] : [from, to];
  context.save();
  context.globalAlpha = Math.min(1, Math.max(0.1, Number(stroke.opacity) || 1));
  drawWallPath(context, mapState, images, stroke, points, patternCache);
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

const FOREST_MIN_SPACING = 1.12;
const FOREST_CELL_SIZE = 128;

function getForestBrushMetrics(stroke, mapState, texture) {
  const brushWidth = Math.max(56, Math.min(340, (Number(stroke.size) || 0.05) * mapState.height * 2.15));
  const treeHeight = Math.max(
    24,
    Math.min((Number(texture.forestTreeSize) || 0.085) * mapState.height, brushWidth * 0.42),
  );
  const densityValue = Number(stroke.forestDensity ?? texture.forestDensity ?? 0.92);
  const density = Math.min(1, Math.max(0.65, Number.isFinite(densityValue) ? densityValue : 0.92));
  const rowSpacing = treeHeight * (FOREST_MIN_SPACING / density);
  const laneCount = Math.max(1, Math.floor(Math.max(0, brushWidth - treeHeight) / rowSpacing) + 1);
  const usedWidth = (laneCount - 1) * rowSpacing;
  return {
    brushWidth,
    treeHeight,
    rowSpacing,
    laneCount,
    firstLaneOffset: -usedWidth / 2,
    stationSpacing: laneCount > 1 ? rowSpacing / 2 : rowSpacing,
  };
}

function createForestOccupancy() {
  return { cells: new Map(), cellSize: FOREST_CELL_SIZE, maxRadius: 0 };
}

function addForestOccupant(occupancy, x, y, radius) {
  const cellX = Math.floor(x / occupancy.cellSize);
  const cellY = Math.floor(y / occupancy.cellSize);
  const key = `${cellX}:${cellY}`;
  const cell = occupancy.cells.get(key) || [];
  cell.push({ x, y, radius });
  occupancy.cells.set(key, cell);
  occupancy.maxRadius = Math.max(occupancy.maxRadius, radius);
}

function cloneForestOccupancy(occupancy) {
  return {
    cellSize: occupancy.cellSize,
    maxRadius: occupancy.maxRadius,
    cells: new Map([...occupancy.cells].map(([key, entries]) => [key, entries.map((entry) => ({ ...entry }))])),
  };
}

function getStampRadiusPixels(mapState, images, texture, size) {
  const image = images?.[texture.src];
  const aspect = image?.naturalWidth && image?.naturalHeight
    ? sourceCrop(image, texture)[2] / sourceCrop(image, texture)[3]
    : 1;
  return Math.max(10, Number(size) * mapState.height * Math.max(1, aspect)) / 2;
}

function seedForestOccupancyWithStamps(occupancy, mapState, images) {
  for (const stamp of mapState.stamps || []) {
    const texture = getMapTexture(stamp.textureId, mapState.textures || []);
    const radius = getStampRadiusPixels(mapState, images, texture, stamp.size || texture.defaultSize || 0.08);
    addForestOccupant(occupancy, stamp.x * mapState.width, stamp.y * mapState.height, radius);
  }
}

function canPlaceForestTree(occupancy, x, y, radius) {
  const cellSize = occupancy.cellSize;
  const cellX = Math.floor(x / cellSize);
  const cellY = Math.floor(y / cellSize);
  const searchRange = Math.ceil((radius + occupancy.maxRadius + 2) / cellSize);
  for (let offsetY = -searchRange; offsetY <= searchRange; offsetY += 1) {
    for (let offsetX = -searchRange; offsetX <= searchRange; offsetX += 1) {
      const neighbors = occupancy.cells.get(`${cellX + offsetX}:${cellY + offsetY}`);
      if (!neighbors) continue;
      for (const neighbor of neighbors) {
        if (Math.hypot(neighbor.x - x, neighbor.y - y) < radius + neighbor.radius + 1) return false;
      }
    }
  }
  addForestOccupant(occupancy, x, y, radius);
  return true;
}

function getForestTreeTextures(mapState, images, texture) {
  const ids = Array.isArray(texture.forestTreeIds) && texture.forestTreeIds.length
    ? texture.forestTreeIds
    : ["tree"];
  return ids
    .map((id) => getMapTexture(id, mapState.textures || []))
    .filter((treeTexture) => images?.[treeTexture.src]?.naturalWidth);
}

function drawForestStation(context, mapState, images, stroke, texture, point, from, to, stationIndex, state) {
  const { metrics, treeTextures, occupancy } = state;
  if (!treeTextures.length) return;
  const segmentX = (to.x - from.x) * mapState.width;
  const segmentY = (to.y - from.y) * mapState.height;
  const segmentLength = Math.hypot(segmentX, segmentY);
  const tangentX = segmentLength ? segmentX / segmentLength : 1;
  const tangentY = segmentLength ? segmentY / segmentLength : 0;
  const normalX = -tangentY;
  const normalY = tangentX;
  const laneParity = metrics.laneCount > 1 ? stationIndex % 2 : -1;

  for (let lane = 0; lane < metrics.laneCount; lane += 1) {
    if (laneParity >= 0 && lane % 2 !== laneParity) continue;
    const random = createSeededRandom(hashString(`${stroke.id || stroke.textureId}:forest:${stationIndex}:${lane}`));
    const treeTexture = treeTextures[Math.floor(random() * treeTextures.length)];
    const size = (metrics.treeHeight / mapState.height) * (0.94 + random() * 0.08);
    const radius = getStampRadiusPixels(mapState, images, treeTexture, size);
    const alongJitter = (random() - 0.5) * metrics.treeHeight * 0.025;
    const acrossJitter = (random() - 0.5) * metrics.treeHeight * 0.025;
    const laneOffset = metrics.firstLaneOffset + lane * metrics.rowSpacing;
    const centerX = point.x * mapState.width + tangentX * alongJitter + normalX * (laneOffset + acrossJitter);
    const centerY = point.y * mapState.height + tangentY * alongJitter + normalY * (laneOffset + acrossJitter);
    if (!canPlaceForestTree(occupancy, centerX, centerY, radius)) continue;
    if (!context) continue;

    drawMapStamp(context, mapState, images, {
      textureId: treeTexture.id,
      x: centerX / mapState.width,
      y: centerY / mapState.height,
      size,
      rotation: random() * 360,
      opacity: stroke.opacity,
    });
  }
}

function paintForestBrushSegment(context, mapState, images, stroke, from, to, brushState) {
  const texture = getMapTexture(stroke.textureId, mapState.textures || []);
  const state = brushState || {};
  const segmentX = (to.x - from.x) * mapState.width;
  const segmentY = (to.y - from.y) * mapState.height;
  const segmentLength = Math.hypot(segmentX, segmentY);

  if (!state.initialized) {
    state.metrics = getForestBrushMetrics(stroke, mapState, texture);
    state.treeTextures = getForestTreeTextures(mapState, images, texture);
    state.occupancy = state.occupancy || createForestOccupancy();
    state.nextStationIndex = 1;
    state.distanceUntilNext = state.metrics.stationSpacing;
    drawForestStation(context, mapState, images, stroke, texture, from, from, to, 0, state);
    state.initialized = true;
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
    drawForestStation(
      context,
      mapState,
      images,
      stroke,
      texture,
      point,
      from,
      to,
      state.nextStationIndex,
      state,
    );
    state.nextStationIndex += 1;
    state.distanceUntilNext = state.metrics.stationSpacing;
  }
  state.distanceUntilNext -= segmentLength - distanceAlongSegment;
}

function drawForestBrushStroke(context, mapState, images, stroke, occupancy = createForestOccupancy()) {
  if (!stroke.points?.length) return;
  const brushState = { occupancy };
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

const forestOccupancyCache = new WeakMap();

export function createForestOccupancyForMap(mapState, images) {
  const strokes = Array.isArray(mapState.strokes) ? mapState.strokes : [];
  const cached = forestOccupancyCache.get(strokes);
  if (
    cached?.images === images &&
    cached.stamps === mapState.stamps &&
    cached.textures === mapState.textures &&
    cached.width === mapState.width &&
    cached.height === mapState.height
  ) {
    return cloneForestOccupancy(cached.occupancy);
  }

  const occupancy = createForestOccupancy();
  seedForestOccupancyWithStamps(occupancy, mapState, images);
  for (const stroke of strokes) {
    const texture = getMapTexture(stroke.textureId, mapState.textures || []);
    if (stroke.kind !== "wall" && !stroke.erase && (texture.brushMode === "forest" || texture.brushMode === "cluster")) {
      drawForestBrushStroke(null, mapState, images, stroke, occupancy);
    }
  }

  forestOccupancyCache.set(strokes, {
    images,
    stamps: mapState.stamps,
    textures: mapState.textures,
    width: mapState.width,
    height: mapState.height,
    occupancy,
  });
  return cloneForestOccupancy(occupancy);
}

export function paintBrushSegment(context, mapState, images, stroke, from, to, cache, brushState) {
  if (stroke.kind === "wall") {
    paintWallSegment(context, mapState, stroke, from, to, images, cache);
    return;
  }
  const textureId = stroke.erase ? mapState.baseTextureId : stroke.textureId;
  const texture = getMapTexture(textureId, mapState.textures || []);
  if (!stroke.erase && (texture.brushMode === "forest" || texture.brushMode === "cluster")) {
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
    stroke.erase ? mapState.baseTextureRotation : stroke.textureRotation,
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

export function renderMapCanvas(
  context,
  mapState,
  images,
  includeCities = true,
  selectedCountryId = null,
  patternCache = new Map(),
) {
  const { width, height } = mapState;
  const baseTexture = getMapTexture(mapState.baseTextureId, mapState.textures || []);
  const basePattern = getPattern(
    context,
    mapState.baseTextureId,
    mapState,
    images,
    patternCache,
    mapState.baseTextureRotation,
  );
  context.save();
  context.globalAlpha = 1;
  context.fillStyle = FALLBACK_COLORS[baseTexture.category] || FALLBACK_COLORS.земля;
  context.fillRect(0, 0, width, height);
  if (basePattern) {
    context.fillStyle = basePattern;
    context.fillRect(0, 0, width, height);
  }
  context.restore();

  const forestOccupancy = createForestOccupancy();
  seedForestOccupancyWithStamps(forestOccupancy, mapState, images);
  for (const stroke of mapState.strokes) {
    if (stroke.kind === "wall") {
      context.save();
      context.globalAlpha = Math.min(1, Math.max(0.1, Number(stroke.opacity) || 1));
      drawWallPath(context, mapState, images, stroke, stroke.points, patternCache);
      context.restore();
      continue;
    }
    const textureId = stroke.erase ? mapState.baseTextureId : stroke.textureId;
    const texture = getMapTexture(textureId, mapState.textures || []);
    if (!stroke.erase && (texture.brushMode === "forest" || texture.brushMode === "cluster")) {
      drawForestBrushStroke(context, mapState, images, stroke, forestOccupancy);
      continue;
    }
    const pattern = getPattern(
      context,
      textureId,
      mapState,
      images,
      patternCache,
      stroke.erase ? mapState.baseTextureRotation : stroke.textureRotation,
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
      traceSmoothPath(context, stroke.points, width, height, false, stroke.smoothing);
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

function applySculptStrokes(context, strokes) {
  if (!strokes?.length) return;
  const width = context.canvas.width;
  const height = context.canvas.height;
  const image = context.getImageData(0, 0, width, height);
  const { data } = image;

  for (const stroke of strokes) {
    const points = (stroke.points || []).map((point) => ({
      x: point.x * width,
      y: point.y * height,
    }));
    if (!points.length) continue;
    const radius = Math.max(2, (Number(stroke.size) || 0.05) * height);
    const direction = stroke.mode === "lower" ? -1 : 1;
    const delta = direction * Math.min(0.18, Math.max(0.005, Number(stroke.strength) || 0.04)) * 255;
    const weights = new Float32Array(width * height);
    const segmentCount = Math.max(1, points.length - 1);

    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
      const start = points[segmentIndex];
      const end = points[Math.min(segmentIndex + 1, points.length - 1)];
      const segmentX = end.x - start.x;
      const segmentY = end.y - start.y;
      const lengthSquared = segmentX * segmentX + segmentY * segmentY;
      const left = Math.max(0, Math.floor(Math.min(start.x, end.x) - radius));
      const right = Math.min(width - 1, Math.ceil(Math.max(start.x, end.x) + radius));
      const top = Math.max(0, Math.floor(Math.min(start.y, end.y) - radius));
      const bottom = Math.min(height - 1, Math.ceil(Math.max(start.y, end.y) + radius));

      for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
          const amount = lengthSquared
            ? Math.min(1, Math.max(0, ((x - start.x) * segmentX + (y - start.y) * segmentY) / lengthSquared))
            : 0;
          const nearestX = start.x + amount * segmentX;
          const nearestY = start.y + amount * segmentY;
          const distance = Math.hypot(x - nearestX, y - nearestY);
          if (distance >= radius) continue;
          const edge = 1 - distance / radius;
          const weight = edge * edge * (3 - 2 * edge);
          const index = y * width + x;
          if (weight > weights[index]) weights[index] = weight;
        }
      }
    }

    for (let index = 0; index < weights.length; index += 1) {
      const weight = weights[index];
      if (!weight) continue;
      const channel = index * 4;
      const gray = Math.min(250, Math.max(8, data[channel] + delta * weight));
      data[channel] = gray;
      data[channel + 1] = gray;
      data[channel + 2] = gray;
    }
  }

  context.putImageData(image, 0, 0);
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
      traceSmoothPath(context, stroke.points, width, height, false, stroke.smoothing);
      context.stroke();
    } else {
      const strokeWidth = texture.brushMode === "cluster" || texture.brushMode === "forest"
        ? Math.max(56, Math.min(340, stroke.size * height * 2.15))
        : Math.max(2, stroke.size * height);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = strokeWidth;
      context.beginPath();
      if (stroke.points.length === 1) {
        context.arc(stroke.points[0].x * width, stroke.points[0].y * height, Math.max(1, strokeWidth / 2), 0, Math.PI * 2);
        context.fill();
      } else {
        traceSmoothPath(context, stroke.points, width, height, false, stroke.smoothing);
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

  applySculptStrokes(context, mapState.heightStrokes || []);
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
