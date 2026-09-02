import { BUILDINGS, UPGRADE_TIERS } from "./buildings.js";

export class EconomyEngine {
  constructor(state) {
    this.state = state;
    this.blackoutTimer = 0;
  }

  tick(deltaSeconds) {
    if (this.state.status !== "playing") return;

    this.state.gameTime += deltaSeconds;

    // 1. Update Phases & Escalation
    this.updatePhases();

    // 2. Handle Surge Timing & Fluctuations
    this.updateSurge(deltaSeconds);

    // 3. Calculate Power Grid
    this.updatePowerGrid();

    // 4. Calculate Eco Cleanliness
    this.updateEco(deltaSeconds);

    // 5. Calculate Revenue & Tourist Traffic
    this.updateRevenue(deltaSeconds);

    // 6. Check Win/Loss Conditions
    this.checkEndConditions(deltaSeconds);
  }

  updatePhases() {
    const t = this.state.gameTime;
    if (t < 90) {
      this.state.phase = 1;
      this.state.phaseName = "Phase 1: Sunrise Arrival";
    } else if (t < 210) {
      this.state.phase = 2;
      this.state.phaseName = "Phase 2: High Tide Rush";
    } else if (t < 330) {
      this.state.phase = 3;
      this.state.phaseName = "Phase 3: Signal Surge Storm";
    } else {
      this.state.phase = 4;
      this.state.phaseName = "Phase 4: Neon Sunset Gala";
    }
  }

  updateSurge(deltaSeconds) {
    const s = this.state.surge;
    if (!s.active) {
      s.countdown -= deltaSeconds;
      if (s.countdown <= 0) {
        s.active = true;
        s.remaining = s.duration;
        s.intensity = 0.8;
      }
    } else {
      s.remaining -= deltaSeconds;
      if (s.remaining <= 0) {
        s.active = false;
        s.countdown = 150; // next surge in 2.5 minutes
        s.intensity = 0;
        this.state.stats.surgesSurvived++;
      }
    }
  }

  updatePowerGrid() {
    let gen = 0;
    let draw = 0;

    for (const plot of this.state.plots) {
      if (!plot.building) continue;
      const def = BUILDINGS[plot.building.type];
      if (!def) continue;

      const tier = UPGRADE_TIERS[plot.building.level - 1] || UPGRADE_TIERS[0];
      const mult = tier.multiplier;

      if (def.category === "energy") {
        let pGen = def.powerGen * mult;
        // Surge solar flare / storm effect: wind boosts, solar drops slightly
        if (this.state.surge.active) {
          if (plot.building.type === "solar_canopy") pGen *= 0.65;
          if (plot.building.type === "wind_turbine") pGen *= 1.35;
        }
        gen += pGen;
      } else {
        let pDraw = def.powerDraw;
        if (plot.building.level > 1) {
          pDraw *= (1 + (plot.building.level - 1) * 0.4);
        }
        // Surge increases grid load
        if (this.state.surge.active) {
          pDraw *= 1.3;
        }
        draw += pDraw;
      }
    }

    this.state.powerGen = Math.round(gen);
    this.state.powerDraw = Math.round(draw);

    if (draw <= 0) {
      this.state.powerSatisfaction = 1.0;
    } else if (gen >= draw) {
      this.state.powerSatisfaction = 1.0;
    } else {
      this.state.powerSatisfaction = Math.max(0.1, gen / draw);
    }
  }

  updateEco(deltaSeconds) {
    let deltaEco = 0;
    let totalAttractions = 0;

    for (const plot of this.state.plots) {
      if (!plot.building) continue;
      const def = BUILDINGS[plot.building.type];
      if (!def) continue;

      const tier = UPGRADE_TIERS[plot.building.level - 1] || UPGRADE_TIERS[0];

      if (def.category === "eco") {
        deltaEco += def.ecoImpact * tier.multiplier * 0.15;
      } else if (def.category === "attraction") {
        totalAttractions++;
        deltaEco += def.ecoImpact * (1 + (plot.building.level - 1) * 0.3) * 0.1;
      }
    }

    // Natural mild drift towards 50%
    if (deltaEco === 0) {
      deltaEco = (60 - this.state.ecoHealth) * 0.005;
    }

    // Moderate tourist pollution in later phases
    if (this.state.phase >= 2) {
      deltaEco -= (this.state.touristCount * 0.015);
    }

    this.state.ecoHealth = Math.min(100, Math.max(0, this.state.ecoHealth + deltaEco * deltaSeconds));
  }

