# Prompt for Orcha: ship Easy Job as an installable, updatable plugin

Paste everything below the line into the Orcha agent.

---

Easy Job (repo `trungkien1208/orcha-plugin-office`, private now, public at launch) is now released as a normal
Orcha plugin installed from GitHub. Each Easy Job tag `vX.Y.Z` publishes a GitHub release
(`easy-job-<platform>.tar.gz` for darwin-arm64, darwin-x64, linux-x64, linux-arm64, plus `SHA256SUMS`) and
rewrites the repo's `plugin` branch, which holds only:

- `herdr-plugin.toml`: `id = "easy-job"`, the version, `min_herdr_version`, actions `open` / `status` / `stop`,
  pane `server` (`bin/easy-job serve --no-open`), and one `[[build]]` step: `sh fetch.sh`.
- `fetch.sh`: downloads the tarball for this machine from release `v<version>`, checks the sha256, unpacks
  `bin/easy-job` and `bin/easy-job-web/` into the plugin folder. `EASY_JOB_RELEASE_BASE` overrides the source
  (any curl URL, including `file://`).

So installing is `orcha plugin install trungkien1208/orcha-plugin-office --ref plugin --yes`, and
`orcha plugin update easy-job` already works with today's plugin system. Make it the obvious path for users, and
let people update Easy Job without waiting for an Orcha release. Never install, update or start anything without
the user's consent.

## Tasks (one commit each, Conventional Commits, tests for behaviour changes)

1. **Offer installs from GitHub.** In `OFFERED_PLUGINS` (`src/orcha_app.rs`, and the copy in the popup test in
   `src/client/shell/orcha_popup.rs`), change Easy Job's `install` from `easy-job orcha-plugin install` to Orcha's
   own `plugin install trungkien1208/orcha-plugin-office --ref plugin --yes` (run with the current executable, not
   PATH). Offer it on macOS and Linux even when no `easy-job` command is on PATH, since installing no longer needs
   one. Keep the four choices (add, add and start with Orcha, not now, never) and the `.plugin-offers.json`
   memory. If the install fails (no network, private repo, build step error), show the plugin log line and leave
   the offer to ask again next time.

2. **Installer question.** `install.sh` (and `install.ps1` once Windows is supported; skip it for now) asks after
   installing Orcha: `Add Easy Job, a pixel-art office for your agents? (y/N)`, default no. `--office` answers yes,
   `--no-office` answers no, and a non-interactive run answers no. Yes runs the same install as task 1 and records
   the answer so the in-app offer does not ask again.

3. **`orcha office`.** `orcha office` opens it (the plugin's `open` action), `orcha office install` runs task 1's
   install, `orcha office update` runs `plugin update easy-job --yes`, `orcha office remove` uninstalls it (ask
   first; stop its server pane; keep `~/.easy-job` unless a second question says delete it). Add them to the CLI
   reference.

4. **Update check for GitHub plugins.** Wherever Orcha checks for its own new version, also check each installed
   GitHub plugin: `git ls-remote` the recorded source and ref, compare with the installed commit, and when they
   differ read the remote `herdr-plugin.toml` (fetch `--depth 1`) for the new `version` and `min_herdr_version`.
   Cache the result like Orcha's own check (no extra network traffic per keypress), and treat no network as "no
   news".

5. **Update notice in Orcha.** When task 4 finds a newer compatible version, show it once per version: "Easy Job
   0.2.0 is out · Update" (dismissible), mark it in the plugin list, and offer Update there. If the new
   `min_herdr_version` is newer than this Orcha, say "Easy Job 0.2.0 needs Orcha X; run `orcha update`" instead
   of offering Update. Update runs `plugin update <id> --yes`, then restarts the plugin's autostart panes so they
   run the new files (today running panes keep the old installation).

6. **Socket API for clients.** Easy Job must never go online itself, so it asks Orcha:
   - `plugin.updates {}` → `{ "type": "plugin_updates", "plugins": [{ "id", "current_version", "latest_version",
     "compatible", "needs_herdr_version"?, "source", "ref" }] }`, from task 4's cache (no network on call; a
     `refresh: true` param may trigger a check).
   - `plugin.update { "id" }` → runs task 5's update and restart; returns `{ "type": "plugin_updated", "id",
     "version" }` or an error with the build log tail. Confirmation happens in the client that calls it (Easy Job
     shows an Update button; the click is the consent).
   - Advertise both in `server.capabilities` `methods`, add feature `plugin.updates`, and emit
     `plugin.updates_changed` when task 4 finds something new. Document them in `socket-api.mdx`.

7. **`orcha update` follows plugins.** After a successful self-update, run `plugin update` for GitHub-installed
   plugins, printing one line per plugin (updated / already current / needs a newer Orcha / failed). Add a
   setting "Update plugins automatically" (off by default); when on, task 4's finds are applied without the notice.

8. **Release.** Bump the Orcha version, release notes in `docs/orcha/releases/<version>.md` mentioning the
   Easy Job offer and `orcha office`, and keep protocol 24 as is. Check what `min_herdr_version` compares against
   (Cargo still says `0.9.5` while Orcha is `0.9.12`); Easy Job's manifest uses `0.9.0`, so make sure both
   current and next Orcha accept it, and document which version string plugins should name.

## Testing before Easy Job is public

The repo is private, so `fetch.sh` cannot download releases yet. Test with a local build instead:

```sh
cd ~/Project/PartyAgent-2-claude && bun run release --only darwin-arm64
cp -R dist/release/plugin /tmp/easy-job-plugin && cd /tmp/easy-job-plugin
EASY_JOB_RELEASE_BASE="file://$HOME/Project/PartyAgent-2-claude/dist/release" sh fetch.sh
orcha plugin link /tmp/easy-job-plugin
```

For tasks 4 to 7, point a test at a throwaway public repo with the same `plugin` branch layout, or fake the
remote in unit tests. After launch, the real check is: fresh machine → `install.sh` → yes → `prefix E` opens Easy
Job; tag a new Easy Job → the notice appears in Orcha and in Easy Job → Update → the page reconnects on the new
version.

## Do not

- Modify the Easy Job repo (gaps go back to the Owner).
- Download or start anything without a yes, or add telemetry.
- Read or log tokens; the update check uses plain `git` with the user's own credentials.
