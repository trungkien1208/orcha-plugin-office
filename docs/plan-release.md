# Plan: releasing Orcha and Easy Job together

Goal: someone who has never heard of either types one command and gets Orcha, with Easy Job one "yes" away.
Updates are one click or one command, and Easy Job can ship without a new Orcha. It is a fun project: no store,
no accounts, no signing fees, nothing to do by hand that CI can do.

## The shape

Two repos, two release trains. Easy Job rides Orcha's own plugin system (`orcha plugin install|update`), so Orcha
needs no special installer for it.

| | Orcha | Easy Job |
|---|---|---|
| Repo | `trungkien1208/orcha` (public, Apache-2.0, herdr fork) | `trungkien1208/orcha-plugin-office` (public snapshots, Apache-2.0); work happens in the private `orcha-plugin-office-dev` and reaches it through `scripts/publish-public.ts` |
| Tag | `orcha-X.Y.Z` (exists) | `vX.Y.Z` (version in `package.json`) |
| Release | packages per platform (exists) | `easy-job-<platform>.tar.gz` for darwin-arm64/x64, linux-x64/arm64, and `SHA256SUMS` |
| Install | `install.sh` / `install.ps1` (exists) | `orcha plugin install trungkien1208/orcha-plugin-office --ref plugin` |

The `plugin` branch holds two files and nothing else, rewritten by CI on every tag:

- `herdr-plugin.toml`: the version, `min_herdr_version`, actions (Open, Status, Stop), the server pane, and one
  build step, `sh fetch.sh`.
- `fetch.sh`: downloads `easy-job-<this machine>.tar.gz` from the release named in the manifest, checks it against
  `SHA256SUMS`, unpacks `bin/easy-job` and `bin/easy-job-web/`.

Why a branch instead of the main tree: Orcha fetches the ref with `--depth 1`; the main tree is ~70 MB of review
screenshots and art sources, the `plugin` branch is two small files. The binary comes from the release.

Compatibility: Easy Job already falls back to Orcha protocols 22 and 23, so any Orcha since `min_herdr_version`
works, with fewer features on an older one. A release that truly needs a newer Orcha raises `min_herdr_version`;
Orcha then refuses that update with a clear message instead of installing something broken.

macOS needs no signing: `fetch.sh` uses `curl`, and files fetched that way carry no quarantine flag.

## What the user sees

```
curl -fsSL https://raw.githubusercontent.com/trungkien1208/orcha/HEAD/install.sh | sh
…
Add Easy Job, a pixel-art office for your agents? (y/N)
```

- Yes: Orcha runs `orcha plugin install trungkien1208/orcha-plugin-office --ref plugin --yes`. `prefix E` or
  `orcha office` opens it.
- No: never asked again. `orcha office install` adds it later, `orcha office remove` takes it out.

Updates never happen without a click:

- Orcha checks installed GitHub plugins when it checks for its own updates. When Easy Job's `plugin` branch has a
  new commit, Orcha's UI shows "Easy Job 0.2.0 is out · Update" (once per version) and its plugin list marks it.
- Easy Job shows the same notice in its top bar. It never goes online itself (the local-only rule): the bridge asks
  Orcha (`plugin.updates`) and Update calls `plugin.update { id }`; Orcha runs the update and restarts the plugin's
  server pane, and the page reconnects on its own.
- `orcha update` updates Orcha, then its GitHub plugins. `orcha plugin update easy-job` updates only Easy Job.
- A setting "Update plugins automatically", off by default.

## Work

### Easy Job (this repo), done

- `bun run release` (`scripts/release.ts`): web build, `bun build --compile` for four targets, tarballs,
  `SHA256SUMS`, and `dist/release/plugin/` (the two files with the version filled in). `--only <platform>` for a
  quick local build.
- `integrations/orcha-plugin/release/`: the release manifest and `fetch.sh` (`EASY_JOB_RELEASE_BASE` points it at
  a local folder for tests). The dev manifest one folder up still runs `easy-job` from PATH.
- `.github/workflows/ci.yml`: `bun run check` and the Playwright e2e on every push and PR.
- `.github/workflows/release.yml`: on `vX.Y.Z`, checks the tag against `package.json`, builds, publishes the release
  (draft until every file is attached), then rewrites the `plugin` branch.

### Easy Job, next

- Update notice in the top bar once Orcha has `plugin.updates` (hidden on an older Orcha), behind the `orcha/`
  adapter.
- When run as a plugin, keep state in `HERDR_PLUGIN_STATE_DIR` and use `HERDR_BIN_PATH` for `orcha` (plan P3).

### Orcha (Orcha repo): see `docs/orcha-release-prompt.md`

### Going public (Easy Job repo)

- `LICENSE` (Apache-2.0, like Orcha) and a README: one GIF of the Floor, the install line, what it reads and what
  it never does (local only, no telemetry, no tokens).
- Scrub before flipping to public: personal paths in docs, `docs/review/` screenshots that show real projects or
  emails.
- GitHub topic `herdr-plugin` so the marketplace lists it (it reads manifests on the default branch).
- Then: repo public, tag `v0.1.0`, Orcha release with the offer.

## Release day

- Easy Job only: bump `package.json`, tag `vX.Y.Z`, push the tag. Users see the Update notice. Orcha untouched.
- Orcha: its own flow (`orcha-X.Y.Z`). Nothing to change for Easy Job unless the offer text changes.

## Later

- Homebrew tap when people ask; Windows after Orcha's Windows build and named pipes in the bridge; signing and the
  Tauri app (ADR 0005, phase 2).
