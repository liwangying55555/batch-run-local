import type { FastifyInstance } from "fastify";
import open from "open";
import { addProject, getProject, getProjects, getTagOrder, getTags, removeProject, reorderProjects, reorderTagGroups, updateProject } from "../config/store.js";
import { readGitBranches, switchGitBranch } from "../project/git.js";
import { readPackageScripts } from "../project/package-json.js";
import { runScriptInGitBash } from "../runner/git-bash.js";
import type { AppSettings } from "../shared/types.js";

type AddProjectBody = {
  name?: string;
  root?: string;
  tag?: string;
};

type UpdateProjectBody = AddProjectBody;

type RunScriptBody = {
  script?: string;
};

type SwitchBranchBody = {
  branch?: string;
};

type ReorderProjectsBody = {
  projectIds?: string[];
};

type ReorderTagGroupsBody = {
  tagKeys?: string[];
};

export async function registerApiRoutes(app: FastifyInstance, settings: AppSettings): Promise<void> {
  app.get("/api/projects", async () => ({
    projects: getProjects(),
    tagOrder: getTagOrder(),
  }));

  app.get("/api/tags", async () => ({
    tags: getTags(),
    tagOrder: getTagOrder(),
  }));

  app.post<{ Body: AddProjectBody }>("/api/projects", async (request, reply) => {
    const name = request.body.name?.trim();
    const root = request.body.root?.trim();

    if (!name || !root) {
      return reply.code(400).send({ message: "项目名称和根路径不能为空" });
    }

    const project = await addProject({ name, root, tag: request.body.tag });
    return { project };
  });

  app.put<{ Body: ReorderProjectsBody }>("/api/projects/order", async (request, reply) => {
    const projectIds = request.body.projectIds;

    if (!Array.isArray(projectIds) || !projectIds.every((projectId) => typeof projectId === "string")) {
      return reply.code(400).send({ message: "项目排序数据无效" });
    }

    try {
      return {
        projects: reorderProjects(projectIds),
        tagOrder: getTagOrder(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存项目排序失败";
      return reply.code(400).send({ message });
    }
  });

  app.put<{ Body: ReorderTagGroupsBody }>("/api/tag-order", async (request, reply) => {
    const tagKeys = request.body.tagKeys;

    if (!Array.isArray(tagKeys) || !tagKeys.every((tagKey) => typeof tagKey === "string")) {
      return reply.code(400).send({ message: "标签排序数据无效" });
    }

    try {
      return {
        projects: reorderTagGroups(tagKeys),
        tagOrder: getTagOrder(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存标签排序失败";
      return reply.code(400).send({ message });
    }
  });

  app.put<{ Params: { id: string }; Body: UpdateProjectBody }>("/api/projects/:id", async (request, reply) => {
    const name = request.body.name?.trim();
    const root = request.body.root?.trim();

    if (!name || !root) {
      return reply.code(400).send({ message: "项目名称和根路径不能为空" });
    }

    try {
      const project = await updateProject(request.params.id, { name, root, tag: request.body.tag });
      if (!project) {
        return reply.code(404).send({ message: "项目不存在" });
      }

      return { project };
    } catch (error) {
      const message = error instanceof Error ? error.message : "更新项目失败";
      return reply.code(400).send({ message });
    }
  });

  app.delete<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
    const removed = removeProject(request.params.id);

    if (!removed) {
      return reply.code(404).send({ message: "项目不存在" });
    }

    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/api/projects/:id/scripts", async (request, reply) => {
    const project = getProject(request.params.id);

    if (!project) {
      return reply.code(404).send({ message: "项目不存在" });
    }

    const scripts = await readPackageScripts(project.root);
    return { scripts };
  });

  app.get<{ Params: { id: string } }>("/api/projects/:id/branches", async (request, reply) => {
    const project = getProject(request.params.id);

    if (!project) {
      return reply.code(404).send({ message: "项目不存在" });
    }

    try {
      return await readGitBranches(project.root);
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取 Git 分支失败";
      return reply.code(400).send({ message });
    }
  });

  app.post<{ Params: { id: string }; Body: SwitchBranchBody }>("/api/projects/:id/branches/switch", async (request, reply) => {
    const project = getProject(request.params.id);
    const branch = request.body.branch?.trim();

    if (!project) {
      return reply.code(404).send({ message: "项目不存在" });
    }

    if (!branch) {
      return reply.code(400).send({ message: "分支名称不能为空" });
    }

    try {
      const branchState = await switchGitBranch(project.root, branch);
      const scripts = await readPackageScripts(project.root);
      return {
        ...branchState,
        scripts,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "切换 Git 分支失败";
      return reply.code(400).send({ message });
    }
  });

  app.post<{ Params: { id: string } }>("/api/projects/:id/open", async (request, reply) => {
    const project = getProject(request.params.id);

    if (!project) {
      return reply.code(404).send({ message: "项目不存在" });
    }

    await open(project.root);
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: RunScriptBody }>("/api/projects/:id/run", async (request, reply) => {
    const project = getProject(request.params.id);
    const script = request.body.script?.trim();

    if (!project) {
      return reply.code(404).send({ message: "项目不存在" });
    }

    if (!script) {
      return reply.code(400).send({ message: "脚本名称不能为空" });
    }

    const scripts = await readPackageScripts(project.root);
    if (!scripts[script]) {
      return reply.code(404).send({ message: "脚本不存在" });
    }

    const result = runScriptInGitBash(project, script, settings);
    return {
      ok: true,
      pid: result.pid,
    };
  });
}
