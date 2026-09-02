import type { QuestId } from "./data";

export type GameSave = {
  version: 1;
  colorIndex: number;
  points: number;
  position: [number, number, number] | null;
  inventory: string[];
  acceptedQuests: QuestId[];
  completedQuests: QuestId[];
  openedChests: string[];
  repairedHouses: string[];
  healedCitizens: string[];
  bridgeRepaired: boolean;
  bikeBestTime: number | null;
};

const SAVE_KEY = "datab-each-three-v1";

const DEFAULT_SAVE: GameSave = {
  version: 1,
  colorIndex: 0,
  points: 0,
  position: null,
  inventory: [],
  acceptedQuests: [],
  completedQuests: [],
  openedChests: [],
  repairedHouses: [],
  healedCitizens: [],
  bridgeRepaired: false,
  bikeBestTime: null,
};

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export class GameStore extends EventTarget {
  state: GameSave;

  constructor() {
    super();
    this.state = this.load();
  }

  private load(): GameSave {
    if (typeof window === "undefined") return structuredClone(DEFAULT_SAVE);
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as Partial<GameSave> | null;
      if (!saved || saved.version !== 1) return structuredClone(DEFAULT_SAVE);
      return {
        ...structuredClone(DEFAULT_SAVE),
        ...saved,
        inventory: unique(saved.inventory ?? []),
        acceptedQuests: unique(saved.acceptedQuests ?? []),
        completedQuests: unique(saved.completedQuests ?? []),
        openedChests: unique(saved.openedChests ?? []),
        repairedHouses: unique(saved.repairedHouses ?? []),
        healedCitizens: unique(saved.healedCitizens ?? []),
      };
    } catch {
      return structuredClone(DEFAULT_SAVE);
    }
  }

  update(mutator: (state: GameSave) => void) {
    mutator(this.state);
    this.state.inventory = unique(this.state.inventory);
    this.state.acceptedQuests = unique(this.state.acceptedQuests);
    this.state.completedQuests = unique(this.state.completedQuests);
    this.state.openedChests = unique(this.state.openedChests);
    this.state.repairedHouses = unique(this.state.repairedHouses);
    this.state.healedCitizens = unique(this.state.healedCitizens);
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    this.dispatchEvent(new CustomEvent("change", { detail: structuredClone(this.state) }));
  }

  snapshot() {
    return structuredClone(this.state);
  }

  savePosition(position: [number, number, number]) {
    this.state.position = position;
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
  }

  reset() {
    this.state = structuredClone(DEFAULT_SAVE);
    localStorage.removeItem(SAVE_KEY);
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }));
  }
}
