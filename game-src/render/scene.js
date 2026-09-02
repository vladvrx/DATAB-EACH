import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { BUILDINGS } from "../sim/buildings.js";

export class BeachScene {
  constructor(container, onPlotSelected, onTrashCleaned) {
    this.container = container;
    this.onPlotSelected = onPlotSelected;
    this.onTrashCleaned = onTrashCleaned;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#4ac6ff"); // Bright tropical sky
    this.scene.fog = new THREE.FogExp2("#57d2ff", 0.025);

    this.width = container.clientWidth || 390;
    this.height = container.clientHeight || 500;

    // Portrait diorama camera
    this.camera = new THREE.PerspectiveCamera(48, this.width / this.height, 0.5, 100);
    this.camera.position.set(0, 16, 17);
    this.camera.lookAt(0, -0.5, 0.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // Setup loaders with Draco support
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath("./vendor/draco/");
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(this.dracoLoader);

    this.modelCache = new Map();
    this.plotMeshes = new Map();
    this.buildingMeshes = new Map();
    this.trashMeshes = [];
    this.floatingTexts = [];

    this.selectedPlotId = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.setupLighting();
    this.setupEnvironment();
    this.setupInteraction();

    window.addEventListener("resize", () => this.onResize());
  }

  setupLighting() {
    const ambient = new THREE.AmbientLight("#e0f4ff", 1.4);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight("#ffe8c4", "#307a8c", 0.9);
    hemi.position.set(0, 20, 0);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight("#fff5db", 2.0);
    sun.position.set(12, 22, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 45;
    const d = 14;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    this.sunLight = sun;
  }

  setupEnvironment() {
    // Ocean plane
    const oceanGeo = new THREE.PlaneGeometry(80, 80, 24, 24);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: "#0888a8",
      roughness: 0.1,
      metalness: 0.2,
      flatShading: true
    });
    this.ocean = new THREE.Mesh(oceanGeo, oceanMat);
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.y = -0.6;
    this.scene.add(this.ocean);

    // Island Sand Mass (Main resort beach ground)
    const islandGeo = new THREE.CylinderGeometry(11.5, 13.5, 1.2, 32);
    const islandMat = new THREE.MeshStandardMaterial({
      color: "#f6d89b", // warm golden sand
      roughness: 0.8,
      metalness: 0.05
    });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.y = -0.55;
    island.receiveShadow = true;
    this.scene.add(island);

    // Raised inland ridge for power canopy
    const ridgeGeo = new THREE.BoxGeometry(16, 0.4, 3.8);
    const ridgeMat = new THREE.MeshStandardMaterial({
      color: "#e2bf7d",
      roughness: 0.9
    });
    const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridge.position.set(0, 0.15, -3.5);
    ridge.receiveShadow = true;
    this.scene.add(ridge);

    // Boardwalk strip
    const boardwalkGeo = new THREE.BoxGeometry(16, 0.08, 1.2);
    const boardwalkMat = new THREE.MeshStandardMaterial({
      color: "#a37042",
      roughness: 0.7
    });
    const boardwalk = new THREE.Mesh(boardwalkGeo, boardwalkMat);
    boardwalk.position.set(0, 0.05, 1.0);
    boardwalk.receiveShadow = true;
    this.scene.add(boardwalk);
  }

