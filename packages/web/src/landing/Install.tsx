import { useEffect, useRef, useState } from "react";
import { PixelIcon } from "../floor/PixelIcon";
import { BUN_URL, DOCS_URL, INSTALL_COMMANDS, ORCHA_URL } from "./data";

/** The install commands with Copy; falls back to selecting the text when the clipboard is blocked. */
export function InstallCommands({ timeCard = false }: { timeCard?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [punched, setPunched] = useState("");
  const code = useRef<HTMLElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMANDS);
      setCopied(true);
      setPunched(new Date().toLocaleTimeString(undefined, {hour:"2-digit",minute:"2-digit"}));
      setMessage("Copied. Run these from the Easy Job project folder.");
    } catch {
      const selection = getSelection();
      if (code.current && selection) {
        const range = document.createRange();
        range.selectNodeContents(code.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setMessage("Commands selected. Press Ctrl+C or ⌘C to copy.");
    }
  }

  return (
    <>
      <div className={`install-commands${timeCard ? " time-card-commands" : ""}`}>
        <button type="button" aria-label="Copy installation commands" onClick={() => void copy()}>
          <PixelIcon name={copied ? "check" : "copy"} />
          {copied ? "Copied" : "Copy"}
        </button>
        <pre>
          <code ref={code}>{timeCard ? INSTALL_COMMANDS.split("\n").map((command,index)=><span className="time-card-row" data-row={index+1} data-punched={punched} key={command}>{command}{index < INSTALL_COMMANDS.split("\n").length-1 ? "\n" : ""}</span>) : INSTALL_COMMANDS}</code>
        </pre>
      </div>
      <p className="copy-feedback" role="status">
        {message}
      </p>
      <p className="requirements">
        Requires{" "}
        <a href={BUN_URL} target="_blank" rel="noreferrer">
          Bun 1.4+
        </a>{" "}
        and{" "}
        <a href={ORCHA_URL} target="_blank" rel="noreferrer">
          Orcha 0.9.12
        </a>
        .
      </p>
    </>
  );
}

export function InstallDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog className="install-dialog" ref={dialog} aria-labelledby="install-heading" onClose={onClose}>
      <header>
        <span>Installation instructions</span>
        <button type="button" aria-label="Close installation instructions" onClick={onClose}>
          <PixelIcon name="close" />
        </button>
      </header>
      <h2 id="install-heading">Open your local office</h2>
      <p>From the Easy Job project folder, install the local launcher and open your office.</p>
      <InstallCommands />
      <a className="setup-docs" href={DOCS_URL}>
        Read the setup guide
      </a>
    </dialog>
  );
}
