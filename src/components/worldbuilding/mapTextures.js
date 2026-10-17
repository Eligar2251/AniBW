export const DEFAULT_TILE_SHEET = "/assets/world-map-fantasy-tiles.png";
export const DEFAULT_MAP_WIDTH = 32;
export const DEFAULT_MAP_HEIGHT = 24;
export const MAP_CELL_SIZE = 40;

export const DEFAULT_MAP_TEXTURES = [
  { id: "grass", label: "Зелёные луга", col: 0, row: 0, elevation: 0.18, category: "земля" },
  { id: "meadow", label: "Цветущий луг", col: 1, row: 0, elevation: 0.2, category: "земля" },
  { id: "earth", label: "Грунтовая дорога", col: 2, row: 0, elevation: 0.18, category: "земля" },
  { id: "sand", label: "Песок", col: 3, row: 0, elevation: 0.16, category: "земля" },
  { id: "deep-water", label: "Глубокая вода", col: 0, row: 1, elevation: 0.1, category: "вода" },
  { id: "shallow-water", label: "Мелководье", col: 1, row: 1, elevation: 0.12, category: "вода" },
  { id: "shore", label: "Берег", col: 2, row: 1, elevation: 0.16, category: "вода" },
  { id: "stone", label: "Камни", col: 3, row: 1, elevation: 0.22, category: "земля" },
  { id: "forest", label: "Редкий лес", col: 0, row: 2, elevation: 0.32, category: "лес" },
  { id: "dense-forest", label: "Хвойный лес", col: 1, row: 2, elevation: 0.48, category: "лес" },
  { id: "foothills", label: "Предгорья", col: 2, row: 2, elevation: 0.62, category: "горы" },
  { id: "mountain", label: "Снежные горы", col: 3, row: 2, elevation: 1.15, category: "горы" },
  { id: "village", label: "Деревня", col: 0, row: 3, elevation: 0.34, category: "город" },
  { id: "city", label: "Город", col: 1, row: 3, elevation: 0.46, category: "город" },
  { id: "castle", label: "Замок", col: 2, row: 3, elevation: 0.8, category: "город" },
  { id: "wheat", label: "Пшеничное поле", col: 3, row: 3, elevation: 0.2, category: "земля" },
].map((texture) => ({
  ...texture,
  src: DEFAULT_TILE_SHEET,
  sourceType: "sheet",
  cols: 4,
  rows: 4,
}));

export const MAP_SIZE_PRESETS = [
  { label: "24 × 24", width: 24, height: 24 },
  { label: "32 × 24", width: 32, height: 24 },
  { label: "32 × 32", width: 32, height: 32 },
  { label: "48 × 32", width: 48, height: 32 },
  { label: "48 × 48", width: 48, height: 48 },
  { label: "64 × 48", width: 64, height: 48 },
];

const indexOf = (x, y, width) => y * width + x;

function emptyTiles(width, height, fill = "grass") {
  return Array(width * height).fill(fill);
}

export function createStarterMapState() {
  const width = DEFAULT_MAP_WIDTH;
  const height = DEFAULT_MAP_HEIGHT;
  const tiles = emptyTiles(width, height);
  const put = (x, y, id) => {
    if (x >= 0 && y >= 0 && x < width && y < height) {
      tiles[indexOf(x, y, width)] = id;
    }
  };

  // A coastline and shallow-water shelf make the starter useful immediately.
  for (let y = 0; y < height; y += 1) {
    const coast = 25 + Math.round(Math.sin(y * 0.42) * 1.5);
    for (let x = coast + 2; x < width; x += 1) put(x, y, "deep-water");
    for (let x = coast; x <= coast + 1; x += 1) put(x, y, "shallow-water");
    put(coast - 1, y, "shore");
    put(coast - 2, y, "sand");
  }

  // Mountain range in the north-west, with foothills around its base.
  for (let y = 2; y <= 7; y += 1) {
    for (let x = 4; x <= 12; x += 1) {
      const distance = Math.abs(x - 8) + Math.abs(y - 4);
      if (distance <= 4) put(x, y, distance <= 2 ? "mountain" : "foothills");
    }
  }

  // Forests and a dirt road connecting the settlement to the coast.
  for (let y = 12; y <= 19; y += 1) {
    for (let x = 3; x <= 8; x += 1) {
      if ((x + y) % 3 !== 0) put(x, y, (x + y) % 2 ? "forest" : "dense-forest");
    }
  }
  for (let y = 3; y <= 8; y += 1) {
    for (let x = 16; x <= 21; x += 1) {
      if ((x * y) % 4 !== 0) put(x, y, "forest");
    }
  }
  for (let x = 10; x <= 24; x += 1) {
    put(x, 13, "earth");
    if (x % 3 === 0) put(x, 14, "earth");
  }
  for (let x = 16; x <= 20; x += 1) {
    for (let y = 17; y <= 20; y += 1) put(x, y, "wheat");
  }
  put(11, 8, "castle");
  put(17, 12, "city");
  put(23, 15, "village");

  return {
    version: 1,
    width,
    height,
    tiles,
    textures: [],
    cities: [
      { id: "starter-city-elden", name: "Эльден", x: 17, y: 12, type: "city" },
      { id: "starter-village-wood", name: "Лесной Предел", x: 7, y: 18, type: "village" },
    ],
  };
}

export function normalizeMapState(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.tiles)) {
    return createStarterMapState();
  }

  const width = Math.min(64, Math.max(8, Math.floor(Number(value.width) || DEFAULT_MAP_WIDTH)));
  const height = Math.min(64, Math.max(8, Math.floor(Number(value.height) || DEFAULT_MAP_HEIGHT)));
  const size = width * height;
  const tiles = Array.from({ length: size }, (_, index) => {
    const id = value.tiles[index];
    return typeof id === "string" && id.length <= 100 ? id : "grass";
  });
  const textures = Array.isArray(value.textures)
    ? value.textures.filter(
        (texture) =>
          texture &&
          typeof texture.id === "string" &&
          typeof texture.src === "string" &&
          (texture.sourceType === "image" || texture.sourceType === "sheet"),
      )
        .slice(0, 256)
    : [];
  const cities = Array.isArray(value.cities)
    ? value.cities
        .filter((city) => city && typeof city.name === "string")
        .map((city) => ({
          id: String(city.id || `city-${Math.random().toString(36).slice(2, 9)}`),
          name: city.name.slice(0, 80),
          x: Math.min(width - 1, Math.max(0, Math.floor(Number(city.x) || 0))),
          y: Math.min(height - 1, Math.max(0, Math.floor(Number(city.y) || 0))),
          type: city.type === "village" ? "village" : "city",
        }))
    : [];

  return { version: 1, width, height, tiles, textures, cities };
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