  setupPlots(plots) {
    plots.forEach((p) => {
      const plotGroup = new THREE.Group();
      plotGroup.position.set(p.x, 0.04, p.z);

      // Base tile
      const radius = p.type === "sand" ? 1.4 : 1.3;
      const tileGeo = new THREE.CylinderGeometry(radius, radius, 0.08, 16);
      const tileMat = new THREE.MeshStandardMaterial({
        color: p.type === "sand" ? "#ebd094" : p.type === "boardwalk" ? "#c98f59" : "#d1aa64",
        roughness: 0.6
      });
      const tileMesh = new THREE.Mesh(tileGeo, tileMat);
      tileMesh.receiveShadow = true;
      tileMesh.userData = { isPlot: true, plotId: p.id };
      plotGroup.add(tileMesh);

      // Selection Ring
      const ringGeo = new THREE.RingGeometry(radius + 0.05, radius + 0.25, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: "#00f0ff",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      plotGroup.add(ring);

      this.scene.add(plotGroup);
      this.plotMeshes.set(p.id, { group: plotGroup, tile: tileMesh, ring });
    });
  }

  selectPlot(plotId) {
    this.selectedPlotId = plotId;
    this.plotMeshes.forEach((meshObj, id) => {
      meshObj.ring.material.opacity = id === plotId ? 0.9 : 0;
      meshObj.ring.material.color.set(id === plotId ? "#00f0ff" : "#ffffff");
    });
  }

  async loadModel(url) {
    if (this.modelCache.has(url)) {
      return this.modelCache.get(url).clone();
    }
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          this.modelCache.set(url, model);
          resolve(model.clone());
        },
        undefined,
        (error) => {
          console.warn(`Could not load 3D model ${url}, using fallback geometry`, error);
          const fallback = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 1.2, 1.2),
            new THREE.MeshStandardMaterial({ color: "#00f0ff", roughness: 0.4 })
          );
          fallback.castShadow = true;
          resolve(fallback);
        }
      );
    });
  }

  async updateBuildingOnPlot(plotId, buildingData) {
    // Remove existing building mesh if present
    if (this.buildingMeshes.has(plotId)) {
      const oldGroup = this.buildingMeshes.get(plotId);
      this.scene.remove(oldGroup);
      this.buildingMeshes.delete(plotId);
    }

    if (!buildingData) return;

    const def = BUILDINGS[buildingData.type];
    if (!def) return;

    const plotObj = this.plotMeshes.get(plotId);
    if (!plotObj) return;

    const modelPath = `./reference/assets/${def.model}`;
    const model = await this.loadModel(modelPath);

    const bGroup = new THREE.Group();
    bGroup.position.copy(plotObj.group.position);
    bGroup.position.y = 0.08;

    const scale = def.scale || [1, 1, 1];
    model.scale.set(scale[0], scale[1], scale[2]);
    bGroup.add(model);

    // Pop-in bouncy scale animation
    bGroup.scale.set(0.1, 0.1, 0.1);
    let scaleProg = 0.1;
    const animatePop = () => {
      scaleProg += (1.0 - scaleProg) * 0.25;
      bGroup.scale.set(scaleProg, scaleProg, scaleProg);
      if (Math.abs(1.0 - scaleProg) > 0.01) {
        requestAnimationFrame(animatePop);
      } else {
        bGroup.scale.set(1, 1, 1);
      }
    };
    animatePop();

    // Level indicator ring if upgraded
    if (buildingData.level > 1) {
      const auraGeo = new THREE.RingGeometry(1.1, 1.3, 16);
      const auraMat = new THREE.MeshBasicMaterial({
        color: buildingData.level === 3 ? "#ffd700" : "#00ffcc",
        side: THREE.DoubleSide
      });
      const aura = new THREE.Mesh(auraGeo, auraMat);
      aura.rotation.x = -Math.PI / 2;
      aura.position.y = 0.02;
      bGroup.add(aura);
    }

    this.scene.add(bGroup);
    this.buildingMeshes.set(plotId, bGroup);
  }

  spawnTrash(x, z) {
    const trashGeo = new THREE.DodecahedronGeometry(0.35);
    const trashMat = new THREE.MeshStandardMaterial({
      color: "#ff3366",
      roughness: 0.3,
      emissive: "#66001a"
    });
    const trash = new THREE.Mesh(trashGeo, trashMat);
    trash.position.set(x, 0.3, z);
    trash.castShadow = true;
    trash.userData = { isTrash: true };
    this.scene.add(trash);
    this.trashMeshes.push(trash);
  }

  addFloatingText(text, x, y, z, color = "#00f0ff") {
    const el = document.createElement("div");
    el.className = "floating-number";
    el.textContent = text;
    el.style.color = color;
    document.body.appendChild(el);

    this.floatingTexts.push({
      el,
      pos: new THREE.Vector3(x, y + 1.2, z),
      life: 1.0
    });
  }

  setupInteraction() {
    const onPointerDown = (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const clientX = event.clientX || (event.touches && event.touches[0]?.clientX);
      const clientY = event.clientY || (event.touches && event.touches[0]?.clientY);
      if (clientX === undefined || clientY === undefined) return;

      this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.pointer, this.camera);
      const intersects = this.raycaster.intersectObjects(this.scene.children, true);

      for (const hit of intersects) {
        // Check trash tap
        if (hit.object.userData?.isTrash) {
          const idx = this.trashMeshes.indexOf(hit.object);
          if (idx !== -1) {
            this.scene.remove(hit.object);
            this.trashMeshes.splice(idx, 1);
            this.addFloatingText("+50 DB (Eco Boost!)", hit.point.x, hit.point.y, hit.point.z, "#10b981");
            if (this.onTrashCleaned) this.onTrashCleaned();
            return;
          }
        }

        // Check plot tap
        let cur = hit.object;
        while (cur && cur !== this.scene) {
          if (cur.userData?.isPlot) {
            this.selectPlot(cur.userData.plotId);
            if (this.onPlotSelected) this.onPlotSelected(cur.userData.plotId);
            return;
          }
          cur = cur.parent;
        }
      }
    };

    this.renderer.domElement.addEventListener("pointerdown", onPointerDown);
  }

  onResize() {
    this.width = this.container.clientWidth || 390;
    this.height = this.container.clientHeight || 500;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  render(time, isSurge = false) {
    // Gentle ocean wave motion
    if (this.ocean) {
      this.ocean.position.y = -0.6 + Math.sin(time * 1.5) * 0.05;
    }

    // Surge lighting pulse
    if (isSurge) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 8);
      this.scene.background.setRGB(0.2 + pulse * 0.3, 0.1, 0.35);
      this.sunLight.color.setRGB(1.0, 0.4 + pulse * 0.3, 0.4);
    } else {
      this.scene.background.set("#4ac6ff");
      this.sunLight.color.set("#fff5db");
    }

    // Rotate trash items gently
    for (const trash of this.trashMeshes) {
      trash.rotation.y += 0.02;
      trash.rotation.x += 0.01;
    }

    // Update floating HTML numbers
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const item = this.floatingTexts[i];
      item.life -= 0.025;
      item.pos.y += 0.03;

      const screenPos = item.pos.clone().project(this.camera);
      const x = (screenPos.x * 0.5 + 0.5) * this.width;
      const y = (-(screenPos.y * 0.5) + 0.5) * this.height;

      item.el.style.transform = `translate(${x}px, ${y}px)`;
      item.el.style.opacity = item.life;

      if (item.life <= 0) {
        item.el.remove();
        this.floatingTexts.splice(i, 1);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
