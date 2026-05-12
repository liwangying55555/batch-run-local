import { startServer } from "../../server/index.js";

export async function uiCommand(): Promise<void> {
  await startServer({ openBrowser: true });
}
