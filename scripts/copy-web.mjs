import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = resolve(root, "src/web");
const target = resolve(root, "dist/web");

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
