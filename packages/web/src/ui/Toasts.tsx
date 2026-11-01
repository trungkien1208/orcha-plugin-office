import { Toaster } from "sonner";
import { useOffice } from "../useOffice.ts";
import "./toasts.css";

/** One toaster for outcomes of actions (sent, switched, created, failed); context stays inline where it belongs. */
export function Toasts() {
  const snap = useOffice();
  return (
    <Toaster
      position="bottom-right"
      theme={snap.theme === "office" ? "light" : "dark"}
      duration={snap.calm ? 5000 : 3500}
      visibleToasts={3}
      gap={6}
      toastOptions={{ className: "ej-toast" }}
    />
  );
}
