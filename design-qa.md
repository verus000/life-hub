# Life Hub 薄荷青 UI · 设计核对

日期：2026-10-30。实现对象：现有 Next.js 应用，沿用用户选择的第二版与随后确认的七张延展稿。

final result: passed

没有待处理的 P0 / P1 / P2 问题。保留的 P3 差异与验证边界见后文。本报告确认整体方向、主要结构与交互；不声称生成位图的每个字形和间距均逐像素相同。

## 视觉依据与对照方法

- source visual truth path：C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-mint
- 实现地址：http://127.0.0.1:4173/
- 浏览器：Codex 内置浏览器。
- 截图与对照目录：C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation
- 完整像素、画布和密度记录：[qa-evidence.json](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/qa-evidence.json)。
- 每张对照图左侧为设计稿，右侧为浏览器实际渲染。已把两者放到同一图片中查看，而非仅凭源码判断。
- 桌面 CSS 视口为 1440 × 1024，devicePixelRatio 约 1。源图 1487 × 1058 按比例归一化到同一画布；实现截图为 1440 × 1024，资产页截图服务返回 1430 × 1017，按相同比例归一化，没有拉伸。
- 手机 CSS 视口为 390 × 844。源图 853 × 1844 按比例归一化；实现整页截图为 380 × 920（浏览器排除了 10px 滚动条），比较时取顶部 844px 并在右侧补齐滚动条宽度，不把整个长页压缩到一屏。
- 处理弹窗是组件级对照：源画布 1190 × 1322 归一化到 720 × 800，实现裁剪为 600 × 677，置于同尺寸画布中比较。

| 页面 / 状态 | 设计稿文件（以上述源目录为根） | 实现截图 | 同屏对照 |
| --- | --- | --- | --- |
| 桌面总览：1 逾期、1 今天、2 近期，统计折叠 | 01-overview-desktop.png | [overview-desktop.jpg](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/overview-desktop.jpg) | [首页对照](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/comparison-overview-final.jpg) |
| 手机号：3 条在用记录，含空金额与 SGD | 02-category-phone-desktop.png | [category-desktop.jpg](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/category-desktop.jpg) | [列表对照](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/comparison-category-final.jpg) |
| 添加手机号：更多信息折叠 | 03-create-phone-dialog.png | [create-desktop.jpg](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/create-desktop.jpg) | [添加对照](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/comparison-create-final.jpg) |
| 记录保活：实际日期、下次日期、费用可留空 | 04-record-completion-dialog.png | [complete-dialog.jpg](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/complete-dialog.jpg) | [处理对照](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/comparison-complete-final.jpg) |
| 资产：4 账户，人民币分布展开 | 05-assets-desktop.png | [assets-desktop.jpg](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/assets-desktop.jpg) | [资产对照](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/comparison-assets-final.jpg) |
| 手机总览：四条近期事项 | 06-overview-mobile.png | [overview-mobile.jpg](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/overview-mobile.jpg) | [手机对照](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/comparison-mobile-final.jpg) |
| 登录：未登录、空表单 | 07-auth-login-desktop.png | [login-desktop.jpg](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/login-desktop.jpg) | [登录对照](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/comparison-login-final.jpg) |

聚焦证据：[顶部、主标题与日期的局部对照](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/comparison-header-focus.jpg)。处理弹窗的独立 600px 裁剪和 390px 手机对照也用于检查小字、字段、按钮及日期，而不是仅看缩小的桌面全景。

截图均使用独立验证数据库中的虚构资料，没有读取或截图用户日常数据。为匹配各参考稿，验证夹具分为首页四条到期事项、手机号三条记录、资产四账户三种状态。

## 已发现问题、修复与复核历史

| 轮次 | 问题与证据 | 修复 | 修复后的证据与结论 |
| --- | --- | --- | --- |
| 1 | P2：首页内容偏紧、字号偏小，导航偏左。见 [首轮首页](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/overview-initial.jpg) 与 [首轮同屏对照](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/comparison-overview-initial.jpg) | 居中分类导航，增加标题区与行间留白，调整标题、日期、事项名称字号和图标位置 | 最终首页全景与局部对照；主区域比例已回到所选方向 |
| 2 | P2：手机近期区仍使用桌面卡片内边距，四个行动明显下移。见 [首轮手机整页](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/overview-mobile-initial.jpg) | 手机改为连续单列，减少行内垂直间距，保留 44px 文字按钮，取消侧区额外底色与内边距 | 最终手机对照；四个主要行动位于首屏，统计接近屏底，页脚可继续滚动查看；无横向溢出 |
| 3 | P1：生产环境分布图为黑色。见 [初始资产页](C:/Users/verus/.codex/visualizations/2026/10/30/01a18a68-5baf-7971-b03a-d3b753cc2350/life-hub-ui-implementation/assets-initial.jpg)；实际检查发现颜色 token 为空 | 八个图表 token 使用 Tailwind 静态保留主题块，避免动态索引引用被裁掉 | 实际样式为 #008A7A、#32C9B5、#99E8D7；最终资产图和图例均显示对应颜色 |
| 3 | P2：资产列表重复完整日期块，行高使后面的账户下移 | 桌面资产用紧凑日期与复核文案，余额放第二列，资产行单独收紧；保留手机可读结构 | 最终资产页四个账户与操作均可见；现金账户保持无复核日期 |
| 4 | P2：未登录时背景被页面闸门重定向，背景请求得到登录 HTML | 仅公开 /images/mint-orbit.png 这个静态文件，其余访问判断不变；补充允许与拒绝边界测试 | 未登录 GET 返回 200 / image/png，783507 字节；登录页最终截图有背景；其他测试路径仍跳登录 |
| 5 | P2：原主青色文字在浅薄荷底上的对比度为 4.48:1 | 次要按钮、强调区域与选中预设文字改用深青 #00695E，主按钮仍为 #007F72 + 白字 | 实际按钮前景 rgb(0,105,94)、背景 rgb(232,248,243)，对比度 6.02:1；按钮高 44px |

