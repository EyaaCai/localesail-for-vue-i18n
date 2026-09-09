const fs = require('fs');
const path = require('path');
const validator = require('validator');
const connect = require('./connect');
const safeEval = require('safe-eval');
const ast = require('./ast');
const {
  executeCommand,
  msg,
  open,
  file,
  Range,
  Position,
  workspace,
  window,
  WorkspaceEdit,
} = require('./vs');
const {
  templateBeginRegexp,
  templateEndRegexp,
  scriptBeginRegexp,
  scripteEndRegexp,
  scriptSetupRegexp,
} = require('./regex');
const {
  langArr,
  operation,
  customConfigFileName,
  deprecatedCustomConfigFileNames,
  pkgFileName,
} = require('./constant');
const isObject = (obj) =>
  Object.prototype.toString.call(obj) === '[object Object]';

const getCustomSettingKey = (customSetting, key) => {
  if (customSetting && customSetting.hasOwnProperty(key)) {
    return customSetting[key];
  }
  const settings = workspace.getConfiguration('localeSail');
  return settings.get(key);
};

const getCustomConfigPath = (dirName) => {
  const candidates = [
    customConfigFileName,
    ...deprecatedCustomConfigFileNames,
  ].map((fileName) => path.join(dirName, fileName));

  return candidates.find((filePath) => fs.existsSync(filePath)) || candidates[0];
};

const showMessage = ({
  type = 'info',
  message,
  file,
  editor = null,
  callback = null,
  needOpen = true,
}) => {
  const actions = [
    'Got it',
    callback && callback.name,
    needOpen && 'View it',
  ].filter((v) => !!v);

  const vsMsg = type === 'error' ? msg.error : msg.info;

  const viewColumn = editor
    ? editor.viewColumn + 1
    : getEditor(editor)
    ? getEditor(editor).viewColumn + 1
    : 1;

  vsMsg(message, ...actions).then((val) => {
    if (val === 'View it') {
      openFileByPath(file, {
        selection: new Range(new Position(0, 0), new Position(0, 0)),
        preview: false,
        viewColumn,
      });
    }
    if (callback && val === callback.name) {
      callback.func();
    }
  });
};

//获取配置项
const getCustomSetting = (fsPath, key, forceIgnoreCustomSetting = false) => {
  const dirName = path.dirname(fsPath);
  if (fs.existsSync(path.join(dirName, pkgFileName))) {
    const customPath = getCustomConfigPath(dirName);
    const data =
      fs.existsSync(customPath) && !forceIgnoreCustomSetting
        ? fs.readFileSync(customPath)
        : '';
    let customSetting = validator.isJSON(data.toString())
      ? JSON.parse(data.toString())
      : {};
    if (
      fs.existsSync(customPath) &&
      !forceIgnoreCustomSetting &&
      !validator.isJSON(data.toString())
    ) {
      showMessage({
        type: 'error',
        file: customPath,
        message: `'${customPath}' is not a right json, custom setting will not work`,
      });
    }
    if (typeof key === 'string') {
      const data = getCustomSettingKey(customSetting, key);
      return getCustomSettingKey(customSetting, key);
    }
    if (Array.isArray(key)) {
      return key.reduce((p, c) => {
        p[c] = getCustomSettingKey(customSetting, c);
        return p;
      }, {});
    }
    if (isObject(key)) {
      for (const i in key) {
        if (key.hasOwnProperty(i)) {
          key[i] = getCustomSettingKey(customSetting, key[i]);
        }
      }
      return key;
    }
    return {};
  } else {
    return getCustomSetting(dirName, key, forceIgnoreCustomSetting);
  }
};

const getPrefix = (currentEditor) => {
  const { uri } = currentEditor.document;
  let fileName = path.basename(uri.fsPath, path.extname(uri.fsPath));
  const fileFsPath = uri.fsPath;

  const {
    modulePrefix,
    notUseFileNameAsKey = false,
    fileNameSubstitute = 'components',
    jsonNameLevel = 0,
    useCompactPathMode = true,
    useCompactModeBasePath = 'src',
  } = getCustomSetting(fileFsPath, {
    modulePrefix: 'modulePrefixForUpdateJson',
    notUseFileNameAsKey: 'notUseFileNameAsKey',
    jsonNameLevel: 'parentDirLevel',
    useCompactPathMode: 'useCompactPathMode',
    useCompactModeBasePath: 'useCompactModeBasePath',
  });

  let prefix = '';

  if (useCompactPathMode) {
    const workspaceFolder = workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
      const rootPath = workspaceFolder.uri.fsPath;
      const absoluteBasePath = path.isAbsolute(useCompactModeBasePath)
        ? useCompactModeBasePath
        : path.join(rootPath, useCompactModeBasePath);

      try {
        const relativeDir = path.relative(
          absoluteBasePath,
          path.dirname(fileFsPath),
        );
        if (relativeDir && relativeDir !== '.') {
          prefix = relativeDir
            .split(path.sep)
            .filter((v) => !!v)
            .join('.');
        }
      } catch (e) {
        prefix = '';
      }
    }
  } else if (jsonNameLevel > 0) {
    const dirs = path
      .dirname(fileFsPath)
      .split(path.sep)
      .filter((v) => !!v)
      .slice(-jsonNameLevel);
    prefix = dirs.join('.');
  }

  if (!notUseFileNameAsKey) {
    prefix = prefix ? connect(prefix, fileName) : fileName;
  } else if (!prefix) {
    prefix = fileNameSubstitute;
  }

  if (modulePrefix) {
    prefix = prefix ? connect(modulePrefix, prefix) : modulePrefix;
  }

  return prefix;
};

