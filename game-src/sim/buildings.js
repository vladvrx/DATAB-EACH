export const BUILDINGS = {
  // --- ENERGY & INFRASTRUCTURE ---
  solar_canopy: {
    id: "solar_canopy",
    category: "energy",
    name: "Solar Canopy",
    icon: "☀️",
    description: "Harvests clean power from the blazing tropical sun.",
    baseCost: 1000,
    powerGen: 20,
    powerDraw: 0,
    ecoImpact: 3,
    baseRevenue: 0,
    model: "Asset_TechCompany03HouseOn.95ee562765453426.glb",
    scale: [0.8, 0.8, 0.8],
    color: "#ffaa00"
  },
  wind_turbine: {
    id: "wind_turbine",
    category: "energy",
    name: "Aero-Turbine",
    icon: "🌀",
    description: "Converts island sea winds into heavy power generation.",
    baseCost: 3200,
    powerGen: 50,
    powerDraw: 0,
    ecoImpact: 5,
    baseRevenue: 0,
    model: "Asset_BuildingD.9f9b006f65453426.glb",
    scale: [0.7, 0.7, 0.7],
    color: "#00d4ff"
  },
  grid_battery: {
    id: "grid_battery",
    category: "energy",
    name: "Capacitor Grid Relay",
    icon: "🔋",
    description: "Buffers grid stability and absorbs peak shocks during Signal Surges.",
    baseCost: 5500,
    powerGen: 15,
    powerDraw: 0,
    ecoImpact: 0,
    baseRevenue: 0,
    model: "Asset_TechCompany03HouseOff.a23f6b6965453426.glb",
    scale: [0.8, 0.8, 0.8],
    color: "#7928ca"
  },

  // --- ATTRACTIONS (REVENUE) ---
  sun_loungers: {
    id: "sun_loungers",
    category: "attraction",
    name: "Umbrella & Lounger",
    icon: "⛱️",
    description: "Comfortable beach chairs where tourists relax and leave tips.",
    baseCost: 600,
    powerGen: 0,
    powerDraw: 0,
    ecoImpact: 2,
    baseRevenue: 15,
    model: "Asset_BeachUmbrella.ebc2bd3065453426.glb",
    scale: [1.2, 1.2, 1.2],
    color: "#ff007a"
  },
  beach_bar: {
    id: "beach_bar",
    category: "attraction",
    name: "Neon Beach Bar",
    icon: "🍹",
    description: "Mixes tropical algae coolers and high-voltage synth-cocktails.",
    baseCost: 1500,
    powerGen: 0,
    powerDraw: 12,
    ecoImpact: -2,
    baseRevenue: 45,
    model: "Asset_BeachBar.23745a6b65453426.glb",
    scale: [0.9, 0.9, 0.9],
    color: "#00f0ff"
  },
  ramen_kiosk: {
    id: "ramen_kiosk",
    category: "attraction",
    name: "Cyber-Ramen Stand",
    icon: "🍜",
    description: "Steaming bowls of seaweed broth packed with digital nutrients.",
    baseCost: 3500,
    powerGen: 0,
    powerDraw: 22,
    ecoImpact: -4,
    baseRevenue: 110,
    model: "Asset_ShopRamen.56282a3f65453426.glb",
    scale: [0.75, 0.75, 0.75],
    color: "#ff5e00"
  },
  surf_shop: {
    id: "surf_shop",
    category: "attraction",
    name: "Zero-G Surf Shack",
    icon: "🏄",
    description: "Rentals for anti-gravity skimboards and reef gliders.",
    baseCost: 7500,
    powerGen: 0,
    powerDraw: 35,
    ecoImpact: -3,
    baseRevenue: 240,
    model: "Asset_SurfShop.0bb1733265453426.glb",
    scale: [0.75, 0.75, 0.75],
    color: "#00ff88"
  },
  stilt_villa: {
    id: "stilt_villa",
    category: "attraction",
    name: "Luxury Stilt Villa",
    icon: "🏡",
    description: "Exclusive overwater bungalow catering to high-wealth alien visitors.",
    baseCost: 15000,
    powerGen: 0,
    powerDraw: 55,
    ecoImpact: -5,
    baseRevenue: 520,
    model: "Asset_StiltHouseA.c6e4a15a65453426.glb",
    scale: [0.75, 0.75, 0.75],
    color: "#e2b714"
  },

  // --- ECO & HEALTH ---
  cyber_palm: {
    id: "cyber_palm",
    category: "eco",
    name: "Biolum Palm Grove",
    icon: "🌴",
    description: "Purifies island atmosphere and enchants tourists.",
    baseCost: 800,
    powerGen: 0,
    powerDraw: 0,
    ecoImpact: 12,
    baseRevenue: 5,
    model: "Asset_PalmTreeTallA.e36ef4cc65453426.glb",
    scale: [0.9, 0.9, 0.9],
    color: "#2bd980"
  },
  algae_scrubber: {
    id: "algae_scrubber",
    category: "eco",
    name: "Algae Bio-Scrubber",
    icon: "🧪",
    description: "Filters tourist waste and beach microplastics into clean coral food.",
    baseCost: 2600,
    powerGen: 0,
    powerDraw: 8,
    ecoImpact: 25,
    baseRevenue: 0,
    model: "Asset_GrowableTreeLarge.abc3c7b965453426.glb",
    scale: [0.85, 0.85, 0.85],
    color: "#10b981"
  }
};

export const UPGRADE_TIERS = [
  { level: 1, name: "Standard", multiplier: 1.0, costFactor: 1.0 },
  { level: 2, name: "Overcharged", multiplier: 1.8, costFactor: 1.8 },
  { level: 3, name: "Quantum Prime", multiplier: 3.2, costFactor: 3.2 }
];
