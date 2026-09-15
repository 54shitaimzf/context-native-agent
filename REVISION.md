# 修订与校验说明（v1.1）

本文的定稿与交付说明。**正文文字自 `8229d01` 起未改动**——其后所有提交只插入了引用角标、重编号，或改了附录；每一轮改动都用同一套指标做过"零差异"比对。

## 一、交付物

| 文件 | 说明 |
| --- | --- |
| `Agent架构革新：迈向上下文原生智能-Context-Native Agent.md` | 定稿源文件（序言 / 正文 / 附录1 Harness 耦合思考 / 附录2 半定量成本分析 / 附录3 引用与对照） |
| `Agent架构革新：迈向上下文原生智能-Context-Native Agent.pdf` | **最终格式**：A4、**35 页**、154 个可点击链接（目录 29 + 角标 82 + 回链 40 + 页边注 3），带页码的目录与页脚页码 |
| `Agent架构革新：迈向上下文原生智能-Context-Native Agent.html` | 自包含单文件阅读版：KaTeX 与字体全部内联，离线可用。顶部两个开关——「强调·专名·边注」与「白底（PDF 预览）」 |
| `build-html.mjs` | 渲染脚本：`node build-html.mjs` 从 Markdown 重建 HTML（只读 Markdown，不改它） |
| `build-pdf.mjs` | 导出与自查：`node build-pdf.mjs` 导出 PDF；`final` 导出＋截图＋几何审计＋页边距探针；`tocpages` 用 pdftotext 反查目录页码；`shots 关键词…` 分页截图；`audit` 几何审计；`probe` 页边距探针；`notetest` 页边注排版变体测试；`fonttest` 字体嵌入诊断 |
| `verify.mjs` | 交付校验：`node verify.mjs` 逐行比对 Markdown 与 HTML 文字、检查角标双向、表格列数、内部链接 |
| `measure-pdf.mjs` | 成品量测：`node measure-pdf.mjs` 用 `pdftotext -bbox` 量出正文/页脚/页边注在纸面上的真实位置 |
| `fix-font-names.py` | 修正 `wght=600` 实例的名称表（见第八节） |
| `_tocpages.json` | 目录页码表（由 `build-pdf.mjs tocpages` 生成，`build-html.mjs` 读它渲染目录页码） |

## 二、数据来源

- 三条**从未装过任何上下文处理插件**的干净会话：合计 **9,023 步 / 363 小时 / 54 次原生压缩**，逐次调用的计费数据完整；
- 锚定会话 `session-b5f92412`：**2,068 步**、**9 次人工压缩**（触发点中位 **30.9%**）；
- 全部金额按 **DeepSeek V4.1 Flash 空闲时段**官方价：缓存命中 ¥0.02 / 未命中 ¥1 / 输出 ¥4（每百万 token，高峰为 2 倍）。

## 三、哪些是实测、哪些是保守取法

| 量 | 取值 | 性质 |
| --- | --- | --- |
| $W$、$T$、$g$、$\theta_b$、$C_c$、$\sigma$、$E_b$、$k_b$、缓存命中率 | 见附录2 A2.4 | **实测** |
| 压缩后重读段 | 9.2k | **实测**：九次压缩后首次调用的未命中均值（残留中位 15.3k，其余仍在缓存中） |
| 价格取低谷价、$P+s=60\mathrm{k}$、$M=10\mathrm{k}$、$\rho=0$、$\varepsilon=0$、$N^2c$ 不入账、质量与能力收益一律为 0 | 见附录2 A2.4 | **保守**（全部取在对本文不利的一侧） |
| $N=4$、$\theta_d=20\%$ | — | **三条例外**之一二：不是保守取法，是"设计被正确使用"与"能力水位"的假设（偏有利） |
| $\Delta P=P$（前缀整段按未命中） | — | **三条例外**之三：不是偏向哪一边，而是越过了真实机制 |

## 四、成本结论速查（一次 2,068 步任务）

