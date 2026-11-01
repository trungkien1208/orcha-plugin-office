import { officeAssetUrl } from "../floor/asset-url";
import { PixelIcon } from "../floor/PixelIcon";
import { LANDING_ART } from "./art.generated";
import { MOVES, ORCHA_URL, REPO_URL, WARNINGS } from "./data";
import { InsertCoin } from "./Install";
import { ProductDemo } from "./ProductDemo";

type Props = { calm: boolean; inert: boolean; demo: boolean; onTitle: () => void };

/** One screen under the title: what it is and how to run it on the left, how to play on the right. */
export function Manual({ calm, inert, demo, onTitle }: Props) {
  return (
    <div className="manual" inert={inert}>
      <header className="bar">
        <button type="button" className="bar-brand" onClick={onTitle} aria-label="Back to the title screen">
          <img src={officeAssetUrl(LANDING_ART.logo144)} width={32} height={32} alt="" />
          <span>easy job</span>
        </button>
        <span className="bar-note">a local client for Orcha</span>
        <a className="bar-link" href={ORCHA_URL} target="_blank" rel="noreferrer">
          What's Orcha?
        </a>
        <a className="bar-link" href={REPO_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </header>

      <main className="board">
        <section className="story" aria-labelledby="story-title">
          <p className="tag">The story so far</p>
          <h1 id="story-title">Your AI agents got an office.</h1>
          <p className="story-lede">
            Easy Job draws what{" "}
            <a href={ORCHA_URL} target="_blank" rel="noreferrer">
              Orcha
            </a>{" "}
            is running as a pixel office. Every workspace is a team at a Bench, every coding
            agent sits at a Desk, and you walk the Floor as the Boss. One look tells you who is working, who is done
            and who needs you.
          </p>
          <div className="insert" id="insert-coin">
            <h2 className="mini-head">Insert coin</h2>
            <InsertCoin />
          </div>
        </section>

        <section className="play" aria-labelledby="play-title">
          <h2 id="play-title" className="mini-head">
            How it plays
          </h2>
          <div className="demo-slot">{demo && <ProductDemo calm={calm} />}</div>
          <div className="moves">
            <span className="moves-head">Boss moves</span>
            <ul className="move-list" aria-label="What the Boss can do">
              {MOVES.map((move) => (
                <li key={move.name} className={`move move-${move.kind}`} title={move.does}>
                  <span className="move-icon">
                    <PixelIcon name={move.icon} size={32} />
                  </span>
                  <b>{move.name}</b>
                </li>
              ))}
            </ul>
            <p className="move-legend">
              <i className="dot-work" /> reaches the Agent <i className="dot-gag" /> just for fun
            </p>
          </div>
        </section>
      </main>

      <footer className="rules">
        <b className="rules-head">⚠ House rules</b>
        {WARNINGS.map((w) => (
          <span key={w.title}>
            <b>{w.title}.</b> {w.body}
          </span>
        ))}
      </footer>
    </div>
  );
}
