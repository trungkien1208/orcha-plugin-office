import { useEffect, useState } from "react";
import { token } from "../api.ts";
import { Modal, ModalTitle } from "./Modal.tsx";

// The API needs the bearer token, so <img src> cannot load it directly: fetch once, keep an object URL per path.
const loaded = new Map<string, Promise<string>>();

function objectUrl(src: string): Promise<string> {
  let pending = loaded.get(src);
  if (!pending) {
    const auth = token();
    pending = fetch(src, { headers: auth ? { authorization: `Bearer ${auth}` } : {} })
      .then((response) => { if (!response.ok) throw new Error(`${response.status}`); return response.blob(); })
      .then((blob) => URL.createObjectURL(blob));
    pending.catch(() => loaded.delete(src));
    loaded.set(src, pending);
  }
  return pending;
}

/** A thumbnail that opens the full image in a Radix dialog: Esc, the backdrop or a click on the image closes it. */
export function ImagePreview({ src, alt, large }: { src: string; alt: string; large?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={large ? "auth-img large" : "auth-img"} title={`${alt} · click to enlarge`} onClick={() => setOpen(true)}>
        <img src={src} alt={alt} />
      </button>
      {open ? (
        <Modal onClose={() => setOpen(false)} overlayClass="lightbox">
          <figure className="lightbox-panel" onClick={() => setOpen(false)} onKeyDown={(event) => { if (event.key === "Enter") setOpen(false); }}>
            <ModalTitle className="sr-only">{alt}</ModalTitle>
            <img src={src} alt={alt} />
          </figure>
        </Modal>
      ) : null}
    </>
  );
}

/** A bridge-served image (it needs the token, so it is fetched, not linked). */
export function AuthImage({ src, alt, large }: { src: string; alt: string; large?: boolean }) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setFailed(false);
    void objectUrl(src).then((value) => { if (live) setUrl(value); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [src]);
  if (failed) return <span className="auth-img missing" title={alt}>Image unavailable</span>;
  if (!url) return <span className={large ? "auth-img large loading" : "auth-img loading"} role="img" aria-label={`Loading ${alt}`} />;
  return <ImagePreview src={url} alt={alt} large={large} />;
}
