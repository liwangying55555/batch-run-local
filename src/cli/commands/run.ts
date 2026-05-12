import prompts from "prompts";
import { getProjects, getSettings } from "../../config/store.js";
import { readPackageScripts } from "../../project/package-json.js";
import { runScriptInGitBash } from "../../runner/git-bash.js";

export async function runCommand(): Promise<void> {
  const projects = getProjects();

  if (projects.length === 0) {
    console.log("暂无项目配置，可运行 br add 新增。");
    return;
  }

  const projectAnswer = await prompts({
    type: "select",
    name: "projectId",
    message: "选择项目",
    choices: projects.map((project) => ({
      title: project.name,
      description: project.root,
      value: project.id,
    })),
  });

  const project = projects.find((item) => item.id === projectAnswer.projectId);
  if (!project) {
    return;
  }

  const scripts = await readPackageScripts(project.root);
  const scriptEntries = Object.entries(scripts);

  if (scriptEntries.length === 0) {
    console.log("该项目 package.json 中没有 scripts。");
    return;
  }

  const scriptAnswer = await prompts({
    type: "select",
    name: "script",
    message: "选择要执行的脚本",
    choices: scriptEntries.map(([name, command]) => ({
      title: name,
      description: command,
      value: name,
    })),
  });

  if (!scriptAnswer.script) {
    return;
  }

  const result = runScriptInGitBash(project, scriptAnswer.script, getSettings());
  console.log(`已在 Git Bash 窗口执行: npm run ${scriptAnswer.script}`);
  if (result.pid) {
    console.log(`进程 PID: ${result.pid}`);
  }
}
