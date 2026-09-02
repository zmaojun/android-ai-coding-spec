# SmartPro AI Coding 项目配置

## 技术栈

- Android、Java、XML、Gradle 多模块项目
- 仅使用项目现有库与并发机制
- 未经批准，不引入 Kotlin、Compose，不迁移依赖、SDK、AGP 或架构

## 架构

依赖按以下职责层级向上流动：

```text
commonlib
→ config / compents / cernerehr / hl7
→ mvvm
→ protocollib
→ service || database
→ bussiness
→ app
```

- `app` 负责 UI，并通过 `bussiness` 访问业务能力。
- `bussiness` 是应用门面，负责编排、映射、同步写入、UI 组装和 Paging 组合。
- `service` 负责远端 API 通信与线值对象。
- `database` 负责 Room、DAO、实体、迁移和薄层本地 DAO 委托。
- `service` 与 `database` 是同层模块，不得新增相互依赖。
- `protocollib` 负责血糖仪/设备协议通信。

实现约束以 `.cursor/rules/arch-project.mdc` 为权威来源；本配置仅提供流程摘要。

## 固定链路

- HTTP 使用现有 API 和 `ServiceExecutor`。
- app 的本地数据访问通过 `com.acon.bussiness.facade`。
- 同步链路为 UI → bussiness 门面 → service API → bussiness Mapper → database。
- 设备通信使用 `protocollib` 公共 API。
- Paging 在 bussiness 中组装、读取 Room，并通过 `PagingData` 更新 UI。

## 项目规则

修改代码前，遵循 `AGENTS.md` 和 `.cursor/rules/meta-enforcement.mdc`，包括必需的 `## 预检清单`、适用规则读取和现有代码复用搜索。

项目专属架构、领域、风格和设计 token 规则优先于可移植 Kit 基线。

## 验证

优先运行范围最小且相关的 Gradle 模块检查。高风险医疗、设备、同步、HIS、安全、持久化和时间变更必须经过人工评审，并提供适用的设备/集成证据。
