import prompts from "prompts";
import { addProject } from "../../config/store.js";

export async function addCommand(): Promise<void> {
  const answers = await prompts([
    {
      type: "text",
      name: "name",
      message: "项目名称",
      validate: (value) => value.trim().length > 0 || "请输入项目名称",
    },
    {
      type: "text",
      name: "root",
      message: "项目根路径",
      validate: (value) => value.trim().length > 0 || "请输入项目根路径",
    },
  ]);

  if (!answers.name || !answers.root) {
    return;
  }

  const project = await addProject({
    name: answers.name,
    root: answers.root,
  });

  console.log(`已添加项目: ${project.name}`);
  console.log(project.root);
}
