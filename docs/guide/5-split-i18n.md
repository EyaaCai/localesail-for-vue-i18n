# 拆分国际化文件 (Generate Split I18n Files)

在大型项目中，如果所有的国际化文案都挤在一个巨大的 JSON 文件里，维护起来会非常痛苦。且一旦多人协作修改同一个 JSON，极易引发代码冲突。

LocaleSail 提供了可增量执行的**智能拆分功能**。

## 功能特性

- **自动分层目录**: 根据 JSON 中的 Key 层级（如 `views.account.index`），自动在输出目录创建对应的文件夹结构。
- **支持 JS/TS 导出**: 可以配置生成 `.js` 或 `.ts` 文件，且自动匹配项目环境。
- **智能追加 (Append Only)**: 
    - 如果目标文件已存在，插件会智能识别当前 JSON 中新增的 Key。
    - **不覆盖原文件**: 它会精准定位到文件末尾的 `export default { ... }` 对象，并仅在末尾追加新的词条。
    - **保留注释与格式**: 无论你手动在 i18n 文件里加了多少注释或调整了缩进，该功能都能完美保留。
- **安全清空源文件**: 拆分生成并格式化成功后，才会把源 `zh-cn.json` 清空为 `{}`；如果格式化失败，源文件会保留原内容。

## 如何使用

1. 打开项目的 `zh-cn.json`（或你配置的主语言包文件）。
2. 在编辑器内右键，选择 **"Generate Split I18n Files"**。
3. 插件会根据配置的 `generateI18nFilesOutputDir` 路径自动生成/更新拆分后的文件。
4. 生成和格式化都成功后，源 JSON 会自动清空，方便继续下一轮提取。

## 配置项

- `localeSail.generateI18nFilesOutputDir`: 设置拆分文件存放的基准路径（默认 `src/i18n/lang/zh-cn`）。
- `localeSail.generateI18nFilesExt`: 设置输出文件名后缀（`auto` / `js` / `ts`）。
