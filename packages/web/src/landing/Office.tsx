import { type CSSProperties, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { demoAgent, makeDemoOffice } from "../floor/demo-state";
import { PixelIcon } from "../floor/PixelIcon";
import {
  type AgentState,
  benchOf,
  CAST,
  DOCS_URL,
  INITIAL_STATES,
  NAMES,
  PROJECTS,
  projectOf,
  SAMPLE_MESSAGE,
  STATE_LABEL,
  type Theme,
} from "./data";
import { BrandLogo, Portrait, portraitUrl } from "./parts";

const NativeFloor = lazy(() => import("./NativeFloor"));

const agentKey = (index: number) => `landing-agent-${index}`;
const pad = (n: number) => String(n).padStart(2, "0");

type Props = {
  entered: boolean;
  nativeReady: boolean;
  inert: boolean;
  theme: Theme;
  calm: boolean;
  onTheme: (theme: Theme) => void;
  onCalm: (calm: boolean) => void;
  onLeave: () => void;
  onInstall: () => void;
  onAbout: () => void;
};

/** The sample office: the native Floor, a Project directory and the selected Agent's Conversation. */
export function Office({ entered, nativeReady, inert, theme, calm, onTheme, onCalm, onLeave, onInstall, onAbout }: Props) {
  const [states, setStates] = useState(INITIAL_STATES);
  const [selected, setSelected] = useState(1);
  const [project, setProject] = useState<number | null>(null);
  const [feed, setFeed] = useState("Pixel has a question for you.");

  const state = states[selected] ?? "idle";
  const team = PROJECTS[projectOf(selected)] ?? PROJECTS[0];
  const count = (wanted: AgentState) => states.filter((s) => s === wanted).length;

  const select = useCallback((index: number) => {
    setSelected(index);
    setProject(projectOf(index));
  }, []);

  const office = useMemo(() => {
    const sample = makeDemoOffice(PROJECTS.length);
    sample.projects = sample.projects.map((p, i) => ({
      ...p,
      label: PROJECTS[i]?.name ?? p.label,
      projectColor: PROJECTS[i]?.color ?? p.projectColor,
    }));
    sample.agents = CAST.map((skin, i) => ({
      ...demoAgent(i, `project-${projectOf(i)}`),
      agentKey: agentKey(i),
      name: NAMES[i] ?? skin,
      skin,
      status: states[i] ?? "idle",
      orchaStatus: states[i] ?? "idle",
    }));
    return sample;
  }, [states]);

  const onFloorSelect = useCallback(
    (key: string) => {
      const index = Number(key.replace("landing-agent-", ""));
      if (Number.isInteger(index) && index >= 0 && index < CAST.length) select(index);
    },
    [select],
  );
  const onFloorProject = useCallback((id: string) => {
    const index = Number(id.replace("project-", ""));
    if (Number.isInteger(index) && index >= 0 && index < PROJECTS.length) {
      setProject(index);
      setSelected(benchOf(index)[0] ?? 0);
    }
  }, []);

  function selectFirst(wanted: AgentState) {
    const index = states.indexOf(wanted);
    if (index >= 0) select(index);
  }

  function nextQuestion() {
    const waiting = states.flatMap((s, index) => (s === "blocked" ? [index] : []));
    if (!waiting.length) return setFeed("No questions waiting. You're all caught up.");
    select(waiting[(waiting.indexOf(selected) + 1) % waiting.length] ?? 0);
  }

  function chooseProject(index: number) {
    setProject(project === index ? null : index);
    const asking = benchOf(index).find((i) => states[i] === "blocked");
    setSelected(asking ?? benchOf(index)[0] ?? 0);
  }

  // N jumps to the next Agent with a Question, as the room caption promises.
  const nextRef = useRef(nextQuestion);
  nextRef.current = nextQuestion;
  useEffect(() => {
    if (!entered) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
      if ((event.target as HTMLElement | null)?.closest("input, textarea, select, dialog")) return;
      nextRef.current();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [entered]);

  /** Answer turns Needs-you into Working; Seen turns Done into idle. */
  function answer() {
    const seen = state === "done";
    setStates((old) => old.map((s, i) => (i === selected ? (seen ? "idle" : "working") : s)));
    setFeed(seen ? `${NAMES[selected]}'s finish is marked Seen.` : `${NAMES[selected]} got your Answer. Back to work.`);
  }

  return (
    <div className="workplace" inert={inert}>
      <header className="office-header">
        <button className="wordmark" type="button" aria-label="Return to reception" onClick={onLeave}>
          <BrandLogo />
        </button>
        <span className="on-shift">
          <i />
          YOU'RE ON SHIFT
        </span>
        <nav aria-label="Office navigation">
          <button type="button" className="quiet-button" onClick={onAbout}>
            Office paperwork ↓
          </button>
          <button type="button" className="quiet-button" aria-pressed={calm} onClick={() => onCalm(!calm)}>
            <PixelIcon name={calm ? "moon" : "sun"} />
            Calm {calm ? "on" : "off"}
          </button>
          <select aria-label="Office theme" value={theme} onChange={(e) => onTheme(e.target.value as Theme)}>
            <option value="office">Cozy Office</option>
            <option value="compound">Compound</option>
          </select>
          <a href={DOCS_URL}>Setup guide</a>
        </nav>
      </header>

      <section className="office-heading" aria-labelledby="office-title">
        <div>
          <h1 id="office-title">Your shift on the Floor</h1>
        </div>
        <button type="button" className="install-button" onClick={onInstall}>
          <span className="install-label">Make it your office</span>
        </button>
      </section>

      <main className="worktable">
        <section className="room-frame" aria-label="Interactive pixel office">
          <header className="room-toolbar">
            <span>
              <PixelIcon name="office" />
              The Floor <small>LIVE DEMO</small>
            </span>
            <span>
              {CAST.length} Agents <i /> {PROJECTS.length} Projects
            </span>
          </header>
          <div className="room-scene native-scene">
            <Suspense fallback={<span className="native-loading">Preparing the Floor…</span>}>
              {nativeReady && (
                <NativeFloor
                  office={office}
                  selected={agentKey(selected)}
                  theme={theme}
                  calm={calm}
                  active={entered}
                  onSelect={onFloorSelect}
                  onProject={onFloorProject}
                  onActivity={setFeed}
                />
              )}
            </Suspense>
          </div>
          <nav className="mobile-projects" aria-label="Choose a Project">
            {PROJECTS.map((p, index) => (
              <button type="button" key={p.name} aria-pressed={project === index} onClick={() => chooseProject(index)}>
                <span style={{ background: p.color }} />
                {p.name}
              </button>
            ))}
          </nav>
          <div className="room-caption">
            <span>
              <PixelIcon name="action-knock" />
              Select an Agent to read its Conversation.
            </span>
            <span>
              <kbd>↑ ↓ ← →</kbd> walk · <kbd>N</kbd> next question
            </span>
          </div>
        </section>

        <aside className="project-binder" aria-label="Project directory">
          <div className="binder-heading">
            <PixelIcon name="folder" />
            <h2>Projects</h2>
            <span>{pad(PROJECTS.length)}</span>
          </div>
          {PROJECTS.map((p, index) => (
            <button
              type="button"
              key={p.name}
              className={`project-file${project === index ? " selected" : ""}`}
              style={{ "--project-ink": p.color } as CSSProperties}
              aria-pressed={project === index}
              onClick={() => chooseProject(index)}
            >
              <span className="file-tab">TEAM {pad(index + 1)}</span>
              <span className="file-body">
                <b>{p.name}</b>
                <span className="file-people">
                  {benchOf(index).map((agent) => (
                    <img key={agent} src={portraitUrl(agent)} width={27} height={27} alt="" />
                  ))}
                </span>
                <small>
                  {benchOf(index).length} Agents
                </small>
              </span>
            </button>
          ))}

        </aside>

        <aside className="note-panel" aria-label="Selected Agent's Conversation">
          <span className="paper-clip" aria-hidden="true" />
          <div className="note-top">
            <span>Conversation</span>
            <span className={`state-stamp ${state}`}>{STATE_LABEL[state]}</span>
          </div>
          <div className="note-person">
            <Portrait index={selected} />
            <div>
              <h2>{NAMES[selected]}</h2>
              <p>
                {team?.name} · Desk {pad(selected + 1)}
              </p>
            </div>
          </div>
          <p className="note-message">{SAMPLE_MESSAGE[state]}</p>
          <div className="note-rule" />
          <div className="note-actions">
            {state === "blocked" ? (
              <button type="button" onClick={answer}>
                Yes, run the tests <PixelIcon name="send" />
              </button>
            ) : state === "done" ? (
              <button type="button" onClick={answer}>
                Looks good. Mark Seen <PixelIcon name="check" />
              </button>
            ) : (
              <button type="button" onClick={nextQuestion}>
                Who needs me next? <PixelIcon name="chevron-right" />
              </button>
            )}
          </div>
          <div className="bench-roster">
            <span>At this Bench</span>
            {benchOf(projectOf(selected)).map((index) => (
              <button key={index} type="button" onClick={() => select(index)} aria-pressed={selected === index}>
                <Portrait index={index} />
                <b>{NAMES[index]}</b>
                <span className={`roster-status ${states[index]}`}>{STATE_LABEL[states[index] ?? "idle"]}</span>
              </button>
            ))}
          </div>
          <p className="sample-copy">
            Sample Conversation.
            <br />
            Setup connects your own Projects.
          </p>
        </aside>
      </main>

      <footer className="office-footer">
        <div className="live-message" role="status">
          <PixelIcon name="coffee" />
          <span>{feed}</span>
        </div>
        <fieldset className="status-counts" aria-label="Office status">
          <button type="button" onClick={() => selectFirst("working")}>
            <i className="working" />
            <b>{count("working")}</b> working
          </button>
          <button type="button" onClick={nextQuestion}>
            <i className="blocked" />
            <b>{count("blocked")}</b> need you
          </button>
          <button type="button" onClick={() => selectFirst("done")}>
            <i className="done" />
            <b>{count("done")}</b> done
          </button>
        </fieldset>
        <span className="local-note">Sample data · Local demo</span>
      </footer>
    </div>
  );
}