| 情形 | 账单 |
| --- | --- |
| 基线，人停手在实测的 31% | **¥7.02** |
| 基线，完全不管控（撞默认阈值 80%） | ¥16.97 |
| 基线，按钱调到自己的最优点 8%（工程上不可达） | ¥3.33 |
| 本架构，20% 水位、4 分支、申报按保守的 10k | **¥5.70** |

对实测的真实基线**省约 19%**；对完全不管控**省约 66%**；对基线自己的钱最优**贵 71%**；与基线同水位（31%）**贵 12%**。

三条判据：**申报量 ≤ 2.8k**；**前缀 + 切片 < 63k**；**重发现盈亏平衡 $\rho^* = 160\text{–}194$ token/步**。
四个台阶：写一次 ¥4/M（＝背 200 步）、第一次构建 ¥1/M（＝背 50 步）、此后每步被读 ¥0.02/M（＝背 1 步）、不构建 **0**。

## 五、引用体系

共 **40 条**，按来源分四档：**甲 10 条**（同行评审）、**乙 16 条**（厂商一手文档/官方仓库）、**丙 11 条**（预印本）、**丁 3 条**（工程博客）。**只有甲、乙两档被用来支撑结论**；丙、丁只作方向性参考。
条目表的「核验」列：**【原文】**＝直接访问了原始页面或论文正文；**【转述】**＝经镜像、索引或第三方转述核实（方向可信、精度待复核）。未采信与不可用清单见附录3 A3.7。

## 六、版式与字体

- **字体**：正文与标题 **思源黑体**（Noto Sans SC），封面大标题 **思源宋体**（Noto Serif SC）；代码、坐标、编号用 Cascadia Mono。PDF 内嵌 `NotoSansSC-Regular / -SemiBold / -Bold` 与 `NotoSerifSC-Bold`。
- **一个必须记下的坑**：系统里的思源是**变量字体**（`NotoSansSC-VF.ttf`），Chrome 导出 PDF 时**无法嵌入变量字体**，会静默回退成 NSimSun（新宋体）——早期的 PDF 里中文其实一直是新宋体。现用 `fontTools` 把变量字体实例化成静态字重（`_fonts/`）后经 `@font-face` 接入导出管线，PDF 里才是真思源。
- **版心**：A4，页边距 上 22 / 右 38 / 下 20 / 左 22 mm，正文宽 150mm ≈ **41 字/行**；正文 10.5pt（五号）、行距 1.75、段间 0.72em，不首行缩进。右侧 38mm 留白用于页边注。
- **强调**：Markdown 风范——加粗承担醒目；**中性极淡暖灰底色（#F2EFE9）只给 20 字以内的短标记**（全书 9 处），更长的结论句只加粗（4 处），全篇不用彩色高亮。
- **表格**：26 张全部为**三线表**（顶/底线 1.5pt `#1a1a1a`、表头下 0.6pt `#8a8a8a`，无竖线、无斑马、无圆角），表头不折行、数值列右对齐并使用等宽数字。
- **图**：两张 SVG 为单色系（暖灰 + 墨蓝），柱体直角、网格极淡、图内不重复图注标题；图注带「图 1 / 图 2」编号。
- **封面与目录**：渲染层新增封面页（标题 / 主题式 / 作者 / 日期）与目录页（29 行，含**真实页码与点线引导**，可点击）。目录**不写"表 x"编号题注**：这些表是夹在论述链条里的论证表，编号会制造虚假的"表格清单"预期。
- **页边注的两次转折**：屏幕上是正文右侧留白里的真页边注（与所注段落首行齐平）；但 **Chrome 导出 PDF 时会丢弃落在版心外的绝对定位元素**（实测三种 absolute/float 写法全部丢失），所以打印时改为**紧贴该段落上方的一行右对齐灰色小注**。若把它塞回外侧留白，就得再冒一次"印不出来"的风险。
- **页码**：目录页码用 `pdftotext` 反查成品 PDF 得到（先导出→反查→重建 HTML→再导出，迭代到两轮一致，已收敛）；页脚由导出脚本注入「当前页 / 总页数」。

