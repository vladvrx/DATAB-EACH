import { createInitialState } from "./sim/state.js";
import { EconomyEngine } from "./sim/economy.js";
import { BeachScene } from "./render/scene.js";
import { TouristManager } from "./render/tourists.js";
import { SoundFX } from "./audio/synth.js";
import { GameHUD } from "./ui/hud.js";
import { GameDrawer } from "./ui/drawer.js";
import { GameModals } from "./ui/modals.js";

export class DataBeachGame {
  constructor(rootContainer) {
    this.root = rootContainer;
    this.state = createInitialState();
    this.economy = new EconomyEngine(this.state);
    this.sound = new SoundFX();

    this.root.innerHTML = `
      <div id="app-container">
        <div id="viewport-container"></div>
      </div>
    `;

    this.appContainer = this.root.querySelector("#app-container");
    this.viewportContainer = this.root.querySelector("#viewport-container");

    // 1. Scene
    this.scene = new BeachScene(
      this.viewportContainer,
      (plotId) => this.onPlotSelected(plotId),
      () => this.onTrashCleaned()
    );
    this.scene.setupPlots(this.state.plots);

    // 2. Tourists
    this.tourists = new TouristManager(this.scene);

    // 3. UI
    this.hud = new GameHUD(this.appContainer, () => this.sound.toggleMute());
    this.drawer = new GameDrawer(
      this.appContainer,
      (type, plotId) => this.onBuild(type, plotId),
      (plotId) => this.onUpgrade(plotId),
      (plotId) => this.onDemolish(plotId),
      () => this.onDeselectPlot()
    );
    this.modals = new GameModals(this.appContainer, () => this.restart());

    this.lastTime = performance.now();
    this.trashSpawnTimer = 0;
    this.isRunning = true;

    // First user gesture initializes WebAudio
    window.addEventListener("pointerdown", () => this.sound.ensureContext(), { once: true });

    // Initial plots
    this.drawer.update(this.state, this.state.plots);

    // Start loop
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  onPlotSelected(plotId) {
    this.sound.playClick();
    this.drawer.setSelectedPlot(plotId, this.state.plots[plotId], this.state);
  }

  onDeselectPlot() {
    this.scene.selectPlot(null);
  }

  onBuild(buildingType, selectedPlotId) {
    // If no plot selected, pick the first available plot that suits the category
    let targetId = selectedPlotId;
    if (targetId === null || this.state.plots[targetId].building) {
      const freePlot = this.state.plots.find((p) => !p.building);
      if (freePlot) targetId = freePlot.id;
    }

    if (targetId === null || targetId === undefined) {
      this.scene.addFloatingText("No Free Plots Available!", 0, 1, 0, "#ef4444");
      return;
    }

    if (this.economy.build(buildingType, targetId)) {
      this.sound.playBuild();
      this.scene.updateBuildingOnPlot(targetId, this.state.plots[targetId].building);
      this.scene.selectPlot(targetId);
      this.drawer.setSelectedPlot(targetId, this.state.plots[targetId], this.state);
      this.drawer.update(this.state, this.state.plots);

      const plotPos = this.state.plots[targetId];
      this.scene.addFloatingText("Built!", plotPos.x, 1.5, plotPos.z, "#00f0ff");
    } else {
      this.scene.addFloatingText("Not Enough Databloons!", 0, 1, 0, "#ef4444");
    }
  }

  onUpgrade(plotId) {
    if (this.economy.upgrade(plotId)) {
      this.sound.playUpgrade();
      this.scene.updateBuildingOnPlot(plotId, this.state.plots[plotId].building);
      this.drawer.setSelectedPlot(plotId, this.state.plots[plotId], this.state);
      this.drawer.update(this.state, this.state.plots);

      const plotPos = this.state.plots[plotId];
      this.scene.addFloatingText("UPGRADED! ⭐", plotPos.x, 2.0, plotPos.z, "#ffd700");
    }
  }

  onDemolish(plotId) {
    this.sound.playClick();
    this.economy.demolish(plotId);
    this.scene.updateBuildingOnPlot(plotId, null);
    this.drawer.setSelectedPlot(plotId, this.state.plots[plotId], this.state);
    this.drawer.update(this.state, this.state.plots);
  }

  onTrashCleaned() {
    this.sound.playTrashClean();
    this.economy.cleanTrash();
    this.drawer.update(this.state, this.state.plots);
  }

  restart() {
    this.state = createInitialState();
    this.economy = new EconomyEngine(this.state);

    // Clear meshes
    this.state.plots.forEach((p) => {
      this.scene.updateBuildingOnPlot(p.id, null);
    });
    this.scene.trashMeshes.forEach((t) => this.scene.scene.remove(t));
    this.scene.trashMeshes = [];
    this.tourists.clear();

    this.scene.selectPlot(null);
    this.drawer.setSelectedPlot(null, null, this.state);
    this.drawer.update(this.state, this.state.plots);
    this.modals.hide();
    this.lastTime = performance.now();
  }

  loop(now) {
    if (!this.isRunning) return;

    const delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    if (this.state.status === "playing") {
      const prevSurge = this.state.surge.active;

      // 1. Tick simulation economy
      this.economy.tick(delta);

      // 2. Play warning sound when surge begins
      if (!prevSurge && this.state.surge.active) {
        this.sound.playSurgeWarning();
      }

      // 3. Periodic trash spawning (especially when tourists are high)
      this.trashSpawnTimer += delta;
      if (this.trashSpawnTimer > 18 && this.scene.trashMeshes.length < 4) {
        this.trashSpawnTimer = 0;
        const tx = (Math.random() - 0.5) * 11;
        const tz = 0.5 + Math.random() * 3.5;
        this.scene.spawnTrash(tx, tz);
      }

      // 4. Update tourists
      this.tourists.syncCount(this.state.touristCount, this.state.plots);
      this.tourists.update(delta, this.state.plots, this.state.powerSatisfaction);

      // 5. Update UI
      this.hud.update(this.state);
      this.drawer.update(this.state, this.state.plots);

      // 6. Handle victory/defeat
      if (this.state.status === "victory") {
        this.sound.playVictory();
        this.modals.showVictory(this.state);
      } else if (this.state.status === "game_over") {
        this.sound.playGameOver();
        this.modals.showGameOver(this.state);
      }
    }

    // Render 3D Scene
    this.scene.render(now * 0.001, this.state.surge.active);

    requestAnimationFrame(this.loop);
  }
}
