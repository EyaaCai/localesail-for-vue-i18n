# LocaleSail for Vue i18n

LocaleSail 是一个面向 Vue 与 TypeScript 项目的 vue-i18n 工作台，用于把源码中的中文界面文案转换成可维护的 locale key。

```bash
# VS Code Quick Open (Ctrl+P)
ext install Eyaa.vue-swift-i18n-plus
```

## 主要工作流

1. 在 `.vue`、`.js` 或 `.ts` 文件中执行 **LocaleSail: Extract Chinese Copy**。
2. 审核写入 locale JSON 的文案与 key。
3. 执行 **LocaleSail: Replace Copy with i18n Keys** 完成源码替换。
4. 按需将大型 JSON 生成为目录化的 JavaScript/TypeScript locale 模块。

LocaleSail 支持 Vue 3 `<script setup>`、模板插值参数、TypeScript、短 hash key 回查，以及在不覆盖注释和原有格式的前提下追加拆分模块。

## 快捷键

- 提取中文文案：`Ctrl+Alt+U` / `Ctrl+Cmd+U`
- 替换为 i18n key：`Ctrl+Alt+I` / `Ctrl+Cmd+I`
- 预览翻译内容：`Ctrl+Alt+O` / `Ctrl+Cmd+O`

::: warning 运行环境
需要 VS Code 1.37 或更高版本。
:::
