export class GameModals {
  constructor(container, onRestart) {
    this.container = container;
    this.onRestart = onRestart;

    this.overlay = document.createElement("div");
    this.overlay.id = "game-modal-overlay";
    this.overlay.className = "modal-overlay";
    this.overlay.style.display = "none";
    this.overlay.innerHTML = `
      <div class="modal-card" data-modal-card>
        <div class="modal-badge" data-modal-icon>🎉</div>
        <h2 class="modal-title" data-modal-title>Victory!</h2>
        <p class="modal-message" data-modal-desc>You built a thriving 5-star alien eco-paradise!</p>
        <div class="modal-stats" data-modal-stats></div>
        <button class="modal-btn" data-modal-btn>PLAY AGAIN</button>
      </div>
    `;

    container.appendChild(this.overlay);

    this.modalCard = this.overlay.querySelector("[data-modal-card]");
    this.modalIcon = this.overlay.querySelector("[data-modal-icon]");
    this.modalTitle = this.overlay.querySelector("[data-modal-title]");
    this.modalDesc = this.overlay.querySelector("[data-modal-desc]");
    this.modalStats = this.overlay.querySelector("[data-modal-stats]");
    this.modalBtn = this.overlay.querySelector("[data-modal-btn]");

    this.modalBtn.addEventListener("click", () => {
      this.hide();
      if (this.onRestart) this.onRestart();
    });
  }

  showVictory(state) {
    this.modalCard.className = "modal-card victory";
    this.modalIcon.textContent = "🏆";
    this.modalTitle.textContent = "5-STAR RESORT ACHIEVED!";
    this.modalDesc.textContent = "Congratulations! Data B-each is the highest-rated alien eco-resort in the quadrant!";

    this.modalStats.innerHTML = `
      <div class="stat-row"><span>Total Earned:</span> <strong>💾 ${Math.round(state.lifetimeEarned).toLocaleString()} DB</strong></div>
      <div class="stat-row"><span>Final Rating:</span> <strong>⭐ ${state.resortRating.toFixed(1)} / 5.0</strong></div>
      <div class="stat-row"><span>Eco Health:</span> <strong>🌿 ${Math.round(state.ecoHealth)}%</strong></div>
      <div class="stat-row"><span>Surges Survived:</span> <strong>⚡ ${state.stats.surgesSurvived}</strong></div>
      <div class="stat-row"><span>Buildings Placed:</span> <strong>🏗️ ${state.stats.buildingsPlaced}</strong></div>
    `;
    this.modalBtn.textContent = "PLAY AGAIN";
    this.overlay.style.display = "flex";
  }

  showGameOver(state) {
    this.modalCard.className = "modal-card defeat";
    this.modalIcon.textContent = "⚠️";
    this.modalTitle.textContent = "RESORT EVACUATED";
    this.modalDesc.textContent = state.statusMessage || "The resort collapsed due to system failure.";

    this.modalStats.innerHTML = `
      <div class="stat-row"><span>Survival Time:</span> <strong>⏱️ ${Math.floor(state.gameTime / 60)}m ${Math.floor(state.gameTime % 60)}s</strong></div>
      <div class="stat-row"><span>Total Revenue:</span> <strong>💾 ${Math.round(state.lifetimeEarned).toLocaleString()} DB</strong></div>
      <div class="stat-row"><span>Tip for Next Run:</span> <em>Ensure you build Solar & Turbines before high-demand shops!</em></div>
    `;
    this.modalBtn.textContent = "TRY AGAIN";
    this.overlay.style.display = "flex";
  }

  hide() {
    this.overlay.style.display = "none";
  }
}
