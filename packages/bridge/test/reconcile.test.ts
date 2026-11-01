import { agentKeyOf, fallbackCatalog, type SessionSnapshot } from "@easy-job/shared";
import { emptyLocal } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { readCatalog } from "../src/state/catalog.ts";
import {
  compareAgents,
  hashHue,
  projectColor,
  reconcile,
  rememberWaiting,
  skinForPane,
  stripLabel,
} from "../src/state/reconcile.ts";

const fixturePath = path.join(import.meta.dir, "fixtures/snapshot-live.json");

function liveSnapshot(): SessionSnapshot {
  const raw = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as {
    result: { snapshot: SessionSnapshot };
  };
  return raw.result.snapshot;
}

describe("reconcile", () => {
  test("maps the captured snapshot onto Projects and Agents", () => {
    const state = reconcile(liveSnapshot(), emptyLocal(), 1_700_000_000_000, "/tmp/herdr.sock");
    expect(state.orcha.connected).toBe(true);
    expect(state.orcha.version).toBe("0.9.5");
    expect(state.orcha.protocol).toBe(22);
    expect(state.projects).toHaveLength(16);
    expect(state.agents).toHaveLength(9);
    expect(state.counts.projects).toBe(16);
    expect(state.counts.working).toBe(2);
    expect(state.counts.done).toBe(1);
    expect(state.counts.needsMe).toBe(0);
    expect(state.projects[0]?.label).toBe("~Sam");
    expect(state.projects[0]?.terminalCount).toBe(3);
    expect(state.projects[1]?.label).toBe("acme-superapp");
    expect(state.projects[1]?.terminalCount).toBe(1);
    const done = state.agents.find((agent) => agent.paneId === "w2:p1");
    expect(done?.status).toBe("done");
    expect(done?.task).toBe("Review the activity branch");
    expect(done?.model).toBe("claude-opus-5-5");
    const catalog = fallbackCatalog();
    const expectedSkin = catalog.cast[hashHue(agentKeyOf(done ?? {})) % catalog.cast.length];
    expect(done?.skin).toBe(expectedSkin);
    expect(done?.name).toBe(catalog.skins.find((skin) => skin.id === expectedSkin)?.name);
    expect(["crew-cut", "ponytail", "beard", "bob", "spike", "braids", "beanie"]).not.toContain(done?.skin);
    const codex = state.agents.find((agent) => agent.paneId === "wQ:p2");
    expect(codex?.kind).toBe("codex");
    expect(codex?.status).toBe("working");
    expect(codex?.session?.value).toBe("01a18b50-cbd7-7af0-9933-288ed2f91e89");
  });

  test("strips Nerd Font glyphs from Project labels", () => {
    expect(stripLabel("\uf015  ~Sam")).toBe("~Sam");
    expect(stripLabel("\uf10b  acme-superapp")).toBe("acme-superapp");
    expect(stripLabel("\u{100000} Git branch")).toBe("Git branch");
    expect(stripLabel("plain")).toBe("plain");
    const state = reconcile(liveSnapshot(), emptyLocal(), 0, "sock");
    expect(state.projects.map((project) => project.label)).toEqual([
      "~Sam",
      "acme-superapp",
      "Clinic RPM",
      "travel-marketing",
      "Design Kit",
      "Search Jobs",
      "COGSHOP",
      "health360",
      "myportfolio",
      "game-ios",
      "orcha",
      "OPS_AUTOMATION",
      "kiosk-app",
      "NOTES",
      "Party Agent",
      "PartyAgent2",
    ]);
  });

  test("project colour matches the style guide hash", () => {
    expect(hashHue("acme-superapp")).toBe(161);
    expect(projectColor("acme-superapp")).toBe("hsl(161 60% 58%)");
    expect(projectColor("~Sam")).toBe("hsl(25 60% 58%)");
  });

  test("a Seen Done Agent shows idle until a newer finish", () => {
    const local = emptyLocal();
    const agent = liveSnapshot().agents.find((item) => item.pane_id === "w2:p1");
    if (!agent) throw new Error("missing agent");
    local.seen[agentKeyOf(agent)] = 217;
    const seen = reconcile(liveSnapshot(), local, 0, "sock");
    expect(seen.agents.find((agent) => agent.paneId === "w2:p1")?.status).toBe("idle");
    expect(seen.counts.done).toBe(0);
    local.seen[agentKeyOf(agent)] = 216;
    const older = reconcile(liveSnapshot(), local, 0, "sock");
    expect(older.agents.find((agent) => agent.paneId === "w2:p1")?.status).toBe("done");
  });

  test("waitingSince is kept across refreshes", () => {
    const snapshot = liveSnapshot();
    const agent = snapshot.agents.find((item) => item.pane_id === "wQ:p3");
    if (!agent) throw new Error("missing agent");
    agent.agent_status = "blocked";
    const first = reconcile(snapshot, emptyLocal(), 1_000, "sock");
    expect(first.agents.find((item) => item.paneId === "wQ:p3")?.waitingSince).toBe(1_000);
    const local = rememberWaiting(emptyLocal(), first);
    const second = reconcile(snapshot, local, 9_000, "sock");
    expect(second.agents.find((item) => item.paneId === "wQ:p3")?.waitingSince).toBe(1_000);
    agent.agent_status = "working";
    const left = reconcile(snapshot, local, 9_500, "sock");
    expect(left.agents.find((item) => item.paneId === "wQ:p3")?.waitingSince).toBeUndefined();
    expect(rememberWaiting(local, left).waitingSince["wQ:p3"]).toBeUndefined();
  });

  test("sorts Needs me, then Done, longest wait first", () => {
    const snapshot = liveSnapshot();
    for (const agent of snapshot.agents) agent.agent_status = "idle";
    const blocked = snapshot.agents.find((agent) => agent.pane_id === "w9:p1");
    const older = snapshot.agents.find((agent) => agent.pane_id === "wC:p1");
    const done = snapshot.agents.find((agent) => agent.pane_id === "w2:p1");
    if (!blocked || !older || !done) throw new Error("missing agents");
    blocked.agent_status = "blocked";
    older.agent_status = "blocked";
    done.agent_status = "done";
    const local = emptyLocal();
    local.waitingSince[agentKeyOf(blocked)] = 500;
    local.waitingSince[agentKeyOf(older)] = 100;
    const state = reconcile(snapshot, local, 900, "sock");
    expect(state.agents.slice(0, 3).map((agent) => agent.paneId)).toEqual(["wC:p1", "w9:p1", "w2:p1"]);
    const copy = [...state.agents].reverse().sort(compareAgents);
    expect(copy.map((agent) => agent.paneId)).toEqual(state.agents.map((agent) => agent.paneId));
  });

  test("an Orcha name wins over the Skin name", () => {
    const snapshot = liveSnapshot();
    const agent = snapshot.agents[0];
    if (!agent) throw new Error("missing agent");
    agent.name = "Headset";
    const state = reconcile(snapshot, emptyLocal(), 0, "sock");
    expect(state.agents.find((item) => item.paneId === agent.pane_id)?.name).toBe("Headset");
    const local = emptyLocal();
    local.skins[agentKeyOf(agent)] = "beanie";
    const skinned = reconcile(snapshot, local, 0, "sock");
    expect(skinned.agents.find((item) => item.paneId === agent.pane_id)?.skin).toBe("beanie");
  });

  test("a moved pane keeps its Skin, Seen mark and Desk", () => {
    const snapshot = liveSnapshot();
    const agent = snapshot.agents.find((item) => item.pane_id === "w2:p1");
    if (!agent?.agent_session || agent.completion_seq == null) throw new Error("missing agent");
    const key = agentKeyOf(agent);
    const local = emptyLocal();
    local.seen[key] = agent.completion_seq;
    local.skins[key] = "beanie";
    local.floor.seats[key] = { projectId: agent.workspace_id, benchIndex: 0, seat: 3 };
    const before = reconcile(snapshot, local, 0, "sock");
    const moved = structuredClone(snapshot);
    const copy = moved.agents.find((item) => item.agent_session?.value === agent.agent_session?.value);
    if (!copy) throw new Error("missing copy");
    copy.pane_id = "w9:p9";
    copy.workspace_id = "w9";
    const after = reconcile(moved, local, 0, "sock");
    const again = after.agents.find((item) => item.agentKey === key);
    expect(again?.paneId).toBe("w9:p9");
    expect(again?.skin).toBe("beanie");
    expect(again?.status).toBe("idle");
    expect(before.agents.find((item) => item.agentKey === key)?.status).toBe("idle");
    expect(after.floor.seats[key]).toBe(3);
  });

  test("the manifest cast is the default and extra skins are picker-only", () => {
    const catalog = readCatalog(path.join(import.meta.dir, "../../web/public/office/manifest.json"));
    expect(catalog.cast).toEqual([
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
    ]);
    expect(catalog.skins.map((skin) => skin.id)).toContain("crew-cut");
    expect(catalog.cast).not.toContain("crew-cut");
    expect(catalog.skins.map((skin) => skin.id)).not.toContain("violet");
    const assigned = skinForPane("session-1", undefined, catalog);
    expect(catalog.cast).toContain(assigned);
    expect(skinForPane("session-1", "beanie", catalog)).toBe("beanie");
    expect(skinForPane("session-1", "violet", catalog)).toBe(assigned);
    expect(readCatalog("/missing/manifest.json").cast).toEqual([...fallbackCatalog().cast]);
  });

  test("a protocol other than 22 sets one warning and stays connected", () => {
    const other = liveSnapshot();
    other.protocol = 21;
    const warned = reconcile(other, emptyLocal(), 0, "/tmp/herdr.sock");
    expect(warned.orcha.connected).toBe(true);
    expect(warned.orcha.protocolWarning).toBe("Orcha protocol 21 is untested; some actions may fail");
    const current = liveSnapshot();
    expect(reconcile(current, emptyLocal(), 0, "/tmp/herdr.sock").orcha.protocolWarning).toBeUndefined();
  });
});
