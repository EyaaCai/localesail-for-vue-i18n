# JSON 更新

通过正则匹配需要做国际化的汉字，自动制定对应 unique key 并更新到对应国际化 JSON 文件中

## 汉字检索原则

- 位于 `<template></template>`中的汉字，如 `<span>汉字123</span>`
- 位于 `<template></template>`中的标签属性的汉字，如 `<span title="汉字"></span>`
- 位于 `<template></template>` 插值表达式中的汉字，例如条件表达式里的“汉字”和“中文”；同时会保留“发运单号：”这类位于插值变量旁的静态中文文本
- 位于 `<script></script>`中的 `"`与 `"`之间的汉字，`'`与 `'`之间的**汉字**，并支持模板字符串中的插值参数与兜底中文提取
- 过滤单行注释

## i18nJSON 更新路径

::: tip 约定
`root`：约定当前项目 `package.json`为根目录
:::

- 默认：**`[root]/src/locales/zh-cn.json`** 为默认 json 路径，
- 当设置 **`defaultLocalesPath`** 如 `test`、**`langFile`** 如 `cn.json`，则对应的 i18nJSON 路径：**`[root]/test/cn.json`**

## i18nJSON 文件的 key 的外层属性名

假设文件目录为 `src/view/list/test.vue`，则对应的 json 外层如下：

```json
{
  "list": {
    "test": {
      "puidUniqueKey": "你好"
    }
  }
}
```

假如设置 **`modulePrefixFoUpdateJson`** 为 `test-module`， **`parentDirLevel`** 为 `3`，则对应的 json 外层如下：

```json
{
  "test-module": {
    "src": {
      "view": {
        "list": {
          "test": {
            "puidUniqueKey": "你好"
          }
        }
      }
    }
  }
}
```

当不需要 scope 概念时，即想把所有的 key-value 放在国际化最外层时，应该怎么办?

设置 **`notUseFileNameAsKey`** 为 `true`， **`parentDirLevel`** 为 `0`， **`fileNameSubstitute`** 为 `componentTest`，则对应的 json 外层如下：

```json
{
  "componentTest": {
    "puidUniqueKey": "你好"
  }
}
```
