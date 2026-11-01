# Status updates use one subscription entry per pane, rebuilt when panes change

> Superseded for Orcha protocol 23 (2026-11-01): when `server.capabilities` lists the sync API, the bridge uses one
> all-pane status subscription and `session.changed` deltas on a multiplexed connection. This ADR still describes
> the path for older Orchas.

Orcha's `pane.agent_status_changed` subscription requires a `pane_id` (there is no wildcard), and one unknown pane id makes Orcha reject the whole request and close the connection. The bridge therefore keeps a lifecycle subscription (workspace/tab/pane events, no ids needed) and a separate status subscription listing every current pane; when panes are created or closed it opens a fresh status subscription from an authoritative snapshot and retires the old one, and treats a rejection as "state is stale, re-snapshot and retry". Logged as a gap in `docs/orcha-api-gaps.md`.
