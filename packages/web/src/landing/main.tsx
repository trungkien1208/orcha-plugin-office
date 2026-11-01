import { createRoot } from "react-dom/client";
import "@fontsource/chakra-petch/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/source-serif-4/latin-700.css";
import "@fontsource/source-serif-4/latin-400-italic.css";
import { Landing } from "./Landing";
import "./landing.css";

createRoot(document.getElementById("root") as HTMLElement).render(<Landing />);
