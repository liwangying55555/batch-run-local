export const UNGROUPED_TAG = "";
export const UNGROUPED_TAG_LABEL = "未分组";

export type ProjectConfig = {
  id: string;
  name: string;
  root: string;
  tag?: string;
  createdAt: number;
  updatedAt: number;
};

export type AppSettings = {
  shell: "git-bash";
  gitBashPath?: string;
  port: number;
};

export type AppConfig = {
  projects: ProjectConfig[];
  settings: AppSettings;
  tagOrder?: string[];
};

export type PackageScripts = Record<string, string>;

export type GitBranch = {
  name: string;
  current: boolean;
  remote: boolean;
};

export type GitBranchState = {
  current?: string;
  branches: GitBranch[];
};
