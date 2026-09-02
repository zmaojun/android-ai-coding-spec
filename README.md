# Android AI Coding

正式、可持续迭代的 AI Coding 工作流 npm 包。它安装九个 Cursor `/ai-*` 命令、阶段 Skill、治理文档，以及按需组合的 Android、医疗和血糖领域资产。

## 环境与安装

- Node.js 20 或更高版本
- 无第三方运行时依赖

```shell
npm install -g android-ai-coding
android-ai-coding version
```

本仓库开发态可运行 `npm install -g .`。包只注册 `android-ai-coding`，不会注册 `ai-coding`，以避免与现有 npm 包的全局命令冲突。

## Profile 与 Pack

```shell
android-ai-coding profiles
android-ai-coding packs
```

- `core`：九阶段命令、通用 Skill、治理和模板。
- `android`：core + 通用 Android 线程、生命周期、UI 状态和资源边界。
- `android-medical`：android + 医疗、设备、同步与敏感数据边界。
- `smartpro`：上述能力 + `domain-glucose` + SmartPro 项目说明与职责 Binding。

可向任一 profile 附加 pack，依赖会自动展开：

```shell
android-ai-coding init <project> --profile android-medical --packs domain-glucose
```

## 使用

```shell
android-ai-coding init [target] --profile core
android-ai-coding update [target]
android-ai-coding doctor [target]
android-ai-coding uninstall [target]
```

安装后使用九个 Cursor 命令：

```text
/ai-analyze → /ai-plan → /ai-design → approval
→ /ai-implement → /ai-review → /ai-test
→ [/ai-fix → /ai-review → /ai-test]
→ optional /ai-refactor → /ai-deliver
```

`update` 未传 `--profile` 或 `--packs` 时沿用已安装配置。传入 `--packs` 表示在当前选择上附加 pack。

## 更新、冲突与卸载

状态仍保存在 `.ai-coding/`：

- `.ai-coding/config.json` 保存 schema、产品、版本、profile 与最终 pack 列表。
- config 与 manifest 都记录静态 `packVersions`；manifest 文件条目同时记录来源 pack，便于升级审计与溯源。
- `.ai-coding/manifest.lock.json` 保存托管文件哈希。

更新只覆盖“上次由 Kit 托管且用户未修改”的文件。未托管同路径文件绝不接管；新版写入 `.ai-coding/incoming/<timestamp>/` 供人工合并。卸载仅删除哈希未变化的托管文件。

## 1.0 / schema v1 迁移

兼容旧 `managedBy=android-ai-coding-kit` 的隐式 schema v1 配置，以及 schemaVersion 1 的锁文件。`doctor` 会提示迁移但不因旧 schema 本身失败；执行 `android-ai-coding update` 后写为 schema v2。迁移仍按旧锁哈希判断所有权，不会误删用户修改。

## 安全边界

Kit 托管 rules 白名单只有：

- `eng-ai-coding-workflow.mdc`
- `eng-ai-coding-android.mdc`
- `domain-ai-coding-medical.mdc`

项目自己的架构、领域、样式、Hook 和实现规则不进入 Kit，也不会被改写。Pack 同路径覆盖必须在 `kit.config.json` 显式声明。

架构与扩展方式见 [docs/architecture.md](docs/architecture.md)，发布流程见 [docs/releasing.md](docs/releasing.md)。
