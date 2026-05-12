import type { FastifyInstance } from "fastify";
import open from "open";
import { addProject, getProject, getProjects, removeProject } from "../config/store.js";
import { readPackageScripts } from "../project/package-json.js";
import { runScriptInGitBash } from "../runner/git-bash.js";
import type { AppSettings } from "../shared/types.js";

type AddProjectBody = {
  name?: string;
  root?: string;
};

type RunScriptBody = {
  script?: string;
};

export async function registerApiRoutes(app: FastifyInstance, settings: AppSettings): Promise<void> {
  app.get("/api/projects", async () => ({
    projects: getProjects(),
  }));

  app.post<{ Body: AddProjectBody }>("/api/projects", async (request, reply) => {
    const name = request.body.name?.trim();
    const root = request.body.root?.trim();

    if (!name || !root) {
      return reply.code(400).send({ message: "项目名称和根路径不能为空" });
    }

    const project = await addProject({ name, root });
    return { project };
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