## 七、定稿校验记录

| 项 | 结果 |
| --- | --- |
| 正文文字 | `node verify.mjs`：Markdown 有内容的行 497，比对 462 行，**未命中 0 行** |
| 引用 | 82 个角标、40 条条目、**40 条双向可达**，编号连续 1–40，无未定义引用、无孤儿条目 |
| 内部链接 | 109 个锚点目标，**悬空 0 个** |
| 表格 | 26 块，**0 处列数不一致** |
| 版式几何 | 溢出正文框 **0**、图内文字越界 **0**、表格横向溢出 **0** |
| 成品量测 | `node measure-pdf.mjs`：正文文字横向 **21.6–172.0 mm**（设计值 22–172）、页脚 **162.7–172 mm**、**35 页**、页边注 3 条均在（第 6、6、7 页） |
| 字体嵌入 | `NotoSansSC-Regular / -SemiBold / -Bold`、`NotoSerifSC-Bold`、`SegoeUI`、`KaTeX`×2、`NSimSun`（个别符号兜底） |
| 残留标记 | 占位符 0、正文可见的字面星号 0 |
| 账目重算 | 13 个金额 + $R_b$、$\theta_b^*$、$k_b$、$R_d$ 四组派生量，用附录2 参数**独立重算全部命中** |

## 八、重建与导出

```bash
node build-html.mjs              # Markdown → 自包含 HTML
node build-pdf.mjs               # HTML → A4 PDF（自动接入 _fonts/ 静态字体、注入页码页脚）
node build-pdf.mjs tocpages      # 反查目录真实页码 → _tocpages.json（改版式后需重跑，再重跑 build-html）
node build-pdf.mjs final         # 导出 + 分页截图(_shots/) + 几何审计 + 页边距探针
node build-pdf.mjs audit         # 只做几何审计
node build-pdf.mjs shots 关键词…  # 把含关键词的那一页截成 PNG
node verify.mjs                  # 交付校验
node measure-pdf.mjs             # 用 pdftotext -bbox 量成品纸面位置
```

> 顺序很关键：**先导出、后截图**。A4 模拟层与设备尺寸覆盖会污染随后的分页（实测同一次运行里"先截图后导出"会多出 4 页）。

`_fonts/`、`_shots/` 是构建缓存（已 gitignore）。静态字重由系统变量字体实例化而来，需要 Python + fontTools：

```bash
py -m fontTools.varLib.instancer "$WINDIR/Fonts/NotoSansSC-VF.ttf"  wght=400 --update-name-table -o _fonts/NotoSansSC-Regular.ttf
py -m fontTools.varLib.instancer "$WINDIR/Fonts/NotoSansSC-VF.ttf"  wght=700 --update-name-table -o _fonts/NotoSansSC-Bold.ttf
py -m fontTools.varLib.instancer "$WINDIR/Fonts/NotoSerifSC-VF.ttf" wght=700 --update-name-table -o _fonts/NotoSerifSC-Bold.ttf
py -m fontTools.varLib.instancer "$WINDIR/Fonts/NotoSansSC-VF.ttf"  wght=600 -o _fonts/NotoSansSC-SemiBold.ttf
py fix-font-names.py             # 600 不在命名实例里，--update-name-table 会失败，名称表另行修正
```

> `wght=600`（SemiBold，用于小节标题）不在思源黑体变量字体的命名实例中，`--update-name-table` 会报 `Cannot find Axis Values`；改不带该参数生成，再用 `fix-font-names.py` 把名称表改成 `Noto Sans SC SemiBold`。

## 九、留给作者决定的一处文字细节

正文里有两处用 ASCII 省略号 `...`（序言 L45、L49），中文排版惯例是 `……`；另有一处引号方向反了（序言 L29 的 `”任务判别器“` 应为 `“任务判别器”`）。这三处都是**正文文字**，未作改动，等您定夺。
