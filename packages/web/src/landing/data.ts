/** Sample office for the public landing. Nothing here talks to Orcha or the bridge. */

export type AgentState = "working" | "blocked" | "done" | "idle";
export type Theme = "office" | "compound";

/** Public repository; leave empty to hide the GitHub link. */
export const REPO_URL = "";
export const ORCHA_URL = "https://github.com/trungkien1208/orcha";
export const BUN_URL = "https://bun.sh/";
export const DOCS_URL = "./README.md";

export const INSTALL_COMMANDS = "bun install\nbun run install-local\neasy-job";

export const STATE_LABEL: Record<AgentState, string> = {
  working: "Working",
  blocked: "Needs you",
  done: "Done",
  idle: "On a break",
};

export const PROJECTS = [
  { name: "Website", color: "#c77550" },
  { name: "API", color: "#70a597" },
  { name: "Desktop", color: "#9282a7" },
];

/** Four Agents per Project, in Bench order. */
export const AGENTS_PER_PROJECT = 4;
export const CAST = [
  "headset",
  "red-cap",
  "robot",
  "tabby",
  "bun",
  "shiba",
  "crt-bot",
  "curly",
  "specs",
  "capybara",
  "raccoon",
  "black-cat",
];
export const NAMES = ["Patch", "Pixel", "Bits", "Tabby", "Loop", "Bean", "Byte", "Syntax", "Root", "Mochi", "Echo", "Mint"];
export const INITIAL_STATES: AgentState[] = [
  "working",
  "blocked",
  "working",
  "idle",
  "working",
  "done",
  "idle",
  "working",
  "done",
  "idle",
  "working",
  "idle",
];

export const SAMPLE_MESSAGE: Record<AgentState, string> = {
  blocked: "The changes are ready. Can I run the full test suite?",
  done: "All done. The tests passed and the changes are ready for you to review.",
  working: "Working through the changes. I'll give you a shout when I'm done.",
  idle: "I'm all caught up. Ready for the next task whenever you are.",
};

export const projectOf = (agent: number) => Math.floor(agent / AGENTS_PER_PROJECT);
export const benchOf = (project: number) =>
  Array.from({ length: AGENTS_PER_PROJECT }, (_, offset) => project * AGENTS_PER_PROJECT + offset);

type Point = { icon: string; title: string; body: string };

export const HOUSE_RULES: Point[] = [
  {
    icon: "privacy",
    title: "Everything stays on this machine",
    body: "Easy Job listens on 127.0.0.1 with a per-run token. No account, no telemetry.",
  },
  {
    icon: "stop",
    title: "Stopping work always asks first",
    body: "Removing an Agent or closing a Project always asks for confirmation.",
  },
  {
    icon: "moon",
    title: "Calm mode stills the Floor",
    body: "Switch Calm on to pause motion, gags and sound.",
  },
];
