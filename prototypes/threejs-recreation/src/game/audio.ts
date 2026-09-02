import { ASSETS } from "./data";

type Bus = "music" | "ambience" | "sfx" | "ui";

function dbToGain(db: number) {
  return 10 ** (db / 20);
}

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses = new Map<Bus, GainNode>();
  private music: HTMLAudioElement | null = null;
  private ambience: HTMLAudioElement | null = null;
  private sources: MediaElementAudioSourceNode[] = [];
  private unlocked = false;

  async unlock() {
    if (this.unlocked) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = dbToGain(-4);
    this.master.connect(this.context.destination);

    const levels: Record<Bus, number> = {
      music: -13,
      ambience: -18,
      sfx: -7,
      ui: -9,
    };
    for (const [name, db] of Object.entries(levels) as [Bus, number][]) {
      const gain = this.context.createGain();
      gain.gain.value = dbToGain(db);
      gain.connect(this.master);
      this.buses.set(name, gain);
    }

    this.music = this.createLoop(ASSETS.music, "music");
    this.ambience = this.createLoop(ASSETS.ambience, "ambience");
    await this.context.resume();
    await Promise.allSettled([this.music.play(), this.ambience.play()]);
    this.unlocked = true;
  }

  private createLoop(url: string, bus: Bus) {
    const element = new Audio(url);
    element.loop = true;
    element.preload = "auto";
    if (this.context) {
      const source = this.context.createMediaElementSource(element);
      source.connect(this.buses.get(bus)!);
      this.sources.push(source);
    }
    return element;
  }

  setDialogueDucking(active: boolean) {
    if (!this.context) return;
    const music = this.buses.get("music");
    if (!music) return;
    const target = dbToGain(active ? -25 : -13);
    music.gain.cancelScheduledValues(this.context.currentTime);
    music.gain.setTargetAtTime(target, this.context.currentTime, active ? 0.03 : 0.3);
  }

  playUi(frequency = 520, duration = 0.055) {
    if (!this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.12, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(this.buses.get("ui")!);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
  }

  dispose() {
    this.music?.pause();
    this.ambience?.pause();
    void this.context?.close();
    this.sources = [];
    this.buses.clear();
  }
}
