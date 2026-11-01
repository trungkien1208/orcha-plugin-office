/** Build the standalone landing (reception + sample office) into dist/landing. No bridge, no token. */
import { cp } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

type Sheet = { sheet: string; portrait?: string; polo?: string; animations?: Record<string, number[]> };
type ArtSource = {
  characters: {
    frame: { width: number; height: number; columns: number; rows: number };
    skins: Record<string, Sheet & { portrait: string }>;
    boss: Sheet;
    bouncer: Sheet;
    animations: Record<string, number[]>;
  };
  themes: { office: { characters: { bossPortrait: string; boss: string; bouncer: string } } };
  landing: {
    brandMark: string;
    brandMark144: string;
    brandMark224: string;
    favicon32: string;
    appleTouch: string;
    ogImage: string;
    officePaperwork: Record<string, string>;
    compoundPaperwork: Record<string, string>;
  };
  ui: Record<string, string>;
  objects: Record<string, unknown>;
  layout: {
    monitor: { screen: { x: number; y: number; width: number; height: number } };
    markerNeeds: { frame: { width: number; height: number }; columns: number };
    animations: Record<string, { frame: { width: number; height: number }; columns: number }>;
  };
};
const manifest = (await Bun.file(resolve(root, "packages/web/public/office/manifest.json")).json()) as ArtSource;
// Static social metadata must follow the same manifest keys as the rendered page.
const indexPath = resolve(root, "index.html");
let indexHtml = await Bun.file(indexPath).text();
for (const [pattern, path] of [
  [/(<link rel="icon"[^>]*href=")[^"]+/, manifest.landing.favicon32],
  [/(<link rel="apple-touch-icon"[^>]*href=")[^"]+/, manifest.landing.appleTouch],
  [/(<meta property="og:image" content=")[^"]+/, manifest.landing.ogImage],
  [/(<meta name="twitter:image" content=")[^"]+/, manifest.landing.ogImage],
] as const)
  indexHtml = indexHtml.replace(pattern, `$1./${path}`);
await Bun.write(indexPath, indexHtml);

const art = {
  logo: manifest.landing.brandMark224,
  logo144: manifest.landing.brandMark144,
  logo224: manifest.landing.brandMark224,
  bossPortrait: manifest.themes.office.characters.bossPortrait,
  portraits: Object.fromEntries(Object.entries(manifest.characters.skins).map(([key, skin]) => [key, skin.portrait])),
  paperwork: { office: manifest.landing.officePaperwork, compound: manifest.landing.compoundPaperwork },
  frame: {
    width: manifest.characters.frame.width,
    height: manifest.characters.frame.height,
    columns: manifest.characters.frame.columns,
    rows: manifest.characters.frame.rows,
  },
  sheets: Object.fromEntries(
    Object.entries(manifest.characters.skins).map(([key, skin]) => [key, { sheet: skin.sheet, polo: skin.polo }]),
  ),
  animations: manifest.characters.animations,
  boss: {
    compound: manifest.characters.boss.sheet,
    office: manifest.themes.office.characters.boss,
    animations: manifest.characters.boss.animations,
  },
  bouncer: {
    compound: manifest.characters.bouncer.sheet,
    office: manifest.themes.office.characters.bouncer,
    animations: manifest.characters.bouncer.animations,
  },
  props: Object.fromEntries(
    ["benchL", "benchM", "benchR", "monitor", "chairBack", "benchTag"].map((key) => [key, manifest.objects[key]]),
  ),
  effects: Object.fromEntries(
    ["markerNeeds", "stampUrgent", "stampDone", "fxPaperPlane", "newspaper"].map((key) => [key, manifest.ui[key]]),
  ),
  monitorScreen: manifest.layout.monitor.screen,
  effectFrames: Object.fromEntries(
    ["markerNeeds", "fxPaperPlane"].map((key) => {
      const layout = key === "markerNeeds" ? manifest.layout.markerNeeds : manifest.layout.animations.fxPaperPlane;
      return [key, { frame: layout?.frame, columns: layout?.columns }];
    }),
  ),
};
await Bun.write(
  resolve(root, "packages/web/src/landing/art.generated.ts"),
  `// Generated from office/manifest.json by scripts/build-landing.ts. Never edit frame numbers here.
export const LANDING_ART: {
  logo:string; logo144:string; logo224:string; bossPortrait:string; portraits:Record<string,string>;
  paperwork:Record<"office"|"compound",Record<string,string>>;
  frame:{width:number;height:number;columns:number;rows:number};
  sheets:Record<string,{sheet:string;polo?:string}>; animations:Record<string,number[]>;
  boss:{office:string;compound:string;animations:Record<string,number[]>};
  bouncer:{office:string;compound:string;animations:Record<string,number[]>};
  props:Record<string,string>; effects:Record<string,string>;
  monitorScreen:{x:number;y:number;width:number;height:number};
  effectFrames:Record<string,{frame:{width:number;height:number};columns:number}>;
} = ${JSON.stringify(art, null, 2)};
`,
);

const vite = resolve(root, "packages/web/node_modules/vite/bin/vite.js");
const build = Bun.spawn(["bun", vite, "build", "--config", resolve(root, "packages/web/vite.landing.config.ts")], {
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
});
if (await build.exited) process.exit(build.exitCode ?? 1);

await cp(resolve(root, "README.md"), resolve(root, "dist/landing/README.md"));
await Bun.write(resolve(root, "dist/landing/.nojekyll"), "");
console.log("Landing ready in dist/landing.");
