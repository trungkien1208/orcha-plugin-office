// The Easy Job version this bridge was built from. `bun build --compile` inlines the JSON, so the released binary
// knows its version without reading files at runtime.
import pkg from "../../../package.json" with { type: "json" };

/** `EASY_JOB_DEV_VERSION` is only set by `dev:fake`, to play the update flow without building a release. */
export const APP_VERSION: string = process.env.EASY_JOB_DEV_VERSION || pkg.version;