  updateRevenue(deltaSeconds) {
    let baseIncomeRate = 0;
    let attractionCount = 0;

    for (const plot of this.state.plots) {
      if (!plot.building) continue;
      const def = BUILDINGS[plot.building.type];
      if (!def) continue;

      if (def.category === "attraction" || def.baseRevenue > 0) {
        attractionCount++;
        const tier = UPGRADE_TIERS[plot.building.level - 1] || UPGRADE_TIERS[0];
        baseIncomeRate += def.baseRevenue * tier.multiplier;
      }
    }

    // Satisfaction factors
    const powerFactor = Math.pow(this.state.powerSatisfaction, 1.2);
    const ecoFactor = 0.4 + (this.state.ecoHealth / 100) * 0.6;
    const effectiveIncomeRate = baseIncomeRate * powerFactor * ecoFactor;

    const earned = effectiveIncomeRate * deltaSeconds;
    this.state.databloons += earned;
    this.state.lifetimeEarned += earned;
    this.state.incomeRate = Math.round(effectiveIncomeRate);

    // Tourist population & Resort Rating
    const targetTourists = Math.min(25, 3 + attractionCount * 3 + Math.floor(this.state.ecoHealth / 15));
    this.state.touristCount = Math.round(targetTourists * powerFactor);

    // Calculate dynamic rating (1.0 to 5.0)
    const powerScore = this.state.powerSatisfaction * 2.0;
    const ecoScore = (this.state.ecoHealth / 100) * 2.0;
    const varietyScore = Math.min(1.0, attractionCount / 5);
    this.state.resortRating = Math.min(5.0, Math.max(1.0, Number((powerScore + ecoScore + varietyScore).toFixed(1))));
  }

  checkEndConditions(deltaSeconds) {
    // 1. Blackout Failure (power satisfaction < 0.2 for 20 seconds)
    if (this.state.powerSatisfaction < 0.25 && this.state.powerDraw > 15) {
      this.blackoutTimer += deltaSeconds;
      if (this.blackoutTimer >= 18) {
        this.state.status = "game_over";
        this.state.statusMessage = "CRITICAL GRID FAILURE: Island-wide blackout caused resort evacuation.";
        return;
      }
    } else {
      this.blackoutTimer = Math.max(0, this.blackoutTimer - deltaSeconds * 2);
    }

    // 2. Eco Collapse Failure
    if (this.state.ecoHealth <= 1) {
      this.state.status = "game_over";
      this.state.statusMessage = "ECOLOGICAL COLLAPSE: Bio-waste exceeded safe parameters. Island quarantined.";
      return;
    }

    // 3. Victory Condition
    // Earn $60,000+ total, reach 4.8+ rating, keep eco >= 75%, and reach at least Phase 3
    if (
      this.state.lifetimeEarned >= this.state.targetWinScore &&
      this.state.resortRating >= this.state.targetWinRating &&
      this.state.ecoHealth >= 75
    ) {
      this.state.status = "victory";
      this.state.statusMessage = "5-STAR PARADISE ACHIEVED! Data B-each is now the premier alien eco-resort in the galaxy!";
    }
  }

  // --- ACTIONS ---

  canBuild(buildingType, plotId) {
    const plot = this.state.plots[plotId];
    if (!plot || plot.building) return false;
    const def = BUILDINGS[buildingType];
    if (!def) return false;
    return this.state.databloons >= def.baseCost;
  }

  build(buildingType, plotId) {
    if (!this.canBuild(buildingType, plotId)) return false;
    const def = BUILDINGS[buildingType];
    this.state.databloons -= def.baseCost;
    this.state.plots[plotId].building = {
      type: buildingType,
      level: 1,
      constructedAt: this.state.gameTime
    };
    this.state.stats.buildingsPlaced++;
    this.updatePowerGrid();
    return true;
  }

  getUpgradeCost(plotId) {
    const plot = this.state.plots[plotId];
    if (!plot || !plot.building) return null;
    if (plot.building.level >= UPGRADE_TIERS.length) return null;

    const def = BUILDINGS[plot.building.type];
    const nextTier = UPGRADE_TIERS[plot.building.level];
    return Math.round(def.baseCost * nextTier.costFactor);
  }

  canUpgrade(plotId) {
    const cost = this.getUpgradeCost(plotId);
    return cost !== null && this.state.databloons >= cost;
  }

  upgrade(plotId) {
    if (!this.canUpgrade(plotId)) return false;
    const cost = this.getUpgradeCost(plotId);
    this.state.databloons -= cost;
    this.state.plots[plotId].building.level++;
    this.state.stats.upgradesPerformed++;
    this.updatePowerGrid();
    return true;
  }

  demolish(plotId) {
    const plot = this.state.plots[plotId];
    if (!plot || !plot.building) return false;
    const def = BUILDINGS[plot.building.type];
    // Refund 40%
    const refund = Math.round(def.baseCost * 0.4);
    this.state.databloons += refund;
    plot.building = null;
    this.updatePowerGrid();
    return true;
  }

  cleanTrash() {
    this.state.ecoHealth = Math.min(100, this.state.ecoHealth + 4);
    this.state.databloons += 50;
    this.state.stats.trashesCleaned++;
    return true;
  }
}
