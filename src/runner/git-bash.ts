import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppSettings, ProjectConfig } from "../shared/types.js";
import { findBashExecutablePath, findGitBashPath, findMinttyPath, shellSingleQuote, toGitBashPath } from "./path.js";

export type RunResult = {
  pid?: number;
  command: string;
};

export function runScriptInGitBash(project: ProjectConfig, scriptName: string, settings: AppSettings): RunResult {
  const gitBashPath = findGitBashPath(settings.gitBashPath);

  if (!gitBashPath) {
    throw new Error("未找到 Git Bash，请先通过 br config 设置 git-bash.exe 路径");
  }

  const title = createTerminalTitle(project.name, scriptName);
  const gitBashRoot = toGitBashPath(project.root);
  const scriptPath = writeRunScript(project, scriptName, title, gitBashRoot);
  const gitBashScriptPath = toGitBashPath(scriptPath);
  const bashPath = findBashExecutablePath(gitBashPath);
  const command = `${bashPath} --login ${scriptPath}`;

  const minttyPath = findMinttyPath(gitBashPath);
  const child = minttyPath
    ? spawn(minttyPath, ["--title", title, "--dir", gitBashRoot, toGitBashPath(bashPath), "--login", gitBashScriptPath], {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      })
    : spawn("cmd.exe", ["/d", "/c", "start", title, "/D", project.root, bashPath, "--login", gitBashScriptPath], {
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

function createTerminalTitle(projectName: string, scriptName: string): string {
  const title = `batch-run - ${projectName} - npm run ${scriptName}`;
  return title.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 120);
}

function writeRunScript(project: ProjectConfig, scriptName: string, title: string, gitBashRoot: string): string {
  const tempDir = mkdtempSync(join(tmpdir(), "batch-run-"));
  const scriptPath = join(tempDir, "run.sh");
  const scriptContent = [
    "#!/usr/bin/env bash",
    "set +e",
    `cd ${shellSingleQuote(gitBashRoot)}`,
    'rm -f "$0" >/dev/null 2>&1 || true',
    `__batch_run_title=${shellSingleQuote(title)}`,
    "set_batch_run_title() { printf '\\033]0;%s\\007' \"$__batch_run_title\"; }",
    "set_batch_run_title",
    "(while true; do set_batch_run_title; sleep 2; done) &",
    "__batch_run_title_pid=$!",
    "cleanup_batch_run_title() {",
    '  kill "$__batch_run_title_pid" >/dev/null 2>&1 || true',
    '  wait "$__batch_run_title_pid" 2>/dev/null || true',
    "  set_batch_run_title",
    "}",
    "trap cleanup_batch_run_title EXIT",
    `echo Running ${shellSingleQuote(project.name)}: npm run ${shellSingleQuote(scriptName)}`,
    `npm run ${shellSingleQuote(scriptName)}`,
    "__batch_run_exit_code=$?",
    "set_batch_run_title",
    "echo",
    'echo "Process exited with code $__batch_run_exit_code. Press Ctrl+D or close this window."',
    "bash --login",
    'exit "$__batch_run_exit_code"',
    "",
  ].join("\n");

  writeFileSync(scriptPath, scriptContent, "utf8");
  return scriptPath;
}
