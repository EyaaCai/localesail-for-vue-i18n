const constants = {
  defaultStyle: {
    fontStyle: 'italic',
    // textDecoration: "underline solid green"
  },
  errorStyle: {
    fontStyle: 'italic',
    // textDecoration: "underline solid red"
  },
  langArr: [
    'javascript',
    'vue',
    'typescript',
    'typescriptreact',
    'javascriptreact',
  ],
  operation: {
    flatJson: { cmd: 'localeSail.flatJson', title: 'Flatten Locale JSON' },
    unFlatJson: { cmd: 'localeSail.unFlatJson', title: 'Restore Nested Locale JSON' },
    showI18n: {
      cmd: 'localeSail.showI18n',
      title: 'Preview Translation Values',
    },
    updateI18n: {
      cmd: 'localeSail.updateI18n',
      title: 'Extract Chinese Copy',
    },
    generateWorkspaceConfig: {
      cmd: 'localeSail.generateWorkspaceConfig',
      aliases: ['localeSail.generateRichieRC'],
      title: 'Create Workspace Configuration',
    },
    ignoreNextLine: {
      cmd: 'localeSail.ignoreNextLine',
      title: 'Ignore Next Line',
    },
    replaceWithI18nKeys: {
      cmd: 'localeSail.replaceWithI18nKeys',
      aliases: ['localeSail.swiftI18n'],
      title: 'Replace Copy with i18n Keys',
    },
    hoverI18n: { cmd: 'localeSail.hoverI18n', title: 'Hover I18n' },
    openI18nFile: { cmd: 'localeSail.openI18nFile', title: 'Open Locale Source' },
    generateI18nFiles: { cmd: 'localeSail.generateI18nFiles', title: 'Build Split Locale Modules' },
  },
  plugin: {
    name: 'LocaleSail for Vue i18n',
    congratulations:
      'LocaleSail for Vue i18n is now active.',
    noUri: 'please selected a json file first',
  },
  defaultConfig: {
    defaultLocalesPath: 'src/locales',
    doNotDisturb: false,
    puidType: 'short',
    hashLength: 8,
    i18nValueHover: true,
    langFile: 'zh-cn.json',
    modulePrefixFoUpdateJson: '',
    notAlertBeforeUpdateI18n: false,
    fileNameSubstitute: 'components',
    notUseFileNameAsKey: false,
    parentDirLevel: 1,
    useCompactPathMode: false,
    useCompactModeBasePath: 'src',
    useHashKeyOnly: false,
    generateI18nFilesOutputDir: 'src/i18n/lang/zh-cn',
    generateI18nFilesExt: 'auto',
  },

  pkgFileName: 'package.json',
  customConfigFileName: 'localesailrc.json',
  deprecatedCustomConfigFileNames: ['richierc.json'],
};
module.exports = constants;
