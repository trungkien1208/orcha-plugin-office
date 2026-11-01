import { officeAssetUrl } from "../floor/asset-url";
import { LANDING_ART } from "./art.generated";
import { BenchCanvas, type DeskStatus } from "./BenchCanvas";
import { type Act, Bar, Prompt, Stage, States, Text, Window } from "./kit";
import "./product-demo.css";

// The product hero: Orcha sees an agent waiting, the office shows its raised hand,
// the Boss clicks it, answers from the chat, and the agent (and Orcha's pane) gets back to work.

type S = {
  hand: boolean;
  selected: "patch" | "pixel";
  answered: boolean;
  reply: boolean;
};

const initial: S = { hand: false, selected: "patch", answered: false, reply: false };
const POSTER: S = { hand: false, selected: "pixel", answered: true, reply: true };
const QUESTION = "Can I run the full test suite?";
const TEAM = "#e0552f";
const OTHER_TEAM = "#8fb08a";
const API_SKINS = ["headset", "red-cap", "robot", "tabby"];
const WEB_SKINS = ["shiba", "curly", "crt-bot", "capybara"];
const REST = { wide: { x: 540, y: 96 }, compact: { x: 300, y: 40 } };

async function script(a: Act<S>) {
  await a.wait(900);
  // Orcha sees Pixel waiting: the pane asks, the office raises a hand.
  await a.set({ hand: true });
  await a.wait(1100);
  await a.move("pixel-desk");
  await a.wait(250);
  await a.click();
  await a.set({ selected: "pixel" });
  await a.wait(900);
  await a.move("answer-yes");
  await a.wait(300);
  await a.click();
  await a.set({ answered: true, hand: false });
  await a.wait(700);
  await a.set({ reply: true });
  await a.move("rest");
  await a.wait(2800);
  // Back to the first frame: the Boss looks at another Desk, Pixel's pane is quiet again.
  await a.set({ ...initial });
  await a.wait(600);
}

function status(s: S): DeskStatus[] {
  return ["working", s.hand ? "blocked" : "working", "working", "working"];
}

export function ProductDemo({ calm }: { calm: boolean }) {
  return (
    <Stage
      width={840}
      height={560}
      compact={{ below: 600, width: 358, height: 560 }}
      initial={initial}
      poster={POSTER}
      script={script}
      cursor={{ at: REST, style: "arrow", ripple: true }}
      accent={TEAM}
      className="ej-demo"
    >
      {(s, _rect, layout) => (
        <>
          <Window title="Easy Job" className="ej-app">
            <div className="ej-app-body">
              <div className="ej-floor">
                <div className="ej-wall" aria-hidden="true" />
                <div className="ej-bench ej-bench-main">
                  <BenchCanvas skins={API_SKINS} statuses={status(s)} color={TEAM} still={calm} className="ej-bench-art" />
                  <span className="ej-desk-hit" data-target="pixel-desk" data-cursor="hand" />
                </div>
                <div className="ej-bench ej-bench-filler" data-crop>
                  <BenchCanvas
                    skins={WEB_SKINS}
                    statuses={["working", "working", "done", "working"]}
                    color={OTHER_TEAM}
                    still={calm}
                    className="ej-bench-art"
                  />
                </div>
              </div>

              <aside className="ej-chat">
                <States
                  value={s.selected}
                  states={{
                    patch: <Conversation name="Patch" skin={0} state="working" />,
                    pixel: (
                      <Conversation name="Pixel" skin={1} state={s.answered ? "working" : "blocked"}>
                        <div className="ej-question" data-answered={s.answered || undefined}>
                          <div className="ej-question-text">{QUESTION}</div>
                          <div className="ej-options">
                            <span className="ej-option ej-option-yes" data-target="answer-yes" data-cursor="hand" data-picked={s.answered || undefined}>
                              Yes
                            </span>
                            <span className="ej-option">No</span>
                          </div>
                        </div>
                        <div className="ej-reply" data-show={s.reply || undefined}>
                          Running 128 tests…
                        </div>
                      </Conversation>
                    ),
                  }}
                />
              </aside>
            </div>
          </Window>

          {layout === "wide" && (
            <Window chrome="terminal" title="orcha — api · Pixel" className="ej-term">
              <Prompt path="~/api">claude</Prompt>
              <div className="ss-term__line dim">Edited 3 files</div>
              <div className="ss-term__line ej-term-ask" data-show={s.hand || s.answered || undefined}>
                ? Run the test suite? (y/n)
              </div>
              <div className="ss-term__line ok ej-term-run" data-show={s.answered || undefined}>
                › y · running 128 tests
              </div>
            </Window>
          )}
          <span data-target="rest" className="ej-rest" style={{ left: REST[layout].x, top: REST[layout].y }} />
        </>
      )}
    </Stage>
  );
}

function Conversation({
  name,
  skin,
  state,
  children,
}: {
  name: string;
  skin: number;
  state: DeskStatus;
  children?: React.ReactNode;
}) {
  const portrait = LANDING_ART.portraits[API_SKINS[skin] ?? ""] ?? LANDING_ART.bossPortrait;
  return (
    <div className="ej-convo">
      <div className="ej-convo-head">
        <img src={officeAssetUrl(portrait)} width={32} height={32} alt="" />
        <div>
          <div className="ej-convo-name">{name}</div>
          <Text className="ej-convo-sub" filler w={70}>
            {`API · Desk ${skin + 1}`}
          </Text>
        </div>
        <span className="ej-pill" data-state={state}>
          {state === "blocked" ? "Needs you" : "Working"}
        </span>
      </div>
      <div className="ej-thread">
        <div className="ej-msg">
          <Bar w="70%" h={6} tone={2} />
        </div>
        <div className="ej-msg">
          <Bar w="88%" h={6} tone={2} />
          <Bar w="62%" h={6} tone={2} />
        </div>
        <div className="ej-msg ej-msg-me">
          <Bar w="54%" h={6} tone={2} />
        </div>
        {children ?? (
          <div className="ej-msg">
            <Bar w="76%" h={6} tone={2} />
            <Bar w="40%" h={6} tone={2} />
          </div>
        )}
      </div>
      <div className="ej-composer" aria-hidden="true">
        <Bar w="58%" h={6} tone={2} />
      </div>
    </div>
  );
}
