/** Copy and links for the public landing. Nothing here talks to Orcha or the bridge. */

export type Theme = "office" | "compound";

/** Public repository. */
export const REPO_URL = "https://github.com/trungkien1208/orcha-plugin-office";
export const ORCHA_URL = "https://github.com/trungkien1208/orcha";
export const BUN_URL = "https://bun.sh/";

/** What a visitor runs: get Orcha, then add Easy Job through it. */
export const INSTALL_STEPS = [
  { cmd: "curl -fsSL https://raw.githubusercontent.com/trungkien1208/orcha/HEAD/install.sh | sh", note: "get Orcha" },
  { cmd: "orcha office install", note: "add Easy Job" },
  { cmd: "orcha office", note: "open the office" },
];
export const INSTALL_COMMANDS = INSTALL_STEPS.map((step) => step.cmd).join("\n");

/** The cast that walks across the title screen, each in a Project colour. */
export const PARADE: { skin: string; color: string }[] = [
  { skin: "headset", color: "#e0552f" },
  { skin: "robot", color: "#8fb08a" },
  { skin: "tabby", color: "#f0c24b" },
  { skin: "red-cap", color: "#c9b8a0" },
  { skin: "shiba", color: "#e0552f" },
  { skin: "crt-bot", color: "#8fb08a" },
  { skin: "curly", color: "#f0c24b" },
  { skin: "capybara", color: "#c9b8a0" },
  { skin: "specs", color: "#e0552f" },
  { skin: "raccoon", color: "#8fb08a" },
  { skin: "bun", color: "#f0c24b" },
  { skin: "black-cat", color: "#c9b8a0" },
];

/** The Boss's moves on the Floor. Work moves reach the Agent; gags never leave the browser. */
export const MOVES: { icon: string; name: string; does: string; kind: "work" | "gag" }[] = [
  { icon: "action-knock", name: "Knock", does: "Nudge an idle Agent with a short Prompt.", kind: "work" },
  { icon: "action-megaphone", name: "Megaphone", does: "Broadcast one Prompt to every Agent of a Project.", kind: "work" },
  { icon: "action-whip", name: "Whip crack", does: "A polite “hurry up”.", kind: "work" },
  { icon: "action-bonk", name: "Bonk", does: "Stop an Agent. Always asks first.", kind: "work" },
  { icon: "action-coffee", name: "Coffee", does: "Just a coffee. Nothing is sent.", kind: "gag" },
  { icon: "action-high-five", name: "High five", does: "Morale only. Nothing is sent.", kind: "gag" },
];

export const WARNINGS: { title: string; body: string }[] = [
  { title: "Local only", body: "127.0.0.1, no account, no telemetry." },
  { title: "Stopping work asks first", body: "Always." },
  { title: "Gags stay here", body: "Coffee and high fives never reach an Agent." },
];
