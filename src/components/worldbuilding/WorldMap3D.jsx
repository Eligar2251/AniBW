import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getMapTexture } from "./mapTextures";

function loadTexture(loader, src) {
  return new Promise((resolve) => {
    loader.load(
      src,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        resolve(texture);
      },
      undefined,
      () => resolve(null),
    );
  });
}

function makeTileTexture(atlas, descriptor) {
  if (!atlas) return null;
  const texture = atlas.clone();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;

  if (descriptor.sourceType === "sheet") {
    const cols = Math.max(1, Number(descriptor.cols) || 1);
    const rows = Math.max(1, Number(descriptor.rows) || 1);
    const col = Math.min(cols - 1, Math.max(0, Number(descriptor.col) || 0));
    const row = Math.min(rows - 1, Math.max(0, Number(descriptor.row) || 0));
    texture.repeat.set(1 / cols, 1 / rows);
    texture.offset.set(col / cols, 1 - (row + 1) / rows);
  }
  texture.needsUpdate = true;
  return texture;
}

function makeLabelSprite(text, color = "#f7e7c5") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = "rgba(9, 12, 15, 0.84)";
  context.strokeStyle = "rgba(220, 174, 88, 0.8)";
  context.lineWidth = 5;
  context.beginPath();
  context.roundRect(4, 4, 504, 120, 20);
  context.fill();
  context.stroke();
  context.fillStyle = color;
  context.font = "600 44px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text.slice(0, 32), 256, 64, 470);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(Math.max(1.2, Math.min(4, text.length * 0.12 + 0.8)), 0.42, 1);
  return sprite;
}

function makeTextureMaterial(atlas, descriptor) {
  const texture = makeTileTexture(atlas, descriptor);
  return new THREE.MeshStandardMaterial({
    map: texture || null,
    color: texture ? "#ffffff" : "#62734f",
    roughness: 1,
    metalness: 0,
  });
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
  return group;
}

const NO_MARKERS = [];

