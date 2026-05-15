import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitBranch, GitBranchState } from "../shared/types.js";

const execFileAsync = promisify(execFile);

export async function readGitBranches(projectRoot: string): Promise<GitBranchState> {
  const [current, localBranches] = await Promise.all([
    runGit(projectRoot, ["branch", "--show-current"]),
    runGit(projectRoot, ["branch", "--format=%(refname:short)"]),
  ]);

  const currentBranch = current.trim() || undefined;
  const localNames = parseBranchLines(localBranches);
  const branches: GitBranch[] = localNames.map((name) => ({
    name,
    current: name === currentBranch,
    remote: false,
  }));

  return {
    current: currentBranch,
    branches,
  };
}

export async function switchGitBranch(projectRoot: string, branchName: string): Promise<GitBranchState> {
  const name = branchName.trim();
  if (!name) {
    throw new Error("分支名称不能为空");
  }

  const branchState = await readGitBranches(projectRoot);
  const branch = branchState.branches.find((item) => item.name === name);
  if (!branch) {
    throw new Error("本地分支不存在");
  }

  if (branch.current) {
    return branchState;
  }

  await runGit(projectRoot, ["switch", name]);

  return readGitBranches(projectRoot);
}

async function runGit(projectRoot: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: projectRoot,
      env: processEnvWithoutGitOverrides(),
      windowsHide: true,
    });
    return stdout;
  } catch (error) {
    const stderr = typeof error === "object" && error && "stderr" in error ? String(error.stderr) : "";
    const message = stderr.trim() || (error instanceof Error ? error.message : "Git 命令执行失败");
    throw new Error(message);
  }
}

function parseBranchLines(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function processEnvWithoutGitOverrides(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_PREFIX;
  delete env.GIT_OBJECT_DIRECTORY;
  delete env.GIT_ALTERNATE_OBJECT_DIRECTORIES;
  return env;
}
