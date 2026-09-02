import { createInitialState } from "../game-src/sim/state.js";
import { EconomyEngine } from "../game-src/sim/economy.js";

console.log("=== Testing Data B-each Simulation Economy ===");

const state = createInitialState();
const engine = new EconomyEngine(state);

console.log("Initial state:", {
  credits: state.databloons,
  powerGen: state.powerGen,
  powerDraw: state.powerDraw,
  eco: state.ecoHealth,
  rating: state.resortRating
});

// Build 1: Solar Canopy on Plot 8 (ridge)
const b1 = engine.build("solar_canopy", 8);
console.log("Built solar canopy:", b1, "Credits left:", state.databloons, "Power:", state.powerGen);
if (!b1 || state.powerGen <= 0) throw new Error("Failed to build solar canopy");

// Build 2: Beach Bar on Plot 4 (boardwalk)
const b2 = engine.build("beach_bar", 4);
console.log("Built beach bar:", b2, "Credits left:", state.databloons, "Power draw:", state.powerDraw);
if (!b2 || state.powerDraw <= 0) throw new Error("Failed to build beach bar");

// Build 3: Sun Loungers on Plot 0 (sand)
const b3 = engine.build("sun_loungers", 0);
console.log("Built loungers:", b3, "Credits left:", state.databloons);

// Simulate 60 seconds (1 minute of real time)
for (let sec = 0; sec < 60; sec++) {
  engine.tick(1.0);
}

console.log("After 60 seconds of play:", {
  time: state.gameTime,
  phase: state.phaseName,
  credits: Math.round(state.databloons),
  incomeRate: state.incomeRate,
  powerSat: state.powerSatisfaction,
  eco: Math.round(state.ecoHealth),
  rating: state.resortRating,
  tourists: state.touristCount
});

if (state.databloons <= 0 || state.incomeRate <= 0) {
  throw new Error("Economy failed to generate positive revenue");
}

// Upgrade Beach Bar to Level 2
const canUp = engine.canUpgrade(4);
console.log("Can upgrade beach bar:", canUp, "Cost:", engine.getUpgradeCost(4));
if (canUp) {
  engine.upgrade(4);
  console.log("Upgraded beach bar! New level:", state.plots[4].building.level);
}

// Simulate through Surge (around 180s)
for (let sec = 60; sec < 200; sec++) {
  engine.tick(1.0);
  if (state.surge.active && sec === 185) {
    console.log("SURGE ACTIVE AT 185s:", {
      intensity: state.surge.intensity,
      remaining: state.surge.remaining,
      powerGen: state.powerGen,
      powerDraw: state.powerDraw
    });
  }
}

console.log("After 200 seconds (Surge survived):", {
  phase: state.phaseName,
  surgesSurvived: state.stats.surgesSurvived,
  credits: Math.round(state.databloons),
  eco: Math.round(state.ecoHealth)
});

console.log("✅ Simulation economy tests passed successfully!");
