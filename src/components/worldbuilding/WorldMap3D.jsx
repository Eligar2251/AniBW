import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getAllMapTextures } from "./mapTextures";
import { renderHeightMap, renderMapCanvas } from "./mapRenderer";

const NO_MARKERS = [];
const imageLoads = new Map();

function loadImage(src) {
  if (imageLoads.has(src)) return imageLoads.get(src);
  const promise = new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve([src, image]);
    image.onerror = () => resolve([src, null]);
    image.src = src;
  });
  imageLoads.set(src, promise);
  return promise;
}

function makeLabelSprite(text, color = "#f7e7c5") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = "rgba(9, 12, 15, 0.88)";
  context.strokeStyle = "rgba(220, 174, 88, 0.85)";
  context.lineWidth = 5;
  context.beginPath();
  context.roundRect(4, 4, 504, 120, 20);
  context.fill();
  context.stroke();
  context.fillStyle = color;
  context.font = "600 44px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(text || "").slice(0, 32), 256, 64, 470);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(Math.max(1.2, Math.min(4, String(text || "").length * 0.12 + 0.8)), 0.42, 1);
  return sprite;
}

function addMapPin(group, x, z, y, color, label, markerId) {
  const pinGroup = new THREE.Group();
  pinGroup.position.set(x, y, z);
  pinGroup.userData.mapMarkerId = markerId || null;
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.085, 0.42, 10), material);
  pin.position.y = 0.22;
  pin.userData.mapMarkerId = markerId || null;
  pinGroup.add(pin);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), material);
  bead.position.y = 0.48;
  bead.userData.mapMarkerId = markerId || null;
  pinGroup.add(bead);
  if (label) {
    const sprite = makeLabelSprite(label);
    sprite.position.y = 0.86;
    sprite.userData.mapMarkerId = markerId || null;
    pinGroup.add(sprite);
  }
  group.add(pinGroup);
}

function createHeightCanvas(mapState, previewStroke = null) {
  const canvas = document.createElement("canvas");
  const aspect = mapState.height / mapState.width;
  canvas.width = 512;
  canvas.height = Math.max(1, Math.round(canvas.width * aspect));
  const renderState = previewStroke
    ? { ...mapState, heightStrokes: [...(mapState.heightStrokes || []), previewStroke] }
    : mapState;
  renderHeightMap(canvas.getContext("2d"), renderState);
  return canvas;
}

