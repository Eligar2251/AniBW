import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getAllMapTextures } from "./mapTextures";
import { renderHeightMap, renderMapCanvas } from "./mapRenderer";

const NO_MARKERS = [];

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve([src, image]);
    image.onerror = () => resolve([src, null]);
    image.src = src;
  });
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

function addMapPin(scene, x, z, y, color, label, markerId) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.userData.mapMarkerId = markerId || null;
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.085, 0.42, 10), material);
  pin.position.y = 0.22;
  pin.userData.mapMarkerId = markerId || null;
  group.add(pin);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), material);
  bead.position.y = 0.48;
  bead.userData.mapMarkerId = markerId || null;
  group.add(bead);
  if (label) {
    const sprite = makeLabelSprite(label);
    sprite.position.y = 0.86;
    sprite.userData.mapMarkerId = markerId || null;
    group.add(sprite);
  }
  scene.add(group);
}

function createHeightCanvas(mapState) {
  const canvas = document.createElement("canvas");
  const aspect = mapState.height / mapState.width;
  canvas.width = 512;
  canvas.height = Math.max(1, Math.round(canvas.width * aspect));
  renderHeightMap(canvas.getContext("2d"), mapState);
  return canvas;
}

function createTerrainGeometry(heightCanvas, mapWidth, mapDepth) {
  const context = heightCanvas.getContext("2d", { willReadFrequently: true });
  const pixels = context.getImageData(0, 0, heightCanvas.width, heightCanvas.height).data;
  const segmentsX = 180;
  const segmentsZ = Math.max(64, Math.round(segmentsX * mapDepth / mapWidth));
  const vertexCount = (segmentsX + 1) * (segmentsZ + 1);
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = new Uint32Array(segmentsX * segmentsZ * 6);
  const elevationAt = (u, v) => {
    const x = Math.min(heightCanvas.width - 1, Math.max(0, Math.round(u * (heightCanvas.width - 1))));
    const y = Math.min(heightCanvas.height - 1, Math.max(0, Math.round(v * (heightCanvas.height - 1))));
    const gray = pixels[(y * heightCanvas.width + x) * 4] / 255;
    return Math.max(-0.18, (gray * 1.2 - 0.25 + 0.22) * 2.8);
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

export default function WorldMap3D({ mapState, markers = NO_MARKERS, onSelectMarker }) {
  const mountRef = useRef(null);
  const loadingRef = useRef(null);
  const selectMarkerRef = useRef(onSelectMarker);

  useEffect(() => {
    selectMarkerRef.current = onSelectMarker;
  }, [onSelectMarker]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !mapState) return undefined;

    let disposed = false;
    let frameId = 0;
    let renderer;
    let controls;
    let terrainGeometry = null;
    let terrainGeometryAttached = false;
    if (loadingRef.current) loadingRef.current.hidden = false;

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

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1012);
    scene.fog = new THREE.Fog(0x0b1012, 72, 190);
    scene.add(new THREE.HemisphereLight(0xe5f0ff, 0x463d2d, 2.1));
    const sun = new THREE.DirectionalLight(0xffe0a6, 2.2);
    sun.position.set(-24, 38, 30);
    scene.add(sun);

    const mapWidth = 36;
    const mapDepth = mapWidth * mapState.height / mapState.width;
    const mapExtent = Math.max(mapWidth, mapDepth);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    camera.position.set(mapWidth * 0.8, mapExtent * 1.1, mapDepth * 1.1);
    camera.lookAt(0, 0.6, 0);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.target.set(0, 0.6, 0);
    controls.minDistance = mapExtent * 0.55;
    controls.maxDistance = mapExtent * 4.5;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.update();

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(mapWidth + 3, mapDepth + 3),
      new THREE.MeshStandardMaterial({ color: 0x18221d, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.28;
    scene.add(floor);

    const heightCanvas = createHeightCanvas(mapState);
    const terrainModel = createTerrainGeometry(heightCanvas, mapWidth, mapDepth);
    terrainGeometry = terrainModel.geometry;
    const { elevationAt } = terrainModel;

    loadMapImages(mapState).then((images) => {
      if (disposed) {
        terrainGeometry?.dispose();
        terrainGeometry = null;
        return;
      }
      const colorCanvas = document.createElement("canvas");
      colorCanvas.width = mapState.width;
      colorCanvas.height = mapState.height;
      const colorContext = colorCanvas.getContext("2d");
      renderMapCanvas(colorContext, mapState, images, false);
      const colorTexture = new THREE.CanvasTexture(colorCanvas);
      colorTexture.colorSpace = THREE.SRGBColorSpace;
      colorTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      colorTexture.wrapS = THREE.ClampToEdgeWrapping;
      colorTexture.wrapT = THREE.ClampToEdgeWrapping;
      colorTexture.minFilter = THREE.LinearMipmapLinearFilter;
      colorTexture.magFilter = THREE.LinearFilter;

      const terrain = new THREE.Mesh(
        terrainGeometry,
        new THREE.MeshStandardMaterial({ map: colorTexture, roughness: 1, metalness: 0 }),
      );
      terrain.receiveShadow = false;
      terrain.frustumCulled = false;
      scene.add(terrain);
      terrainGeometryAttached = true;

      const pointHeight = (x, y) => elevationAt(x, y);
      mapState.cities.forEach((city) => {
        addMapPin(
          scene,
          (city.x - 0.5) * mapWidth,
          (city.y - 0.5) * mapDepth,
          pointHeight(city.x, city.y),
          "#dcae58",
          city.name,
          null,
        );
      });

      markers.forEach((marker) => {
        const x = Math.min(1, Math.max(0, Number(marker.pos_x) / 100));
        const y = Math.min(1, Math.max(0, Number(marker.pos_y) / 100));
        addMapPin(
          scene,
          (x - 0.5) * mapWidth,
          (y - 0.5) * mapDepth,
          pointHeight(x, y),
          marker.color || "#e8354a",
          marker.label,
          marker.id,
        );
      });
      if (loadingRef.current) loadingRef.current.hidden = true;
      scheduleRender();
    }).catch(() => {
      if (!terrainGeometryAttached) {
        terrainGeometry?.dispose();
        terrainGeometry = null;
      }
      if (!disposed && loadingRef.current) loadingRef.current.hidden = true;
    });

    const pointerDown = { x: 0, y: 0 };
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handlePointerDown = (event) => {
      pointerDown.x = event.clientX;
      pointerDown.y = event.clientY;
    };
    const handlePointerUp = (event) => {
      if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const markerId = raycaster.intersectObjects(scene.children, true)
        .map((intersection) => {
          let object = intersection.object;
          while (object && !object.userData.mapMarkerId) object = object.parent;
          return object?.userData.mapMarkerId;
        })
        .find(Boolean);
      if (markerId) selectMarkerRef.current?.(markerId);
    };
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);

    const scheduleRender = () => {
      if (disposed || frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        if (disposed) return;
        controls.update();
        renderer.render(scene, camera);
      });
    };
    controls.addEventListener("change", scheduleRender);

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

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", resizeScene);
      controls.removeEventListener("change", scheduleRender);
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        const releaseMaterial = (material) => {
          material.map?.dispose?.();
          material.dispose?.();
        };
        if (Array.isArray(object.material)) object.material.forEach(releaseMaterial);
        else if (object.material) releaseMaterial(object.material);
      });
      if (!terrainGeometryAttached) {
        terrainGeometry?.dispose();
        terrainGeometry = null;
      }
      renderer.dispose();
      mount.replaceChildren();
    };
  }, [mapState, markers]);

  return (
    <div className="world-map-3d-canvas">
      <div className="world-map-3d-stage" ref={mountRef} />
      <span ref={loadingRef} className="world-map-3d-loading">Формируем рельеф…</span>
      <span className="world-map-3d-hint">Зажмите и тяните, чтобы повернуть · колесо мыши — масштаб · правая кнопка — перемещение</span>
    </div>
  );
}
