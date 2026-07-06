import { getConfigPath, getProjects, getTagOrder } from "../../config/store.js";
import { UNGROUPED_TAG, UNGROUPED_TAG_LABEL } from "../../shared/types.js";

function getTagLabel(tagKey: string): string {
  return tagKey === UNGROUPED_TAG ? UNGROUPED_TAG_LABEL : tagKey;
}

export function listCommand(): void {
  const projects = getProjects();

  if (projects.length === 0) {
    console.log("暂无项目配置，可运行 br add 新增。");
    console.log(`配置文件: ${getConfigPath()}`);
    return;
  }

  const tagOrder = getTagOrder();

  for (const tagKey of tagOrder) {
    const groupedProjects = projects.filter((project) => (project.tag ?? UNGROUPED_TAG) === tagKey);
    if (groupedProjects.length === 0) {
      continue;
    }

    console.log(`[${getTagLabel(tagKey)}]`);
    for (const project of groupedProjects) {
      console.log(`  ${project.name}`);
      console.log(`    id: ${project.id}`);
      console.log(`    root: ${project.root}`);
    }
    console.log("");
  }

  console.log(`配置文件: ${getConfigPath()}`);
}
