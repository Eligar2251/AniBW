export const DEFAULT_TILE_SHEET = "/assets/world-map-fantasy-tiles.png";
export const DEFAULT_MAP_WIDTH = 1200;
export const DEFAULT_MAP_HEIGHT = 800;
export const MAP_CANVAS_PRESETS = [
  { label: "Маленький · 800 × 600", width: 800, height: 600 },
  { label: "Средний · 1200 × 800", width: 1200, height: 800 },
  { label: "Большой · 1600 × 1000", width: 1600, height: 1000 },
];
export const MAP_SIZE_PRESETS = MAP_CANVAS_PRESETS;

export const DEFAULT_MAP_TEXTURES = [
  { id: "grass", label: "Зелёные луга", col: 0, row: 0, elevation: 0.13, category: "земля" },
  { id: "meadow", label: "Цветущий луг", col: 1, row: 0, elevation: 0.15, category: "земля" },
  { id: "earth", label: "Грунтовая дорога", col: 2, row: 0, elevation: 0.06, category: "земля" },
  { id: "sand", label: "Песок", col: 3, row: 0, elevation: 0.02, category: "земля" },
  { id: "deep-water", label: "Глубокая вода", col: 0, row: 1, elevation: -0.2, category: "вода" },
  { id: "shallow-water", label: "Мелководье", col: 1, row: 1, elevation: -0.12, category: "вода" },
  { id: "shore", label: "Берег", col: 2, row: 1, elevation: -0.01, category: "вода" },
  { id: "stone", label: "Камни", col: 3, row: 1, elevation: 0.17, category: "земля" },
  { id: "forest", label: "Редкий лес", col: 0, row: 2, elevation: 0.23, category: "лес" },
  { id: "dense-forest", label: "Хвойный лес", col: 1, row: 2, elevation: 0.31, category: "лес" },
  { id: "foothills", label: "Предгорья", col: 2, row: 2, elevation: 0.48, category: "горы" },
  { id: "mountain", label: "Снежные горы", col: 3, row: 2, elevation: 0.88, category: "горы" },
  { id: "village", label: "Деревня", col: 0, row: 3, elevation: 0.2, category: "город" },
  { id: "city", label: "Город", col: 1, row: 3, elevation: 0.25, category: "город" },
  { id: "castle", label: "Замок", col: 2, row: 3, elevation: 0.62, category: "город" },
  { id: "wheat", label: "Пшеничное поле", col: 3, row: 3, elevation: 0.08, category: "земля" },
].map((texture) => ({
  ...texture,
  src: DEFAULT_TILE_SHEET,
  sourceType: "sheet",
  cols: 4,
  rows: 4,
}));

const starterStroke = (id, textureId, size, points, opacity = 1) => ({
  id,
  textureId,
  size,
  opacity,
  points: points.map(([x, y]) => ({ x, y })),
});

export function createStarterMapState() {
  return {
    version: 2,
    width: DEFAULT_MAP_WIDTH,
    height: DEFAULT_MAP_HEIGHT,
    baseTextureId: "grass",
    textures: [],
    strokes: [
      starterStroke("starter-ocean", "deep-water", 0.58, [[0.99, -0.05], [0.95, 0.18], [0.98, 0.43], [0.92, 0.68], [0.96, 1.05]]),
      starterStroke("starter-shallows", "shallow-water", 0.27, [[0.79, -0.04], [0.77, 0.22], [0.82, 0.45], [0.76, 0.73], [0.78, 1.04]]),
      starterStroke("starter-shore", "shore", 0.14, [[0.68, -0.04], [0.68, 0.22], [0.71, 0.5], [0.66, 0.77], [0.69, 1.04]]),
      starterStroke("starter-sand", "sand", 0.16, [[0.59, -0.04], [0.59, 0.22], [0.62, 0.5], [0.58, 0.78], [0.6, 1.04]]),
      starterStroke("starter-foothills", "foothills", 0.34, [[0.1, 0.2], [0.22, 0.12], [0.35, 0.16], [0.42, 0.27], [0.36, 0.37]]),
      starterStroke("starter-mountains", "mountain", 0.16, [[0.13, 0.2], [0.23, 0.13], [0.31, 0.19], [0.37, 0.27]]),
      starterStroke("starter-west-forest", "dense-forest", 0.2, [[0.17, 0.56], [0.21, 0.65], [0.15, 0.74], [0.24, 0.82]]),
      starterStroke("starter-north-forest", "forest", 0.17, [[0.44, 0.14], [0.48, 0.23], [0.52, 0.2]]),
      starterStroke("starter-road", "earth", 0.035, [[0.2, 0.68], [0.3, 0.62], [0.42, 0.59], [0.53, 0.56], [0.64, 0.52]]),
      starterStroke("starter-fields", "wheat", 0.15, [[0.4, 0.79], [0.46, 0.82], [0.48, 0.75]]),
      starterStroke("starter-castle", "castle", 0.12, [[0.3, 0.34]]),
      starterStroke("starter-town", "city", 0.1, [[0.5, 0.56]]),
      starterStroke("starter-village", "village", 0.1, [[0.2, 0.68]]),
    ],
    cities: [
      { id: "starter-city-elden", name: "Эльден", x: 0.5, y: 0.56, type: "city" },
      { id: "starter-village-wood", name: "Лесной Предел", x: 0.2, y: 0.68, type: "village" },
    ],
  };
}

