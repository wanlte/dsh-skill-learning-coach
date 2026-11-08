import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8')

const pkg = JSON.parse(await read('../package.json'))
const readme = await read('../README.md')
const readmeEn = await read('../README.en.md')
const changelog = await read('../CHANGELOG.md')
const ci = await read('../.github/workflows/ci.yml')
const releasing = await read('../RELEASING.md')

test('收录信号：keywords 含 dsh-plugin，仓库字段把 npm 包与 GitHub 对上', () => {
  assert.ok(pkg.keywords.includes('dsh-plugin'), '缺 dsh-plugin 关键词，registry 抓不到')
  assert.equal(pkg.repository.type, 'git')
  assert.match(pkg.repository.url, /github\.com\/wanlte\/dsh-skill-learning-coach\.git$/)
  assert.match(pkg.homepage, /github\.com\/wanlte\/dsh-skill-learning-coach/)
  assert.match(pkg.bugs.url, /github\.com\/wanlte\/dsh-skill-learning-coach\/issues$/)
  assert.match(pkg.author, /wanlte/)
  assert.equal(pkg.license, 'MIT')
})

test('发布走官方 registry 且公开', () => {
  assert.equal(pkg.publishConfig.access, 'public')
  assert.equal(pkg.publishConfig.registry, 'https://registry.npmjs.org/')
  assert.equal(pkg.private, undefined)
})

test('files 只发运行时、skill 与面向使用者的文档', () => {
  const files = pkg.files
  for (const required of ['skills/**', 'lib/**/*.js', 'cordis.patch.yml', 'README.md', 'README.en.md', 'CHANGELOG.md', 'LICENSE']) {
    assert.ok(files.includes(required), `files 缺 ${required}`)
  }
  for (const forbidden of ['docs/**', 'tests', '.superpowers', 'node_modules']) {
    assert.ok(!files.includes(forbidden), `files 不该包含 ${forbidden}`)
  }
  assert.ok(!files.some(entry => entry.includes('docs')), '内部计划文档不该进 npm 包')
})

test('描述是一行可读文案，不被换行截断', () => {
  assert.equal(pkg.description.includes('\n'), false)
  assert.ok(pkg.description.length <= 200, `description 过长：${pkg.description.length}`)
  assert.ok(pkg.description.includes('dsh-plugin'), 'description 里应出现 dsh-plugin 便于搜索')
})

test('中文 README 首屏包含：定位、安装命令、收录信号、走查清单', () => {
  assert.match(readme, /记得你卡在哪/)
  assert.match(readme, /pnpm dsh plugin --profile desktop add dsh-skill-learning-coach/)
  assert.match(readme, /npx @deepseek-ai\/dsh plugin add dsh-skill-learning-coach/)
  assert.match(readme, /dsh-plugin/)
  assert.match(readme, /## 真机走查清单/)
  assert.match(readme, /RELEASING\.md/)
  assert.match(readme, /## English/)
  assert.ok(readme.split('\n').length >= 120, 'README 被截短了')
})

test('npm 页面点得开的链接：指向包外文档一律用绝对地址', () => {
  const absolute = 'https://github.com/wanlte/dsh-skill-learning-coach/blob/main/'
  assert.ok(readme.includes(`${absolute}RELEASING.md`), 'README 的 RELEASING 链接要用绝对地址，相对链接在 npm 上是死的')
  assert.ok(readme.includes(`${absolute}CHANGELOG.md`), 'README 的 CHANGELOG 链接要用绝对地址')
  assert.ok(readmeEn.includes(`${absolute}RELEASING.md`), 'README.en 的 RELEASING 链接要用绝对地址')
})

test('英文 README 与中文版结构对齐', () => {
  assert.match(readmeEn, /## Install/)
  assert.match(readmeEn, /dsh-plugin/)
  assert.match(readmeEn, /## Methods/)
  assert.match(readmeEn, /RELEASING\.md/)
  assert.ok(readmeEn.split('\n').length >= 80, 'README.en.md 被截短了')
})

test('README 标注的版本与 package.json 一致', () => {
  assert.ok(readme.includes(`\`${pkg.version}\``), `README 的版本标注与 ${pkg.version} 不一致`)
})

test('变更记录覆盖当前版本', () => {
  assert.match(changelog, new RegExp(`## ${pkg.version.replace(/\//g, '\\/')} `))
  assert.match(changelog, /## 0\.2\.0/)
  assert.match(changelog, /dsh-plugin/)
})

test('发布流程文档给出可执行命令与收录验证', () => {
  assert.match(releasing, /npm publish --dry-run/)
  assert.match(releasing, /npm publish/)
  assert.match(releasing, /dsh-plugin/)
  assert.match(releasing, /topics/i)
})

test('CI 覆盖双平台双 Node，且跑四道门', () => {
  assert.match(ci, /ubuntu-latest/)
  assert.match(ci, /windows-latest/)
  assert.match(ci, /node: \[22, 24\]/)
  for (const gate of ['pnpm run typecheck', 'pnpm run test', 'pnpm run test:client-bundle', 'pnpm run pack:check']) {
    assert.ok(ci.includes(gate), `CI 缺 ${gate}`)
  }
})
