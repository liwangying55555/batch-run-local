export type ProjectConfig = {
  id: string;
  name: string;
  root: string;
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
};

export type PackageScripts = Record<string, string>;
