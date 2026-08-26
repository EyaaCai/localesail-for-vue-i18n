# LocaleSail for Vue i18n

LocaleSail 是一个面向 Vue、JavaScript、TypeScript 项目的 VS Code 国际化辅助插件。它可以从源码中提取中文界面文案，写入 locale JSON，再把源码里的文案替换成 vue-i18n 调用。

它适合用来把已有项目逐步迁移到 vue-i18n，也适合在日常开发中快速维护中文语言包。

## 能做什么

| 能力 | 说明 |
| --- | --- |
| 提取中文文案 | 从 Vue template、属性、脚本字符串、TypeScript、模板字符串中提取中文 |
| 替换源码文案 | 根据 locale JSON 把中文替换成 `$t(...)`、`this.$t(...)` 或 `t(...)` |
| 预览翻译内容 | 在当前打开文件中自动覆盖查看 i18n key 对应中文文案 |
| 生成拆分语言包 | 将大型 JSON 拆成目录化的 JS/TS locale 模块 |
| JSON 辅助处理 | 支持 locale JSON 扁平化与还原 |

## 安装

在 VS Code 扩展市场搜索：

```text
LocaleSail for Vue i18n
```

也可以在 VS Code Quick Open 中执行：

```text
ext install Eyaa.localesail-for-vue-i18n
```

## 快速开始

### 1. 准备语言包文件

默认语言包路径是：

```text
src/locales/zh-cn.json
```

如果你的项目路径不同，可以在 VS Code 设置或 `localesailrc.json` 中配置：

```json
{
  "defaultLocalesPath": "src/locales",
  "langFile": "zh-cn.json"
}
```

### 2. 提取中文文案

打开 `.vue`、`.js` 或 `.ts` 文件，执行命令：

```text
LocaleSail: Extract Chinese Copy
```

默认快捷键：

```text
Windows: Ctrl+Alt+U
macOS: Ctrl+Cmd+U
```

例如源码：

```vue
<template>
  <el-button title="添加">删除</el-button>
</template>
```

会写入类似：

```json
{
  "views.customer.index": {
    "a1b2c3d4": "添加",
    "e5f6g7h8": "删除"
  }
}
```

### 3. 替换源码

确认语言包内容无误后，执行：

```text
LocaleSail: Replace Copy with i18n Keys
```

默认快捷键：

```text
Windows: Ctrl+Alt+I
macOS: Ctrl+Cmd+I
```

替换后类似：

```vue
<template>
  <el-button :title="$t('views.customer.index.a1b2c3d4')">
    {{$t('views.customer.index.e5f6g7h8')}}
  </el-button>
</template>
```

在 TypeScript 或 Vue 3 `<script setup>` 中，会优先使用：

```ts
t('key')
```

在普通 Vue options / mixin 风格脚本中，会按上下文使用：

```js
this.$t('key')
```

如果当前文件里已经存在翻译函数调用，替换时会优先复用已有风格，避免 Vue 3 项目里强行替换成不存在的 `t(...)`：

```vue
<script setup>
const title = $t('common.title')
</script>
```

继续替换为：

```js
$t('key')
```

如果代码里使用了别名：

```js
const { t: tt } = useI18n()
```

会替换为：

```js
tt('key')
```

### 4. 预览翻译值

默认会在当前打开文件中自动覆盖显示 i18n key 对应的翻译文案，例如：

```text
t('用户名称')
```

它只扫描当前编辑器，不需要等待全项目索引。插件会优先按 key 路径查找拆分语言包，也会回退到 `src/locales/zh-cn.json`。
当展示结果来自 `defaultLocalesPath` 兜底时，会标记为 `[D]`，避免误以为该 key 已经生成到拆分目录。
当光标或选区进入当前聚焦编辑器的某个 key 时，该 key 会临时还原为源码，方便直接编辑；非聚焦但仍可见的编辑器会继续保留覆盖预览。
覆盖预览默认只显示一个语言；悬浮提示会展示所有可发现语言，并标出缺失翻译。

