# Agent 重架构：迈向上下文原生智能（Context-Native Agent）

一篇约 2.1 万字的中文长文（序言 + 正文 + 三个附录），讨论 LLM Agent 的上下文成本，以及围绕这笔成本该怎么设计 Agent 架构。

## 讲了什么

`Agent = Harness + Model` 少写了一项，补上第三项：

> **Agent = 环境 + 上下文 + 模型**

由此推出的两条，是全文的骨架：

- **上下文不是攒出来的，是每一轮从 0 构建出来的。** 每一轮按需要把原文取出来装进去，一轮结束整份消失——原文还在，消失的不是内容。
- **成本有四个台阶**：模型写出一个字 ¥4 / 百万 token（等于把 200 个字背着走一步）、内容变了要重读 ¥1、内容没变可复用 ¥0.02、压根不装进去 0 元。现行做法主要在最贵的那两档之间来回付钱。

一次 2,068 步的真实任务：现行做法按实测的停手位置算是 **¥7.02**，这套架构按同一套口径算是 **¥5.70**。

这笔账刻意往对自己不利的方向取——凡是对本文有利的量一律按 0 计（被摘要丢掉、后来又得重新推一遍的内容，多出来的协调步骤，质量上的好处，全都不算钱），不利的量一律往大取。所以它不是"刚好划算"，而是在压着自己的条件下仍然划算。

要让这笔账成立，设计上得守住三件事：每轮常驻的上下文压得住，每轮为更新它而真正写出去的量足够小，内容没变的那部分能一直复用。正文给了这三个量的算法，全部参数与取法列在附录2。

## 仓库里有什么

三种格式，同名不同扩展名（`Agent架构革新：迈向上下文原生智能-Context-Native Agent.*`）：

- **[`.md`](Agent架构革新：迈向上下文原生智能-Context-Native%20Agent.md)** —— 源文件，唯一事实来源
- **[`.html`](Agent架构革新：迈向上下文原生智能-Context-Native%20Agent.html)** —— 单文件网页版，公式也在文件里，断网可用
- **[`.pdf`](Agent架构革新：迈向上下文原生智能-Context-Native%20Agent.pdf)** —— A4 排版成品，36 页，带页码目录与可点链接

另有 `REVISION.md`（改了哪里、原来是什么、改后是什么，逐条记着），以及一条把 Markdown 渲染成 HTML、PDF 的脚本链。

## 讨论

勘误、质疑，以及你按文中口径算出来的结果，都欢迎发在 **[Discussions](https://github.com/54shitaimzf/context-native-agent/discussions)**。参数与取法列在附录2，对着算比空说有用。

## 许可

| 范围 | 许可 |
| --- | --- |
| 正文与附录（`.md` / `.pdf` / `.html` 及其中图表） | [CC BY-NC 4.0](LICENSE) |
| 构建脚本（`*.mjs` / `*.py`） | [MIT](LICENSE-CODE) |
| 成品里内嵌的第三方组件（思源黑体/宋体、KaTeX） | 见 [THIRD-PARTY.md](THIRD-PARTY.md) |

附录3 里的【原文】引用，文字权利仍属原作者；本仓库的许可只覆盖作者自己的表达。正文只在标点规范化时改动过（经作者批准），未增删字句，逐条见 `REVISION.md` 第一节。

## 引用

```
余烬. Agent 重架构：迈向上下文原生智能（Context-Native Agent）[EB/OL].
v1.3.1, 2026-09-16. https://github.com/54shitaimzf/context-native-agent
```

GitHub 侧栏的「Cite this repository」可直接导出 APA 与 BibTeX（数据来自 `CITATION.cff`）。

<details>
<summary>构建链、校验与重建（要自己重跑一遍再展开）</summary>

需要 Node 18+、本机装好的 Chrome 或 Edge，以及 KaTeX 0.16.47。

```bash
npm i                        # 装 katex
node build-html.mjs          # Markdown → 单文件 HTML
node build-pdf.mjs tocpages  # 反复跑到 _tocpages.json 稳定（目录页码两轮收敛）
node build-html.mjs
node build-pdf.mjs final     # 先导出 PDF，再做分页截图与版式审计
node verify.mjs              # 逐行文字比对、引用双向可达、内部链接无悬空
```

| 脚本 | 干什么 |
| --- | --- |
| `build-html.mjs` | Markdown → HTML（分块、表格、目录、图、页边注、胶囊） |
| `build-pdf.mjs` | HTML → PDF，另有 `shots` / `audit` / `tocpages` 模式 |
| `verify.mjs` | 交付校验 |
| `measure-pdf.mjs` | 量成品 PDF 里文字的真实位置 |
| `normalize-punctuation.mjs` | 中文标点规范化，默认只干跑 |
| `fix-font-names.py` | 修正字重实例的名称表（见 `REVISION.md` 第六节） |

顺序不能颠倒：**先导出 PDF，再截图**——截图用的模拟层会污染导出结果。

环境变量都有默认值，见各脚本头部：`DOC_DIR`（文档目录）、`KATEX_DIR`（KaTeX 位置）、`POPPLER_DIR` / `PDFTOTEXT` / `PDFINFO`（只有 `measure-pdf.mjs` 需要）。

`_fonts/` 不在仓库里（四个静态字重，约 45 MB），只在重建 PDF 时用得上：PDF 里的思源黑体/宋体是由变量字体实例化出的静态字重，做法见 `REVISION.md` 第六节。

最后一次交付的校验输出：Markdown 与 HTML 逐行比对 465 行、未命中 0；引用 85 处、40 条参考文献双向可达；26 张表列数一致；109 个内部链接无悬空；成品 A4 36 页、157 个链接、文字落在版心内。

</details>
