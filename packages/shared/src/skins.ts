export type SkinInfo = { id: string; name: string };

export type SkinCatalog = {
  /** Ids the office assigns by itself. */
  cast: readonly string[];
  /** Cast first, then every other skin the picker can select. */
  skins: readonly SkinInfo[];
};

/** The 16 default looks: 8 humans, then 8 robots and animals. */
export const FALLBACK_CAST = [
  "headset",
  "red-cap",
  "bun",
  "shiny",
  "curly",
  "mohawk",
  "silver",
  "specs",
  "robot",
  "crt-bot",
  "shiba",
  "husky",
  "tabby",
  "black-cat",
  "raccoon",
  "capybara",
] as const;

/** Drawn humans that stay in the Skin picker and are never assigned by default. */
export const EXTRA_SKINS = ["crew-cut", "ponytail", "beard", "bob", "spike", "braids", "beanie"] as const;

const NAMES: Record<string, string> = {
  headset: "Headset",
  "red-cap": "Red Cap",
  bun: "Bun",
  shiny: "Shiny",
  curly: "Curly",
  mohawk: "Mohawk",
  silver: "Silver",
  specs: "Specs",
  robot: "Robot",
  "crt-bot": "CRT Bot",
  shiba: "Shiba",
  husky: "Husky",
  tabby: "Tabby",
  "black-cat": "Black Cat",
  raccoon: "Raccoon",
  capybara: "Capybara",
  "crew-cut": "Crew Cut",
  ponytail: "Ponytail",
  beard: "Beard",
  bob: "Bob",
  spike: "Spike",
  braids: "Braids",
  beanie: "Beanie",
};

export function agentKeyOf(agent: {
  pane_id?: string;
  paneId?: string;
  terminal_id?: string;
  agent_session?: { value?: string };
  session?: { value?: string };
}): string {
  return agent.agent_session?.value || agent.session?.value || agent.terminal_id || agent.pane_id || agent.paneId || "";
}

export function skinName(id: string): string {
  return (
    NAMES[id] ??
    id
      .split("-")
      .map((part) => {
        const first = part[0];
        return first ? first.toUpperCase() + part.slice(1) : part;
      })
      .join(" ")
  );
}

export function catalogFrom(cast: readonly string[], skinIds: readonly string[]): SkinCatalog {
  const defaults = cast.length ? [...cast] : [...FALLBACK_CAST];
  const ids = [...new Set([...defaults, ...skinIds])];
  return {
    cast: defaults,
    skins: ids.map((id) => ({ id, name: skinName(id) })),
  };
}

export function fallbackCatalog(): SkinCatalog {
  return catalogFrom(FALLBACK_CAST, EXTRA_SKINS);
}
