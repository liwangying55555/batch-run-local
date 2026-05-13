import fastify from "fastify";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import open from "open";
import { getSettings } from "../config/store.js";
import { registerApiRoutes } from "./routes.js";

function getWebRoot(): string {
  return join(dirname(dirname(fileURLToPath(import.meta.url))), "web");
}

export async function startServer(options: { openBrowser?: boolean } = {}): Promise<void> {
  const settings = getSettings();
  const app = fastify({
    logger: false,
  });
  const webRoot = getWebRoot();

  await registerApiRoutes(app, settings);

  app.get("/", async (_request, reply) => {
    return reply.type("text/html").send(await readFile(join(webRoot, "index.html"), "utf8"));
  });

  app.get("/main.js", async (_request, reply) => {
    return reply.type("application/javascript").send(await readFile(join(webRoot, "main.js"), "utf8"));
  });

  app.get("/style.css", async (_request, reply) => {
    return reply.type("text/css").send(await readFile(join(webRoot, "style.css"), "utf8"));
  });

  app.get("/favicon.ico", async (_request, reply) => {
    return reply.type("image/x-icon").send(await readFile(join(webRoot, "favicon.ico")));
  });

  const url = await app.listen({
    host: "127.0.0.1",
    port: settings.port,
  });

  console.log(`Batch Run Web 已启动: ${url}`);

  if (options.openBrowser ?? true) {
    await open(url);
  }
}
