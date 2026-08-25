# 查看

LocaleSail 默认会根据正则匹配当前打开文件中已经替换的 i18n key，并自动覆盖展示对应文案。

它只检测当前编辑器，不依赖全项目索引。查找时会优先按 key 路径读取拆分后的 JS/TS 语言包，找不到时再回退到配置的 locale JSON。
如果展示结果来自 `defaultLocalesPath` 兜底，会标记为 `[D]`，避免误以为该 key 已经生成到拆分目录。

编辑文件、切换文件或保存语言包后会自动刷新展示结果，便于快速确认当前翻译内容。

当光标或选区进入当前聚焦编辑器的某个 key 时，该 key 会临时还原为源码，方便直接编辑；非聚焦但仍可见的编辑器会继续保留覆盖预览。

覆盖预览默认只显示一个语言；可以通过 `localeSail.previewLocale` 指定，例如 `en-us`。如果该配置为空，则根据 `langFile` 推导预览语言。

鼠标悬浮时会展示所有可发现语言，包括 `defaultLocalesPath` 下的 JSON 文件，以及拆分语言包目录中的兄弟语言目录。缺失的语言会显示为“未翻译”。

如果不想自动覆盖显示，可以关闭 `localeSail.inlineTranslationPreview`。`LocaleSail: Preview Translation Values` 命令仍可用于手动强制刷新覆盖预览。
