import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PackageScripts } from "../shared/types.js";

type PackageJson = {
  scripts?: PackageScripts;
};

export async function readPackageJson(projectRoot: string): Promise<PackageJson> {
  const packageJsonPath = join(projectRoot, "package.json");
  const content = await readFile(packageJsonPath, "utf8");

  try {
    return JSON.parse(content) as PackageJson;
  } catch {
    throw new Error(`package.json 解析失败: ${packageJsonPath}`);
  }
}

export async function readPackageScripts(projectRoot: string): Promise<PackageScripts> {
  const packageJson = await readPackageJson(projectRoot);
  return packageJson.scripts ?? {};
}
