import Conf from "conf";
import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import type { AppConfig, AppSettings, ProjectConfig } from "../shared/types.js";
import { UNGROUPED_TAG, UNGROUPED_TAG_LABEL } from "../shared/types.js";

const defaultSettings: AppSettings = {
  shell: "git-bash",
  port: 1234,
};

const store = new Conf<AppConfig>({
  projectName: "batch-run-local",
  defaults: {
    projects: [],
    settings: defaultSettings,
  },
});

export function normalizeTag(tag?: string): string | undefined {
  const trimmed = tag?.trim();
  if (!trimmed || trimmed === UNGROUPED_TAG_LABEL) {
    return undefined;
  }
  return trimmed;
}

export function getProjectTagKey(project: ProjectConfig): string {
  return project.tag ?? UNGROUPED_TAG;
}

function collectTagKeysFromProjects(projects: ProjectConfig[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();

  for (const project of projects) {
    const key = getProjectTagKey(project);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }

  return keys;
}

function groupProjectsByTag(projects: ProjectConfig[]): Map<string, ProjectConfig[]> {
  const groups = new Map<string, ProjectConfig[]>();

  for (const project of projects) {
    const key = getProjectTagKey(project);
    const group = groups.get(key);
    if (group) {
      group.push(project);
    } else {
      groups.set(key, [project]);
    }
  }

  return groups;
}

function flattenProjectsByTagOrder(projects: ProjectConfig[], tagOrder: string[]): ProjectConfig[] {
  const grouped = groupProjectsByTag(projects);
  const nextProjects: ProjectConfig[] = [];

  for (const tagKey of tagOrder) {
    const group = grouped.get(tagKey);
    if (group) {
      nextProjects.push(...group);
      grouped.delete(tagKey);
    }
  }

  for (const group of grouped.values()) {
    nextProjects.push(...group);
  }

  return nextProjects;
}

function syncTagOrder(projects: ProjectConfig[], preferredOrder?: string[]): string[] {
  const projectTagKeys = collectTagKeysFromProjects(projects);
  const projectTagKeySet = new Set(projectTagKeys);
  const sourceOrder = preferredOrder ?? store.get("tagOrder") ?? [];
  const nextOrder: string[] = [];
  const seen = new Set<string>();

  for (const tagKey of sourceOrder) {
    if (!seen.has(tagKey) && projectTagKeySet.has(tagKey)) {
      seen.add(tagKey);
      nextOrder.push(tagKey);
    }
  }

  for (const tagKey of projectTagKeys) {
    if (!seen.has(tagKey)) {
      seen.add(tagKey);
      nextOrder.push(tagKey);
    }
  }

  store.set("tagOrder", nextOrder);
  return nextOrder;
}

export function getConfig(): AppConfig {
  return {
    projects: store.get("projects") ?? [],
    settings: {
      ...defaultSettings,
      ...(store.get("settings") ?? {}),
    },
    tagOrder: store.get("tagOrder"),
  };
}

export function getProjects(): ProjectConfig[] {
  return getConfig().projects;
}

export function getProject(projectId: string): ProjectConfig | undefined {
  return getProjects().find((project) => project.id === projectId);
}

export function getTagOrder(): string[] {
  return syncTagOrder(getProjects());
}

export function getTags(): string[] {
  return getTagOrder().filter((tagKey) => tagKey !== UNGROUPED_TAG);
}

export async function addProject(input: { name: string; root: string; tag?: string }): Promise<ProjectConfig> {
  const root = resolve(input.root);
  await access(root);

  const now = Date.now();
  const project: ProjectConfig = {
    id: randomUUID(),
    name: input.name.trim(),
    root,
    tag: normalizeTag(input.tag),
    createdAt: now,
    updatedAt: now,
  };

  const projects = getProjects();
  if (projects.some((item) => item.root.toLowerCase() === root.toLowerCase())) {
    throw new Error("该项目路径已经存在");
  }

  const nextProjects = [...projects, project];
  store.set("projects", nextProjects);
  syncTagOrder(nextProjects);
  return project;
}

export async function updateProject(
  projectId: string,
  input: { name: string; root: string; tag?: string },
): Promise<ProjectConfig | undefined> {
  const root = resolve(input.root);
  await access(root);

  const projects = getProjects();
  const projectIndex = projects.findIndex((project) => project.id === projectId);
  if (projectIndex < 0) {
    return undefined;
  }

  if (projects.some((project) => project.id !== projectId && project.root.toLowerCase() === root.toLowerCase())) {
    throw new Error("该项目路径已经存在");
  }

  const nextProject: ProjectConfig = {
    ...projects[projectIndex],
    name: input.name.trim(),
    root,
    tag: normalizeTag(input.tag),
    updatedAt: Date.now(),
  };
  const nextProjects = [...projects];
  nextProjects[projectIndex] = nextProject;
  store.set("projects", nextProjects);
  syncTagOrder(nextProjects);
  return nextProject;
}

export function removeProject(projectId: string): boolean {
  const projects = getProjects();
  const nextProjects = projects.filter((project) => project.id !== projectId);
  store.set("projects", nextProjects);
  syncTagOrder(nextProjects);
  return nextProjects.length !== projects.length;
}

export function reorderProjects(projectIds: string[]): ProjectConfig[] {
  const projects = getProjects();
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const uniqueProjectIds = new Set(projectIds);

  if (uniqueProjectIds.size !== projects.length) {
    throw new Error("项目排序数据不完整");
  }

  const nextProjects = projectIds.map((projectId) => {
    const project = projectMap.get(projectId);
    if (!project) {
      throw new Error("项目排序包含不存在的项目");
    }
    return project;
  });

  store.set("projects", nextProjects);
  syncTagOrder(nextProjects);
  return nextProjects;
}

export function reorderTagGroups(tagKeys: string[]): ProjectConfig[] {
  const projects = getProjects();
  const projectTagKeys = collectTagKeysFromProjects(projects);
  const uniqueTagKeys = new Set(tagKeys);

  if (uniqueTagKeys.size !== tagKeys.length) {
    throw new Error("标签排序包含重复项");
  }

  if (uniqueTagKeys.size !== projectTagKeys.length) {
    throw new Error("标签排序数据不完整");
  }

  for (const tagKey of projectTagKeys) {
    if (!uniqueTagKeys.has(tagKey)) {
      throw new Error("标签排序包含不存在的标签");
    }
  }

  const nextProjects = flattenProjectsByTagOrder(projects, tagKeys);
  store.set("tagOrder", tagKeys);
  store.set("projects", nextProjects);
  return nextProjects;
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
