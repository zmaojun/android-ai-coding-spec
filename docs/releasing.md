# 发布

## 版本策略

遵循 SemVer：

- MAJOR：不兼容的 CLI、状态 schema 或资产契约变化。
- MINOR：向后兼容的新 pack、profile、诊断或能力。
- PATCH：向后兼容的修复与文档更新。

产品版本必须静态写入 `package.json` 与 `kit.config.json` 并保持一致；每个 pack 也必须声明静态 SemVer，禁止运行时动态推导或发布漂移版本。

## 发布检查

1. 确认 Git 工作树或变更来源清晰，避免覆盖他人未提交修改。
2. 核对 CHANGELOG、README、架构和迁移说明。
3. 运行 `npm test`。
4. 运行 CLI 的 `--help`、`profiles`、`packs`。
5. 在临时项目验证 init、update、doctor、uninstall 与 schema v1 迁移。
   同时确认 manifest 的 `packVersions` 与文件 `source` 可追溯。
6. 运行 `npm pack --dry-run`，检查只包含声明文件、无项目实现 rules、无密钥和临时文件。
7. 确认没有遗留 `.tgz`。
8. 发布后以干净环境安装固定版本并复查 `android-ai-coding version`。

升级必须继续识别仍受支持的旧状态；若必须停止兼容，应提升 MAJOR，并在迁移文档中说明回滚与用户文件保护。
