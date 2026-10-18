export const DEFAULT_TILE_SHEET = "/assets/world-map-fantasy-tiles.png";
export const DEFAULT_MAP_WIDTH = 1200;
export const DEFAULT_MAP_HEIGHT = 800;
export const MAP_CANVAS_PRESETS = [
  { label: "Маленький · 800 × 600", width: 800, height: 600 },
  { label: "Средний · 1200 × 800", width: 1200, height: 800 },
  { label: "Большой · 1600 × 1000", width: 1600, height: 1000 },
];
export const MAP_SIZE_PRESETS = MAP_CANVAS_PRESETS;

const terrain = (id, label, image, elevation, category = "земля", brushMode = "pattern", brushSpacing) => ({
  id,
  label,
  src: `/assets/world-map/textures/${image}.png`,
  sourceType: "image",
  elevation,
  category,
  brushMode,
  ...(brushSpacing ? { brushSpacing } : {}),
});

const objectStamp = (id, label, image, elevation, defaultSize, placement = "stamp") => ({
  id,
  label,
  src: `/assets/world-map/${image}.png`,
  sourceType: "image",
  elevation,
  category: "город",
  placement,
  defaultSize,
});

export const DEFAULT_MAP_TEXTURES = [
  terrain("grass", "Зелёные луга", "grass", 0.13),
  terrain("meadow", "Цветущий луг", "meadow", 0.15),
  terrain("earth", "Грунтовая дорога", "earth", 0.06),
  terrain("sand", "Песок", "sand", 0.02),
  terrain("deep-water", "Глубокая вода", "deep-water", -0.2, "вода"),
  terrain("shallow-water", "Мелководье", "shallow-water", -0.12, "вода"),
  terrain("shore", "Берег", "shore", -0.01, "вода"),
  terrain("stone", "Камни", "stone", 0.17),
  terrain("forest", "Редкий лес", "forest", 0.23, "лес", "cluster", 0.52),
  terrain("dense-forest", "Хвойный лес", "dense-forest", 0.31, "лес", "cluster", 0.4),
  terrain("mixed-forest", "Смешанный лес · Kenney", "medieval-forest", 0.27, "лес", "cluster", 0.44),
  terrain("foothills", "Предгорья", "foothills", 0.48, "горы"),
  terrain("mountain", "Снежные горы", "mountain", 0.88, "горы"),
  terrain("village-ground", "Деревенские угодья", "village-ground", 0.15),
  terrain("city-ground", "Каменная площадь", "city-ground", 0.25, "город"),
  terrain("castle-ground", "Замковый двор", "castle-ground", 0.62, "город"),
  {
    ...objectStamp("village", "Посёлок", "city-stamp", 0.2, 0.16),
    category: "город",
  },
  objectStamp("city", "Город", "city-stamp", 0.25, 0.22),
  objectStamp("castle", "Замок", "castle-stamp", 0.62, 0.2),
  terrain("wheat", "Пшеничное поле", "wheat", 0.08),
  {
    ...objectStamp("tree", "Одиночное дерево", "pine-tree-stamp", 0.31, 0.08, "scatter"),
    category: "лес",
    footprint: "round",
  },
  {
    ...objectStamp("kenney-tree-01", "Ель · Kenney 1", "kenney-rts-medieval/medievalEnvironment_01", 0.31, 0.1, "scatter"),
    category: "лес",
    footprint: "round",
  },
  {
    ...objectStamp("kenney-tree-02", "Ель · Kenney 2", "kenney-rts-medieval/medievalEnvironment_02", 0.31, 0.085, "scatter"),
    category: "лес",
    footprint: "round",
  },
  {
    ...objectStamp("kenney-tree-03", "Ель · Kenney 3", "kenney-rts-medieval/medievalEnvironment_03", 0.31, 0.12, "scatter"),
    category: "лес",
    footprint: "round",
  },
  {
    ...objectStamp("kenney-bush", "Куст · Kenney", "kenney-rts-medieval/medievalEnvironment_12", 0.13, 0.075),
    category: "лес",
  },
  {
    ...objectStamp("kenney-berry-bush", "Ягодный куст · Kenney", "kenney-rts-medieval/medievalEnvironment_19", 0.13, 0.075),
    category: "лес",
  },
  objectStamp("kenney-rocks", "Камни · Kenney", "kenney-rts-medieval/medievalEnvironment_09", 0.19, 0.08),
  objectStamp("kenney-log", "Бревно · Kenney", "kenney-rts-medieval/medievalEnvironment_05", 0.02, 0.06),
  objectStamp("kenney-campfire", "Костёр · Kenney", "kenney-rts-medieval/medievalEnvironment_20", 0.04, 0.07),
];

const starterStroke = (id, textureId, size, points, opacity = 1) => ({
  id,
  textureId,
  size,
  opacity,
  kind: "brush",
  points: points.map(([x, y]) => ({ x, y })),
});

