import { getConfigPath, getProjects } from "../../config/store.js";

export function listCommand(): void {
  const projects = getProjects();

  if (projects.length === 0) {
    console.log("暂无项目配置，可运行 br add 新增。");
    console.log(`配置文件: ${getConfigPath()}`);
    return;
  }

  for (const project of projects) {
    console.log(`${project.name}`);
    console.log(`  id: ${project.id}`);
    console.log(`  root: ${project.root}`);
  }

  console.log(`\n配置文件: ${getConfigPath()}`);
}
