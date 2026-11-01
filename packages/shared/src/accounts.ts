/** Account the Agent is signed in as. Tokens never appear here. */
export type AccountKind = "claude" | "codex" | "cursor" | "other";

export type FuelWindowInfo = { key: string; label: string; left: number; resetAt?: number };

export type AccountInfo = {
  id: string;
  label: string;
  kind: AccountKind;
  email?: string;
  plan?: string;
  /** Expanded config folder. Missing means the default (`~/.claude`). */
  dir?: string;
  /** A sign-in exists for this account. */
  signedIn: boolean;
  /** Orcha's default (`claude-active`). */
  active: boolean;
  /** From `~/.cache/orcha/limits/<id>.json`. Percent left, never a token. */
  fuel: FuelWindowInfo[];
  /** Pane ids of Agents currently on this account. */
  panes: string[];
};

export type SwitchMode = "keychain" | "restart" | "handoff";

/** Dry run shown before a switch. It changes nothing. */
export type SwitchPlan = {
  mode: SwitchMode;
  allowed: boolean;
  reason?: string;
  /** Pane ids sharing the folder. Keychain mode moves all of them. */
  alsoMoves: string[];
  /** Restart: the session file is already in the new folder, or can be linked. */
  sessionLinked?: boolean;
  /** Restart: the Agent is working right now. */
  needsIdle: boolean;
};

export type Capabilities = { accountApi: boolean; handoff: boolean };

export const NO_ACCOUNT_API = "Orcha has no account API yet";

/** Orcha has no account socket API. Hand off is on only when its script is installed. */
export function officeCapabilities(handoff: boolean): Capabilities {
  return { accountApi: false, handoff };
}

/** The 5-hour window (`session`) under 10% is low fuel. No window is not low. */
export function fuelIsLow(fuel: FuelWindowInfo[]): boolean {
  const five = fuel.find((window) => window.key === "session");
  return five != null && five.left < 10;
}

/** A dry-run plan. Keychain is refused until Orcha grows an account API. */
export function planSwitch(input: {
  mode: SwitchMode;
  alsoMoves?: string[];
  sessionLinked?: boolean;
  needsIdle?: boolean;
  handoff?: boolean;
}): SwitchPlan {
  if (input.mode === "keychain") {
    return {
      mode: "keychain",
      allowed: false,
      reason: NO_ACCOUNT_API,
      alsoMoves: input.alsoMoves ?? [],
      needsIdle: false,
    };
  }
  if (input.mode === "handoff") {
    const allowed = input.handoff === true;
    return {
      mode: "handoff",
      allowed,
      reason: allowed ? undefined : "Hand off script is not installed",
      alsoMoves: [],
      needsIdle: false,
    };
  }
  return {
    mode: "restart",
    allowed: true,
    alsoMoves: [],
    sessionLinked: input.sessionLinked,
    needsIdle: input.needsIdle === true,
  };
}
