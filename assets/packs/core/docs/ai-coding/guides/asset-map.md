# AI Coding 资产地图

## 职责与单一真源

| 资产 | 职责 | 权威性与修改入口 | Kit 托管 |
|---|---|---|---|
| `.cursor/rules/*.mdc` | 通用流程、平台与医疗薄边界 | 项目实现规则仍在目标项目维护 | 仅 Kit 白名单内文件 |
| `.cursor/skills/ai-coding/SKILL.md` | 九阶段执行流程、人工门禁和证据要求 | 流程单一真源；在 Kit 的 Skill 资产中维护 | 是 |
| `.cursor/commands/ai-*.md` | 九阶段命令入口 | 仅转交对应阶段，不重复定义流程 | 是 |
| `docs/ai-coding/governance/*.md` | 宪章、决策边界、项目配置和质量门禁 | 治理约束与项目事实；项目专属规则更优先 | 是 |
| `docs/ai-coding/**` | 治理文档、使用说明、指南和模板 | 治理约束与面向开发者的执行辅助；不复制规则正文 | 是 |
| `openspec/` | 需求、规格、设计、任务和归档 | 需求与变更产物的事实源；由 OpenSpec 管理 | 否 |
| `docs/规范/` | 项目长期架构与领域规范 | 项目稳定规范；由项目团队维护 | 否 |

发生冲突时，依次遵循：用户明确需求与已批准验收标准 → 项目规则与架构 → 稳定规格和当前 OpenSpec 变更 → `docs/ai-coding/governance/` 治理文件 → 通用 Skill。

## 修改原则

- 流程语义只修改 `SKILL.md`；Commands 仅保留入口说明。
- 项目实现约束只修改 `.cursor/rules` 或项目 `docs/规范`，不要复制到模板。
- 需求或设计变化写入 OpenSpec；执行证据写入任务记录和交付报告。
- 通用流程放在 core，平台边界放 platform pack，领域细序放 domain pack，项目差异放 project overlay。
- 项目自有实现 rules 不进入 Kit；同路径内容不同的 overlay 必须在注册表显式声明 `overrides`。
- 本地定制托管文件后，`update` 不会覆盖，而会将新版写入 `.ai-coding/incoming/<timestamp>/` 供人工合并。

## 更新与诊断

```shell
android-ai-coding update <project>
android-ai-coding doctor <project>
```

`update` 根据 `.ai-coding/manifest.lock.json` 的哈希更新未被修改的托管文件，并保护项目定制。`doctor` 检查安装状态、托管文件、九阶段命令和 OpenSpec 兼容问题。更新后应评审冲突目录并再次运行 `doctor`。
