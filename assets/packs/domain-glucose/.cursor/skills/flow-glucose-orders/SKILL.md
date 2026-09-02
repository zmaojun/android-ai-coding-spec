---
name: flow-glucose-orders
description: >-
  指导血糖医嘱列表的分页、同步写入后刷新、状态出口与新旧链路分叉复用。
  Use when changing 血糖医嘱、Paging、RemoteMediator 或列表路由。
disable-model-invocation: true
---
# flow-glucose-orders（血糖医嘱列表细序）

## 组合门禁

1. 由 `/flow-glucose-domain` 确认当前 AI Coding 阶段。
2. 若 `/flow-clinical-list-pipeline` 存在，应组合该 Skill；它是软依赖，缺失只提示，不阻止使用本包。
3. 写入前读取目标项目的架构、Paging、UI 状态、展示与医疗治理规则。
4. 同步、持久化、身份或医疗语义未批准时不得实现。

## 按职责搜索

实现前搜索目标项目已有的：

- Pager 注册与创建职责
- 远端同步和本地写入协调职责
- 本地分页读侧与查询变体
- 新旧列表链路选择职责
- ViewModel 或等价状态会话出口

若存在 `docs/ai-coding/bindings/*-glucose.md`，读取其中业务索引与类名以帮助定位，但不得将 Binding 当作 MUST 规则。

## 实现细序

1. 从已批准规格确认血糖医嘱归类和稳定业务键，不凭数字或显示字段推断语义。
2. 扩展现有 Factory、Mediator、PagingSource、QueryFactory 或 Session，避免平行 Pager 与第二套查询链。
3. 区分首屏本地读取、用户明确对齐云端、本地已写库后三条链；本地写入后优先依赖数据库失效通知与 Diff 更新。
4. ViewModel 或等价状态容器是分页数据、筛选、计数和会话的唯一业务出口。
5. View 层只持 Adapter、LoadState、布局等界面对象，不直连 DAO、裸网络或业务同步。
6. 只有确有新旧实现分叉时才保留 Router；Router 不成为数据真源。

## 写后检查

- 检查平行 Pager/Source/查询、View 层业务状态、状态容器持有 View 对象或 Router 膨胀。
- 检查首屏、用户刷新、本地写库三条链是否混用。
- 检查业务索引、同步和展示行为是否有项目代码或已批准规格依据。
- 执行 `/ai-review` 和覆盖分页、筛选、空态、失败及回归的 `/ai-test`。
