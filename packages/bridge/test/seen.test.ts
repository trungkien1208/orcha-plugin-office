import type { Agent, LocalState, OfficeState } from "@easy-job/shared";
import { emptyLocal, emptyOffice } from "@easy-job/shared";
import { expect, test } from "bun:test";
import { markSeen } from "../src/actions.ts";
import type { OfficeLink } from "../src/orcha/link.ts";
import type { ActivityLog } from "../src/state/activity.ts";

test("Seen is logged once per finish, not every time the Agent is opened", () => {
  const local: LocalState = emptyLocal();
  const agent = { paneId: "p1", agentKey: "k1", name: "Headset", workspaceId: "w1", completionSeq: 3 } as Agent;
  const office: OfficeState = { ...emptyOffice("/tmp/sock"), agents: [agent] };
  const link = { state: () => office, updateLocal: (mutate: (draft: LocalState) => void) => mutate(local) } as unknown as OfficeLink;
  const texts: string[] = [];
  const activity = { append: (entry: { text: string }) => { texts.push(entry.text); } } as unknown as ActivityLog;
  markSeen(link, "p1", activity);
  markSeen(link, "p1", activity);
  expect(texts).toEqual(["Seen Headset"]);
  agent.completionSeq = 4;
  markSeen(link, "p1", activity);
  expect(texts).toHaveLength(2);
});
