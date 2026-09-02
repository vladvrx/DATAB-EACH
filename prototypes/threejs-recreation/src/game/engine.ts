import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import {
  ANIMATION_FRAMES,
  ASSETS,
  COVE_MANIFEST,
  NPC_IDLE_ANIMATION,
  PLAYER_COLORS,
  QUEST_BY_NPC,
  QUESTS,
  actorPosition,
  actorQuaternion,
  actorScale,
  type AnimationName,
  type IslandActor,
  type QuestId,
} from "./data";
import { GameAudio } from "./audio";
import { GameStore, type GameSave } from "./state";

type DialogueAction = {
  id: string;
  label: string;
  primary?: boolean;
};

export type GameDialogue = {
  speaker: string;
  text: string;
  actions: DialogueAction[];
};

export type RaceStatus = {
  active: boolean;
  checkpoint: number;
  total: number;
  elapsed: number;
};

export type GameCallbacks = {
  onProgress: (progress: number, label: string) => void;
  onReady: () => void;
  onState: (state: GameSave) => void;
  onPrompt: (label: string | null) => void;
  onDialogue: (dialogue: GameDialogue | null) => void;
  onRace: (race: RaceStatus) => void;
  onToast: (message: string) => void;
  onError: (message: string) => void;
};

type InteractableType =
  | "npc"
  | "chest"
  | "house"
  | "bridge"
  | "sick"
  | "decor";

type Interactable = {
  id: string;
  type: InteractableType;
  label: string;
  object: THREE.Object3D;
  subtype?: string;
  radius: number;
};

type AssetMap = Record<string, string>;

const PLAYER_SPEED = 5.7;
const PLAYER_RUN_SPEED = 8.4;
const CAMERA_DISTANCE = 8.5;
const CAMERA_HEIGHT = 1.25;
const UP = new THREE.Vector3(0, 1, 0);

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function assetColor(assetName: string) {
  if (/tree|bush|flower|mushroom|plant/i.test(assetName)) return 0x51b96d;
  if (/rock|wall|pillar|concret|pavement|stairs|ground/i.test(assetName)) return 0x79758f;
  if (/beach|towel|umbrella|sand/i.test(assetName)) return 0xf2c973;
  if (/water|boat|ship|pontoon|floating/i.test(assetName)) return 0x5bc4d9;
  if (/house|building|shop|hospital|bar|truck|bus/i.test(assetName)) return 0xe58e7e;
  const hue = (hashString(assetName) % 360) / 360;
  return new THREE.Color().setHSL(hue, 0.52, 0.62).getHex();
}

function setObjectMaterial(root: THREE.Object3D, assetName: string) {
  const color = assetColor(assetName);
  root.traverse((node) => {
    if (!node.name.toLowerCase().includes("collider") && node instanceof THREE.Mesh) {
      const source = Array.isArray(node.material) ? node.material[0] : node.material;
      if (!source || (!source.map && source.color?.getHex() === 0xffffff)) {
        node.material = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.76,
          metalness: /bike|car|light|bus|ship/i.test(assetName) ? 0.16 : 0,
          flatShading: true,
        });
      }
      node.castShadow = !/tree|bush|flower/i.test(assetName);
      node.receiveShadow = true;
    }
    if (node.name.toLowerCase().includes("collider")) node.visible = false;
  });
}

function applyActorTransform(object: THREE.Object3D, actor: IslandActor) {
  object.position.fromArray(actorPosition(actor));
  object.scale.fromArray(actorScale(actor));
  object.quaternion.fromArray(actorQuaternion(actor));
}

function normalizeCharacter(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const height = Math.max(1, box.max.y - box.min.y);
  const scalar = 1.72 / height;
  model.scale.setScalar(scalar);
  model.updateMatrixWorld(true);
  const scaled = new THREE.Box3().setFromObject(model);
  model.position.y -= scaled.min.y;
}

class CharacterRig {
  readonly group = new THREE.Group();
  readonly model: THREE.Object3D;
  readonly mixer: THREE.AnimationMixer;
  readonly actions = new Map<AnimationName, THREE.AnimationAction>();
  private current: AnimationName | null = null;
  private bodyMaterials: THREE.MeshStandardMaterial[] = [];