const defaultOption = {
  selection: new Range(new Position(0, 0), new Position(0, 0)),
  preview: false,
};
const openFileByPath = (fPath, option) => {
  return open(file(fPath), option || defaultOption);
};

const getCellRange = ({ editor, regex, line }) =>
  //zero base charactor is 0
  editor.document.getWordRangeAtPosition(new Position(line, 0), regex);

const setupFunctionRegexp =
  /\b(?:async\s+)?setup\s*\([^)]*\)\s*\{|\bsetup\s*:\s*(?:async\s*)?(?:function\s*)?\([^)]*\)\s*\{|\bsetup\s*:\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/;

const isNumber = (value) => typeof value === 'number';

const isLineInRange = (line, range = {}) =>
  isNumber(range.begin) &&
  isNumber(range.end) &&
  line >= range.begin &&
  line <= range.end;

const getLineRange = (ranges = [], line) =>
  ranges.find((range) => isLineInRange(line, range));

const getVueScriptRangeAtLine = (range = {}, line) =>
  getLineRange(range.scripts || [], line) ||
  (isLineInRange(line, range.script) ? range.script : null);

const isVueSetupLine = (range = {}, line) => {
  const scriptRange = getVueScriptRangeAtLine(range, line);
  if (!scriptRange) return false;
  return (
    !!scriptRange.isSetup ||
    !!getLineRange(scriptRange.setupRanges || [], line)
  );
};

const countCodeBraces = (text = '') => {
  let count = 0;
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (quote) {
      if (char === '\\') {
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '/' && nextChar === '/') break;
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
    } else if (char === '{') {
      count += 1;
    } else if (char === '}') {
      count -= 1;
    }
  }
  return count;
};

const getRange = (editor) => {
  const range = {
    template: {},
    script: {},
    scripts: [],
    isSetup: false,
  };
  const lineCount = editor.document.lineCount;
  let currentScript = null;
  let activeSetupRange = null;
  let setupBraceDepth = 0;
  for (let i = 0; i < lineCount; i++) {
    const line = editor.document.lineAt(i);
    const lineText = line.text || '';
    const tBegin = getCellRange({
      editor,
      regex: templateBeginRegexp,
      line: i,
    });
    const tEnd = getCellRange({
      editor,
      regex: templateEndRegexp,
      line: i,
    });
    const sBegin = getCellRange({
      editor,
      regex: scriptBeginRegexp,
      line: i,
    });
    const sEnd = getCellRange({
      editor,
      regex: scripteEndRegexp,
      line: i,
    });
    const sSetup = getCellRange({
      editor,
      regex: scriptSetupRegexp,
      line: i,
    });
    if (tBegin) {
      range.template.begin = tBegin.start.line;
    } else if (tEnd) {
      range.template.end = tEnd.start.line;
    }

    if (sBegin) {
      currentScript = {
        begin: sBegin.start.line,
        end: undefined,
        isSetup: !!sSetup,
        setupRanges: [],
      };
      range.scripts.push(currentScript);
    }

    if (currentScript && currentScript.isSetup) {
      range.isSetup = true;
    } else if (currentScript) {
      if (activeSetupRange) {
        setupBraceDepth += countCodeBraces(lineText);
        activeSetupRange.end = i;
        if (setupBraceDepth <= 0) {
          activeSetupRange = null;
          setupBraceDepth = 0;
        }
      } else {
        const setupMatch = lineText.match(setupFunctionRegexp);
        if (setupMatch) {
          activeSetupRange = { begin: i, end: i };
          currentScript.setupRanges.push(activeSetupRange);
          range.isSetup = true;
          setupBraceDepth = countCodeBraces(
            lineText.slice(setupMatch.index || 0),
          );
          if (setupBraceDepth <= 0) {
            activeSetupRange = null;
            setupBraceDepth = 0;
          }
        }
      }
    }

    if (sEnd && currentScript) {
      currentScript.end = sEnd.start.line;
      if (activeSetupRange && !isNumber(activeSetupRange.end)) {
        activeSetupRange.end = sEnd.start.line;
      }
      currentScript = null;
      activeSetupRange = null;
      setupBraceDepth = 0;
    }
  }
  if (range.scripts.length > 0) {
    range.script = {
      begin: range.scripts[0].begin,
      end: range.scripts[range.scripts.length - 1].end,
      isSetup: range.scripts.some((scriptRange) => scriptRange.isSetup),
      setupRanges: range.scripts.reduce(
        (result, scriptRange) => result.concat(scriptRange.setupRanges || []),
        [],
      ),
    };
  }
  return range;
};

