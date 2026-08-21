# 配置文件

::: tip 什么时候需要
当一个项目拥有多个模块时，vscode 的系统配置是针对全局的，此时就需要优先级更高的独立配置文件
:::

## 配置详情

`localesailrc.json`中的所有配置见[配置列表](/config/)

```json
{
  "defaultLocalesPath": "src/locales",
  "doNotDisturb": false,
  "fileNameSubstitute": "components",
  "generateI18nFilesExt": "auto",
  "generateI18nFilesOutputDir": "src/i18n/lang/zh-cn",
  "hashLength": 8,
  "i18nValueHover": true,
  "langFile": "zh-cn.json",
  "modulePrefixFoUpdateJson": "",
  "notAlertBeforeUpdateI18n": false,
  "notUseFileNameAsKey": false,
  "parentDirLevel": 1,
  "puidType": "short",
  "useCompactModeBasePath": "src",
  "useCompactPathMode": false,
  "useHashKeyOnly": false
}
```
