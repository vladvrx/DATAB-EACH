import * as THREE from "three";

export class TouristManager {
  constructor(beachScene) {
    this.beachScene = beachScene;
    this.tourists = [];
    this.alienColors = ["#39ff14", "#00f0ff", "#ff007a", "#ffff00", "#bf55ec", "#ff7700"];
  }

  syncCount(targetCount, activePlots) {
    // Add tourists if below target
    while (this.tourists.length < targetCount && this.tourists.length < 20) {
      this.spawnTourist(activePlots);
    }
    // Remove if above target
    while (this.tourists.length > targetCount && this.tourists.length > 0) {
      const removed = this.tourists.pop();
      this.beachScene.scene.remove(removed.mesh);
    }
  }

  spawnTourist(activePlots) {
    const group = new THREE.Group();

    // Stylized low-poly alien visitor
    const color = this.alienColors[Math.floor(Math.random() * this.alienColors.length)];
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.1
    });

    // Torso
    const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.45, 4, 8);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.45;
    body.castShadow = true;
    group.add(body);

    // Alien Head (larger cute proportions)
    const headGeo = new THREE.SphereGeometry(0.26, 8, 8);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.y = 0.82;
    head.scale.set(1.1, 1.2, 1.0);
    head.castShadow = true;
    group.add(head);

    // Big black eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: "#111118" });
    const eyeGeo = new THREE.SphereGeometry(0.07, 6, 6);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.1, 0.86, 0.22);
    leftEye.scale.set(1, 1.4, 0.6);
    const rightEye = leftEye.clone();
    rightEye.position.x = 0.1;
    group.add(leftEye);
    group.add(rightEye);

    // Initial position on the beach shore
    const startX = (Math.random() - 0.5) * 12;
    const startZ = 1.0 + Math.random() * 3.5;
    group.position.set(startX, 0.05, startZ);

    this.beachScene.scene.add(group);

    const tourist = {
      mesh: group,
      speed: 0.8 + Math.random() * 0.6,
      targetPos: this.pickTargetPosition(activePlots),
      waitTime: Math.random() * 2,
      bobOffset: Math.random() * Math.PI * 2,
      emojiLife: 0,
      emojiEl: null
    };

    this.tourists.push(tourist);
  }

  pickTargetPosition(activePlots) {
    // 60% chance to target an active attraction, 40% to wander the beach
    const attractionPlots = activePlots ? activePlots.filter(p => p.building && p.building.type !== "cyber_palm" && p.building.type !== "algae_scrubber") : [];
    if (attractionPlots.length > 0 && Math.random() < 0.65) {
      const chosen = attractionPlots[Math.floor(Math.random() * attractionPlots.length)];
      return new THREE.Vector3(chosen.x + (Math.random() - 0.5) * 1.0, 0.05, chosen.z + 0.8);
    }
    // Random beach coordinate
    return new THREE.Vector3((Math.random() - 0.5) * 12, 0.05, 0.5 + Math.random() * 3.8);
  }

  update(deltaSeconds, activePlots, powerSatisfaction) {
    for (const t of this.tourists) {
      if (t.waitTime > 0) {
        t.waitTime -= deltaSeconds;
        // Bobbing while standing
        t.mesh.position.y = 0.05 + Math.sin(performance.now() * 0.006 + t.bobOffset) * 0.04;
        continue;
      }

      // Move toward target
      const dir = new THREE.Vector3().subVectors(t.targetPos, t.mesh.position);
      dir.y = 0;
      const dist = dir.length();

      if (dist < 0.25) {
        // Reached destination, hang out and react
        t.waitTime = 2.0 + Math.random() * 3.0;
        t.targetPos = this.pickTargetPosition(activePlots);

        // Emoji reaction
        if (Math.random() < 0.5) {
          const emoji = powerSatisfaction < 0.6 ? "⚡" : Math.random() < 0.4 ? "🍹" : Math.random() < 0.7 ? "💖" : "🍜";
          this.beachScene.addFloatingText(emoji, t.mesh.position.x, 1.2, t.mesh.position.z, "#ffffff");
        }
      } else {
        dir.normalize();
        t.mesh.position.addScaledVector(dir, t.speed * deltaSeconds);
        // Look in direction of travel
        t.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        // Walking hop
        t.mesh.position.y = 0.05 + Math.abs(Math.sin(performance.now() * 0.012 + t.bobOffset)) * 0.08;
      }
    }
  }

  clear() {
    for (const t of this.tourists) {
      this.beachScene.scene.remove(t.mesh);
    }
    this.tourists = [];
  }
}
