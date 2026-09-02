# AI Coding 执行流程

本目录是执行入口，不重复定义完整流程：

- 流程单一真源：`.cursor/skills/ai-coding/SKILL.md`
- 资产职责与权威顺序：[guides/asset-map.md](guides/asset-map.md)
- Analyze / Plan / Design 产出：[templates/analysis-plan.md](templates/analysis-plan.md)
- 实施与评审检查：[templates/change-checklist.md](templates/change-checklist.md)
- 交付报告：[templates/delivery.md](templates/delivery.md)

## 标准链路

```text
需求/TFS
  → OpenSpec proposal + specs
  → /ai-analyze
  → /ai-plan
  → /ai-design
  → 人工批准（适用时）
  → /ai-implement
  → /ai-review
  → /ai-test
  → 缺陷则 /ai-fix → /ai-review → /ai-test
  → 可选 /ai-refactor
  → /ai-deliver
  → OpenSpec archive / PR
```

各阶段定义、人工批准边界和完成条件均以 Skill 为准；`docs/ai-coding/governance/quality-gate.md` 是 Review（评审）的统一质量与代码坏味道门禁。

## OpenSpec 兼容

当前 CLI 的活跃变更目录为：

```text
openspec/changes/<change-name>/
```

不要创建 `openspec/changes/active/<change-name>`；`active` 会被 CLI 当作变更名。归档由 OpenSpec CLI 写入 `openspec/changes/archive/`。

## 安装维护

```shell
android-ai-coding update <project>
android-ai-coding doctor <project>
```

哈希保护、Pack overlay 及冲突处理方式见 [guides/asset-map.md](guides/asset-map.md)。
