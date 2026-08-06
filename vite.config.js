import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/* api/chat.js is a Vercel Serverless Function — it normally only runs when
   deployed on Vercel, or locally via `vercel dev`. This plugin lets plain
   `npm run dev` serve /api/chat too, by loading the handler through Vite's
   SSR module loader and adapting the raw Node req/res Vite's dev server
   hands us into the (req.body / res.status().json()) shape the handler
   expects — the same contract Vercel's runtime provides. */
function apiChatDevMiddleware() {
  return {
    name: "api-chat-dev-middleware",
    configureServer(server) {
      server.middlewares.use("/api/chat", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }

        let raw = "";
        req.on("data", (chunk) => (raw += chunk));
        req.on("end", async () => {
          try {
            req.body = raw ? JSON.parse(raw) : {};
          } catch {
            req.body = {};
          }
          res.status = (code) => {
            res.statusCode = code;
            return res;
          };
          res.json = (payload) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(payload));
          };

          try {
            const mod = await server.ssrLoadModule("/api/chat.js");
            await mod.default(req, res);
          } catch (err) {
            console.error("[api/chat dev middleware]", err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
              error: "CHAT_ERROR",
              message: "Error local al ejecutar api/chat.js (revisá la consola de `npm run dev`).",
              detail: err?.message || String(err),
            }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Vite only auto-exposes VITE_-prefixed vars to the client bundle. The
  // handler above also needs the unprefixed ANTHROPIC_API_KEY (and reads
  // VITE_SUPABASE_URL/ANON_KEY itself too), so load every var from
  // .env.local into process.env — mirroring what `vercel dev` does — so the
  // dev middleware sees exactly what the deployed function would.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    plugins: [react(), apiChatDevMiddleware()],
  };
});