  constructor(template: GLTF, colorIndex: number) {
    this.model = cloneSkeleton(template.scene);
    normalizeCharacter(this.model);
    this.group.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);

    const sourceClip = template.animations[0];
    if (sourceClip) {
      for (const [name, [start, end]] of Object.entries(ANIMATION_FRAMES) as [
        AnimationName,
        readonly [number, number],
      ][]) {
        const clip = THREE.AnimationUtils.subclip(sourceClip, name, start, end, 30);
        const action = this.mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
        if (name === "Walk") action.timeScale = 0.9792;
        if (name === "Run") action.timeScale = 0.9888;
        this.actions.set(name, action);
      }
    }

    this.model.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
      const lowerName = node.name.toLowerCase();
      const color = lowerName.includes("bouche")
        ? 0x251b35
        : lowerName.includes("oeil")
          ? 0xf6fff4
          : PLAYER_COLORS[colorIndex % PLAYER_COLORS.length].body;
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: lowerName.includes("oeil") ? 0.28 : 0.72,
        metalness: 0,
        flatShading: false,
      });
      node.material = material;
      if (lowerName.includes("body")) this.bodyMaterials.push(material);
    });

    this.setColor(colorIndex);
    this.play("Idle", 0);
  }

  setColor(index: number) {
    const palette = PLAYER_COLORS[index % PLAYER_COLORS.length];
    for (const material of this.bodyMaterials) {
      material.color.set(palette.body);
      material.emissive.set(palette.accent);
      material.emissiveIntensity = 0.08;
    }
  }

  play(name: AnimationName, fade = 0.18) {
    if (this.current === name) return;
    const next = this.actions.get(name);
    if (!next) return;
    const previous = this.current ? this.actions.get(this.current) : null;
    next.reset().fadeIn(fade).play();
    previous?.fadeOut(fade);
    this.current = name;
  }

  update(delta: number) {
    this.mixer.update(delta);
  }
}

