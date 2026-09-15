# 第三方组件与字体

成品 `.html` 与 `.pdf` 里内嵌了下列第三方资源。本文件说明它们分别是什么、以什么许可分发、在本仓库里以哪种形式存在。重建时才用到的第三方工具列在最后。

判断内嵌情况用的是 Poppler 的 `pdffonts`，可以自己复核：

```bash
pdffonts "Agent架构革新：迈向上下文原生智能-Context-Native Agent.pdf"
```

## 一、KaTeX 0.16.47

公式排版库。

- **存在形式**：`.html` 内嵌它的 CSS、`katex.min.js`、`contrib/auto-render.min.js`，以及 20 个 woff2 字体（base64 内联）。`.pdf` 里内嵌 `KaTeX_Main-Regular` 与 `KaTeX_Math-Italic` 两个子集。
- **上游**：<https://github.com/KaTeX/KaTeX>
- **许可**：MIT

```
The MIT License (MIT)

Copyright (c) 2013-2020 Khan Academy and other contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 二、思源黑体 / 思源宋体（Noto Sans SC / Noto Serif SC）

正文的中文字体。

- **存在形式**：`.pdf` 内嵌下列子集——`NotoSansSC-Regular`、`NotoSansSC-SemiBold`、`NotoSansSC-Bold`、`NotoSerifSC-Bold`（封面与标题）。它们由 Google 发布的**可变字体**实例化出静态字重后再子集化，因此 PDF 在没有安装这些字体的机器上也能正确显示。`.html` 不内嵌中文字体，只用 `font-family` 引用本机字体（缺失时回退到系统黑体/宋体）。
- **上游**：<https://github.com/notofonts/noto-cjk>
- **许可**：SIL Open Font License 1.1（OFL-1.1）

两点与本文档直接相关：上游 LICENSE 未声明**保留字体名**（Reserved Font Name），所以子集化后可以沿用原字体名；OFL 第 5 条写明「字体须保持本许可的要求，不适用于使用该字体创建的任何文档」——也就是说，嵌入字体**不会**让成品 PDF 本身变成 OFL 作品。

```
This Font Software is licensed under the SIL Open Font License,
Version 1.1.

This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL

-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font
creation efforts of academic and linguistic communities, and to
provide a free and open framework in which fonts may be shared and
improved in partnership with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply to
any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software
components as distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to,
deleting, or substituting -- in part or in whole -- any of the
components of the Original Version, by changing formats or by porting
the Font Software to a new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed,
modify, redistribute, and sell modified and unmodified copies of the
Font Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components, in
Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the
corresponding Copyright Holder. This restriction only applies to the
primary font name as presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created using
the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

## 三、其他内嵌字体

`pdffonts` 在成品里还能看到三种系统字体。它们的角色不同，要分开看：

| 字体 | 承担什么 | 在 PDF 里的形式 |
| --- | --- | --- |
| Cascadia Mono | 代码、等宽数字 | **Type 3**：只写入绘制指令，PDF 里不含字体程序 |
| Segoe UI Emoji | 极少数符号的兜底 | **Type 3**：同上 |
| Segoe UI | 少量西文兜底 | 内嵌子集（CID TrueType） |
| 新宋体（NSimSun） | 极少数思源子集之外的汉字兜底 | 内嵌子集（CID TrueType） |

前两者在 PDF 里只以绘制指令存在，不构成字体程序的分发；后两者是 Windows 自带字体，只内嵌了用到的子集，Windows 字体许可允许这种文档嵌入。若不希望成品里出现任何专有字体，调整字体栈后重新导出即可，构建链会重新内嵌。

## 四、重建时才用到的第三方工具

这些工具不随仓库分发，只在重新生成成品时在本机调用。

| 工具 | 用途 | 许可 |
| --- | --- | --- |
| Node.js 18+ | 跑构建与校验脚本 | MIT |
| Google Chrome / Microsoft Edge | 经 DevTools 协议把 HTML 导出为 PDF | 专有软件，仅本机调用 |
| KaTeX 0.16.47 | 公式渲染，由 `npm i` 安装 | MIT |
| Poppler（`pdftotext` / `pdfinfo` / `pdffonts`） | 实测 PDF 文字边界、复核内嵌字体 | GPL-2.0 |
| fontTools | 把可变字体实例化成静态字重（见 `REVISION.md` 第六节） | MIT |
