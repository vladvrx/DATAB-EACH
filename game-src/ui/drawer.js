import { BUILDINGS, UPGRADE_TIERS } from "../sim/buildings.js";

export class GameDrawer {
  constructor(container, onBuildClicked, onUpgradeClicked, onDemolishClicked, onDeselectPlot) {
    this.container = container;
    this.onBuildClicked = onBuildClicked;
    this.onUpgradeClicked = onUpgradeClicked;
    this.onDemolishClicked = onDemolishClicked;
    this.onDeselectPlot = onDeselectPlot;

    this.activeTab = "attraction"; // "attraction" | "energy" | "eco"
    this.selectedPlotId = null;

    this.el = document.createElement("section");
    this.el.id = "game-drawer";
    this.el.innerHTML = `
      <div class="plot-inspector" data-plot-inspector style="display: none;">
        <div class="inspector-header">
          <span class="inspector-title" data-plot-title>Plot #0</span>
          <button class="close-inspector-btn" data-close-inspector>✕</button>
        </div>
        <div class="inspector-content" data-plot-content></div>
        <div class="inspector-actions" data-plot-actions></div>
      </div>

      <nav class="drawer-tabs">
        <button class="tab-btn active" data-tab="attraction">🏪 Attractions</button>
        <button class="tab-btn" data-tab="energy">⚡ Energy</button>
        <button class="tab-btn" data-tab="eco">🌿 Eco & Island</button>
      </nav>

      <div class="drawer-cards-scroll" data-cards-container></div>
    `;

    container.appendChild(this.el);

    this.tabs = this.el.querySelectorAll("[data-tab]");
    this.cardsContainer = this.el.querySelector("[data-cards-container]");
    this.plotInspector = this.el.querySelector("[data-plot-inspector]");
    this.plotTitle = this.el.querySelector("[data-plot-title]");
    this.plotContent = this.el.querySelector("[data-plot-content]");
    this.plotActions = this.el.querySelector("[data-plot-actions]");
    this.closeInspectorBtn = this.el.querySelector("[data-close-inspector]");

    this.tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        this.tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.activeTab = tab.dataset.tab;
        this.renderCatalog();
      });
    });

    this.closeInspectorBtn.addEventListener("click", () => {
      this.selectedPlotId = null;
      this.plotInspector.style.display = "none";
      if (this.onDeselectPlot) this.onDeselectPlot();
    });

    this.renderCatalog();
  }

  setSelectedPlot(plotId, plotData, state) {
    this.selectedPlotId = plotId;
    if (plotId === null) {
      this.plotInspector.style.display = "none";
      this.lastInspectorKey = null;
      return;
    }

    const b = plotData.building;
    const def = b ? BUILDINGS[b.type] : null;
    const nextTier = b ? UPGRADE_TIERS[b.level] : null;
    const cost = nextTier ? Math.round(def.baseCost * nextTier.costFactor) : 0;
    const canAfford = nextTier && state ? state.databloons >= cost : false;
    const currentKey = `${plotId}_${b ? `${b.type}_${b.level}_${canAfford}` : "empty"}`;

    if (this.lastInspectorKey === currentKey) {
      return;
    }
    this.lastInspectorKey = currentKey;

    this.plotInspector.style.display = "block";
    this.plotTitle.textContent = `Plot #${plotId + 1} (${plotData.type.toUpperCase()})`;

    if (!plotData.building) {
      this.plotContent.innerHTML = `
        <p class="empty-plot-hint">Plot is empty. Tap any building below to build here!</p>
      `;
      this.plotActions.innerHTML = "";
    } else {
      const tier = UPGRADE_TIERS[plotData.building.level - 1] || UPGRADE_TIERS[0];
      const refund = Math.round(def.baseCost * 0.4);

      let statInfo = "";
      if (def.category === "energy") {
        statInfo = `<span class="stat-power-gen">+${Math.round(def.powerGen * tier.multiplier)} kW Power</span>`;
      } else if (def.category === "attraction") {
        statInfo = `<span class="stat-revenue">+${Math.round(def.baseRevenue * tier.multiplier)} DB/s</span> • <span class="stat-power-draw">-${def.powerDraw} kW</span>`;
      } else {
        statInfo = `<span class="stat-eco">+${Math.round(def.ecoImpact * tier.multiplier)}% Eco Health</span>`;
      }

      this.plotContent.innerHTML = `
        <div class="building-details">
          <span class="b-icon">${def.icon}</span>
          <div class="b-meta">
            <strong>${def.name} <span class="level-tag">Lv.${plotData.building.level} (${tier.name})</span></strong>
            <div class="b-stats">${statInfo}</div>
          </div>
        </div>
      `;

      this.plotActions.innerHTML = `
        ${
          nextTier
            ? `<button class="action-btn upgrade-btn ${canAfford ? "" : "disabled"}" data-upgrade-btn>
                ⏫ Upgrade to Lv.${plotData.building.level + 1} (${cost.toLocaleString()} DB)
              </button>`
            : `<div class="max-level-badge">⭐ Maximum Level Reached</div>`
        }
        <button class="action-btn demolish-btn" data-demolish-btn>
          🗑️ Demolish (+${refund.toLocaleString()} DB)
        </button>
      `;

      const upBtn = this.plotActions.querySelector("[data-upgrade-btn]");
      if (upBtn && canAfford) {
        upBtn.addEventListener("click", () => {
          if (this.onUpgradeClicked) this.onUpgradeClicked(plotId);
        });
      }

      const demBtn = this.plotActions.querySelector("[data-demolish-btn]");
      if (demBtn) {
        demBtn.addEventListener("click", () => {
          if (this.onDemolishClicked) this.onDemolishClicked(plotId);
        });
      }
    }
  }

  renderCatalog(state) {
    this.cardsContainer.innerHTML = "";
    const items = Object.values(BUILDINGS).filter((b) => b.category === this.activeTab);

    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "building-card";
      const canAfford = state ? state.databloons >= item.baseCost : true;
      if (!canAfford) card.classList.add("disabled");

      let impactHtml = "";
      if (item.category === "energy") {
        impactHtml = `<span class="tag power">+${item.powerGen} kW</span>`;
      } else if (item.category === "attraction") {
        impactHtml = `<span class="tag revenue">+${item.baseRevenue}/s</span> <span class="tag draw">-${item.powerDraw}kW</span>`;
      } else {
        impactHtml = `<span class="tag eco">+${item.ecoImpact}% Eco</span>`;
      }

      card.innerHTML = `
        <div class="card-icon">${item.icon}</div>
        <div class="card-info">
          <div class="card-title">${item.name}</div>
          <div class="card-tags">${impactHtml}</div>
          <div class="card-cost">💾 ${item.baseCost.toLocaleString()} DB</div>
        </div>
        <button class="build-action-btn ${canAfford ? "" : "disabled"}">BUILD</button>
      `;

      card.addEventListener("click", () => {
        if (canAfford && this.onBuildClicked) {
          this.onBuildClicked(item.id, this.selectedPlotId);
        }
      });

      this.cardsContainer.appendChild(card);
    });
  }

  update(state, plots) {
    if (this.selectedPlotId !== null && plots[this.selectedPlotId]) {
      this.setSelectedPlot(this.selectedPlotId, plots[this.selectedPlotId], state);
    }
    // Efficiently update disabled/affordability state without re-creating DOM
    const items = Object.values(BUILDINGS).filter((b) => b.category === this.activeTab);
    const cardNodes = this.cardsContainer.querySelectorAll(".building-card");
    items.forEach((item, idx) => {
      const card = cardNodes[idx];
      if (!card) return;
      const canAfford = state ? state.databloons >= item.baseCost : true;
      const btn = card.querySelector(".build-action-btn");
      if (canAfford) {
        card.classList.remove("disabled");
        if (btn) btn.classList.remove("disabled");
      } else {
        card.classList.add("disabled");
        if (btn) btn.classList.add("disabled");
      }
    });
  }
}
