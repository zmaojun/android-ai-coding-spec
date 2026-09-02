# 架构

## 分层

```text
core → platform pack → domain pack → project overlay
```

- core：阶段机、九命令、通用治理与模板。
- platform：平台工程边界，例如 Android 线程与生命周期。
- domain：可跨项目复用的领域流程，例如医疗边界与血糖细序。
- project overlay：项目说明和职责 Binding，不携带项目自有实现 rules。

Rules、Skills、Docs 三分离：Rules 表达强制边界，Skills 组织执行细序，Docs 提供治理说明、模板与非规范性 Binding。

## 解析与 Overlay

根 `kit.config.json` 是唯一扩展注册表。每个 pack 声明硬依赖、软依赖、资产目录和允许覆盖的路径。
每个 pack 还声明独立静态 SemVer；安装状态记录 pack 版本与每个托管文件的来源 pack。

硬依赖按拓扑顺序展开；未知 pack 或循环依赖立即失败。多个 pack 产出同一路径且内容不同，只有后加载 pack 在 `overrides` 中显式列出该路径才允许覆盖。软依赖不参与安装，只由 doctor 检查并警告。

目标项目中没有旧锁所有权记录的同路径文件不会被接管。项目 rules 与 hooks 也不会因 profile 安装而被扫描或改写。

## 扩展 Pack

1. 在 `assets/packs/<name>/` 创建最小职责资产。
2. 在注册表声明 `layer`、`dependencies`、`softDependencies`、`overrides`。
3. 如需新 profile，在 `profiles` 中只列根 pack，让依赖递归展开。
4. 若包含 rule，先确认它属于 Kit 通用边界，再加入 `rulesWhitelist`；项目实现 rule 不得加入。
5. 添加解析、冲突、profile 展开、doctor 和安装生命周期测试。
6. 更新 README 与 CHANGELOG，并按发布清单验证。
