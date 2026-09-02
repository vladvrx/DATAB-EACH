import { BUILDINGS } from "./buildings.js";

export const PLOT_LAYOUT = [
  // Beachfront row (Z = 2.5) - prime attraction & loungers
  { id: 0, x: -6, z: 2.5, type: "sand" },
  { id: 1, x: -2, z: 2.5, type: "sand" },
  { id: 2, x: 2, z: 2.5, type: "sand" },
  { id: 3, x: 6, z: 2.5, type: "sand" },

  // Mid boardwalk row (Z = 0) - bars, shops, cabanas
  { id: 4, x: -6, z: -0.5, type: "boardwalk" },
  { id: 5, x: -2, z: -0.5, type: "boardwalk" },
  { id: 6, x: 2, z: -0.5, type: "boardwalk" },
  { id: 7, x: 6, z: -0.5, type: "boardwalk" },

  // Inland ridge row (Z = -3.5) - energy canopy, turbines, bio scrubbers
  { id: 8, x: -6, z: -3.5, type: "ridge" },
  { id: 9, x: -2, z: -3.5, type: "ridge" },
  { id: 10, x: 2, z: -3.5, type: "ridge" },
  { id: 11, x: 6, z: -3.5, type: "ridge" }
];

export function createInitialState() {
  return {
    databloons: 2500,
    lifetimeEarned: 2500,
    powerGen: 0,
    powerDraw: 0,
    powerSatisfaction: 1.0, // 0 to 1
    ecoHealth: 80,          // 0 to 100%
    resortRating: 2.5,      // 1.0 to 5.0
    touristCount: 3,
    maxTourists: 10,
    gameTime: 0,
    targetWinScore: 60000,
    targetWinRating: 4.8,
    status: "playing",       // "playing" | "victory" | "game_over"
    statusMessage: "",
    phase: 1,
    phaseName: "Sunrise Arrival",
    surge: {
      active: false,
      countdown: 180, // first surge after 3 mins
      duration: 25,
      remaining: 0,
      intensity: 0
    },
    plots: PLOT_LAYOUT.map((p) => ({
      ...p,
      building: null
    })),
    stats: {
      buildingsPlaced: 0,
      upgradesPerformed: 0,
      surgesSurvived: 0,
      trashesCleaned: 0
    }
  };
}
