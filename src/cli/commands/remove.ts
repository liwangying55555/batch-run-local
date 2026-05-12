import prompts from "prompts";
import { getProjects, removeProject } from "../../config/store.js";

export async function removeCommand(): Promise<void> {
  const projects = getProjects();

  if (projects.length === 0) {
    console.log("暂无项目可删除。");
    return;
  }

  const answer = await prompts({
    type: "select",
    name: "projectId",
    message: "选择要删除的项目",
    choices: projects.map((project) => ({
      title: project.name,
      description: project.root,
      value: project.id,
    })),
  });

  if (!answer.projectId) {
    return;
  }

  const removed = removeProject(answer.projectId);
  console.log(removed ? "已删除项目。" : "未找到项目。");
}