export default function WorldMap3D({ mapState, markers = NO_MARKERS, onSelectMarker }) {
  const mountRef = useRef(null);
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
    const texturesToDispose = [];
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      const message = document.createElement("p");
      message.className = "world-map-webgl-fallback";
      message.textContent = "3D-режим недоступен в этом браузере. Откройте карту в 2D.";
      mount.replaceChildren(message);
      return () => mount.replaceChildren();
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x0b1012, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    mount.replaceChildren(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", "Поворачиваемая трёхмерная карта мира");

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1012);
    scene.fog = new THREE.Fog(0x0b1012, Math.max(mapState.width, mapState.height) * 2, Math.max(mapState.width, mapState.height) * 5);
    scene.add(new THREE.HemisphereLight(0xe5f0ff, 0x463d2d, 2.1));
    const sun = new THREE.DirectionalLight(0xffe0a6, 2.2);
    sun.position.set(-mapState.width * 0.4, mapState.height, mapState.height * 0.6);
    scene.add(sun);

    const aspect = Math.max(1, mount.clientWidth) / Math.max(1, mount.clientHeight);
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 1000);
    const mapExtent = Math.max(mapState.width, mapState.height);
    camera.position.set(mapState.width * 0.85, mapExtent * 1.05, mapState.height * 1.1);
    camera.lookAt(0, 0, 0);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.target.set(0, 0.1, 0);
    controls.minDistance = Math.max(5, mapExtent * 0.35);
    controls.maxDistance = mapExtent * 3.2;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.update();

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(mapState.width + 1, mapState.height + 1),
      new THREE.MeshStandardMaterial({ color: 0x18221d, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.09;
    scene.add(floor);

    const usedTextureIds = [...new Set(mapState.tiles)];
    const descriptors = [
      ...new Map(
        usedTextureIds.map((id) => {
          const descriptor = getMapTexture(id, mapState.textures || []);
          return [descriptor.id, descriptor];
        }),
      ).values(),
    ];
    const sources = [...new Set(descriptors.map((descriptor) => descriptor.src).filter(Boolean))];
    const textureLoad = Promise.all(sources.map(async (src) => [src, await loadTexture(loader, src)]));

    textureLoad.then((loadedSources) => {
      if (disposed) {
        loadedSources.forEach(([, texture]) => texture?.dispose());
        return;
      }
      const atlases = new Map(loadedSources);
      loadedSources.forEach(([, texture]) => texture && texturesToDispose.push(texture));
      const sideMaterial = new THREE.MeshStandardMaterial({ color: 0x3b4138, roughness: 1 });

      descriptors.forEach((descriptor) => {
        const indices = [];
        mapState.tiles.forEach((id, index) => {
          if (getMapTexture(id, mapState.textures || []).id === descriptor.id) {
            indices.push(index);
          }
        });
        if (indices.length === 0) return;

        const elevation = Math.max(0.08, Math.min(1.6, Number(descriptor.elevation) || 0.18));
        const atlas = atlases.get(descriptor.src);
        const topMaterial = makeTextureMaterial(atlas, descriptor);
        const tileGeometry = new THREE.BoxGeometry(0.985, 1, 0.985);
        const mesh = new THREE.InstancedMesh(
          tileGeometry,
          [sideMaterial, sideMaterial, topMaterial, sideMaterial, sideMaterial, sideMaterial],
          indices.length,
        );
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;

        const matrix = new THREE.Matrix4();
        indices.forEach((index, instanceIndex) => {
          const x = index % mapState.width;
          const z = Math.floor(index / mapState.width);
          const position = new THREE.Vector3(
            x - (mapState.width - 1) / 2,
            elevation / 2,
            z - (mapState.height - 1) / 2,
          );
          matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(1, elevation, 1));
          mesh.setMatrixAt(instanceIndex, matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        scene.add(mesh);
      });

      mapState.cities.forEach((city) => {
        const texture = getMapTexture(mapState.tiles[city.y * mapState.width + city.x], mapState.textures || []);
        const x = city.x - (mapState.width - 1) / 2;
        const z = city.y - (mapState.height - 1) / 2;
        const y = Number(texture.elevation) || 0.18;
        addMapPin(scene, x, z, y, "#dcae58", city.name, null);
      });

      markers.forEach((marker) => {
        const x = (Number(marker.pos_x) / 100) * (mapState.width - 1) - (mapState.width - 1) / 2;
        const z = (Number(marker.pos_y) / 100) * (mapState.height - 1) - (mapState.height - 1) / 2;
        const tileX = Math.max(0, Math.min(mapState.width - 1, Math.round(Number(marker.pos_x) / 100 * (mapState.width - 1))));
        const tileY = Math.max(0, Math.min(mapState.height - 1, Math.round(Number(marker.pos_y) / 100 * (mapState.height - 1))));
        const terrain = getMapTexture(mapState.tiles[tileY * mapState.width + tileX], mapState.textures || []);
        addMapPin(scene, x, z, Number(terrain.elevation) || 0.18, marker.color || "#e8354a", marker.label, marker.id);
      });
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

    const resizeScene = () => {
      if (!renderer || disposed) return;
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(resizeScene);

    const animate = () => {
      if (disposed) return;
      frameId = window.requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    if (resizeObserver) resizeObserver.observe(mount);
    else window.addEventListener("resize", resizeScene);
    resizeScene();
    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", resizeScene);
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
      texturesToDispose.forEach((resource) => resource?.dispose?.());
      renderer.dispose();
      mount.replaceChildren();
    };
  }, [mapState, markers]);

  return (
    <div className="world-map-3d-canvas">
      <div className="world-map-3d-stage" ref={mountRef} />
      <span className="world-map-3d-hint">Зажмите и тяните, чтобы повернуть · колесо мыши — масштаб · правая кнопка — перемещение</span>
    </div>
  );
}
