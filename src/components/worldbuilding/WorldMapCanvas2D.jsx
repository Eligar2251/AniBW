import { useEffect, useMemo, useRef, useState } from "react";
import { MAP_CELL_SIZE, getAllMapTextures } from "./mapTextures";

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve([src, image]);
    image.onerror = () => resolve([src, null]);
    image.src = src;
  });
}

function drawTexture(context, image, texture, x, y, size) {
  if (!image) {
    const colorByCategory = {
      вода: "#28677b",
      лес: "#234735",
      горы: "#73736c",
      город: "#9a7046",
      земля: "#62824b",
    };
    context.fillStyle = colorByCategory[texture.category] || "#557348";
    context.fillRect(x, y, size, size);
    return;
  }

  if (texture.sourceType === "image") {
    context.drawImage(image, x, y, size, size);
    return;
  }

  const cols = Math.max(1, Number(texture.cols) || 1);
  const rows = Math.max(1, Number(texture.rows) || 1);
  const col = Math.min(cols - 1, Math.max(0, Number(texture.col) || 0));
  const row = Math.min(rows - 1, Math.max(0, Number(texture.row) || 0));
  context.drawImage(
    image,
    (col * image.naturalWidth) / cols,
    (row * image.naturalHeight) / rows,
    image.naturalWidth / cols,
    image.naturalHeight / rows,
    x,
    y,
    size,
    size,
  );
}

function drawCity(context, city, cellSize) {
  const x = (city.x + 0.5) * cellSize;
  const y = (city.y + 0.5) * cellSize;
  const radius = Math.max(7, cellSize * 0.18);

  context.save();
  context.shadowColor = "rgba(0, 0, 0, 0.8)";
  context.shadowBlur = 7;
  context.fillStyle = "#dcae58";
  context.strokeStyle = "#fff0c5";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = "#231d18";
  context.font = `bold ${Math.max(9, cellSize * 0.28)}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(city.type === "village" ? "Д" : "Г", x, y + 0.5);

  const label = city.name;
  context.font = `600 ${Math.max(10, cellSize * 0.28)}px sans-serif`;
  const labelWidth = context.measureText(label).width + 14;
  const labelHeight = Math.max(20, cellSize * 0.48);
  const labelX = x + radius + 6;
  const labelY = y - labelHeight / 2;
  context.fillStyle = "rgba(12, 14, 18, 0.88)";
  context.strokeStyle = "rgba(220, 174, 88, 0.7)";
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(labelX, labelY, labelWidth, labelHeight, 6);
  context.fill();
  context.stroke();
  context.fillStyle = "#fff2d5";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(label, labelX + 7, y, labelWidth - 12);
  context.restore();
}

export default function WorldMapCanvas2D({
  mapState,
  customTextures = mapState?.textures || [],
  cellSize = MAP_CELL_SIZE,
  zoom = 1,
  showGrid = true,
  editable = false,
  onCellClick,
  onCellDrag,
}) {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ active: false, lastCell: "" });
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
    const logicalWidth = mapState.width * cellSize;
    const logicalHeight = mapState.height * cellSize;
    canvas.width = Math.max(1, Math.round(logicalWidth * ratio));
    canvas.height = Math.max(1, Math.round(logicalHeight * ratio));
    canvas.style.width = `${logicalWidth * zoom}px`;
    canvas.style.height = `${logicalHeight * zoom}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = true;
    context.clearRect(0, 0, logicalWidth, logicalHeight);

    const textureById = new Map(textures.map((texture) => [texture.id, texture]));
    mapState.tiles.forEach((textureId, index) => {
      const x = (index % mapState.width) * cellSize;
      const y = Math.floor(index / mapState.width) * cellSize;
      const texture = textureById.get(textureId) || textureById.get("grass") || textures[0];
      drawTexture(context, images[texture.src], texture, x, y, cellSize);
      if (showGrid) {
        context.strokeStyle = "rgba(13, 15, 19, 0.2)";
        context.lineWidth = 1;
        context.strokeRect(x + 0.5, y + 0.5, cellSize, cellSize);
      }
    });

    mapState.cities.forEach((city) => drawCity(context, city, cellSize));
  }, [cellSize, images, mapState, showGrid, textures, zoom]);

  const getCell = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!rect || !mapState || !rect.width || !rect.height) return null;
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * mapState.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * mapState.height);
    if (x < 0 || y < 0 || x >= mapState.width || y >= mapState.height) return null;
    return { x, y };
  };

  const handlePointerDown = (event) => {
    if (!editable) return;
    const cell = getCell(event);
    if (!cell) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerRef.current = { active: true, lastCell: `${cell.x}:${cell.y}` };
    onCellClick?.(cell.x, cell.y);
  };

  const handlePointerMove = (event) => {
    if (!editable || !pointerRef.current.active) return;
    const cell = getCell(event);
    if (!cell) return;
    const key = `${cell.x}:${cell.y}`;
    if (key === pointerRef.current.lastCell) return;
    pointerRef.current.lastCell = key;
    onCellDrag?.(cell.x, cell.y);
  };

  return (
    <canvas
      ref={canvasRef}
      className={`world-map-canvas ${editable ? "world-map-canvas-editable" : ""}`}
      aria-label={`${mapState?.width || 0} на ${mapState?.height || 0} клеток, карта мира`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => { pointerRef.current.active = false; }}
      onPointerCancel={() => { pointerRef.current.active = false; }}
    />
  );
}
