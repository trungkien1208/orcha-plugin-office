import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConnectionNotice } from "./ui/ConnectionNotice.tsx";
import { AccountHost } from "./ui/Accounts.tsx";
import { HandoffHost } from "./ui/Handoff.tsx";
import { CreatedAgentSelection } from "./ui/CreatedAgent.tsx";
import { TeamFlightObserver } from "./ui/Team.tsx";
import { App } from "./App.tsx";
import { Toasts } from "./ui/Toasts.tsx";
import { boot } from "./store.ts";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queries.ts";
import "./theme.css";
import "./looks.css";
import "@fontsource/oswald/500.css";
import "@fontsource/oswald/600.css";
import "@fontsource/oswald/700.css";
import "@fontsource/chakra-petch/500.css";
import "@fontsource/chakra-petch/600.css";
import "@fontsource/chakra-petch/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

boot();
createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConnectionNotice />
      <AccountHost />
      <HandoffHost />
      <CreatedAgentSelection />
      <TeamFlightObserver />
      <App />
      <Toasts />
    </QueryClientProvider>
  </StrictMode>,
);
