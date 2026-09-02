---
name: flow-glucose-domain
description: >-
  路由血糖领域任务到测量或医嘱列表细序，并识别同步、配置、质控与设备协议边界。
  Use when handling 血糖、GLU、血糖测量、血糖结果或血糖医嘱。
disable-model-invocation: true
---
# flow-glucose-domain（薄路由）

本 Skill 只选择职责细序，不定义医疗阈值、项目架构或具体实现类。

## 进入条件

1. 确认任务所处 AI Coding 阶段；阶段未建立时先进入 `/ai-analyze`。
2. 只有已批准的 Implement、Fix、Refactor 阶段可以写入。
3. 涉及医疗解释、患者与测量身份、设备协议、同步或持久化语义时，按医疗治理边界请求人工决定。

## 分流

- 测量、试纸、结果、单位或样式：调用 `/flow-glucose-measurement`。
- 血糖医嘱、列表、Paging 或本地缓存：调用 `/flow-glucose-orders`。
- Sync、配置、QC 或设备协议：转到目标项目已有规则、规格和职责入口，不在本 Skill 中补写语义。

## 项目 Binding

若 `docs/ai-coding/bindings/*-glucose.md` 存在，读取它以定位目标项目的已验证类名、业务索引和已知缺口；Binding 只是搜索提示，不得覆盖规则或规格。

输出当前阶段、所选分支、必读真源与人工决策边界后，再转交对应细序。
