import prompts from "prompts";
import { getConfigPath, getSettings, updateSettings } from "../../config/store.js";

export async function configCommand(): Promise<void> {
  const settings = getSettings();

  console.log(`当前配置文件: ${getConfigPath()}`);
  console.log(`当前 Git Bash 路径: ${settings.gitBashPath ?? "自动检测"}`);
  console.log(`当前 Web 端口: ${settings.port}`);

  const answers = await prompts([
    {
      type: "text",
      name: "gitBashPath",
      message: "Git Bash 路径，留空表示自动检测",
      initial: settings.gitBashPath ?? "",
    },
    {
      type: "number",
      name: "port",
      message: "Web 端口",
      initial: settings.port,
      min: 1,
      max: 65535,
    },
  ]);

  updateSettings({
    gitBashPath: answers.gitBashPath?.trim() || undefined,
    port: answers.port || settings.port,
  });

  console.log("配置已更新。");
}
