# 一条命令跑完发布门；加 -Publish 才真的发。
# 用法：
#   pwsh scripts/release.ps1              # 只跑门 + 干跑
#   pwsh scripts/release.ps1 -Publish     # 真发（需先 npm login）
#   pwsh scripts/release.ps1 -Tag         # 打 tag 并推（需 git 凭据）

param(
  [switch]$Publish,
  [switch]$Tag
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)

$pkg = Get-Content -LiteralPath 'package.json' -Raw -Encoding utf8 | ConvertFrom-Json
$version = $pkg.version
Write-Output "== $($pkg.name)@$version"

function Invoke-Gate([string]$label, [scriptblock]$cmd) {
  Write-Output "-- $label"
  & $cmd
  if ($LASTEXITCODE -ne 0) { throw "门没过：$label（exit $LASTEXITCODE）" }
}

Invoke-Gate '依赖与锁文件' { pnpm install --frozen-lockfile }
Invoke-Gate '类型' { pnpm run typecheck }
Invoke-Gate '构建 + 全量测试' { pnpm run test }
Invoke-Gate '客户端 bundle 纯度' { pnpm run test:client-bundle }
Invoke-Gate '打包' { pnpm pack }
Invoke-Gate '包内容自检' { pnpm run pack:check }

Write-Output "-- registry"
$registry = npm config get registry
Write-Output "   $registry"
$official = 'https://registry.npmjs.org/'
if ($registry -ne $official) {
  Write-Warning "本机默认源是 $registry。"
  Write-Warning "publishConfig 已把发布锁到官方源，但登录 token 是按 registry 存的：镜像源上的登录对 npmjs 无效。"
  Write-Warning "发布前先执行：npm login --registry=$official"
}

if (-not $Publish) {
  Write-Output "-- 干跑（不发布）"
  npm publish --dry-run
  Write-Output ''
  Write-Output "门全过。真发：pwsh scripts/release.ps1 -Publish"
  exit 0
}

Write-Output "-- 检查官方源登录状态"
npm whoami --registry=$official
if ($LASTEXITCODE -ne 0) { throw "未登录官方源：npm login --registry=$official" }

Write-Output "-- 发布"
npm publish --registry=$official
if ($LASTEXITCODE -ne 0) { throw '发布失败，看上面的 npm 输出' }

Write-Output "-- 发布后自查"
npm view $pkg.name version keywords repository.url --registry=$official

if ($Tag) {
  Write-Output "-- 打 tag 并推"
  git tag -a "v$version" -m "$version — $($pkg.description)"
  git push origin "v$version"
}

Write-Output ''
Write-Output "还剩两件只能你在网页上做的事："
Write-Output "  1. GitHub 仓库 About → Topics 加上：dsh-plugin dsh deepseek-harness skill plugin learning study education spaced-repetition typescript"
Write-Output "  2. Releases 里基于 tag v$version 建一个 release（说明取 CHANGELOG 的 $version 段）"
Write-Output "收录抓取按天跑，24–48 小时后到 dshai.org / dshmarket / dshmarketplace.dev 搜包名验证。"
