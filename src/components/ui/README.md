# UI 组件

基于 [shadcn/ui new-york](https://ui.shadcn.com/docs/installation/manual) 的源码组合方式，使用 Radix UI、CVA、Tailwind Merge、cmdk、React DayPicker 9 和 Sonner。组件保留在仓库内，按“晴空朋友”主题调整圆角、密度与蓝色交互状态；图标沿用项目内联 SVG。

- 通用组件放在本目录；业务适配层保留在相邻的 `../ui.tsx`，兼容已有 `Btn`、`Badge`、`Modal` 调用。
- 颜色统一修改 `src/app/globals.css` 的 token，新增样式通过 `cn` 合并。
- 日期选择器使用中文日历，按本地日期格式化，避免 UTC 导致日期偏移；年月下拉复用 Radix Select。
- `SelectField` 保留未知旧值，`CountryCombobox` 支持自定义地区，折叠表单的值由上层持有。
- 弹窗与菜单复用 Radix 的焦点、键盘及关闭交互；删除操作使用 AlertDialog。

上游 shadcn/ui 许可保留在 [LICENSE.shadcn](./LICENSE.shadcn)，Radix UI 等依赖按各自 MIT 许可证使用。
