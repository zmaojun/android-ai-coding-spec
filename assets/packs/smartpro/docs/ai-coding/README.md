# AI Coding 执行流程

本页是 SmartPro 执行入口，不重复定义完整流程：

- 流程单一真源：`.cursor/skills/ai-coding/SKILL.md`
- SmartPro 实现规则：`AGENTS.md`、`.cursor/rules/meta-enforcement.mdc` 及适用项目规则
- 资产职责与权威顺序：[guides/asset-map.md](guides/asset-map.md)
- 血糖领域通用细序：[guides/glucose-skill-pack.md](guides/glucose-skill-pack.md)
- SmartPro 血糖职责索引：[bindings/smartpro-glucose.md](bindings/smartpro-glucose.md)
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

各阶段定义、人工批准边界和完成条件均以 Skill 为准。项目预检、模块边界与领域约束分别以 `meta-enforcement.mdc`、`arch-project.mdc` 和适用 `domain-*` 为准；`docs/ai-coding/governance/quality-gate.md` 统一承载 Review（评审）的质量与代码坏味道门禁。

血糖、GLU、StripTest、BloodTest、GluTask、`mark=2`、血糖结果或血糖医嘱任务先调用 `/flow-glucose-domain`。路由会转入测量细序或医嘱 Paging 细序；任何写入仍须经过 `/flow-rules-preflight`，且不得跳过当前 AI Coding 阶段。

## OpenSpec 兼容

当前 CLI 的活跃变更目录为：

```text
openspec/changes/<change-name>/
```

不要创建 `openspec/changes/active/<change-name>`；`active` 会被 CLI 当作变更名。归档由 OpenSpec CLI 写入 `openspec/changes/archive/`。

## 安装与维护

正式 Kit 真源通过 npm 包 `android-ai-coding` 安装：

```shell
npm install -g .
android-ai-coding init <project> --profile smartpro
android-ai-coding update <project>
android-ai-coding doctor <project>
android-ai-coding uninstall <project>
```

更新与卸载均基于 `.ai-coding/manifest.lock.json` 哈希保护项目定制；Pack 通过声明式依赖与显式 overlay 合成。详细维护方式见 [guides/asset-map.md](guides/asset-map.md)。
