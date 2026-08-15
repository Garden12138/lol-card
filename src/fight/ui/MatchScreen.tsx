import { useEffect, useRef, useState } from "react";
import { getChampionById } from "../../data/champions";
import { EMPTY_INPUT, type FightState, type InputBits } from "../engine/types";
import { tick } from "../engine/tick";
import { drawMatch } from "../render/drawMatch";
import type { ArtMap } from "../puppet/renderPuppet";
import { FightHud } from "./FightHud";

const P1: Record<string, keyof InputBits> = {
  KeyA: "left",
  KeyD: "right",
  KeyW: "up",
  KeyS: "down",
  KeyJ: "lp",
  KeyK: "lk",
  KeyU: "hp",
  KeyI: "hk",
};

const P2: Record<string, keyof InputBits> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  BracketLeft: "lp",
  BracketRight: "lk",
  Semicolon: "hp",
  Quote: "hk",
  Numpad4: "lp",
  Numpad5: "lk",
  Numpad1: "hp",
  Numpad2: "hk",
};

function blank(): InputBits {
  return { ...EMPTY_INPUT };
}

export function MatchScreen({
  initial,
  onDone,
  onExit,
}: {
  initial: FightState;
  onDone: (state: FightState) => void;
  onExit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(initial);
  const inputsRef = useRef<[InputBits, InputBits]>([blank(), blank()]);
  const artRef = useRef<ArtMap>(new Map());
  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    for (const fighter of initial.fighters) {
      const champ = getChampionById(fighter.id);
      const url = champ?.skins[0]?.loadingUrl;
      if (!url) continue;
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        if (!cancelled) artRef.current.set(fighter.id, image);
      };
      image.src = url;
    }
    return () => {
      cancelled = true;
    };
  }, [initial]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        setPaused((value) => !value);
        return;
      }
      const p1 = P1[event.code];
      const p2 = P2[event.code];
      if (p1) {
        event.preventDefault();
        inputsRef.current[0][p1] = true;
      }
      if (p2) {
        event.preventDefault();
        inputsRef.current[1][p2] = true;
      }
    };
    const up = (event: KeyboardEvent) => {
      const p1 = P1[event.code];
      const p2 = P2[event.code];
      if (p1) inputsRef.current[0][p1] = false;
      if (p2) inputsRef.current[1][p2] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let acc = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      if (!paused) {
        acc += dt;
        while (acc >= 1000 / 60) {
          acc -= 1000 / 60;
          const next = tick(stateRef.current, inputsRef.current[0], inputsRef.current[1]);
          stateRef.current = next;
          if (next.phase === "matchOver") {
            onDone(next);
            return;
          }
        }
        setHud(stateRef.current);
      }
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      drawMatch(ctx, stateRef.current, artRef.current, canvas.width, canvas.height);
      raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [paused, onDone]);

  return (
    <div className="fight-match">
      <FightHud state={hud} onPause={() => setPaused(true)} />
      <canvas ref={canvasRef} className="fight-canvas" aria-label="格斗场地" />
      {paused && (
        <div className="fight-pause">
          <p>暂停</p>
          <button type="button" onClick={() => setPaused(false)}>
            继续
          </button>
          <button type="button" onClick={onExit}>
            退出
          </button>
        </div>
      )}
    </div>
  );
}
