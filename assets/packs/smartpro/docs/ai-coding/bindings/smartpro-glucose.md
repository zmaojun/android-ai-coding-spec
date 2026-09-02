# SmartPro 血糖职责 Binding

本文件只为 `domain-glucose` 提供 SmartPro 代码搜索索引，不定义 MUST 规则。类移动后以仓库搜索结果为准。

## 测量职责索引

- 页面与状态：`StripTestActivity`、`StripTestFragment`、`StripTestModel`、`BloodTestViewModel`、`DeviceTestViewModel`
- 试纸与设备：`JackTestStripLiveData`、`MeterCommunication`、`HardwareCompany`、`ResultFactory`
- 展示与单位：`RecordStyleUtil`、`GUMeterUnit`、`StripType`

## 医嘱职责索引

- SmartPro 当前将 GLU 医嘱关联到 `mark=2`；实现前仍须从项目规则、代码或已批准规格确认语义。
- 注册与创建：`DoctorOrdersPagerFactoryRegistry`、`ClinicalGluDoctorOrdersPagerFactory`、`GluDoctorOrdersPagerFactory`
- 读写链：`GluDoctorOrdersRemoteMediator`、`GluTaskRoomPagingSource`、`GluTaskClinicalPagingSource`
- 查询与界面装配：`DoctorOrdersTaskQueryFactory`、`DoctorOrdersListRouter`、`GluTaskPagingSession`

## 已知缺口

- `glu-task-paging3-implementation.md`
- `doctor-orders-all-tabs-room-paging.md`
- `spec-today-doctor-orders-data-display.md`

缺失文件不是强制必读项；不得推断其本应定义的语义。
