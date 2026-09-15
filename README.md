# Agent 重架构：迈向上下文原生智能（Context-Native Agent）

中文长文，约 2.0 万字（序言 + 正文 + 三个附录），讨论 LLM Agent 的上下文成本与架构取舍。

正文之外附一条完整的排版构建链：**Markdown 定稿 → 自包含单文件 HTML → A4 PDF**。目录页码、交叉引用、页边注、图表都由脚本生成，不靠手工调整——所以每一个数字都可以重新跑一遍来核对。

- 文档版本：**v1.2**（2026-09-15）；本仓库快照：**v1.2.1**（同一份文字，另含许可与构建链）
- 成品：A4 35 页，154 个可点击链接；40 条参考文献全部双向可达

## 命题

`Agent = Harness + Model` 少写了一项。补上第三项：

> **Agent = 环境 + 上下文 + 模型**

由此推出的几条，是全文的骨架：

- **上下文不是攒出来的，是每一轮从 0 构建出来的。** 每轮按需把原文装配进上下文，一轮结束整体消失——原文在仓库里，消失的不是内容。
- **成本有四个台阶**：输出 ¥4/M（模型写出一个字，等于把 200 个字背着走一步）、未命中 ¥1/M、命中 ¥0.02/M、不构建 = 0。主流做法在最贵的那两档之间反复付钱。
- **判据可以压成三个数**：每轮「前缀 + 切片」压在 **63k** 以内、每轮申报量不超过 **2.8k**、基线的「重发现」量 ρ\* 不超过 **160–194 token/步**——越过这三条，本文的成本优势不成立。

成本账用真实账单锚定（一次 2,068 步的任务：基线在实测停手点 31% 水位上要 ¥7.02，本架构按 20% 水位、4 分支取 ¥5.70），并把所有对己方有利的量一律设为 0、不利的量往大取，逐条列在附录2。

## 文件

成品有三种格式，主名相同、扩展名不同：

| 文件 | 说明 |
| --- | --- |
| `Agent架构革新：迈向上下文原生智能-Context-Native Agent.md` | **源文件**（830 行）。唯一事实来源，成品都由它渲染 |
| `Agent架构革新：迈向上下文原生智能-Context-Native Agent.html` | 自包含单文件离线版（约 770 KB）。KaTeX 与公式字体以 base64 内联，零外部请求 |
| `Agent架构革新：迈向上下文原生智能-Context-Native Agent.pdf` | A4 排版成品（35 页）。嵌入了思源黑体/宋体子集，未装字体也能正确显示 |

工具与记录：

| 文件 | 说明 |
| --- | --- |
| `build-html.mjs` | Markdown → HTML。负责分块、表格、目录、图、页边注、强调层级 |
| `build-pdf.mjs` | HTML → PDF。经浏览器 DevTools 协议调用 `Page.printToPDF`，另有 `shots` / `audit` / `tocpages` 等模式 |
| `verify.mjs` | 交付校验：Markdown 逐行文字比对、引用双向可达、表格列数、内部锚点、PDF 字体 |
| `measure-pdf.mjs` | 用 `pdftotext -bbox` 量成品 PDF 的真实文字边界（不靠肉眼） |
| `normalize-punctuation.mjs` | 中文标点规范化，默认只干跑；正文改动走它 |
| `_tocpages.json` | 目录页码缓存，两轮迭代收敛后固化 |
| `REVISION.md` | 修订记录。正文的每一处文字改动都逐条列出位置、原文、改后文本 |

## 重新构建

需要 Node 18+、本机装好的 Chrome 或 Edge（导出 PDF 用）、KaTeX 0.16.47。核对 PDF 文字边界还需要 Poppler 的 `pdftotext` / `pdfinfo`。

```bash
npm i                        # 装 katex，渲染公式用
node build-html.mjs          # 定稿 Markdown → 自包含 HTML
node build-pdf.mjs tocpages  # 反复跑到 _tocpages.json 稳定（目录页码两轮收敛）
node build-html.mjs
node build-pdf.mjs final     # 先导出 PDF，再做分页截图与版式审计
node verify.mjs              # 逐行文字比对 + 引用双向可达 + 锚点无悬空
node measure-pdf.mjs         # 实测成品 PDF 的版心与页脚位置
```

顺序不能颠倒：**必须先导出 PDF，再截图**。截图用的模拟层会污染导出结果，页数会漂（曾从 35 页漂到 39 页）。

`node build-pdf.mjs shots 关键词` 可以把含该关键词的那一页截成 PNG 放进 `_shots/`。

环境变量都有默认值，见各脚本头部：

| 变量 | 用途 |
| --- | --- |
| `DOC_DIR` | 文档目录，默认取脚本所在目录 |
| `KATEX_DIR` | KaTeX 的 `dist` 目录，默认 `node_modules/katex/dist` |
| `POPPLER_DIR`、`PDFTOTEXT`、`PDFINFO` | Poppler 工具位置，只有 `measure-pdf.mjs` 需要 |

`_fonts/` 不在仓库里（四个静态字重，共约 45 MB），只在重建 PDF 时需要。PDF 里的思源黑体/宋体是从可变字体实例化出的静态字重——Chrome 无法把可变字体嵌进 PDF，会静默回退成新宋体；实例化做法见 `REVISION.md` 第八节。

## 校验基线

最后一次交付时 `verify.mjs` 与 `measure-pdf.mjs` 的输出：

| 项 | 值 |
| --- | --- |
| Markdown ↔ HTML 文字核对 | 有内容的行 497，比对 462 行，未命中 **0** |
| 引用 | 角标 82 个，条目 40 条，有反向链接的条目 40 条 |
| 表格 / 锚点 | 26 块（列数不一致 0 块）、109 个内部链接目标、悬空 **0** |
| 残留占位符 | 0；正文可见的字面星号 0 |
| PDF | A4 35 页、154 个链接、正文文字实测落在 21.6–173.8 mm、页脚 162.7–172 mm |

## 许可

| 范围 | 许可 |
| --- | --- |
| 正文与附录（`.md` / `.pdf` / `.html` 及其中的图表） | [CC BY-NC 4.0](LICENSE) |
| 构建与校验脚本（`*.mjs` / `*.py`） | [MIT](LICENSE-CODE) |
| 第三方组件（内嵌字体、KaTeX） | 见 [THIRD-PARTY.md](THIRD-PARTY.md) |

两点说明：

1. 附录3 里的【原文】引用，其文字权利仍属原作者。本仓库的许可只覆盖作者自己的表达，不涉及这些引用。
2. 正文只在标点规范化时被改动过（经作者批准），文字内容未作增删。逐条记录见 `REVISION.md` 第九节。

## 引用

```
余烬. Agent 重架构：迈向上下文原生智能（Context-Native Agent）[EB/OL].
v1.2, 2026-09-15. https://github.com/54shitaimzf/context-native-agent
```
