"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Hand, ListChecks, Map, Palette, X, Zap } from "lucide-react";
import { PLAYER_COLORS, QUESTS, type QuestId } from "@/game/data";
import {
  ThreeGameEngine,
  type GameDialogue,
  type RaceStatus,
} from "@/game/engine";
import type { GameSave } from "@/game/state";

type PhonePanel = "map" | "quests" | null;

const EMPTY_STATE: GameSave = {
  version: 1,
  colorIndex: 0,
  points: 0,
  position: null,
  inventory: [],
  acceptedQuests: [],
  completedQuests: [],
  openedChests: [],
  repairedHouses: [],
  healedCitizens: [],
  bridgeRepaired: false,
  bikeBestTime: null,
};

const EMPTY_RACE: RaceStatus = {
  active: false,
  checkpoint: 0,
  total: 0,
  elapsed: 0,
};

export function ThreeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ThreeGameEngine | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joystickPointer = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Preparing Cove");
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<GameSave>(EMPTY_STATE);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [dialogue, setDialogue] = useState<GameDialogue | null>(null);
  const [phonePanel, setPhonePanel] = useState<PhonePanel>(null);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [race, setRace] = useState<RaceStatus>(EMPTY_RACE);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [stick, setStick] = useState({ x: 0, y: 0 });

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new ThreeGameEngine(canvas, {
      onProgress: (value, label) => {
        setProgress(value);
        setProgressLabel(label);
      },
      onReady: () => setReady(true),
      onState: setState,
      onPrompt: setPrompt,
      onDialogue: (nextDialogue) => {
        setDialogue(nextDialogue);
        engineRef.current?.setPaused(Boolean(nextDialogue));
      },
      onRace: setRace,
      onToast: showToast,
      onError: setFatalError,
    });
    engineRef.current = engine;
    void engine.start();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      engine.dispose();
      engineRef.current = null;
    };
  }, [showToast]);

  const setPanel = (panel: PhonePanel) => {
    setPhonePanel(panel);
    setColorsOpen(false);
    engineRef.current?.setPaused(Boolean(panel));
  };

  const togglePanel = (panel: Exclude<PhonePanel, null>) => {
    setPanel(phonePanel === panel ? null : panel);
  };

  const updateJoystick = (event: React.PointerEvent<HTMLDivElement>) => {
    if (joystickPointer.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = rect.width / 2;
    const x = (event.clientX - (rect.left + radius)) / radius;
    const y = (event.clientY - (rect.top + radius)) / radius;
    const length = Math.max(1, Math.hypot(x, y));
    const normalized = { x: x / length, y: y / length };
    setStick(normalized);
    engineRef.current?.setMoveInput(normalized.x, normalized.y);
  };

  const releaseJoystick = (event: React.PointerEvent<HTMLDivElement>) => {
    if (joystickPointer.current !== event.pointerId) return;
    joystickPointer.current = null;
    setStick({ x: 0, y: 0 });
    engineRef.current?.setMoveInput(0, 0);
  };

  const questStatus = (id: QuestId) => {
    if (state.completedQuests.includes(id)) return "complete";
    if (state.acceptedQuests.includes(id)) return "active";
    return "available";
  };

  return (
    <main className="game-shell" data-ready={ready}>
      <canvas ref={canvasRef} className="game-canvas" aria-label="DATAB-EACH Three.js game" />

      <div className="game-hud" aria-live="polite">
        <div className="points-pill">
          <Zap size={17} aria-hidden="true" />
          <span>{state.points}</span>
        </div>

        <button
          className="palette-toggle"
          type="button"
          aria-label="Change alien color"
          aria-expanded={colorsOpen}
          onClick={() => {
            setColorsOpen((open) => !open);
            if (phonePanel) setPanel(null);
          }}
        >
          <Palette size={20} />
        </button>

        {colorsOpen && (
          <section className="color-panel" aria-label="Alien colors">
            {PLAYER_COLORS.map((color, index) => (
              <button
                key={color.id}
                type="button"
                className="color-swatch"
                data-selected={state.colorIndex === index}
                style={{ backgroundColor: color.body }}
                aria-label={`${color.id} alien color`}
                onClick={() => {
                  engineRef.current?.setColor(index);
                  setColorsOpen(false);
                }}
              />
            ))}
          </section>
        )}

        {race.active && (
          <div className="race-hud">
            <span>CHECKPOINT {Math.min(race.checkpoint + 1, race.total)}/{race.total}</span>
            <strong>{race.elapsed.toFixed(1)}s</strong>
          </div>
        )}

        {toast && <div className="game-toast">{toast}</div>}

        {prompt && !dialogue && !phonePanel && (
          <div className="interaction-prompt">
            <span className="interaction-key">E</span>
            {prompt}
          </div>
        )}

        <div
          className="touch-stick"
          role="application"
          aria-label="Movement joystick"
          onPointerDown={(event) => {
            joystickPointer.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            updateJoystick(event);
          }}
          onPointerMove={updateJoystick}
          onPointerUp={releaseJoystick}
          onPointerCancel={releaseJoystick}
        >
          <span
            className="touch-stick-knob"
            style={{ transform: `translate(${stick.x * 30}px, ${stick.y * 30}px)` }}
          />
        </div>

        <button
          type="button"
          className="interact-button"
          aria-label={prompt ?? "Interact"}
          disabled={!prompt}
          onClick={() => engineRef.current?.queueInteract()}
        >
          <Hand size={28} />
        </button>

        <nav className="phone-tabs" aria-label="Phone">
          <button
            type="button"
            data-active={phonePanel === "map"}
            aria-label="Map"
            onClick={() => togglePanel("map")}
          >
            <Map size={22} />
            <span>Map</span>
          </button>
          <button
            type="button"
            data-active={phonePanel === "quests"}
            aria-label="Quests"
            onClick={() => togglePanel("quests")}
          >
            <ListChecks size={22} />
            <span>Quests</span>
          </button>
        </nav>
      </div>

      {phonePanel && (
        <section className="phone-panel" aria-label={phonePanel === "map" ? "Cove map" : "Quests"}>
          <header>
            <div>
              <span>DATAB-EACH PHONE</span>
              <h2>{phonePanel === "map" ? "Cove map" : "Quests"}</h2>
            </div>
            <button type="button" aria-label="Close phone" onClick={() => setPanel(null)}>
              <X size={22} />
            </button>
          </header>
          {phonePanel === "map" ? (
            <div className="map-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/map_1024.cove-only-final.webp" alt="Map of Cove Island" />
              <span className="map-player" aria-label="Your position" />
            </div>
          ) : (
            <div className="quest-list">
              {(Object.keys(QUESTS) as QuestId[]).map((id) => {
                const quest = QUESTS[id];
                const status = questStatus(id);
                return (
                  <article key={id} data-status={status}>
                    <div className="quest-status">{status}</div>
                    <h3>{quest.title}</h3>
                    <p>{quest.objective}</p>
                  </article>
                );
              })}
              <div className="quest-stats">
                <span>Chests {state.openedChests.length}/9</span>
                <span>Houses {state.repairedHouses.length}/4</span>
                <span>Glorbs helped {state.healedCitizens.length}/3</span>
                {state.bikeBestTime !== null && <span>Best race {state.bikeBestTime.toFixed(1)}s</span>}
              </div>
            </div>
          )}
        </section>
      )}

      {dialogue && (
        <section className="dialogue-panel" role="dialog" aria-modal="true" aria-label={dialogue.speaker}>
          <span className="dialogue-speaker">{dialogue.speaker}</span>
          <p>{dialogue.text}</p>
          <div className="dialogue-actions">
            {dialogue.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                data-primary={action.primary}
                autoFocus={action.primary}
                onClick={() => engineRef.current?.handleDialogueAction(action.id)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {!ready && !fatalError && (
        <section className="loading-screen" aria-live="polite">
          <div className="loading-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h1>DATAB-EACH</h1>
          <p>{progressLabel}</p>
          <div className="loading-bar"><span style={{ width: `${progress}%` }} /></div>
          <strong>{Math.round(progress)}%</strong>
        </section>
      )}

      {fatalError && (
        <section className="fatal-screen" role="alert">
          <h1>Three.js could not start</h1>
          <p>{fatalError}</p>
          <button type="button" onClick={() => window.location.reload()}>Reload</button>
        </section>
      )}

      <aside className="desktop-help">WASD move · Shift run · Drag to orbit · E interact</aside>
    </main>
  );
}