function createTerrainGeometry(heightCanvas, mapWidth, mapDepth) {
  const context = heightCanvas.getContext("2d", { willReadFrequently: true });
  const pixels = context.getImageData(0, 0, heightCanvas.width, heightCanvas.height).data;
  const segmentsX = 256;
  const segmentsZ = Math.max(96, Math.round(segmentsX * mapDepth / mapWidth));
  const vertexCount = (segmentsX + 1) * (segmentsZ + 1);
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = new Uint32Array(segmentsX * segmentsZ * 6);
  const elevationAt = (u, v) => {
    const x = Math.min(heightCanvas.width - 1, Math.max(0, Math.round(u * (heightCanvas.width - 1))));
    const y = Math.min(heightCanvas.height - 1, Math.max(0, Math.round(v * (heightCanvas.height - 1))));
    const gray = pixels[(y * heightCanvas.width + x) * 4] / 255;
    return Math.max(-0.3, (gray * 1.2 - 0.25 + 0.22) * 2.8);
  };

  let vertex = 0;
  for (let row = 0; row <= segmentsZ; row += 1) {
    const v = row / segmentsZ;
    for (let column = 0; column <= segmentsX; column += 1) {
      const u = column / segmentsX;
      const offset = vertex * 3;
      positions[offset] = (u - 0.5) * mapWidth;
      positions[offset + 1] = elevationAt(u, v);
      positions[offset + 2] = (v - 0.5) * mapDepth;
      uvs[vertex * 2] = u;
      uvs[vertex * 2 + 1] = 1 - v;
      vertex += 1;
    }
  }

  let indexOffset = 0;
  for (let row = 0; row < segmentsZ; row += 1) {
    for (let column = 0; column < segmentsX; column += 1) {
      const topLeft = row * (segmentsX + 1) + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + segmentsX + 1;
      const bottomRight = bottomLeft + 1;
      indices[indexOffset++] = topLeft;
      indices[indexOffset++] = bottomLeft;
      indices[indexOffset++] = topRight;
      indices[indexOffset++] = topRight;
      indices[indexOffset++] = bottomLeft;
      indices[indexOffset++] = bottomRight;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return { geometry, elevationAt };
}

async function loadMapImages(mapState) {
  const textures = getAllMapTextures(mapState.textures || []);
  const sources = [...new Set(textures.map((texture) => texture.src).filter(Boolean))];
  return Object.fromEntries(await Promise.all(sources.map(loadImage)));
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => {
        material.map?.dispose?.();
        material.dispose?.();
      });
    } else if (child.material) {
      child.material.map?.dispose?.();
      child.material.dispose?.();
    }
  });
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function createId() {
  return `height-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
}

export default function WorldMap3D({
  mapState,
  markers = NO_MARKERS,
  onSelectMarker,
  editable = false,
  sculptMode = null,
  sculptSize = 0.05,
  sculptStrength = 0.04,
  sculptSmoothing = 0.72,
  onHeightStrokeComplete,
}) {
  const mountRef = useRef(null);
  const loadingRef = useRef(null);
  const sceneBundleRef = useRef(null);
  const mapDepthRef = useRef(1);
  const mapStateRef = useRef(mapState);
  const patternCacheRef = useRef(new Map());
  const propsRef = useRef({});
  const activeStrokeRef = useRef(null);
  const updateTokenRef = useRef(0);

  useEffect(() => {
    mapStateRef.current = mapState;
    propsRef.current = {
      markers,
      onSelectMarker,
      onHeightStrokeComplete,
      editable,
      sculptMode,
      sculptSize,
      sculptStrength,
      sculptSmoothing,
    };
  }, [editable, mapState, markers, onHeightStrokeComplete, onSelectMarker, sculptMode, sculptSize, sculptSmoothing, sculptStrength]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !mapStateRef.current) return undefined;

    let disposed = false;
    let frameId = 0;
    let previewFrameId = 0;
    let renderer;
    let controls;
    let terrain;
    let overlayGroup;
    let cursorRing;
    let floor;
    let colorMaterial;
    let camera;
    let scene;
    let mapWidth;
    let mapDepth;

    const scheduleRender = () => {
      if (disposed || frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        if (disposed) return;
        controls?.update();
        renderer?.render(scene, camera);
      });
    };

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      const message = document.createElement("p");
      message.className = "world-map-webgl-fallback";
      message.textContent = "3D-режим недоступен в этом браузере. Откройте карту в 2D.";
      mount.replaceChildren(message);
      if (loadingRef.current) loadingRef.current.hidden = true;
      return () => mount.replaceChildren();
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x0b1012, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    mount.replaceChildren(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", "Поворачиваемая трёхмерная карта мира");

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1012);
    scene.add(new THREE.HemisphereLight(0xe5f0ff, 0x463d2d, 2.1));
    const sun = new THREE.DirectionalLight(0xffe0a6, 2.2);
    sun.position.set(-24, 38, 30);
    scene.add(sun);

    mapWidth = 36;
    mapDepth = mapWidth * mapStateRef.current.height / mapStateRef.current.width;
    mapDepthRef.current = mapDepth;
    const mapExtent = Math.max(mapWidth, mapDepth);
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    camera.position.set(mapWidth * 0.8, mapExtent * 1.1, mapDepth * 1.1);
    camera.lookAt(0, 0.6, 0);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.target.set(0, 0.6, 0);
    controls.minDistance = mapExtent * 0.4;
    controls.maxDistance = mapExtent * 5;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.update();

    floor = new THREE.Mesh(
      new THREE.PlaneGeometry(mapWidth + 3, mapDepth + 3),
      new THREE.MeshStandardMaterial({ color: 0x18221d, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.36;
    scene.add(floor);

    colorMaterial = new THREE.MeshStandardMaterial({ color: 0x53634a, roughness: 1, metalness: 0 });
    terrain = new THREE.Mesh(new THREE.BufferGeometry(), colorMaterial);
    terrain.name = "world-map-terrain";
    terrain.frustumCulled = false;
    terrain.receiveShadow = false;
    scene.add(terrain);

    overlayGroup = new THREE.Group();
    overlayGroup.name = "world-map-overlays";
    scene.add(overlayGroup);

    const cursorMaterial = new THREE.MeshBasicMaterial({
      color: 0x9dd978,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthTest: true,
    });
    cursorRing = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48), cursorMaterial);
    cursorRing.rotation.x = -Math.PI / 2;
    cursorRing.visible = false;
    scene.add(cursorRing);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const getIntersection = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObject(terrain, false)[0] || null;
    };
    const getNormalizedPoint = (intersection) => ({
      x: clamp01(intersection.point.x / mapWidth + 0.5),
      y: clamp01(intersection.point.z / mapDepthRef.current + 0.5),
    });

    const updateCursor = (intersection) => {
      const props = propsRef.current;
      if (!props.editable || !props.sculptMode || !intersection) {
        cursorRing.visible = false;
        return;
      }
      cursorRing.visible = true;
      cursorRing.material.color.set(props.sculptMode === "lower" ? 0x69c7dc : 0x9dd978);
      cursorRing.position.set(
        intersection.point.x,
        intersection.point.y + 0.04,
        intersection.point.z,
      );
      cursorRing.scale.setScalar(Math.max(0.16, Number(props.sculptSize) * mapDepthRef.current));
    };

    const rebuildPreviewTerrain = () => {
      previewFrameId = 0;
      if (disposed || !activeStrokeRef.current) return;
      const currentMap = mapStateRef.current;
      const model = createTerrainGeometry(
        createHeightCanvas(currentMap, activeStrokeRef.current),
        mapWidth,
        mapDepthRef.current,
      );
      const oldGeometry = terrain.geometry;
      terrain.geometry = model.geometry;
      terrain.userData.elevationAt = model.elevationAt;
      oldGeometry.dispose();
      scheduleRender();
    };

    const schedulePreviewTerrain = () => {
      if (previewFrameId || disposed) return;
      previewFrameId = window.requestAnimationFrame(rebuildPreviewTerrain);
    };

    const pointerDown = { x: 0, y: 0 };
    const handlePointerDown = (event) => {
      pointerDown.x = event.clientX;
      pointerDown.y = event.clientY;
      const props = propsRef.current;
      if (!props.editable || !props.sculptMode || event.button !== 0) return;
      const intersection = getIntersection(event);
      if (!intersection) return;
      event.preventDefault();
      controls.enabled = false;
      renderer.domElement.setPointerCapture?.(event.pointerId);
      const point = getNormalizedPoint(intersection);
      const activeStroke = {
        id: createId(),
        pointerId: event.pointerId,
        mode: props.sculptMode === "lower" ? "lower" : "raise",
        size: Math.min(0.3, Math.max(0.006, Number(props.sculptSize) || 0.05)),
        strength: Math.min(0.18, Math.max(0.005, Number(props.sculptStrength) || 0.04)),
        smoothing: Math.min(1, Math.max(0, Number(props.sculptSmoothing) || 0)),
        points: [point],
        filteredPoint: point,
      };
      activeStrokeRef.current = activeStroke;
      updateCursor(intersection);
      schedulePreviewTerrain();
    };

    const handlePointerMove = (event) => {
      const activeStroke = activeStrokeRef.current;
      if (activeStroke && event.pointerId === activeStroke.pointerId) {
        const intersection = getIntersection(event);
        if (!intersection) return;
        const rawPoint = getNormalizedPoint(intersection);
        const smoothingFactor = 1 - Math.min(0.88, Math.max(0, activeStroke.smoothing) * 0.82);
        const point = {
          x: activeStroke.filteredPoint.x + (rawPoint.x - activeStroke.filteredPoint.x) * smoothingFactor,
          y: activeStroke.filteredPoint.y + (rawPoint.y - activeStroke.filteredPoint.y) * smoothingFactor,
        };
        activeStroke.filteredPoint = point;
        const previous = activeStroke.points[activeStroke.points.length - 1];
        const distance = Math.hypot(
          (point.x - previous.x) * mapStateRef.current.width,
          (point.y - previous.y) * mapStateRef.current.height,
        );
        if (distance >= 2.5 && activeStroke.points.length < 5000) {
          activeStroke.points.push(point);
          schedulePreviewTerrain();
        }
        updateCursor(intersection);
        return;
      }
      if (propsRef.current.sculptMode) {
        updateCursor(getIntersection(event));
        scheduleRender();
      } else if (cursorRing.visible) {
        cursorRing.visible = false;
        scheduleRender();
      }
    };

    const finishSculpt = (event, cancelled = false) => {
      const activeStroke = activeStrokeRef.current;
      if (!activeStroke || event.pointerId !== activeStroke.pointerId) return;
      const endIntersection = getIntersection(event);
      if (endIntersection) {
        const endPoint = getNormalizedPoint(endIntersection);
        const lastPoint = activeStroke.points[activeStroke.points.length - 1];
        const distance = Math.hypot(
          (endPoint.x - lastPoint.x) * mapStateRef.current.width,
          (endPoint.y - lastPoint.y) * mapStateRef.current.height,
        );
        if (distance > 0.5 && activeStroke.points.length < 5000) activeStroke.points.push(endPoint);
      }
      activeStrokeRef.current = null;
      controls.enabled = !(propsRef.current.editable && propsRef.current.sculptMode);
      if (previewFrameId) {
        window.cancelAnimationFrame(previewFrameId);
        previewFrameId = 0;
      }
      if (cancelled) {
        const model = createTerrainGeometry(createHeightCanvas(mapStateRef.current), mapWidth, mapDepthRef.current);
        const oldGeometry = terrain.geometry;
        terrain.geometry = model.geometry;
        terrain.userData.elevationAt = model.elevationAt;
        oldGeometry.dispose();
      } else {
        propsRef.current.onHeightStrokeComplete?.(activeStroke);
      }
      scheduleRender();
    };

    const handlePointerUp = (event) => finishSculpt(event, false);
    const handlePointerCancel = (event) => finishSculpt(event, true);
    const handleClickPointerDown = (event) => {
      if (activeStrokeRef.current) return;
      pointerDown.x = event.clientX;
      pointerDown.y = event.clientY;
    };
    const handlePointerUpSelection = (event) => {
      if (activeStrokeRef.current || propsRef.current.sculptMode) return;
      if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) return;
      const intersection = getIntersection(event);
      if (!intersection) return;
      const markerId = raycaster.intersectObjects(overlayGroup.children, true)
        .map((hit) => {
          let object = hit.object;
          while (object && object.userData.mapMarkerId == null) object = object.parent;
          return object?.userData.mapMarkerId;
        })
        .find((id) => id != null);
      if (markerId != null) propsRef.current.onSelectMarker?.(markerId);
    };

    renderer.domElement.addEventListener("pointerdown", handleClickPointerDown);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointerup", handlePointerUpSelection);
    renderer.domElement.addEventListener("pointercancel", handlePointerCancel);

    const resizeScene = () => {
      if (!renderer || disposed) return;
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      scheduleRender();
    };
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(resizeScene);
    if (resizeObserver) resizeObserver.observe(mount);
    else window.addEventListener("resize", resizeScene);
    resizeScene();

    sceneBundleRef.current = {
      renderer,
      scene,
      camera,
      controls,
      floor,
      terrain,
      overlayGroup,
      cursorRing,
      colorMaterial,
      mapWidth,
      mapDepth,
      scheduleRender,
    };

    return () => {
      disposed = true;
      updateTokenRef.current += 1;
      activeStrokeRef.current = null;
      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(previewFrameId);
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", resizeScene);
      renderer.domElement.removeEventListener("pointerdown", handleClickPointerDown);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointerup", handlePointerUpSelection);
      renderer.domElement.removeEventListener("pointercancel", handlePointerCancel);
      controls.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => {
          material.map?.dispose?.();
          material.dispose?.();
        });
        else if (object.material) {
          object.material.map?.dispose?.();
          object.material.dispose?.();
        }
      });
      renderer.dispose();
      sceneBundleRef.current = null;
      mount.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle || !mapState) return undefined;
    let cancelled = false;
    const token = updateTokenRef.current + 1;
    updateTokenRef.current = token;
    if (loadingRef.current) loadingRef.current.hidden = false;

    const nextMapDepth = bundle.mapWidth * mapState.height / mapState.width;
    if (Math.abs(nextMapDepth - bundle.mapDepth) > 0.001) {
      bundle.mapDepth = nextMapDepth;
      mapDepthRef.current = nextMapDepth;
      bundle.floor.geometry.dispose();
      bundle.floor.geometry = new THREE.PlaneGeometry(bundle.mapWidth + 3, nextMapDepth + 3);
    }

    const terrainModel = createTerrainGeometry(
      createHeightCanvas(mapState),
      bundle.mapWidth,
      bundle.mapDepth,
    );
    const previousGeometry = bundle.terrain.geometry;
    bundle.terrain.geometry = terrainModel.geometry;
    bundle.terrain.userData.elevationAt = terrainModel.elevationAt;
    previousGeometry.dispose();
    bundle.scheduleRender();

    loadMapImages(mapState).then((images) => {
      if (cancelled || token !== updateTokenRef.current) return;
      const colorCanvas = document.createElement("canvas");
      colorCanvas.width = mapState.width;
      colorCanvas.height = mapState.height;
      const colorContext = colorCanvas.getContext("2d");
      renderMapCanvas(colorContext, mapState, images, false, null, patternCacheRef.current);
      const colorTexture = new THREE.CanvasTexture(colorCanvas);
      colorTexture.colorSpace = THREE.SRGBColorSpace;
      colorTexture.anisotropy = Math.min(8, bundle.renderer.capabilities.getMaxAnisotropy());
      colorTexture.wrapS = THREE.ClampToEdgeWrapping;
      colorTexture.wrapT = THREE.ClampToEdgeWrapping;
      colorTexture.minFilter = THREE.LinearMipmapLinearFilter;
      colorTexture.magFilter = THREE.LinearFilter;
      const previousTexture = bundle.colorMaterial.map;
      bundle.colorMaterial.map = colorTexture;
      bundle.colorMaterial.needsUpdate = true;
      previousTexture?.dispose?.();

      disposeObject(bundle.overlayGroup);
      bundle.overlayGroup.clear();
      const pointHeight = (x, y) => bundle.terrain.userData.elevationAt?.(x, y) ?? 0;
      mapState.cities.forEach((city) => {
        addMapPin(
          bundle.overlayGroup,
          (city.x - 0.5) * bundle.mapWidth,
          (city.y - 0.5) * bundle.mapDepth,
          pointHeight(city.x, city.y),
          "#dcae58",
          city.name,
          null,
        );
      });
      (propsRef.current.markers || NO_MARKERS).forEach((marker) => {
        const x = clamp01(Number(marker.pos_x) / 100);
        const y = clamp01(Number(marker.pos_y) / 100);
        addMapPin(
          bundle.overlayGroup,
          (x - 0.5) * bundle.mapWidth,
          (y - 0.5) * bundle.mapDepth,
          pointHeight(x, y),
          marker.color || "#e8354a",
          marker.label,
          marker.id,
        );
      });
      if (loadingRef.current) loadingRef.current.hidden = true;
      bundle.scheduleRender();
    }).catch(() => {
      if (!cancelled && token === updateTokenRef.current && loadingRef.current) loadingRef.current.hidden = true;
    });

    return () => {
      cancelled = true;
    };
  }, [mapState, markers]);

  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle) return;
    bundle.controls.enabled = !(editable && sculptMode);
    if (!editable || !sculptMode) bundle.cursorRing.visible = false;
    bundle.scheduleRender();
  }, [editable, sculptMode, sculptSize]);

  return (
    <div className="world-map-3d-canvas">
      <div className="world-map-3d-stage" ref={mountRef} />
      <span ref={loadingRef} className="world-map-3d-loading">Формируем рельеф…</span>
      <span className="world-map-3d-hint">
        {editable && sculptMode
          ? `${sculptMode === "lower" ? "ЛКМ и тяните — углубить" : "ЛКМ и тяните — поднять рельеф"} · переключите режим для вращения`
          : "Зажмите и тяните, чтобы повернуть · колесо мыши — масштаб · правая кнопка — перемещение"}
      </span>
    </div>
  );
}
