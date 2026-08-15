const MUTE_KEY = "rift-sfx-muted";

export type SfxKind = "ui" | "deal" | "strike" | "dodge" | "heal" | "death" | "win" | "lose";

let muted = typeof localStorage !== "undefined" && localStorage.getItem(MUTE_KEY) === "1";

export function isSfxMuted(): boolean {
  return muted;
}

export function setSfxMuted(next: boolean): void {
  muted = next;
  if (typeof localStorage !== "undefined") localStorage.setItem(MUTE_KEY, next ? "1" : "0");
}

type Tone = { freq: number; duration: number; type: OscillatorType };

const TONES: Record<SfxKind, Tone> = {
  ui: { freq: 520, duration: 0.06, type: "square" },
  deal: { freq: 380, duration: 0.08, type: "triangle" },
  strike: { freq: 180, duration: 0.12, type: "sawtooth" },
  dodge: { freq: 740, duration: 0.09, type: "square" },
  heal: { freq: 620, duration: 0.16, type: "sine" },
  death: { freq: 90, duration: 0.28, type: "sawtooth" },
  win: { freq: 880, duration: 0.22, type: "triangle" },
  lose: { freq: 140, duration: 0.3, type: "sine" },
};

export function playSfx(kind: SfxKind, audioContext?: AudioContext): AudioContext | undefined {
  if (muted) return audioContext;
  const ctx =
    audioContext ?? (typeof AudioContext === "undefined" ? undefined : new AudioContext());
  if (!ctx) return audioContext;
  const tone = TONES[kind];
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = tone.type;
  oscillator.frequency.value = tone.freq;
  gain.gain.value = 0.04;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + tone.duration);
  return ctx;
}

export function sfxFromLog(line: string): SfxKind | null {
  if (line.includes("摸了")) return "deal";
  if (line.includes("闪避")) return "dodge";
  if (line.includes("治疗") || line.includes("回复")) return "heal";
  if (line.includes("伤害") || line.includes("普攻")) return "strike";
  if (line.includes("阵亡")) return "death";
  return null;
}