export function createStarterMapState() {
  return {
    version: 3,
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
    ],
    stamps: [
      { id: "starter-castle-stamp", textureId: "castle", x: 0.3, y: 0.34, size: 0.2, rotation: 0 },
      { id: "starter-town-stamp", textureId: "city", x: 0.5, y: 0.56, size: 0.22, rotation: 0 },
      { id: "starter-village-stamp", textureId: "village", x: 0.2, y: 0.68, size: 0.16, rotation: 0 },
    ],
    countries: [],
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

function normalizeStamps(stamps) {
  if (!Array.isArray(stamps)) return [];
  return stamps
    .filter((stamp) => stamp && typeof stamp.textureId === "string")
    .slice(-3000)
    .map((stamp, index) => ({
      id: String(stamp.id || `stamp-${index}`),
      textureId: stamp.textureId,
      x: Math.min(1.2, Math.max(-0.2, Number(stamp.x) || 0)),
      y: Math.min(1.2, Math.max(-0.2, Number(stamp.y) || 0)),
      size: Math.min(0.6, Math.max(0.015, Number(stamp.size) || 0.08)),
      rotation: Math.min(360, Math.max(-360, Number(stamp.rotation) || 0)),
      opacity: Math.min(1, Math.max(0.05, Number(stamp.opacity) || 1)),
    }));
}

function normalizeCountries(countries) {
  if (!Array.isArray(countries)) return [];
  let remainingPoints = 50_000;
  return countries
    .filter((country) => country && typeof country.name === "string" && Array.isArray(country.points))
    .slice(-100)
    .map((country, index) => {
      const points = country.points
        .slice(0, Math.min(3000, remainingPoints))
        .filter((point) => point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)))
        .map((point) => ({
          x: Math.min(1.2, Math.max(-0.2, Number(point.x))),
          y: Math.min(1.2, Math.max(-0.2, Number(point.y))),
        }));
      remainingPoints -= points.length;
      return {
        id: String(country.id || `country-${index}`),
        name: country.name.slice(0, 80),
        color: /^#[\da-f]{6}$/i.test(country.color || "") ? country.color : "#d9895b",
        points,
      };
    })
    .filter((country) => country.points.length >= 3);
}

function convertLegacyGrid(value, textures) {
  const oldWidth = Math.min(64, Math.max(8, Math.floor(Number(value.width) || 32)));
  const oldHeight = Math.min(64, Math.max(8, Math.floor(Number(value.height) || 24)));
  const strokes = [];
  const stamps = [];
  value.tiles.slice(0, oldWidth * oldHeight).forEach((textureId, index) => {
    if (textureId === "grass") return;
    const x = ((index % oldWidth) + 0.5) / oldWidth;
    const y = (Math.floor(index / oldWidth) + 0.5) / oldHeight;
    if (["city", "village", "castle"].includes(textureId)) {
      const texture = DEFAULT_MAP_TEXTURES.find((item) => item.id === textureId);
      stamps.push({
        id: `legacy-stamp-${index}`,
        textureId,
        x,
        y,
        size: texture?.defaultSize || 0.12,
        rotation: 0,
      });
      return;
    }
    strokes.push({
      id: `legacy-${index}`,
      textureId: typeof textureId === "string" ? textureId : "grass",
      size: Math.min(0.2, 1.15 / oldHeight),
      opacity: 1,
      kind: "brush",
      points: [{ x, y }],
      erase: false,
    });
  });
  return {
    version: 3,
    width: DEFAULT_MAP_WIDTH,
    height: DEFAULT_MAP_HEIGHT,
    baseTextureId: "grass",
    textures,
    strokes,
    stamps,
    countries: [],
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
  const stampsToNormalize = Array.isArray(value.stamps) ? [...value.stamps] : [];
  const terrainStrokes = [];
  value.strokes.slice(-2000).forEach((stroke, index) => {
    const objectTexture = DEFAULT_MAP_TEXTURES.find(
      (texture) => texture.placement === "stamp" && texture.id === stroke?.textureId,
    );
    const validPoints = Array.isArray(stroke?.points)
      ? stroke.points
          .slice(0, 5000)
          .filter((point) => point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)))
      : [];
    if (objectTexture && validPoints.length) {
      const point = validPoints[Math.floor(validPoints.length / 2)];
      stampsToNormalize.push({
        id: `${stroke.id || `legacy-object-${index}`}-stamp`,
        textureId: objectTexture.id,
        x: point.x,
        y: point.y,
        size: Number(stroke.size) >= 0.06 ? stroke.size : objectTexture.defaultSize,
        rotation: 0,
      });
    } else {
      terrainStrokes.push(stroke);
    }
  });
  let remainingPoints = 100_000;
  const strokes = terrainStrokes
    .filter((stroke) => stroke && typeof stroke.textureId === "string" && Array.isArray(stroke.points))
    .map((stroke, index) => {
      const points = stroke.points
        .slice(0, Math.min(5000, remainingPoints))
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
        kind: stroke.kind === "wall" ? "wall" : "brush",
        erase: Boolean(stroke.erase),
        points,
      };
    })
    .filter((stroke) => stroke.points.length > 0);

  return {
    version: 3,
    width,
    height,
    baseTextureId: typeof value.baseTextureId === "string" ? value.baseTextureId : "grass",
    textures,
    strokes,
    stamps: normalizeStamps(stampsToNormalize),
    countries: normalizeCountries(value.countries),
    cities: normalizeCities(value.cities, width, height),
  };
}

export function getMapTexture(textureId, customTextures = []) {
  const defaultTexture = DEFAULT_MAP_TEXTURES.find((texture) => texture.id === textureId);
  const customTexture = customTextures.find((texture) => texture.id === textureId);
  if (defaultTexture) return { ...defaultTexture, ...customTexture };
  return customTexture || DEFAULT_MAP_TEXTURES[0];
}

export function getAllMapTextures(customTextures = []) {
  const customById = new Map(customTextures.map((texture) => [texture.id, texture]));
  const defaults = DEFAULT_MAP_TEXTURES.map((texture) => ({
    ...texture,
    ...customById.get(texture.id),
  }));
  const extraTextures = customTextures.filter(
    (texture) => !DEFAULT_MAP_TEXTURES.some((defaultTexture) => defaultTexture.id === texture.id),
  );
  return [...defaults, ...extraTextures];
}
