# The local bridge requires a per-run token, not just a localhost bind

The bridge can type into agents (prompts, answers, keys), and binding to 127.0.0.1 does not stop other web pages in the same browser from sending requests to it (CSRF, DNS rebinding). Each run generates a random token, opens the browser with it in the URL fragment, and rejects any REST or WebSocket request without it; it also checks Host and Origin and never enables CORS.
