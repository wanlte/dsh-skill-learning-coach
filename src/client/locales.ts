export const zh = {
  settingsTitle: '学习路线',
  workspace: '工作区',
  noWorkspace: '还没有带工作区的会话。先在 DSH 里打开一个项目再回来。',
  read: '读取状态',
  write: '写入探针',
  writing: '写入中…',
  result: 'host 返回',
  failed: '失败',
  hint: '这张卡此刻只验证通道：写入会在学习区落一个 learning/framework.json，主题是「通道验证」。确认路径对了以后，正式版会把它换成可编辑的路线框架。',
} as const

export const en: Record<keyof typeof zh, string> = {
  settingsTitle: 'Learning roadmap',
  workspace: 'Workspace',
  noWorkspace: 'No session with a workspace yet. Open a project in DSH first.',
  read: 'Read state',
  write: 'Write probe',
  writing: 'Writing…',
  result: 'Host response',
  failed: 'Failed',
  hint: 'This card only verifies the channel right now: writing drops a learning/framework.json into the workspace with topic "channel probe". Once the path is confirmed, the real card replaces it with an editable roadmap.',
}