function safeTextureList(value) {
  return Array.isArray(value)
    ? value
        .filter(
          (texture) =>
            texture &&
            typeof texture.id === "string" &&
            typeof texture.src === "string" &&
            (texture.sourceType === "image" || texture.sourceType === "sheet"),
        )
        .slice(0, 256)
    : [];
}

function normalizeCities(cities, width, height, legacy = false) {
  if (!Array.isArray(cities)) return [];
  return cities
    .filter((city) => city && typeof city.name === "string")
    .slice(0, 500)
    .map((city, index) => {
      const x = Number(city.x) || 0;
      const y = Number(city.y) || 0;
      return {
        id: String(city.id || `city-${index}`),
        name: city.name.slice(0, 80),
        x: Math.min(1, Math.max(0, legacy ? (x + 0.5) / width : x)),
        y: Math.min(1, Math.max(0, legacy ? (y + 0.5) / height : y)),
        type: city.type === "village" ? "village" : "city",
      };
    });
}

function convertLegacyGrid(value, textures) {
  const oldWidth = Math.min(64, Math.max(8, Math.floor(Number(value.width) || 32)));
  const oldHeight = Math.min(64, Math.max(8, Math.floor(Number(value.height) || 24)));
  const strokes = [];
  value.tiles.slice(0, oldWidth * oldHeight).forEach((textureId, index) => {
    if (textureId === "grass") return;
    strokes.push({
      id: `legacy-${index}`,
      textureId: typeof textureId === "string" ? textureId : "grass",
      size: Math.min(0.2, 1.15 / oldHeight),
      opacity: 1,
      points: [{
        x: ((index % oldWidth) + 0.5) / oldWidth,
        y: (Math.floor(index / oldWidth) + 0.5) / oldHeight,
      }],
      erase: false,
    });
  });
  return {
    version: 2,
    width: DEFAULT_MAP_WIDTH,
    height: DEFAULT_MAP_HEIGHT,
    baseTextureId: "grass",
    textures,
    strokes,
    cities: normalizeCities(value.cities, oldWidth, oldHeight, true),
  };
}

export function normalizeMapState(value) {
  if (!value || typeof value !== "object") return createStarterMapState();
  const textures = safeTextureList(value.textures);

  if (!Array.isArray(value.strokes) && Array.isArray(value.tiles)) {
    return convertLegacyGrid(value, textures);
  }
  if (!Array.isArray(value.strokes)) return createStarterMapState();

  const width = Math.min(2048, Math.max(480, Math.floor(Number(value.width) || DEFAULT_MAP_WIDTH)));
  const height = Math.min(1536, Math.max(320, Math.floor(Number(value.height) || DEFAULT_MAP_HEIGHT)));
  let remainingPoints = 100_000;
  const strokes = value.strokes
    .filter((stroke) => stroke && typeof stroke.textureId === "string" && Array.isArray(stroke.points))
    .slice(-2000)
    .map((stroke, index) => {
      const pointLimit = Math.min(5000, remainingPoints);
      const points = stroke.points
        .slice(0, pointLimit)
        .filter((point) => point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)))
        .map((point) => ({
          x: Math.min(1.2, Math.max(-0.2, Number(point.x))),
          y: Math.min(1.2, Math.max(-0.2, Number(point.y))),
        }));
      remainingPoints -= points.length;
      return {
        id: String(stroke.id || `stroke-${index}`),
        textureId: stroke.textureId,
        size: Math.min(0.65, Math.max(0.004, Number(stroke.size) || 0.06)),
        opacity: Math.min(1, Math.max(0.05, Number(stroke.opacity) || 1)),
        erase: Boolean(stroke.erase),
        points,
      };
    })
    .filter((stroke) => stroke.points.length > 0);

  return {
    version: 2,
    width,
    height,
    baseTextureId: typeof value.baseTextureId === "string" ? value.baseTextureId : "grass",
    textures,
    strokes,
    cities: normalizeCities(value.cities, width, height),
  };
}

export function getMapTexture(textureId, customTextures = []) {
  return (
    customTextures.find((texture) => texture.id === textureId) ||
    DEFAULT_MAP_TEXTURES.find((texture) => texture.id === textureId) ||
    DEFAULT_MAP_TEXTURES[0]
  );
}

export function getAllMapTextures(customTextures = []) {
  const customById = new Map(customTextures.map((texture) => [texture.id, texture]));
  const defaults = DEFAULT_MAP_TEXTURES.map((texture) => customById.get(texture.id) || texture);
  const extraTextures = customTextures.filter(
    (texture) => !DEFAULT_MAP_TEXTURES.some((defaultTexture) => defaultTexture.id === texture.id),
  );
  return [...defaults, ...extraTextures];
}
