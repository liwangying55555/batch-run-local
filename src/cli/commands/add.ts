import prompts from "prompts";
import { addProject, getTags } from "../../config/store.js";

export async function addCommand(): Promise<void> {
  const existingTags = getTags();
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
    {
      type: existingTags.length > 0 ? "autocomplete" : "text",
      name: "tag",
      message: "标签（不填时默认未分组）",
      choices: existingTags.map((tag) => ({ title: tag, value: tag })),
    },
  ]);

  if (!answers.name || !answers.root) {
    return;
  }

  const project = await addProject({
    name: answers.name,
    root: answers.root,
    tag: answers.tag,
  });

  console.log(`已添加项目: ${project.name}`);
  if (project.tag) {
    console.log(`  tag: ${project.tag}`);
  }
  console.log(project.root);
}
