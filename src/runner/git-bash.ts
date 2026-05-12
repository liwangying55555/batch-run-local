import { spawn } from "node:child_process";
import type { AppSettings, ProjectConfig } from "../shared/types.js";
import { findGitBashPath, findMinttyPath, shellSingleQuote, toGitBashPath } from "./path.js";

export type RunResult = {
  pid?: number;
  command: string;
};

export function runScriptInGitBash(project: ProjectConfig, scriptName: string, settings: AppSettings): RunResult {
  const gitBashPath = findGitBashPath(settings.gitBashPath);

  if (!gitBashPath) {
    throw new Error("未找到 Git Bash，请先通过 br config 设置 git-bash.exe 路径");
  }

  const command = [
    `echo Running ${shellSingleQuote(project.name)}: npm run ${shellSingleQuote(scriptName)}`,
    `npm run ${shellSingleQuote(scriptName)}`,
    "echo",
    "echo Process exited. Press Ctrl+D or close this window.",
    "exec bash",
  ].join("; ");

  const minttyPath = findMinttyPath(gitBashPath);
  const child = minttyPath
    ? spawn(minttyPath, ["--dir", toGitBashPath(project.root), "/usr/bin/bash", "-lc", command], {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      })
    : spawn("cmd.exe", ["/d", "/c", "start", "", gitBashPath, `--cd=${toGitBashPath(project.root)}`, "-c", command], {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      });

  child.unref();

  return {
    pid: child.pid,
    command,
  };
}
