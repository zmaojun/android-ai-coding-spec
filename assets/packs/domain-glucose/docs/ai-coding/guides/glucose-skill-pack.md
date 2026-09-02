# 血糖领域 Skill Pack

`domain-glucose` 提供跨项目可复用的执行细序，不定义项目类名、医疗阈值、协议或同步语义。

- `/flow-glucose-domain`：在测量、医嘱列表与相邻边界之间路由。
- `/flow-glucose-measurement`：按职责寻找状态、试纸、设备、结果、样式和单位复用点。
- `/flow-glucose-orders`：按职责寻找分页注册、同步写入、本地读侧、查询、路由和状态出口。

## 组合关系

本包硬依赖 `android-medical`，因此自动获得 Android 平台边界和医疗人工决策边界。

`flow-glucose-orders` 可组合 `/flow-clinical-list-pipeline`，但后者是软依赖；目标项目未安装时 doctor 仅给出 `SOFTDEP_MISSING` 警告，不阻止安装或使用其他细序。

## 项目 Binding

项目 overlay 可以提供：

```text
docs/ai-coding/bindings/<project>-glucose.md
```

Binding 只列已验证的类名、业务索引和已知文档缺口，用于按职责搜索。它不得写入 MUST 规则，不得替代项目 rules、稳定规格或已批准 OpenSpec。
