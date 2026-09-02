const SECONDS_PER_TIME_STAGE = 240;
const UPDATE_INTERVAL_MS = 250;

const stages = Object.freeze([
  { name: "Calm", targetTime: 1, surgeEvery: Infinity, surgeLength: 0, movement: 1 },
  { name: "Rising", targetTime: 0.95, surgeEvery: 60, surgeLength: 5, movement: 0.96 },
  { name: "Charged", targetTime: 0.9, surgeEvery: 45, surgeLength: 6, movement: 0.9 },
  { name: "Severe", targetTime: 0.84, surgeEvery: 32, surgeLength: 7, movement: 0.84 },
  { name: "Critical", targetTime: 0.78, surgeEvery: 24, surgeLength: 8, movement: 0.78 },
]);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function runtimeGlobals() {
  return document.querySelector("#app")?.__vue_app__?.config?.globalProperties ?? null;
}

function completedQuestCount(globals) {
  const savedCount = Number(globals?.$savestate?.game?.vars?.questsCompletedCount);
  if (Number.isFinite(savedCount)) return Math.max(0, savedCount);
  return Object.values(globals?.$quests?.list ?? {}).filter((quest) => quest.completed).length;
}

function unlockedQuestCount(globals) {
  return Object.values(globals?.$quests?.list ?? {}).filter((quest) => quest.unlocked).length;
}

function gameplayIsActive(globals) {
  const route = globals?.$route?.name;
  const scene = globals?.$webgl?.scenes?.currentSceneID?.value;
  return route === "Home" || route === "MiniGame" || scene === "IslandWest" || scene === "CircuitBike";
}

function createHud() {
  const hud = document.createElement("aside");
  hud.id = "session-pressure";
  hud.dataset.visible = "false";
  hud.setAttribute("aria-live", "polite");
  hud.innerHTML = `
    <div class="session-pressure__heading">
      <span>Signal pressure</span>
      <strong data-pressure-stage>Calm</strong>
    </div>
    <div class="session-pressure__track" aria-hidden="true">
      <span data-pressure-fill></span>
    </div>
    <p data-pressure-status>Pressure rises with time and completed quests</p>
  `;
  document.body.appendChild(hud);
  return hud;
}

class SessionPressureController {
  constructor() {
    this.activeSeconds = 0;
    this.lastUpdate = performance.now();
    this.questBaseline = null;
    this.unlockedQuestBaseline = null;
    this.sessionQuestCompletions = 0;
    this.sessionQuestUnlocks = 0;
    this.stage = 0;
    this.surgeEndsAt = 0;
    this.nextSurgeAt = Infinity;
    this.hud = createHud();
    this.player = null;
    this.playerBaseline = null;
    this.circuit = null;
    this.circuitBaseTarget = null;
    this.lastAppliedTarget = null;
    this.interval = window.setInterval(() => this.update(), UPDATE_INTERVAL_MS);
    this.update();
  }

  get surgeActive() {
    return this.activeSeconds < this.surgeEndsAt;
  }

  update() {
    const now = performance.now();
    const delta = clamp((now - this.lastUpdate) / 1000, 0, 1);
    this.lastUpdate = now;
    const globals = runtimeGlobals();

    if (globals && document.visibilityState === "visible" && gameplayIsActive(globals)) {
      this.activeSeconds += delta;
    }
    this.updateQuestProgress(globals);
    this.updateStage(globals);
    this.updateSurge();
    this.applyCircuitDifficulty(globals);
    this.applyMovementPressure(globals);
    this.updateHud(globals);
  }

  updateQuestProgress(globals) {
    if (!globals || document.querySelector("#preloader")) return;
    const completed = completedQuestCount(globals);
    const unlocked = unlockedQuestCount(globals);
    if (this.questBaseline === null) {
      this.questBaseline = completed;
      this.unlockedQuestBaseline = unlocked;
    }
    const previous = Math.max(this.sessionQuestCompletions, this.sessionQuestUnlocks);
    this.sessionQuestCompletions = Math.max(0, completed - this.questBaseline);
    this.sessionQuestUnlocks = Math.max(0, unlocked - this.unlockedQuestBaseline);
    const milestones = Math.max(this.sessionQuestCompletions, this.sessionQuestUnlocks);
    if (milestones > previous) {
      window.dispatchEvent(new CustomEvent("databeach:quest-pressure", {
        detail: {
          completed: this.sessionQuestCompletions,
          unlocked: this.sessionQuestUnlocks,
        },
      }));
    }
  }

  updateStage(globals) {
    const timeStages = Math.floor(this.activeSeconds / SECONDS_PER_TIME_STAGE);
    const questStages = Math.max(this.sessionQuestCompletions, this.sessionQuestUnlocks);
    const nextStage = clamp(timeStages + questStages, 0, stages.length - 1);
    if (nextStage <= this.stage) return;

    this.stage = nextStage;
    this.beginSurge();
    document.body.dataset.sessionPressureStage = String(this.stage);
    window.dispatchEvent(new CustomEvent("databeach:pressure-stage", {
      detail: this.snapshot(),
    }));

    if (gameplayIsActive(globals)) {
      globals?.$webgl?.audio?.playSound?.("sfx_quest_progress", { volume: 0.55 });
    }
  }

