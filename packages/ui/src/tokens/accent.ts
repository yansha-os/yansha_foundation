/**
 * The only axis of visual customisation a module is allowed to choose.
 * Panel chrome, typography, motion and spacing are NOT customisable.
 */
export const ACCENTS = ["blue", "purple", "gold", "red", "green"] as const;

export type Accent = (typeof ACCENTS)[number];

export function accentText(accent: Accent = "blue") {
  switch (accent) {
    case "purple":
      return "text-syspurple";
    case "gold":
      return "text-sysgold";
    case "red":
      return "text-sysred";
    case "green":
      return "text-sysgreen";
    default:
      return "text-sysblue";
  }
}

export function accentGlow(accent: Accent = "blue") {
  switch (accent) {
    case "purple":
      return "glow-purple";
    case "gold":
      return "glow-gold";
    case "red":
      return "glow-red";
    case "green":
      return "glow-green";
    default:
      return "glow-blue";
  }
}

/**
 * Full-strength accent border, for the selected state of nav and tabs. The
 * fainter `accentBorder` is the resting/card weight.
 */
export function accentBorderStrong(accent: Accent = "blue") {
  switch (accent) {
    case "purple":
      return "border-syspurple";
    case "gold":
      return "border-sysgold";
    case "red":
      return "border-sysred";
    case "green":
      return "border-sysgreen";
    default:
      return "border-sysblue";
  }
}

export function accentBorder(accent: Accent = "blue") {
  switch (accent) {
    case "purple":
      return "border-syspurple/40";
    case "gold":
      return "border-sysgold/40";
    case "red":
      return "border-sysred/50";
    case "green":
      return "border-sysgreen/40";
    default:
      return "border-sysblue/40";
  }
}

/** Faint accent wash used behind cards and realm tiles. */
export function accentTint(accent: Accent = "blue") {
  switch (accent) {
    case "purple":
      return "bg-syspurple/10";
    case "gold":
      return "bg-sysgold/10";
    case "red":
      return "bg-sysred/10";
    case "green":
      return "bg-sysgreen/10";
    default:
      return "bg-sysblue/10";
  }
}

/** Filled accent chip — accent background with the inverse text colour. */
export function accentSolid(accent: Accent = "blue") {
  switch (accent) {
    case "purple":
      return "bg-syspurple text-abyss";
    case "gold":
      return "bg-sysgold text-abyss";
    case "red":
      return "bg-sysred text-abyss";
    case "green":
      return "bg-sysgreen text-abyss";
    default:
      return "bg-sysblue text-abyss";
  }
}
