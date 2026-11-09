import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = process.argv[2]
const name = arg ?? readdirSync(ROOT).filter(entry => entry.endsWith('.tgz')).sort().at(-1)
assert.ok(name, '找不到 .tgz，先跑 pnpm pack')

const listing = execFileSync('tar', ['-tzf', resolve(ROOT, name)], { encoding: 'utf8' })
const entries = listing.split('\n').map(line => line.trim()).filter(line => line !== '').map(line => line.replace(/^package\//, ''))

const required = [
  'package.json',
  'cordis.patch.yml',
  'README.md',
  'LICENSE',
  'lib/index.js',
  'lib/client.js',
  'lib/shared/framework.js',
  'lib/types/index.d.ts',
  'lib/types/client/index.d.ts',
  'lib/types/shared/framework.d.ts',
  'skills/learning-coach/SKILL.md',
]
for (const path of required) assert.ok(entries.includes(path), `包内缺少 ${path}`)

const skillFiles = entries.filter(path => path.startsWith('skills/'))
const ROADMAP_TEMPLATE = 'skills/learning-coach/references/roadmap-template.html'
const markdownFiles = skillFiles.filter(path => path.endsWith('.md'))
assert.equal(markdownFiles.length, 14, `skills/ 应有 14 份 Markdown，实际 ${markdownFiles.length}：\n${skillFiles.join('\n')}`)
assert.ok(skillFiles.includes(ROADMAP_TEMPLATE), `包内缺少路线图模板 ${ROADMAP_TEMPLATE}`)
for (const path of skillFiles) assert.ok(path.endsWith('.md') || path === ROADMAP_TEMPLATE, `skills/ 里出现未登记的文件：${path}`)
assert.equal(skillFiles.filter(path => path.includes('/references/methods/')).length, 8, '方法卡必须是 8 份')
assert.equal(skillFiles.includes('skills/learning-coach/references/intake.md'), false, 'v1 的 intake.md 不该还在包里')

for (const path of entries) {
  assert.ok(path.endsWith('.md') || !path.endsWith('.html') || path === ROADMAP_TEMPLATE, `包内出现未登记的 HTML：${path}`)
  assert.ok(!path.includes('node_modules/'), `包内不得有 node_modules：${path}`)
  assert.ok(!path.endsWith('.tgz'), `包内不得套 tgz：${path}`)
  assert.ok(!path.endsWith('.map'), `包内不得有 sourcemap：${path}`)
}

console.log(`OK ${name}：${entries.length} 个文件，skills/ 14 份 Markdown + 1 份路线图模板，methods/ 8 份`)
