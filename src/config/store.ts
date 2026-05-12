import Conf from "conf";
import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import type { AppConfig, AppSettings, ProjectConfig } from "../shared/types.js";

const defaultSettings: AppSettings = {
  shell: "git-bash",
  port: 1234,
};

const store = new Conf<AppConfig>({
  projectName: "batch-run",
  defaults: {
    projects: [],
    settings: defaultSettings,
  },
});

export function getConfig(): AppConfig {
  return {
    projects: store.get("projects") ?? [],
    settings: {
      ...defaultSettings,
      ...(store.get("settings") ?? {}),
    },
  };
}

export function getProjects(): ProjectConfig[] {
  return getConfig().projects;
}

export function getProject(projectId: string): ProjectConfig | undefined {
  return getProjects().find((project) => project.id === projectId);
}

export async function addProject(input: { name: string; root: string }): Promise<ProjectConfig> {
  const root = resolve(input.root);
  await access(root);

  const now = Date.now();
  const project: ProjectConfig = {
    id: randomUUID(),
    name: input.name.trim(),
    root,
    createdAt: now,
    updatedAt: now,
  };

  const projects = getProjects();
  if (projects.some((item) => item.root.toLowerCase() === root.toLowerCase())) {
    throw new Error("该项目路径已经存在");
  }

  store.set("projects", [...projects, project]);
  return project;
}

export function removeProject(projectId: string): boolean {
  const projects = getProjects();
  const nextProjects = projects.filter((project) => project.id !== projectId);
  store.set("projects", nextProjects);
  return nextProjects.length !== projects.length;
}

export function getSettings(): AppSettings {
  return getConfig().settings;
}

export function updateSettings(settings: Partial<AppSettings>): AppSettings {
  const nextSettings = {
    ...getSettings(),
    ...settings,
  };
  store.set("settings", nextSettings);
  return nextSettings;
}

export function getConfigPath(): string {
  return store.path;
}