const getEditor = (editor) => {
  let currentEditor = editor || window.activeTextEditor;
  const stopFlag =
    !currentEditor || !langArr.includes(currentEditor.document.languageId);
  if (stopFlag) return false;
  return currentEditor;
};

const vueOptionsRegexp =
  /export\s+default\s*\{[\s\S]*\b(?:data|methods|computed|watch|props|created|mounted|beforeMount|beforeDestroy|destroyed|beforeUnmount|unmounted)\s*[:(]/;

const isMixinFile = ({ fsPath = '', text = '' } = {}) => {
  const baseName = path.basename(fsPath, path.extname(fsPath));
  return (
    /mixins?/i.test(baseName) ||
    /(^|[\\/])mixins?([\\/]|$)/i.test(fsPath) ||
    vueOptionsRegexp.test(text)
  );
};

const varifyFile = ({ fsPath, showError, showInfo }) => {
  let exist = false;
  if (!fs.existsSync(fsPath)) {
    //TODO: 跳转到国际化设置路径!
    showError &&
      showMessage({
        type: 'error',
        message: `Not Found File:${fsPath}`,
        needOpen: false,
        callback: {
          name: operation.updateI18n.title,
          func: () => executeCommand(operation.updateI18n.cmd),
        },
      });
  } else {
    showInfo &&
      showMessage({
        message: `Get Locales Path:${fsPath}`,
        file: fsPath,
      });
    exist = true;
  }
  return { localesPath: fsPath, exist };
};

const getLocales = ({
  fsPath,
  isGetRootPath = false,
  defaultLocalesPath,
  showInfo = false,
  showError = true,
}) => {
  const dirName = path.dirname(fsPath);
  if (fs.existsSync(path.join(dirName, pkgFileName))) {
    if (isGetRootPath) return dirName;
    const lang = getCustomSetting(path.join(dirName, pkgFileName), 'langFile'); //default "zh-cn.json"
    const localesPath = getCustomSetting(
      path.join(dirName, pkgFileName),
      'defaultLocalesPath',
    );
    let jsonPath = path.join(dirName, localesPath || '', lang);
    if (!!defaultLocalesPath) {
      jsonPath = path.join(dirName, defaultLocalesPath, lang);
    }
    return varifyFile({ fsPath: jsonPath, showInfo, showError });
  } else {
    return getLocales({
      fsPath: dirName,
      isGetRootPath,
      defaultLocalesPath,
      showInfo,
      showError,
    });
  }
};

const changeObjeValueKey = (obj, prefix, useHashKeyOnly = false) => {
  const result = {};
  if (!obj) return result;
  Object.keys(obj).forEach((v) => {
    if (!result[obj[v]]) {
      result[obj[v]] = useHashKeyOnly ? v : connect(prefix, v);
    }
  });
  return result;
};

const getValueFromDotString = (_data, dotString) => {
  let result = {};
  //str存在特殊字符时，需要替换为[]
  const str = dotString
    .split('.')
    .map((v) => `["${v}"]`)
    .join('');
  const context = {
    str,
    _data,
  };
  try {
    result = safeEval(`_data${str}`, context);
  } catch (error) {
    result = null;
  }
  return result;
};

const getLocaleValueByKey = (localeObj = {}, key = '') => {
  if (Object.prototype.hasOwnProperty.call(localeObj, key)) {
    return {
      exist: true,
      key,
      value: localeObj[key],
    };
  }

  const suffix = `.${key}`;
  const matchedKey = Object.keys(localeObj).find((item) =>
    item.endsWith(suffix),
  );

  return {
    exist: !!matchedKey,
    key: matchedKey || key,
    value: matchedKey ? localeObj[matchedKey] : undefined,
  };
};

module.exports = {
  openFileByPath,
  getCellRange,
  getRange,
  getVueScriptRangeAtLine,
  isLineInRange,
  isVueSetupLine,
  getLocales,
  changeObjeValueKey,
  getEditor,
  showMessage,
  connect,
  getPrefix,
  getValueFromDotString,
  getLocaleValueByKey,
  getCustomSetting,
  isMixinFile,
  ...ast,
};
