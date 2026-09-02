# 更新日志

## 1.1.0

- npm 正式命名为 `android-ai-coding`，仅注册同名全局命令。
- 新增声明式 `kit.config.json`，支持 Pack 依赖拓扑、循环检测、显式覆盖和 Profile。
- Pack 使用静态 SemVer，schema v2 manifest 记录 pack 版本与托管文件来源。
- 分层调整为 core → platform → domain → project overlay，并加入 rules 白名单。
- 兼容 `.ai-coding` schema v1 状态，更新后迁移至 schema v2。
- 将血糖能力拆为可复用 `domain-glucose` 与 SmartPro Binding。
- 扩展 doctor 的 Pack、Profile、规则泄漏、软依赖和平行治理诊断。
- 更新时清理空的旧阶段 Skill 目录，非空项目定制目录保持不变。
