import { existsSync } from "node:fs";
import { platform } from "node:os";
import { basename, dirname, join } from "node:path";

const defaultWindowsGitBashPaths = [
  "C:\\Program Files\\Git\\git-bash.exe",
  "C:\\Program Files (x86)\\Git\\git-bash.exe",
];

export function findGitBashPath(configuredPath?: string): string | undefined {
  if (configuredPath && existsSync(configuredPath) && isGitBashExecutable(configuredPath)) {
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
  const gitBashDir = dirname(gitBashPath);
  const candidates = [
    join(gitBashDir, "usr", "bin", "mintty.exe"),
    join(gitBashDir, "mintty.exe"),
    join(dirname(gitBashDir), "usr", "bin", "mintty.exe"),
  ];

  return candidates.find((minttyPath) => existsSync(minttyPath));
}

export function findBashExecutablePath(gitBashPath: string): string {
  const executableName = basename(gitBashPath).toLowerCase();
  if (executableName === "bash.exe" || executableName === "sh.exe") {
    return gitBashPath;
  }

  const gitBashDir = dirname(gitBashPath);
  const candidates = [
    join(gitBashDir, "bin", "bash.exe"),
    join(gitBashDir, "usr", "bin", "bash.exe"),
    join(gitBashDir, "bin", "sh.exe"),
    join(gitBashDir, "usr", "bin", "sh.exe"),
  ];

  return candidates.find((bashPath) => existsSync(bashPath)) ?? gitBashPath;
}

function isGitBashExecutable(inputPath: string): boolean {
  const executableName = basename(inputPath).toLowerCase();
  return executableName === "git-bash.exe" || executableName === "bash.exe" || executableName === "sh.exe";
}
