import { existsSync } from "node:fs";
import { platform } from "node:os";
import { dirname, join } from "node:path";

const defaultWindowsGitBashPaths = [
  "C:\\Program Files\\Git\\git-bash.exe",
  "C:\\Program Files (x86)\\Git\\git-bash.exe",
];

export function findGitBashPath(configuredPath?: string): string | undefined {
  if (configuredPath && existsSync(configuredPath)) {
    return configuredPath;
  }

  if (platform() !== "win32") {
    return undefined;
  }

  return defaultWindowsGitBashPaths.find((item) => existsSync(item));
}

export function toGitBashPath(inputPath: string): string {
  const normalized = inputPath.replaceAll("\\", "/");
  const driveMatch = /^([a-zA-Z]):\/(.*)$/.exec(normalized);

  if (!driveMatch) {
    return normalized;
  }

  const [, drive, rest] = driveMatch;
  return `/${drive.toLowerCase()}/${rest}`;
}

export function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function findMinttyPath(gitBashPath: string): string | undefined {
  const minttyPath = join(dirname(gitBashPath), "usr", "bin", "mintty.exe");
  return existsSync(minttyPath) ? minttyPath : undefined;
}