如果历史项目里的 key 前缀和拆分语言包目录不完全一致，可以配置路径别名。别名支持 `.`、`/`、`\` 分隔，并按最长前缀优先：

```json
{
  "localeSail.splitLocalePathAliases": {
    "order/components": ["views/forwarder/order/components"]
  }
}
```

如果要指定覆盖预览语言，可以配置：

```json
{
  "localeSail.previewLocale": "en-us"
}
```

如果需要手动强制刷新覆盖预览，也可以执行：

```text
LocaleSail: Preview Translation Values
```

默认快捷键：

```text
Windows: Ctrl+Alt+O
macOS: Ctrl+Cmd+O
```

插件会识别 `$t('key')`、`this.$t('key')`、`t('key')`、`i18n.t('key')`、`const { t: tt } = useI18n()` 后的 `tt('key')`，以及 `const i18n = useI18n()` 后的 `i18n.t('key')`，并展示 key 对应的中文文案。

如果不想自动覆盖显示，可以关闭：

```json
{
  "localeSail.inlineTranslationPreview": false
}
```

如果项目封装了自己的局部翻译函数，例如：

```js
const tt = useScopedI18n('views.order.detail')
tt('title')
```

可以配置：

```json
{
  "localeSail.scopedTranslateFunctionNames": ["useLocale", "useScopedI18n"]
}
```

## 提取规则

LocaleSail 会提取这些位置的中文：

- Vue 标签文本：`<span>删除</span>`
- Vue 静态属性：`<el-button title="添加" />`
- Vue 动态属性里的字符串：`:title="isAdd ? '添加' : '删除'"`
- 多行动态属性里的字符串
- Vue 插值表达式里的字符串：`{{ ok ? '通过' : '拒绝' }}`
- 多行 Vue 插值表达式里的字符串
- JS/TS 字符串：`const text = '删除'`
- 模板字符串：`` `本次共打印${count}个订单` ``

Vue 文本插值会只提取静态中文片段：

```vue
发运单号：{{ detail.carriageId }}
```

提取为：

```text
发运单号：
```

动态表达式结构本身不会被当成文案提取。

## 忽略下一行

如果某一行不希望被自动提取或替换，可以在上一行添加忽略注释：

```vue
<!-- localesail-disable-next-line -->
<div>这行不会被处理</div>
```

```js
// localesail-disable-next-line
const text = '这行不会被处理';
```

也可以在编辑器中执行：

```text
LocaleSail: Ignore Next Line
```

插件会自动根据当前文件和位置插入合适的注释。

## 右键菜单

为了避免右键菜单过于拥挤，LocaleSail 只把高频功能放在一级菜单：

- `LocaleSail: Extract Chinese Copy`
- `LocaleSail: Replace Copy with i18n Keys`
- `LocaleSail: Build Split Locale Modules`

其他低频功能会收进 `LocaleSail` 子菜单：

- `LocaleSail: Ignore Next Line`
- `LocaleSail: Preview Translation Values`
- `LocaleSail: Create Workspace Configuration`
- `LocaleSail: Flatten Locale JSON`
- `LocaleSail: Restore Nested Locale JSON`

## 项目级配置

执行：

```text
LocaleSail: Create Workspace Configuration
```

可以在项目根目录生成：

```text
localesailrc.json
```

项目级配置优先级高于 VS Code 全局配置。修改后不需要重启 VS Code，下一次执行命令会自动读取。

常用配置示例：

```json
{
  "defaultLocalesPath": "src/locales",
  "langFile": "zh-cn.json",
  "hashLength": 8,
  "parentDirLevel": 1,
  "useCompactPathMode": true,
  "useHashKeyOnly": false
}
```

## Hash Key 长度

默认生成 8 位 hash key：

```json
{
  "hashLength": 8
}
```

推荐保持默认 8 位。它比 12 位更短，可读性更好，同时对大多数项目来说碰撞风险很低。

如果项目非常大，或者团队希望更保守，可以设置为：

```json
{
  "hashLength": 10
}
```

或：

```json
{
  "hashLength": 12
}
```

支持范围是 `6` 到 `24`。6 位更短，但更适合小项目，不建议作为团队长期项目的默认值。

## 拆分语言包

当 `zh-cn.json` 很大时，可以执行：

```text
LocaleSail: Build Split Locale Modules
```

插件会按 key 路径生成目录化的 JS/TS 文件。也就是说，JSON 中的 key 会被当作文件路径来拆分。

例如 locale JSON：

```json
{
  "views.customer.order.import_order.index": {
    "a1b2c3d4": "导入订单",
    "e5f6g7h8": "删除"
  },
  "views.customer.detail.index": {
    "h1i2j3k4": "客户详情"
  }
}
```

执行生成后，会得到类似目录：

```text
src/i18n/lang/zh-cn/
└─ views/
   └─ customer/
      ├─ order/
      │  └─ import_order/
      │     └─ index.js
      └─ detail/
         └─ index.js
```

其中 `views.customer.order.import_order.index` 会写入：

```js
export default {
  a1b2c3d4: '导入订单',
  e5f6g7h8: '删除',
};
```

`views.customer.detail.index` 会写入：

```js
export default {
  h1i2j3k4: '客户详情',
};
```

如果目标文件已经存在，插件会尽量保留原文件内容，只把新增 key 追加进去。

输出目录和文件后缀可以配置：

```json
{
  "generateI18nFilesOutputDir": "src/i18n/lang/zh-cn",
  "generateI18nFilesExt": "auto"
}
```

`generateI18nFilesExt` 可选：

- `auto`：自动根据项目判断
- `js`：生成 JavaScript 文件
- `ts`：生成 TypeScript 文件

## 更多说明

- [详细行为说明](./README_DETAIL.md)
- [配置说明](./docs/config/README.md)
- [更新日志](./CHANGELOG.md)

## 许可证

本项目基于 MIT License 发布。

LocaleSail 最初源自 [RichieChoo/vue-swift-i18n](https://github.com/RichieChoo/vue-swift-i18n)，后续由 Eyaa 独立维护。