  updateSurge() {
    const settings = stages[this.stage];
    if (this.stage > 0 && !this.surgeActive && this.activeSeconds >= this.nextSurgeAt) {
      this.beginSurge();
    }
    if (!this.surgeActive && Number.isFinite(settings.surgeEvery) && this.nextSurgeAt === Infinity) {
      this.nextSurgeAt = this.activeSeconds + settings.surgeEvery;
    }
    document.body.classList.toggle("pressure-surge", this.surgeActive);
  }

  beginSurge() {
    const settings = stages[this.stage];
    if (this.stage === 0) return;
    this.surgeEndsAt = this.activeSeconds + settings.surgeLength;
    this.nextSurgeAt = this.surgeEndsAt + settings.surgeEvery;
  }

  applyCircuitDifficulty(globals) {
    const circuit = globals?.$circuit;
    if (!circuit) return;
    if (circuit !== this.circuit || circuit.targetTime <= 0) {
      this.circuit = circuit;
      this.circuitBaseTarget = circuit.targetTime > 0 ? circuit.targetTime : null;
      this.lastAppliedTarget = null;
    }
    if (circuit.targetTime <= 0 || circuit.isStarted || circuit.isFinished) return;

    if (
      this.circuitBaseTarget === null ||
      (this.lastAppliedTarget !== null && Math.abs(circuit.targetTime - this.lastAppliedTarget) > 0.01)
    ) {
      this.circuitBaseTarget = circuit.targetTime;
    }
    const adjustedTarget = Math.round(this.circuitBaseTarget * stages[this.stage].targetTime * 10) / 10;
    circuit.targetTime = adjustedTarget;
    this.lastAppliedTarget = adjustedTarget;
  }

  applyMovementPressure(globals) {
    const player = globals?.$webgl?.scenes?.current?.player ?? null;
    if (player !== this.player) {
      this.restorePlayerSpeed();
      this.player = player;
      this.playerBaseline = player ? {
        option: Number(player.options?.speed),
        optimized: Number(player.OptSpeed),
        effect: Number(player.mainEffect?.physicsSpeed),
      } : null;
    }
    if (!player || !this.playerBaseline) return;

    const multiplier = this.surgeActive ? stages[this.stage].movement : 1;
    if (Number.isFinite(this.playerBaseline.option) && player.options) {
      player.options.speed = this.playerBaseline.option * multiplier;
    }
    if (Number.isFinite(this.playerBaseline.optimized)) {
      player.OptSpeed = this.playerBaseline.optimized * multiplier;
    }
    if (Number.isFinite(this.playerBaseline.effect) && player.mainEffect) {
      player.mainEffect.physicsSpeed = this.playerBaseline.effect * multiplier;
    }
  }

  restorePlayerSpeed() {
    if (!this.player || !this.playerBaseline) return;
    if (Number.isFinite(this.playerBaseline.option) && this.player.options) {
      this.player.options.speed = this.playerBaseline.option;
    }
    if (Number.isFinite(this.playerBaseline.optimized)) {
      this.player.OptSpeed = this.playerBaseline.optimized;
    }
    if (Number.isFinite(this.playerBaseline.effect) && this.player.mainEffect) {
      this.player.mainEffect.physicsSpeed = this.playerBaseline.effect;
    }
  }

  updateHud(globals) {
    const settings = stages[this.stage];
    const stageElement = this.hud.querySelector("[data-pressure-stage]");
    const fill = this.hud.querySelector("[data-pressure-fill]");
    const status = this.hud.querySelector("[data-pressure-status]");
    const timeProgress = (this.activeSeconds % SECONDS_PER_TIME_STAGE) / SECONDS_PER_TIME_STAGE;
    const pressure = clamp((this.stage + timeProgress) / (stages.length - 1), 0, 1);

    this.hud.dataset.visible = String(gameplayIsActive(globals));
    this.hud.dataset.stage = String(this.stage);
    stageElement.textContent = settings.name;
    fill.style.transform = `scaleX(${pressure})`;

    if (this.surgeActive) {
      status.textContent = `Interference ${Math.max(0, this.surgeEndsAt - this.activeSeconds).toFixed(1)}s`;
    } else if (this.stage === 0) {
      status.textContent = "Pressure rises with time and completed quests";
    } else {
      status.textContent = `Next surge ${Math.max(0, Math.ceil(this.nextSurgeAt - this.activeSeconds))}s`;
    }
  }

  advance(seconds) {
    this.activeSeconds += Math.max(0, Number(seconds) || 0);
    this.update();
    return this.snapshot();
  }

  snapshot() {
    return {
      stage: this.stage,
      stageName: stages[this.stage].name,
      ready: this.questBaseline !== null,
      activeSeconds: Math.round(this.activeSeconds * 10) / 10,
      sessionQuestCompletions: this.sessionQuestCompletions,
      sessionQuestUnlocks: this.sessionQuestUnlocks,
      surgeActive: this.surgeActive,
      targetTimeMultiplier: stages[this.stage].targetTime,
      movementMultiplier: this.surgeActive ? stages[this.stage].movement : 1,
    };
  }

  stop() {
    window.clearInterval(this.interval);
    this.restorePlayerSpeed();
    this.hud.remove();
    document.body.classList.remove("pressure-surge");
  }
}

export function startSessionPressure() {
  if (window.__DATAB_EACH_SESSION_PRESSURE__) return window.__DATAB_EACH_SESSION_PRESSURE__;
  const controller = new SessionPressureController();
  window.__DATAB_EACH_SESSION_PRESSURE__ = controller;
  return controller;
}
