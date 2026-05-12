#!/usr/bin/env node
import { cac } from 'cac'
import { readFileSync } from 'node:fs'
import prompts from 'prompts'
import { addCommand } from './commands/add.js'
import { configCommand } from './commands/config.js'
import { listCommand } from './commands/list.js'
import { removeCommand } from './commands/remove.js'
import { runCommand } from './commands/run.js'
import { uiCommand } from './commands/ui.js'

const packageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version?: string }
const packageVersion = packageJson.version ?? '0.0.0'

const cli = cac('br')

cli.command('add', '新增项目配置').action(wrap(addCommand))

cli.command('list', '查看项目配置').action(wrap(async () => listCommand()))

cli.command('run', '选择并执行项目脚本').action(wrap(runCommand))

cli.command('remove', '删除项目配置').action(wrap(removeCommand))

cli.command('ui', '打开 Web 管理页面').action(wrap(uiCommand))

cli.command('config', '配置 Git Bash 路径和 Web 端口').action(wrap(configCommand))

cli.help()
cli.version(packageVersion)

async function mainMenu(): Promise<void> {
  const answer = await prompts({
    type: 'select',
    name: 'action',
    message: '请选择操作',
    choices: [
      { title: '打开可视化操作页面', value: 'ui' },
      { title: '启动项目', value: 'run' },
      { title: '查看项目', value: 'list' },
      { title: '新增项目', value: 'add' },
      { title: '删除项目', value: 'remove' },
      { title: '设置 Git Bash 路径', value: 'config' },
    ],
  })

  switch (answer.action) {
    case 'run':
      await runCommand()
      break
    case 'add':
      await addCommand()
      break
    case 'list':
      listCommand()
      break
    case 'remove':
      await removeCommand()
      break
    case 'ui':
      await uiCommand()
      break
    case 'config':
      await configCommand()
      break
  }
}

function wrap(fn: () => Promise<void>) {
  return async () => {
    try {
      await fn()
    } catch (error) {
      handleError(error)
    }
  }
}

function handleError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`执行失败: ${message}`)
  process.exitCode = 1
}

if (process.argv.length <= 2) {
  await wrap(mainMenu)()
} else {
  cli.parse()
}