export class ThreeGameEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly callbacks: GameCallbacks;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.08, 700);
  private readonly clock = new THREE.Clock();
  private readonly loader = new GLTFLoader();
  private readonly draco = new DRACOLoader();
  private readonly store = new GameStore();
  private readonly audio = new GameAudio();
  private readonly keys = new Set<string>();
  private readonly mixers: CharacterRig[] = [];
  private readonly interactables: Interactable[] = [];
  private readonly terrainMeshes: THREE.Mesh[] = [];
  private readonly assetCache = new Map<string, Promise<GLTF>>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly moveVector = new THREE.Vector2();
  private readonly cameraTarget = new THREE.Vector3();
  private readonly desiredCamera = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly movement = new THREE.Vector3();
  private readonly sampleOrigin = new THREE.Vector3();
  private readonly raceCheckpoints: THREE.Mesh[] = [];
  private resizeObserver: ResizeObserver;
  private player: CharacterRig | null = null;
  private playerRoot = new THREE.Group();
  private assetMap: AssetMap = {};
  private nearest: Interactable | null = null;
  private cameraYaw = Math.PI * 0.72;
  private cameraPitch = 0.58;
  private dragPointer: number | null = null;
  private dragX = 0;
  private dragY = 0;
  private interactQueued = false;
  private disposed = false;
  private paused = false;
  private saveTimer = 0;
  private gamepadInteractPressed = false;
  private race = { active: false, checkpoint: 0, elapsed: 0 };

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.draco.setDecoderPath("/vendors/draco/");
    this.draco.preload();
    this.loader.setDRACOLoader(this.draco);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.bindInput();
  }

  async start() {
    try {
      this.callbacks.onProgress(1, "Starting Three.js");
      this.createLighting();
      this.createOceanAndSky();
      this.assetMap = await this.loadAssetMap();
      const [characterTemplate] = await Promise.all([
        this.loader.loadAsync(ASSETS.character),
        this.loadWorld(),
      ]);
      await this.createActors(characterTemplate);
      this.createPlayer(characterTemplate);
      this.createRaceRoute();
      this.restoreDynamicState();
      this.resize();
      this.callbacks.onState(this.store.snapshot());
      this.callbacks.onProgress(100, "Cove ready");
      this.callbacks.onReady();
      this.renderer.setAnimationLoop(() => this.frame());
    } catch (error) {
      console.error(error);
      this.callbacks.onError(error instanceof Error ? error.message : "The Three.js game failed to start");
    }
  }

  private createLighting() {
    this.scene.background = new THREE.Color(0x080e2a);
    this.scene.fog = new THREE.FogExp2(0x101934, 0.0062);
    const hemisphere = new THREE.HemisphereLight(0x99c9ff, 0x2f2140, 1.85);
    this.scene.add(hemisphere);
    const moon = new THREE.DirectionalLight(0xc9dcff, 3.1);
    moon.position.set(-65, 120, -40);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -90;
    moon.shadow.camera.right = 90;
    moon.shadow.camera.top = 90;
    moon.shadow.camera.bottom = -90;
    moon.shadow.camera.near = 10;
    moon.shadow.camera.far = 280;
    moon.shadow.bias = -0.00018;
    moon.shadow.normalBias = 0.04;
    this.scene.add(moon);
  }

  private createOceanAndSky() {
    const ocean = new THREE.Mesh(
      new THREE.CircleGeometry(520, 96),
      new THREE.MeshPhysicalMaterial({
        color: 0x174b80,
        roughness: 0.28,
        metalness: 0.08,
        transparent: true,
        opacity: 0.88,
        clearcoat: 0.35,
      }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(-90, 0.04, 85);
    ocean.receiveShadow = true;
    this.scene.add(ocean);

    const starCount = 1250;
    const positions = new Float32Array(starCount * 3);
    for (let index = 0; index < starCount; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 230 + Math.random() * 220;
      const height = 55 + Math.random() * 220;
      positions[index * 3] = -90 + Math.cos(angle) * radius;
      positions[index * 3 + 1] = height;
      positions[index * 3 + 2] = 85 + Math.sin(angle) * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0xdceaff, size: 0.75, sizeAttenuation: true }),
    );
    this.scene.add(stars);
  }

  private async loadAssetMap() {
    const response = await fetch(ASSETS.logicalMap);
    if (!response.ok) throw new Error(`Asset map failed with ${response.status}`);
    const logical = (await response.json()) as Record<string, string>;
    const map: AssetMap = {};
    for (const [source, target] of Object.entries(logical)) {
      const match = source.match(/Asset_(.+)\.glb$/);
      if (match) map[match[1]] = target;
    }
    return map;
  }

  private loadAsset(name: string) {
    const url = this.assetMap[name];
    if (!url) return Promise.reject(new Error(`Missing asset mapping for ${name}`));
    let promise = this.assetCache.get(name);
    if (!promise) {
      promise = this.loader.loadAsync(url);
      this.assetCache.set(name, promise);
    }
    return promise;
  }

  private async loadWorld() {
    this.callbacks.onProgress(4, "Loading Cove terrain");
    const layout = await this.loader.loadAsync(ASSETS.island);
    this.scene.add(layout.scene);
    const terrainTexture = await new THREE.TextureLoader().loadAsync(ASSETS.terrain);
    terrainTexture.colorSpace = THREE.SRGBColorSpace;
    terrainTexture.flipY = false;

    layout.scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.name === "SceneCollider") {
        node.visible = false;
        this.terrainMeshes.push(node);
      }
      if (node.name === "SceneBase") {
        node.material = new THREE.MeshStandardMaterial({
          map: terrainTexture,
          color: 0xffffff,
          roughness: 0.91,
          metalness: 0,
        });
        node.receiveShadow = true;
        this.terrainMeshes.push(node);
      }
    });

    const markers: THREE.Object3D[] = [];
    layout.scene.traverse((node) => {
      if (typeof node.userData.asset === "string") markers.push(node);
    });
    const uniqueAssets = [...new Set(markers.map((marker) => marker.userData.asset as string))];
    const loaded = new Map<string, THREE.Object3D>();
    let complete = 0;
    await this.parallel(uniqueAssets, 7, async (name) => {
      try {
        const gltf = await this.loadAsset(name);
        loaded.set(name, gltf.scene);
      } catch (error) {
        console.warn(`Skipping ${name}`, error);
      } finally {
        complete += 1;
        this.callbacks.onProgress(
          8 + Math.round((complete / uniqueAssets.length) * 55),
          `Loading Cove props ${complete}/${uniqueAssets.length}`,
        );
      }
    });

    for (const marker of markers) {
      const name = marker.userData.asset as string;
      const template = loaded.get(name);
      if (!template) continue;
      const object = template.clone(true);
      setObjectMaterial(object, name);
      marker.add(object);
    }
  }

  private async parallel<T>(items: T[], concurrency: number, run: (item: T) => Promise<void>) {
    let index = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const current = items[index];
        index += 1;
        await run(current);
      }
    });
    await Promise.all(workers);
  }

  private async createActors(characterTemplate: GLTF) {
    const actors = COVE_MANIFEST.actors;
    let complete = 0;
    for (const actor of actors) {
      if (actor.type === "NPC") {
        const subtype = actor.params?.subtype ?? actor.uid;
        const palette = hashString(subtype) % PLAYER_COLORS.length;
        const rig = new CharacterRig(characterTemplate, palette);
        applyActorTransform(rig.group, actor);
        const animation = NPC_IDLE_ANIMATION[subtype] ?? (hashString(subtype) % 3 === 0 ? "Idle2" : "Idle");
        rig.play(animation, 0);
        this.scene.add(rig.group);
        this.mixers.push(rig);
        const isSick = subtype.startsWith("Zenda_Sick");
        this.interactables.push({
          id: actor.uid,
          type: isSick ? "sick" : "npc",
          label: QUEST_BY_NPC[subtype] ? `Talk to ${QUESTS[QUEST_BY_NPC[subtype]].company}` : "Talk",
          object: rig.group,
          subtype,
          radius: 4.2,
        });
      } else {
        await this.createActorModel(actor);
      }
      complete += 1;
      this.callbacks.onProgress(64 + Math.round((complete / actors.length) * 27), `Creating actors ${complete}/${actors.length}`);
    }
  }

  private actorAssetName(type: string) {
    const names: Record<string, string> = {
      Chest: "Chest",
      ChestBig: "ChestBig",
      AvenHouse: "TechCompany03HouseOff",
      BrokenBridge: "BridgeOff",
      GrowableTree: "GrowableTreeSmall",
      Speakers: "Speakers",
      ShopForSale: "ShopForSaleBase",
      Telescope: "Telescope",
      Zipline: "Zipline",
    };
    return names[type] ?? null;
  }

  private async createActorModel(actor: IslandActor) {
    const name = this.actorAssetName(actor.type);
    if (!name || !this.assetMap[name]) return;
    try {
      const gltf = await this.loadAsset(name);
      const object = gltf.scene.clone(true);
      setObjectMaterial(object, name);
      applyActorTransform(object, actor);
      this.scene.add(object);
      if (actor.type === "Chest" || actor.type === "ChestBig") {
        this.interactables.push({ id: actor.uid, type: "chest", label: "Open chest", object, radius: 3.5 });
      } else if (actor.type === "AvenHouse") {
        this.interactables.push({ id: actor.uid, type: "house", label: "Restore house", object, radius: 5.2 });
      } else if (actor.type === "BrokenBridge") {
        this.interactables.push({ id: actor.uid, type: "bridge", label: "Repair bridge", object, radius: 5.5 });
      }
    } catch (error) {
      console.warn(`Actor ${actor.uid} could not load`, error);
    }
  }

  private createPlayer(template: GLTF) {
    const state = this.store.state;
    this.player = new CharacterRig(template, state.colorIndex);
    this.playerRoot = this.player.group;
    this.playerRoot.name = "Player";
    const spawn = state.position ?? COVE_MANIFEST.points["Spawn.001"].slice(0, 3) as [number, number, number];
    this.playerRoot.position.fromArray(spawn);
    const rotation = COVE_MANIFEST.points["Spawn.001"].slice(6, 10) as [number, number, number, number];
    this.playerRoot.quaternion.fromArray(rotation);
    this.scene.add(this.playerRoot);
    this.mixers.push(this.player);
    this.cameraTarget.copy(this.playerRoot.position).addScaledVector(UP, CAMERA_HEIGHT);
    this.positionCamera(true);
  }

  private createRaceRoute() {
    const route: [number, number, number][] = [
      [-64.4, 11.1, 105.5],
      [-54, 10.5, 92],
      [-43, 10.5, 76],
      [-58, 10.5, 67],
      [-80, 10.5, 79],
      [-84, 10.5, 99],
      [-74.7, 10.6, 109.3],
    ];
    for (const [index, position] of route.entries()) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.15, 0.18, 10, 34),
        new THREE.MeshStandardMaterial({
          color: index === 0 ? 0x55e6ae : 0x8b79ff,
          emissive: index === 0 ? 0x55e6ae : 0x4f3fff,
          emissiveIntensity: 2.1,
          roughness: 0.25,
        }),
      );
      ring.position.fromArray(position);
      ring.visible = false;
      this.scene.add(ring);
      this.raceCheckpoints.push(ring);
    }
  }

  private restoreDynamicState() {
    const state = this.store.state;
    for (const interactable of this.interactables) {
      if (interactable.type === "chest" && state.openedChests.includes(interactable.id)) {
        interactable.object.visible = false;
      }
      if (interactable.type === "house" && state.repairedHouses.includes(interactable.id)) {
        this.tintObject(interactable.object, 0x5de6ad);
      }
      if (interactable.type === "bridge" && state.bridgeRepaired) {
        this.tintObject(interactable.object, 0x5de6ad);
      }
      if (interactable.type === "sick" && state.healedCitizens.includes(interactable.id)) {
        this.tintObject(interactable.object, 0x5de6ad);
      }
    }
  }

  private tintObject(object: THREE.Object3D, color: number) {
    object.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const source of materials) {
        if (!(source instanceof THREE.MeshStandardMaterial)) continue;
        const material = source.clone();
        material.emissive.set(color);
        material.emissiveIntensity = 0.22;
        node.material = material;
      }
    });
  }

  private bindInput() {
    const onKeyDown = (event: KeyboardEvent) => {
      this.keys.add(event.code);
      if (event.code === "KeyE" || event.code === "Space") {
        event.preventDefault();
        this.interactQueued = true;
      }
      if (event.code === "Escape") this.callbacks.onDialogue(null);
    };
    const onKeyUp = (event: KeyboardEvent) => this.keys.delete(event.code);
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      this.dragPointer = event.pointerId;
      this.dragX = event.clientX;
      this.dragY = event.clientY;
      this.canvas.setPointerCapture(event.pointerId);
      void this.audio.unlock();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (this.dragPointer !== event.pointerId) return;
      const dx = event.clientX - this.dragX;
      const dy = event.clientY - this.dragY;
      this.dragX = event.clientX;
      this.dragY = event.clientY;
      this.cameraYaw -= dx * 0.006;
      this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + dy * 0.0045, 0.2, 1.12);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (this.dragPointer === event.pointerId) this.dragPointer = null;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    this.canvas.addEventListener("pointerdown", onPointerDown);
    this.canvas.addEventListener("pointermove", onPointerMove);
    this.canvas.addEventListener("pointerup", onPointerUp);
    this.canvas.addEventListener("pointercancel", onPointerUp);
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.canvas.dataset.bound = "true";
    Object.assign(this.canvas, {
      __disposeInput: () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        this.canvas.removeEventListener("pointerdown", onPointerDown);
        this.canvas.removeEventListener("pointermove", onPointerMove);
        this.canvas.removeEventListener("pointerup", onPointerUp);
        this.canvas.removeEventListener("pointercancel", onPointerUp);
      },
    });
  }

  setMoveInput(x: number, y: number) {
    this.moveVector.set(x, y).clampLength(0, 1);
    void this.audio.unlock();
  }

  queueInteract() {
    this.interactQueued = true;
    this.audio.playUi();
    void this.audio.unlock();
  }

  setPaused(paused: boolean) {
    this.paused = paused;
  }

  setColor(index: number) {
    this.player?.setColor(index);
    this.store.update((state) => {
      state.colorIndex = index;
    });
    this.callbacks.onToast(`Color changed to ${PLAYER_COLORS[index].id}`);
  }

  handleDialogueAction(actionId: string) {
    if (actionId === "close") {
      this.callbacks.onDialogue(null);
      this.audio.setDialogueDucking(false);
      return;
    }
    if (actionId.startsWith("accept:")) {
      const questId = actionId.slice(7) as QuestId;
      const quest = QUESTS[questId];
      this.store.update((state) => {
        state.acceptedQuests.push(questId);
        if (quest.item) state.inventory.push(quest.item);
      });
      this.callbacks.onState(this.store.snapshot());
      this.callbacks.onDialogue(null);
      this.callbacks.onToast(quest.item ? `${quest.item} added. ${quest.objective}.` : quest.objective);
      this.audio.setDialogueDucking(false);
      if (questId === "BrigitMain") this.startRace();
    }
  }

  private frame() {
    if (this.disposed) return;
    const delta = Math.min(this.clock.getDelta(), 0.05);
    if (!this.paused) {
      this.readGamepad();
      this.updatePlayer(delta);
      this.updateRace(delta);
      this.updateInteraction();
      if (this.interactQueued) {
        this.interactQueued = false;
        this.interact();
      }
      this.saveTimer += delta;
      if (this.saveTimer >= 2 && this.player) {
        this.saveTimer = 0;
        this.store.savePosition(this.playerRoot.position.toArray());
      }
    }
    for (const mixer of this.mixers) mixer.update(delta);
    this.positionCamera(false, delta);
    this.renderer.render(this.scene, this.camera);
  }

  private readGamepad() {
    const gamepad = navigator.getGamepads?.()[0];
    if (!gamepad) return;
    const deadzone = (value: number) => Math.abs(value) > 0.17 ? value : 0;
    const x = deadzone(gamepad.axes[0] ?? 0);
    const y = deadzone(gamepad.axes[1] ?? 0);
    if (x || y) this.moveVector.set(x, y).clampLength(0, 1);
    this.cameraYaw -= deadzone(gamepad.axes[2] ?? 0) * 0.035;
    this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + deadzone(gamepad.axes[3] ?? 0) * 0.025, 0.2, 1.12);
    const interact = gamepad.buttons[0]?.pressed ?? false;
    if (interact && !this.gamepadInteractPressed) this.interactQueued = true;
    this.gamepadInteractPressed = interact;
  }

  private updatePlayer(delta: number) {
    if (!this.player) return;
    const keyboardX = Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) - Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));
    const keyboardY = Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")) - Number(this.keys.has("KeyW") || this.keys.has("ArrowUp"));
    const x = THREE.MathUtils.clamp(keyboardX + this.moveVector.x, -1, 1);
    const y = THREE.MathUtils.clamp(keyboardY + this.moveVector.y, -1, 1);
    const magnitude = Math.min(1, Math.hypot(x, y));
    if (magnitude < 0.05) {
      this.player.play("Idle");
      return;
    }

    this.forward.set(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    this.right.crossVectors(this.forward, UP).normalize();
    this.movement.copy(this.forward).multiplyScalar(-y).addScaledVector(this.right, x).normalize();
    const running = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || magnitude > 0.92;
    const speed = running ? PLAYER_RUN_SPEED : PLAYER_SPEED;
    const next = this.playerRoot.position.clone().addScaledVector(this.movement, speed * delta * magnitude);
    const height = this.sampleTerrainHeight(next.x, next.z);
    if (height !== null && height > -0.2) {
      const climb = height - this.playerRoot.position.y;
      if (climb < 1.3) {
        this.playerRoot.position.x = next.x;
        this.playerRoot.position.z = next.z;
        this.playerRoot.position.y = THREE.MathUtils.damp(this.playerRoot.position.y, height, 18, delta);
      }
    }
    const targetRotation = Math.atan2(this.movement.x, this.movement.z);
    const targetQuaternion = new THREE.Quaternion().setFromAxisAngle(UP, targetRotation);
    this.playerRoot.quaternion.slerp(targetQuaternion, 1 - Math.exp(-delta * 14));
    this.player.play(running ? "Run" : "Walk");
  }

  private sampleTerrainHeight(x: number, z: number) {
    if (!this.terrainMeshes.length) return this.playerRoot.position.y;
    this.sampleOrigin.set(x, 80, z);
    this.raycaster.set(this.sampleOrigin, new THREE.Vector3(0, -1, 0));
    this.raycaster.far = 140;
    const hits = this.raycaster.intersectObjects(this.terrainMeshes, false);
    return hits.length ? hits[0].point.y : null;
  }

  private positionCamera(immediate: boolean, delta = 1 / 60) {
    if (!this.player) return;
    this.cameraTarget.copy(this.playerRoot.position).addScaledVector(UP, CAMERA_HEIGHT);
    const horizontal = Math.cos(this.cameraPitch) * CAMERA_DISTANCE;
    this.desiredCamera.set(
      this.cameraTarget.x + Math.sin(this.cameraYaw) * horizontal,
      this.cameraTarget.y + Math.sin(this.cameraPitch) * CAMERA_DISTANCE,
      this.cameraTarget.z + Math.cos(this.cameraYaw) * horizontal,
    );
    if (immediate) this.camera.position.copy(this.desiredCamera);
    else this.camera.position.lerp(this.desiredCamera, 1 - Math.exp(-delta * 9));
    this.camera.lookAt(this.cameraTarget);
  }

  private updateInteraction() {
    if (!this.player) return;
    let nearest: Interactable | null = null;
    let nearestDistance = Infinity;
    for (const item of this.interactables) {
      if (!item.object.visible) continue;
      const distance = item.object.position.distanceTo(this.playerRoot.position);
      if (distance <= item.radius && distance < nearestDistance) {
        nearest = item;
        nearestDistance = distance;
      }
    }
    if (nearest !== this.nearest) {
      this.nearest = nearest;
      this.callbacks.onPrompt(nearest?.label ?? null);
    }
  }

  private interact() {
    const item = this.nearest;
    if (!item) return;
    if (item.type === "npc") this.interactNpc(item);
    if (item.type === "chest") this.openChest(item);
    if (item.type === "house") this.repairHouse(item);
    if (item.type === "bridge") this.repairBridge(item);
    if (item.type === "sick") this.healCitizen(item);
  }

  private interactNpc(item: Interactable) {
    const subtype = item.subtype ?? "Citizen";
    const questId = QUEST_BY_NPC[subtype];
    if (questId) {
      const quest = QUESTS[questId];
      const completed = this.store.state.completedQuests.includes(questId);
      const accepted = this.store.state.acceptedQuests.includes(questId);
      this.showDialogue({
        speaker: quest.company,
        text: completed
          ? "You did it. Cove is stronger because you helped."
          : accepted
            ? quest.objective
            : `${quest.description} ${quest.objective}.`,
        actions: completed || accepted
          ? [{ id: "close", label: "Continue", primary: true }]
          : [
              { id: `accept:${questId}`, label: questId === "BrigitMain" ? "Start race" : "Accept", primary: true },
              { id: "close", label: "Later" },
            ],
      });
      return;
    }

    const lines = [
      "The stars are much clearer since the power went out.",
      "The Glorbs say the old technology under Cove is waking up.",
      "Nine chests are hidden around Cove. I have only seen two.",
      "The path climbs fast near the time-trial track. Keep moving uphill.",
    ];
    this.showDialogue({
      speaker: "Cove Glorb",
      text: lines[hashString(item.id) % lines.length],
      actions: [{ id: "close", label: "Got it", primary: true }],
    });
  }

  private showDialogue(dialogue: GameDialogue) {
    this.callbacks.onDialogue(dialogue);
    this.audio.setDialogueDucking(true);
    this.audio.playUi(430, 0.08);
  }

  private openChest(item: Interactable) {
    if (this.store.state.openedChests.includes(item.id)) return;
    this.store.update((state) => {
      state.openedChests.push(item.id);
      state.points += item.id.startsWith("ChestBig") ? 25 : 10;
    });
    item.object.visible = false;
    this.callbacks.onState(this.store.snapshot());
    this.callbacks.onToast(item.id.startsWith("ChestBig") ? "+25 data points" : "+10 data points");
    this.audio.playUi(760, 0.14);
  }

  private repairHouse(item: Interactable) {
    if (!this.store.state.inventory.includes("Hammer")) {
      this.callbacks.onToast("Talk to TECH COMPANY #3 for the repair tool");
      return;
    }
    if (this.store.state.repairedHouses.includes(item.id)) return;
    this.store.update((state) => {
      state.repairedHouses.push(item.id);
      state.points += 10;
      if (!state.completedQuests.includes("AvenMain")) {
        state.completedQuests.push("AvenMain");
        state.points += 20;
      }
      if (state.repairedHouses.length >= 4) state.points += 50;
    });
    this.tintObject(item.object, 0x55e6ae);
    this.callbacks.onState(this.store.snapshot());
    this.callbacks.onToast("House restored");
  }

  private repairBridge(item: Interactable) {
    if (!this.store.state.inventory.includes("Screwdriver")) {
      this.callbacks.onToast("Talk to TECH COMPANY #8 for the bridge tool");
      return;
    }
    if (this.store.state.bridgeRepaired) return;
    this.store.update((state) => {
      state.bridgeRepaired = true;
      state.completedQuests.push("PomeloMain");
      state.points += 20;
    });
    this.tintObject(item.object, 0x55e6ae);
    this.callbacks.onState(this.store.snapshot());
    this.callbacks.onToast("Bridge repaired");
  }

  private healCitizen(item: Interactable) {
    if (!this.store.state.inventory.includes("Stethoscope")) {
      this.callbacks.onToast("Talk to TECH COMPANY #9 for the medical scanner");
      return;
    }
    if (this.store.state.healedCitizens.includes(item.id)) return;
    this.store.update((state) => {
      state.healedCitizens.push(item.id);
      state.points += 10;
      if (!state.completedQuests.includes("ZendaMain")) {
        state.completedQuests.push("ZendaMain");
        state.points += 20;
      }
      if (state.healedCitizens.length >= 3) state.points += 50;
    });
    this.tintObject(item.object, 0x55e6ae);
    const rig = this.mixers.find((candidate) => candidate.group === item.object);
    rig?.play("Healed");
    this.callbacks.onState(this.store.snapshot());
    this.callbacks.onToast("Glorb helped");
  }

  private startRace() {
    this.race = { active: true, checkpoint: 0, elapsed: 0 };
    this.raceCheckpoints.forEach((checkpoint, index) => {
      checkpoint.visible = index === 0;
    });
    this.callbacks.onRace({ active: true, checkpoint: 0, total: this.raceCheckpoints.length, elapsed: 0 });
    this.callbacks.onToast("Race started. Follow the glowing rings.");
  }

  private updateRace(delta: number) {
    if (!this.race.active || !this.player) return;
    this.race.elapsed += delta;
    const checkpoint = this.raceCheckpoints[this.race.checkpoint];
    checkpoint.rotation.y += delta * 1.8;
    if (checkpoint.position.distanceTo(this.playerRoot.position) < 3.5) {
      checkpoint.visible = false;
      this.race.checkpoint += 1;
      if (this.race.checkpoint >= this.raceCheckpoints.length) {
        this.finishRace();
        return;
      }
      this.raceCheckpoints[this.race.checkpoint].visible = true;
      this.audio.playUi(620 + this.race.checkpoint * 28, 0.08);
    }
    this.callbacks.onRace({
      active: true,
      checkpoint: this.race.checkpoint,
      total: this.raceCheckpoints.length,
      elapsed: this.race.elapsed,
    });
  }

  private finishRace() {
    const elapsed = this.race.elapsed;
    this.race.active = false;
    this.raceCheckpoints.forEach((checkpoint) => { checkpoint.visible = false; });
    this.store.update((state) => {
      state.completedQuests.push("BrigitMain");
      state.points += 20;
      if (state.bikeBestTime === null || elapsed < state.bikeBestTime) state.bikeBestTime = elapsed;
      if (elapsed <= 45) state.points += 50;
    });
    this.callbacks.onState(this.store.snapshot());
    this.callbacks.onRace({ active: false, checkpoint: this.raceCheckpoints.length, total: this.raceCheckpoints.length, elapsed });
    this.callbacks.onToast(`Race complete in ${elapsed.toFixed(1)}s`);
    this.player?.play("Victory");
  }

  private resize() {
    const parent = this.canvas.parentElement;
    const width = Math.max(1, parent?.clientWidth ?? window.innerWidth);
    const height = Math.max(1, parent?.clientHeight ?? window.innerHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    const disposeInput = (this.canvas as HTMLCanvasElement & { __disposeInput?: () => void }).__disposeInput;
    disposeInput?.();
    this.draco.dispose();
    this.audio.dispose();
    this.scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) material.dispose();
    });
    this.renderer.dispose();
  }
}
