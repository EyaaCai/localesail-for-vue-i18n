# 认识 LocaleSail

[LocaleSail for Vue i18n](https://github.com/EyaaCai/localesail-for-vue-i18n) 面向正在把中文 Vue 项目迁移到多语言架构的开发者。它把“发现文案、生成 key、替换源码、整理语言包”放在同一套可审核的编辑器流程中。

## 工作方式

- **先提取，后替换**：locale JSON 是源码替换的明确依据，便于在写回代码前检查结果。
- **适配 Vue 语法上下文**：分别处理模板文本、属性、插值、普通脚本、mixin 与 `<script setup>`。
- **维护大型语言包**：支持 JSON 扁平化与反扁平化，也可以按 key 路径生成 JS/TS 模块。
- **保留人工维护内容**：向现有模块追加条目时保留注释和格式。

## 功能指南

- [提取中文文案](../guide/1-update-i18n.md)
- [替换为 i18n key](../guide/2-swift-i18n.md)
- [预览翻译值](../guide/3-show-i18n.md)
- [拆分 locale 模块](../guide/5-split-i18n.md)
- [JSON 与代码提示工具](../guide/4-other.md)

LocaleSail 不会盲目扫描并改写整个仓库。命令以当前编辑器或明确选中的文件为边界，让迁移结果可以逐文件审查。
