export class GameHUD {
  constructor(container, onMuteToggle) {
    this.container = container;
    this.onMuteToggle = onMuteToggle;

    this.el = document.createElement("header");
    this.el.id = "game-hud";
    this.el.innerHTML = `
      <div class="hud-row top-metrics">
        <div class="metric-badge rating-badge">
          <span class="icon">⭐</span>
          <span class="val" data-rating>2.5</span>
          <span class="sub">Rating</span>
        </div>

        <div class="metric-badge power-badge" data-power-badge>
          <div class="badge-header">
            <span class="icon">⚡</span>
            <span class="val" data-power>0 / 0 kW</span>
          </div>
          <div class="hud-bar"><div class="bar-fill" data-power-fill style="width: 100%;"></div></div>
        </div>

        <div class="metric-badge eco-badge" data-eco-badge>
          <div class="badge-header">
            <span class="icon">🌿</span>
            <span class="val" data-eco>80%</span>
          </div>
          <div class="hud-bar"><div class="bar-fill" data-eco-fill style="width: 80%;"></div></div>
        </div>

        <button class="mute-btn" data-mute-btn title="Toggle Audio">🔊</button>
      </div>

      <div class="hud-row bottom-metrics">
        <div class="credit-counter">
          <span class="credit-icon">💾</span>
          <span class="credit-val" data-credits>2,500</span>
          <span class="credit-rate" data-rate>+0/s</span>
        </div>

        <div class="phase-badge" data-phase-badge>
          <span class="phase-icon">⏱️</span>
          <span class="phase-name" data-phase>Sunrise</span>
        </div>
      </div>

      <div class="surge-warning-banner" data-surge-banner style="display: none;">
        ⚠️ SIGNAL SURGE ACTIVE! High Power Demand!
      </div>
    `;

    container.appendChild(this.el);

    this.ratingEl = this.el.querySelector("[data-rating]");
    this.powerEl = this.el.querySelector("[data-power]");
    this.powerFill = this.el.querySelector("[data-power-fill]");
    this.powerBadge = this.el.querySelector("[data-power-badge]");
    this.ecoEl = this.el.querySelector("[data-eco]");
    this.ecoFill = this.el.querySelector("[data-eco-fill]");
    this.ecoBadge = this.el.querySelector("[data-eco-badge]");
    this.creditsEl = this.el.querySelector("[data-credits]");
    this.rateEl = this.el.querySelector("[data-rate]");
    this.phaseEl = this.el.querySelector("[data-phase]");
    this.surgeBanner = this.el.querySelector("[data-surge-banner]");
    this.muteBtn = this.el.querySelector("[data-mute-btn]");

    this.muteBtn.addEventListener("click", () => {
      if (this.onMuteToggle) {
        const isMuted = this.onMuteToggle();
        this.muteBtn.textContent = isMuted ? "🔇" : "🔊";
      }
    });
  }

  update(state) {
    this.ratingEl.textContent = state.resortRating.toFixed(1);

    this.powerEl.textContent = `${state.powerDraw} / ${state.powerGen} kW`;
    const pSat = state.powerSatisfaction;
    this.powerFill.style.width = `${Math.min(100, Math.round(pSat * 100))}%`;

    if (pSat < 0.5) {
      this.powerBadge.classList.add("danger");
      this.powerBadge.classList.remove("warning");
    } else if (pSat < 1.0) {
      this.powerBadge.classList.add("warning");
      this.powerBadge.classList.remove("danger");
    } else {
      this.powerBadge.classList.remove("warning", "danger");
    }

    const eco = Math.round(state.ecoHealth);
    this.ecoEl.textContent = `${eco}%`;
    this.ecoFill.style.width = `${eco}%`;
    if (eco < 30) {
      this.ecoBadge.classList.add("danger");
    } else {
      this.ecoBadge.classList.remove("danger");
    }

    this.creditsEl.textContent = Math.round(state.databloons).toLocaleString();
    this.rateEl.textContent = `+${state.incomeRate || 0}/s`;

    this.phaseEl.textContent = state.phaseName;

    if (state.surge.active) {
      this.surgeBanner.style.display = "block";
      this.surgeBanner.textContent = `⚠️ SIGNAL SURGE: ${Math.ceil(state.surge.remaining)}s (Grid Strained!)`;
    } else if (state.surge.countdown <= 15) {
      this.surgeBanner.style.display = "block";
      this.surgeBanner.textContent = `⚡ SURGE INCOMING: ${Math.ceil(state.surge.countdown)}s! Check Power!`;
    } else {
      this.surgeBanner.style.display = "none";
    }
  }
}
