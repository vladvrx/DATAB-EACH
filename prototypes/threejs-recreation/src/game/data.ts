import islandWest from "./data/island-west.json";

export type TransformArray = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type IslandActor = {
  uid: string;
  type: string;
  params?: {
    subtype?: string;
    move?: string;
    [key: string]: unknown;
  };
  transforms: TransformArray;
};

export type IslandManifest = {
  name: string;
  bounds: [[number, number, number], [number, number, number]];
  points: Record<string, TransformArray>;
  actors: IslandActor[];
  curves: Record<string, { points?: number[][] }>;
};

export const COVE_MANIFEST = islandWest as unknown as IslandManifest;

export const ASSETS = {
  character: "/assets/character.df6ab95f65453426.glb",
  island: "/assets/Scene_IslandWest.68c3fec765453426.glb",
  terrain: "/assets/Scene_IslandWest_TerrainSplatting.6e0e218f65453426.png",
  map: "/assets/map_1024.cove-only-final.webp",
  logicalMap: "/.gltf/logical-to-hashed.json",
  music: "/assets/music_island_west.ee940d9a65453426.m4a",
  ambience: "/assets/sfx_amb_main_loop.01a57afe65453426.m4a",
  beachAmbience: "/assets/sfx_amb_beach_loop.be1083c965453426.m4a",
} as const;

export const ANIMATION_FRAMES = {
  "T-Pose": [0, 1],
  Walk: [3, 27],
  Run: [33, 57],
  Idle: [63, 104],
  Idle2: [111, 152],
  Idle3: [156, 255],
  Sick: [259, 434],
  Healed: [440, 473],
  Jetpack: [482, 511],
  Victory: [514, 546],
  Gain: [552, 584],
  Action: [591, 642],
  Happy: [648, 688],
  Sad: [694, 735],
  Thinking: [742, 782],
  Eloquant: [788, 829],
  Fear: [836, 876],
  Hello: [882, 939],
  Dancing: [947, 979],
  Seating: [984, 1025],
  Towel: [1031, 1072],
  Swimming: [1079, 1107],
  JetpackAction: [1113, 1142],
  Sport: [1149, 1219],
  ZiplineJump: [1223, 1262],
  ZiplineIdle: [1263, 1322],
  ZiplineFall: [1323, 1355],
} as const;

export type AnimationName = keyof typeof ANIMATION_FRAMES;

export const PLAYER_COLORS = [
  { id: "mint", body: "#55e6ae", accent: "#173a42" },
  { id: "violet", body: "#a889ff", accent: "#26204d" },
  { id: "coral", body: "#ff7d88", accent: "#4b2037" },
  { id: "cyan", body: "#55cfff", accent: "#15364e" },
  { id: "gold", body: "#ffd25f", accent: "#493719" },
] as const;

export type QuestId = "AvenMain" | "BrigitMain" | "PomeloMain" | "ZendaMain";

export const QUESTS: Record<
  QuestId,
  {
    title: string;
    company: string;
    description: string;
    item?: string;
    objective: string;
  }
> = {
  AvenMain: {
    title: "Restore the houses",
    company: "TECH COMPANY #3",
    description: "The Cove homes need repairs. Take the repair tool and restore a house.",
    item: "Hammer",
    objective: "Repair one of the marked houses",
  },
  BrigitMain: {
    title: "Cove time trial",
    company: "TECH COMPANY #1",
    description: "Run the glowing checkpoint route before the timer expires.",
    objective: "Complete the checkpoint route",
  },
  PomeloMain: {
    title: "Repair the bridge",
    company: "TECH COMPANY #8",
    description: "The bridge is down. Take the tool and repair it so the path is safe again.",
    item: "Screwdriver",
    objective: "Repair the broken bridge",
  },
  ZendaMain: {
    title: "Help a sick Glorb",
    company: "TECH COMPANY #9",
    description: "Some Glorbs are in pain. Take the medical scanner and help one of them.",
    item: "Stethoscope",
    objective: "Help one sick Glorb",
  },
};

export const QUEST_BY_NPC: Record<string, QuestId> = {
  Aven_Quest: "AvenMain",
  Brigit_Quest: "BrigitMain",
  Pomelo_Quest: "PomeloMain",
  Zenda_Quest: "ZendaMain",
};

export const NPC_IDLE_ANIMATION: Record<string, AnimationName> = {
  Citizen_West_Beach: "Fear",
  Citizen_West_BeachSeatingA: "Towel",
  Citizen_West_BeachSeatingB: "Sport",
  Citizen_West_SeatingA: "Seating",
  Citizen_West_SeatingB: "Seating",
  Citizen_West_SeatingC: "Seating",
  Citizen_West_SeatingD: "Seating",
  Citizen_West_SwimmingA: "Swimming",
  Citizen_West_SwimmingB: "Swimming",
  Citizen_West_SwimmingC: "Swimming",
  Citizen_West_TowelA: "Towel",
  Citizen_West_TowelB: "Towel",
  Brigit_Quest: "Thinking",
  Pomelo_Quest: "Thinking",
  Zenda_Quest: "Thinking",
  Zenda_Sick_WestA: "Sick",
  Zenda_Sick_WestC: "Sick",
  Zenda_Sick_WestD: "Sick",
};

export function actorPosition(actor: IslandActor) {
  return actor.transforms.slice(0, 3) as [number, number, number];
}

export function actorQuaternion(actor: IslandActor) {
  return actor.transforms.slice(6, 10) as [number, number, number, number];
}

export function actorScale(actor: IslandActor) {
  return actor.transforms.slice(3, 6) as [number, number, number];
}