上述问题均经修复后再次截图或实际样式核验，之后才标为通过。

## 五个必要视觉面

| 面向 | 核对结果 |
| --- | --- |
| 字体与排版 | 系统中文无衬线字体，深墨绿标题与辅助文字分层；日期使用等宽数字；名称、金额可换行。实现中的常规正文字号遵循设计规范 14–16px，未把生成图里偏大的所有文字机械放大 |
| 间距与布局 | 顶部下划线导航、桌面双栏、手机单列、白底连续行、细分隔线、轻薄荷辅助区均已落地；弹窗正文可滚动、操作区独立；360 / 390 / 1024 / 1440px 视口无横向溢出 |
| 配色与 token | 冷白 #FCFFFE、正文 #10352F、辅助 #4B6B64、主按钮 #007F72、浅底 #E8F8F3、深青文字 #00695E；逾期 #BD4152。主按钮白字对比度 4.91:1，浅薄荷按钮文字 6.02:1 |
| 图像与素材 | 使用根据所选参考生成的本地透明背景 PNG；没有远程图片/字体/图标库。标准图标和动态图表保留项目已有内联 SVG 体系，符合仓库约定；没有拿整张 UI 位图代替真实交互 |
| 文案与内容 | 日期、费用、币种、状态、处理与合约提醒来自真实领域字段；演示内容可替换。主操作与移动端均保留文字，未加入未实现的自动付款、AI、汇率换算等入口 |

## 交互与工程验证

- 注册 → 控制台验证邮件 → 邮箱激活 → 空首页 → 登录/登出，已在隔离预览走通。
- 添加手机号：日期 +30 天、自定义国家“示例地区”、保活策略、保存、成功提示已验证。
- 金额留空保存后，通过验证库对应 API 再核对 amount 为 null，没有变成 0；本地日期未出现 UTC 偏移。
- 记录保活、查看处理记录、撤销最新处理已验证，撤销后恢复原日期。
- 中文搜索与无结果态、重置、搜索更新后焦点保留已验证；代码另保留 composition 状态，不在组词期间提交过滤词。
- 暂停 → 状态筛选 → 恢复在用已验证。
- 宽带的续费日期与合约日期仍为独立控件，停车费列表与金额正常。
- 人民币 200000 与 USD 1500 分开显示，60% / 30% / 10% 的图形和图例对应；未设日期账户保持“未设复核日期”。
- 主操作真实渲染高度 44px；浏览器最终验证阶段 error 日志为 0。
- npm run typecheck：通过。
- npm test：11 个测试文件、82 项通过。新增总览分组/合约/后续安排与公开装饰访问回归，并扩充币种显示断言。
- npm run build：通过，15 个路由。
- 使用 .next/standalone/server.js 和独立 DB_FILE_NAME 在 127.0.0.1:4173 完成生产运行冒烟；没有单独运行 npm start。
- git diff --check：通过（仅存在 Git 的 LF/CRLF 提示，无空白错误）。

## 有意保留的差异与 P3

- 生成稿的图标字形、局部光感与行内字号不是精确的设计源文件。实现复用已有图标、原生文字与更深的语义色，不追求栅格字形逐像素相等；个别辅助文字与环形图粗细仍可在后续反馈中微调。
- 手机首屏保留四个主要记录按钮，页脚会稍晚出现；整页约 920px，允许自然滚动，不压缩 44px 点击区域。
- 添加表单初始为未填写状态，而设计稿已有演示选项；因此截图中的占位文案与填充值不同。运营商保持自由文本，国家仍支持自定义。
- 设计稿处理弹窗的 11-28 是概念示例；现有业务对已逾期的 10-28 事项在 10-30 处理时，从实际处理日期顺延到 11-30。本次遵循已有计算逻辑，允许用户核对修改，没有为了匹配示例而修改周期业务。
- 资产条目按现有日期顺序排列，无日期账户排最后；不按设计稿的演示排列强制重排。分布默认折叠，图中展开是明确的交互状态。
- 没有开放设计稿中的展示性假功能，所有主要流程继续使用原有后端与鉴权。

## 未验证范围

真实手机触摸与原生中文输入法组词、系统读屏/完整键盘回归、真实 SMTP、Docker 镜像构建、本次未改动的导入导出在浏览器中的完整文件往返没有另做手动验证；相应已有单元/路由测试仍通过。未对用户运行中的数据库执行测试。

## 实现核对清单

- [x] 主题 token 与本地背景
- [x] 总览、分类、资产、添加/处理、认证与移动端
- [x] 主要实际数据交互与未登录资源
- [x] 修复生产图表颜色、手机密度与浅底文字对比度
- [x] 对照证据、回归测试、类型检查、生产构建和运行冒烟
