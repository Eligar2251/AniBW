import { getMapTexture } from "./mapTextures";

const FALLBACK_COLORS = {
  вода: "#2b7189",
  лес: "#31523b",
  горы: "#77766e",
  город: "#9a7046",
  земля: "#61824d",
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

function drawStrokePath(context, points, width, height, lineWidth) {
  const pixels = points.map((point) => ({ x: point.x * width, y: point.y * height }));
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = lineWidth;
  context.beginPath();

  if (pixels.length === 1) {
    context.arc(pixels[0].x, pixels[0].y, Math.max(1, lineWidth / 2), 0, Math.PI * 2);
    return "dot";
  }

  context.moveTo(pixels[0].x, pixels[0].y);
  if (pixels.length === 2) {
    context.lineTo(pixels[1].x, pixels[1].y);
  } else {
    for (let index = 1; index < pixels.length - 1; index += 1) {
      const current = pixels[index];
      const next = pixels[index + 1];
      context.quadraticCurveTo(
        current.x,
        current.y,
        (current.x + next.x) / 2,
        (current.y + next.y) / 2,
      );
    }
    const last = pixels[pixels.length - 1];
    context.lineTo(last.x, last.y);
  }
  return "line";
}

function getPattern(context, textureId, mapState, images, cache, scale) {
  const texture = getMapTexture(textureId, mapState.textures || []);
  const key = `${texture.id}:${texture.src}:${texture.sourceType}:${texture.col}:${texture.row}:${scale}`;
  if (!cache.has(key)) {
    cache.set(key, makeTexturePattern(context, texture, images?.[texture.src], scale));
  }
  return cache.get(key) || null;
}

export function paintBrushSegment(context, mapState, images, stroke, from, to, cache) {
  const points = from.x === to.x && from.y === to.y ? [from] : [from, to];
  const brush = getPattern(
    context,
    stroke.erase ? mapState.baseTextureId : stroke.textureId,
    mapState,
    images,
    cache,
    stroke.erase ? 0.66 : Math.min(0.9, Math.max(0.22, (Number(stroke.size) || 0.05) * 5.4)),
  );
  const lineWidth = Math.max(2, (Number(stroke.size) || 0.05) * mapState.height);
  context.save();
  context.globalAlpha = stroke.erase ? 1 : Math.min(1, Math.max(0.05, Number(stroke.opacity) || 1));
  context.fillStyle = brush || FALLBACK_COLORS.земля;
  context.strokeStyle = brush || FALLBACK_COLORS.земля;
  const kind = drawStrokePath(context, points, mapState.width, mapState.height, lineWidth);
  if (kind === "dot") context.fill();
  else context.stroke();
  context.restore();
}

export function renderMapCanvas(context, mapState, images, includeCities = true) {
  const { width, height } = mapState;
  const patternCache = new Map();
  const basePattern = getPattern(context, mapState.baseTextureId, mapState, images, patternCache, 0.66);
  context.save();
  context.globalAlpha = 1;
  context.fillStyle = basePattern || FALLBACK_COLORS.земля;
  context.fillRect(0, 0, width, height);
  context.restore();

  for (const stroke of mapState.strokes) {
    const pattern = getPattern(
      context,
      stroke.erase ? mapState.baseTextureId : stroke.textureId,
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
    const kind = drawStrokePath(context, stroke.points, width, height, lineWidth);
    if (kind === "dot") context.fill();
    else context.stroke();
    context.restore();
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
    const kind = drawStrokePath(context, stroke.points, width, height, Math.max(2, stroke.size * height));
    if (kind === "dot") context.fill();
    else context.stroke();
    context.restore();
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
