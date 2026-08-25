const fs = require('fs');
const path = require('path');
const flatten = require('flat');
const {
  MarkdownString,
  Range,
  workspace,
  window,
  OverviewRulerLane,
} = require('../utils/vs');
const {
  getCustomSetting,
  getLocales,
  getLocaleValueByKey,
  getPrefix,
} = require('../utils');
const { getI18nKeyMatches } = require('../utils/regex');
const {
  getSplitFileCandidates,
  getScopedTranslateScopes,
  getUseI18nTranslateCallers,
  readSplitLocaleFile,
} = require('../utils/inlineTranslationResolver');

const documentSelector = [
  { scheme: 'file', language: 'vue' },
  { scheme: 'file', language: 'javascript' },
  { scheme: 'file', language: 'typescript' },
  { scheme: 'file', language: 'typescriptreact' },
  { scheme: 'file', language: 'javascriptreact' },
];
const previewLanguageIds = documentSelector.map(({ language }) => language);
const missingTranslationText = '未找到翻译';
const defaultLocalesPathFallbackBadge = '[D]';
const defaultLocalesPathFallbackDescription = 'defaultLocalesPath fallback';
const localeJsonExtRegexp = /\.json$/i;
const maxLocaleFileCacheSize = 200;

let refreshTimer;
const decorationTypesByEditor = new Map();
const focusedKeysSignatureByEditor = new Map();
const localeFileCache = new Map();

const trimLocaleFileCache = () => {
  while (localeFileCache.size > maxLocaleFileCacheSize) {
    const oldestKey = localeFileCache.keys().next().value;
    localeFileCache.delete(oldestKey);
  }
};

const clearLocaleFileCache = () => {
  localeFileCache.clear();
};

const readCachedLocaleFile = (filePath, parser) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      localeFileCache.delete(filePath);
      return {};
    }

    const stat = fs.statSync(filePath);
    const cached = localeFileCache.get(filePath);
    if (
      cached &&
      cached.mtimeMs === stat.mtimeMs &&
      cached.size === stat.size
    ) {
      return cached.value;
    }

    const value = parser(filePath);
    localeFileCache.set(filePath, {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      value,
    });
    trimLocaleFileCache();
    return value;
  } catch (e) {
    localeFileCache.delete(filePath);
    return {};
  }
};

const readJsonLocale = (localesPath) => {
  return readCachedLocaleFile(localesPath, (filePath) => {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return flatten(data ? JSON.parse(data) : {});
    } catch (e) {
      return {};
    }
  });
};

const readSplitLocaleFileCached = (filePath) =>
  readCachedLocaleFile(filePath, readSplitLocaleFile);

const getWorkspaceRoot = (fsPath) => {
  try {
    return getLocales({
      fsPath,
      isGetRootPath: true,
      showInfo: false,
      showError: false,
    });
  } catch (e) {
    return null;
  }
};

const getSplitLocaleBaseDir = (fsPath) => {
  const rootPath = getWorkspaceRoot(fsPath);
  if (!rootPath) return null;
  const { generateI18nFilesOutputDir = 'src/i18n/lang/zh-cn' } =
    getCustomSetting(fsPath, ['generateI18nFilesOutputDir']);

  return path.isAbsolute(generateI18nFilesOutputDir)
    ? generateI18nFilesOutputDir
    : path.join(rootPath, generateI18nFilesOutputDir);
};

const getLocaleNameFromFileName = (fileName = '') =>
  path.basename(fileName, path.extname(fileName));

const getConfiguredLocaleName = (fsPath) => {
  const { langFile = 'zh-cn.json' } = getCustomSetting(fsPath, ['langFile']);
  return getLocaleNameFromFileName(langFile) || 'zh-cn';
};

const getPreviewLocaleName = (fsPath) => {
  const { previewLocale } = getCustomSetting(fsPath, ['previewLocale']);
  return String(previewLocale || '').trim() || getConfiguredLocaleName(fsPath);
};

const getLocalesFolderPath = (fsPath) => {
  const rootPath = getWorkspaceRoot(fsPath);
  if (!rootPath) return null;
  const { defaultLocalesPath = 'src/locales' } = getCustomSetting(fsPath, [
    'defaultLocalesPath',
  ]);

  return path.isAbsolute(defaultLocalesPath)
    ? defaultLocalesPath
    : path.join(rootPath, defaultLocalesPath);
};

const getJsonLocalePath = (fsPath, localeName) => {
  const localesFolderPath = getLocalesFolderPath(fsPath);
  if (!localesFolderPath || !localeName) return null;
  return path.join(localesFolderPath, `${localeName}.json`);
};

const getSplitLocaleBaseDirForLocale = (fsPath, localeName) => {
  const configuredBaseDir = getSplitLocaleBaseDir(fsPath);
  if (!configuredBaseDir || !localeName) return configuredBaseDir;

  const configuredLocaleName = path.basename(configuredBaseDir);
  if (configuredLocaleName === localeName) return configuredBaseDir;
  return path.join(path.dirname(configuredBaseDir), localeName);
};

const listJsonLocales = (fsPath) => {
  const localesFolderPath = getLocalesFolderPath(fsPath);
  if (!localesFolderPath || !fs.existsSync(localesFolderPath)) return [];

  try {
    return fs
      .readdirSync(localesFolderPath)
      .filter((fileName) => localeJsonExtRegexp.test(fileName))
      .map((fileName) => ({
        name: getLocaleNameFromFileName(fileName),
        jsonPath: path.join(localesFolderPath, fileName),
      }));
  } catch (e) {
    return [];
  }
};

const listSplitLocales = (fsPath) => {
  const configuredBaseDir = getSplitLocaleBaseDir(fsPath);
  if (!configuredBaseDir) return [];

  const parentDir = path.dirname(configuredBaseDir);
  if (!fs.existsSync(parentDir)) return [];

  try {
    return fs
      .readdirSync(parentDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        name: entry.name,
        splitBaseDir: path.join(parentDir, entry.name),
      }));
  } catch (e) {
    return [];
  }
};

const getAvailableLocales = (fsPath) => {
  const locales = {};
  const addLocale = ({ name, jsonPath, splitBaseDir }) => {
    if (!name) return;
    locales[name] = {
      name,
      jsonPath: jsonPath || (locales[name] && locales[name].jsonPath),
      splitBaseDir:
        splitBaseDir || (locales[name] && locales[name].splitBaseDir),
    };
  };

  listJsonLocales(fsPath).forEach(addLocale);
  listSplitLocales(fsPath).forEach(addLocale);

  const previewLocaleName = getPreviewLocaleName(fsPath);
  addLocale({
    name: previewLocaleName,
    jsonPath: getJsonLocalePath(fsPath, previewLocaleName),
    splitBaseDir: getSplitLocaleBaseDirForLocale(fsPath, previewLocaleName),
  });

  return Object.keys(locales)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => locales[name]);
};

const getCandidateKeys = (document, key, caller, scopedTranslateScopes = {}) => {
  if (caller && scopedTranslateScopes[caller]) {
    const scope = scopedTranslateScopes[caller];
    const scopedKey = key.indexOf(`${scope}.`) === 0 ? key : `${scope}.${key}`;
    return scopedKey === key ? [key] : [scopedKey, key];
  }

  const { useHashKeyOnly = false } = getCustomSetting(document.uri.fsPath, [
    'useHashKeyOnly',
  ]);
  if (!useHashKeyOnly || key.indexOf('.') !== -1) return [key];

  const activeEditor = window.activeTextEditor;
  if (!activeEditor || activeEditor.document !== document) return [key];

  const prefix = getPrefix(activeEditor);
  return prefix ? [`${prefix}.${key}`, key] : [key];
};

const getTranslateContext = (fsPath, text) => {
  const { scopedTranslateFunctionNames } = getCustomSetting(
    fsPath,
    ['scopedTranslateFunctionNames'],
  );
  const scopedTranslateScopes = getScopedTranslateScopes(
    text,
    scopedTranslateFunctionNames,
  );
  const translateCallers = Array.from(
    new Set([
      ...Object.keys(scopedTranslateScopes),
      ...getUseI18nTranslateCallers(text),
    ]),
  );

  return {
    scopedTranslateScopes,
    translateCallers,
  };
};

const createLocaleResolver = (document, options = {}) => {
  const fsPath = document.uri.fsPath;
  const localeName = options.localeName || getPreviewLocaleName(fsPath);
  const text = options.text || document.getText();
  const localesPath = getJsonLocalePath(fsPath, localeName);
  const jsonLocaleObj = readJsonLocale(localesPath);
  const splitLocaleBaseDir = getSplitLocaleBaseDirForLocale(fsPath, localeName);
  const { scopedTranslateScopes, translateCallers } =
    options.translateContext || getTranslateContext(fsPath, text);

  const readSplitValue = (candidateKey, originalKey) => {
    const candidates = getSplitFileCandidates(splitLocaleBaseDir, candidateKey);
    for (const filePath of candidates) {
      const splitLocaleObj = readSplitLocaleFileCached(filePath);
      let result = getLocaleValueByKey(splitLocaleObj, candidateKey);
      if (!result.exist && originalKey !== candidateKey) {
        result = getLocaleValueByKey(splitLocaleObj, originalKey);
      }
      if (result.exist) {
        return {
          ...result,
          filePath,
          localeName,
          source: 'split',
        };
      }
    }
    return null;
  };

  const resolveLocaleValue = (key, caller) => {
    const candidateKeys = getCandidateKeys(
      document,
      key,
      caller,
      scopedTranslateScopes,
    );
    for (const candidateKey of candidateKeys) {
      const splitResult = readSplitValue(candidateKey, key);
      if (splitResult) return splitResult;

      const jsonResult = getLocaleValueByKey(jsonLocaleObj, candidateKey);
      if (jsonResult.exist) {
        return {
          ...jsonResult,
          filePath: localesPath,
          localeName,
          source: 'defaultLocalesPath',
        };
      }
    }

    return {
      exist: false,
      key,
      value: undefined,
      filePath: localesPath,
      localeName,
      source: 'missing',
    };
  };

  resolveLocaleValue.callers = translateCallers;
  resolveLocaleValue.localeName = localeName;

  return resolveLocaleValue;
};

const resolveLocaleValues = (document, key, caller) => {
  const fsPath = document.uri.fsPath;
  const text = document.getText();
  const translateContext = getTranslateContext(fsPath, text);

  return getAvailableLocales(fsPath).map((locale) => {
    const result = createLocaleResolver(document, {
      localeName: locale.name,
      text,
      translateContext,
    })(key, caller);
    return {
      ...result,
      localeName: locale.name,
      filePath: result.filePath || locale.jsonPath,
    };
  });
};

const isDefaultLocalesPathFallback = (result) =>
  result && result.source === 'defaultLocalesPath';

const formatPreviewText = (result) => {
  if (!result || !result.exist) return missingTranslationText;
  const value = String(result.value);
  return isDefaultLocalesPathFallback(result)
    ? `${defaultLocalesPathFallbackBadge} ${value}`
    : value;
};

const buildTooltip = ({ key, value, filePath, source }) => {
  const sourceMessage =
    source === 'defaultLocalesPath'
      ? `${defaultLocalesPathFallbackBadge} ${defaultLocalesPathFallbackDescription}`
      : '';
  const message = new MarkdownString(
    [
      `**${key}**`,
      '',
      sourceMessage,
      String(value),
      '',
      filePath ? `_${filePath}_` : '',
    ]
      .filter((item, index) => index === 1 || item)
      .join('\n'),
  );
  message.isTrusted = true;
  return message;
};

const disposeDecorationTypes = (decorationTypes = []) => {
  decorationTypes.forEach((decorationType) => decorationType.dispose());
};

const disposeEditorDecorations = (editor) => {
  if (!editor) return;
  disposeDecorationTypes(decorationTypesByEditor.get(editor) || []);
  decorationTypesByEditor.delete(editor);
  focusedKeysSignatureByEditor.delete(editor);
};

const disposeInvisibleEditorDecorations = () => {
  const visibleEditors = new Set(window.visibleTextEditors || []);
  Array.from(decorationTypesByEditor.keys()).forEach((editor) => {
    if (!visibleEditors.has(editor)) {
      disposeEditorDecorations(editor);
    }
  });
};

const disposeAllDecorationTypes = () => {
  Array.from(decorationTypesByEditor.values()).forEach(disposeDecorationTypes);
  decorationTypesByEditor.clear();
  focusedKeysSignatureByEditor.clear();
};

const getVisibleEditors = () => {
  const visibleEditors = window.visibleTextEditors || [];
  if (visibleEditors.length > 0) return visibleEditors;
  return window.activeTextEditor ? [window.activeTextEditor] : [];
};

const isActiveEditor = (editor) => {
  return !!editor && editor === window.activeTextEditor;
};

const getStoredFocusedKeySignature = (editor) => {
  return focusedKeysSignatureByEditor.get(editor) || '';
};

const setStoredFocusedKeySignature = (editor, signature) => {
  if (!editor) return;
  focusedKeysSignatureByEditor.set(editor, signature || '');
};

const refreshVisibleDecorations = (options = {}) => {
  disposeInvisibleEditorDecorations();
  let count = 0;
  getVisibleEditors().forEach((editor) => {
    count += updateDecorations(editor, {
      ...options,
      restoreFocusedRange: isActiveEditor(editor),
    }) || 0;
  });
  return count;
};

const refreshDocumentDecorations = (document, options = {}) => {
  disposeInvisibleEditorDecorations();
  let count = 0;
  getVisibleEditors()
    .filter((editor) => editor.document === document)
    .forEach((editor) => {
      count += updateDecorations(editor, {
        ...options,
        restoreFocusedRange: isActiveEditor(editor),
      }) || 0;
    });
  return count;
};

const clearPreviewDecorationsWhenDisabled = () => {
  getVisibleEditors().forEach((editor) => {
    if (!isPreviewEditor(editor)) {
      disposeEditorDecorations(editor);
      return;
    }

    const { inlineTranslationPreview } = getCustomSetting(
      editor.document.uri.fsPath,
      ['inlineTranslationPreview'],
    );
    if (!inlineTranslationPreview) {
      disposeEditorDecorations(editor);
    }
  });
  disposeInvisibleEditorDecorations();
};

const isPreviewEditor = (editor) =>
  editor &&
  editor.document &&
  previewLanguageIds.includes(editor.document.languageId);

const createDecorationType = ({ exist, source, contentText, keyLength }) =>
  window.createTextEditorDecorationType({
    color: 'rgba(0,0,0,0)',
    overviewRulerLane: OverviewRulerLane.Right,
    textDecoration: 'none;',
    after: {
      color: !exist
        ? 'rgba(244,63,94,0.95)'
        : source === 'defaultLocalesPath'
        ? 'rgba(217,119,6,0.95)'
        : 'rgba(153,153,153,0.95)',
      contentText,
      fontStyle: 'italic',
      fontWeight: 'normal',
      margin: `0 0 0 -${Math.max(keyLength, 1)}ch`,
    },
  });

const comparePosition = (a, b) => {
  if (a.line !== b.line) return a.line - b.line;
  return a.character - b.character;
};

const isSelectionInRange = (selection, range) => {
  if (!selection) return false;

  const start = selection.start || selection.active;
  const end = selection.end || selection.anchor || selection.active;
  if (!start || !end) return false;

  const selectionStart = comparePosition(start, end) <= 0 ? start : end;
  const selectionEnd = comparePosition(start, end) <= 0 ? end : start;

  return (
    comparePosition(selectionEnd, range.start) >= 0 &&
    comparePosition(selectionStart, range.end) <= 0
  );
};

const isFocusedRange = (editor, range) => {
  const selections = editor.selections || [editor.selection];
  return selections.some((selection) => isSelectionInRange(selection, range));
};

const getFocusedKeySignature = (editor = window.activeTextEditor) => {
  if (!isPreviewEditor(editor)) return '';

  const document = editor.document;
  const text = document.getText();
  const { translateCallers } = getTranslateContext(document.uri.fsPath, text);
  return getI18nKeyMatches(text, translateCallers)
    .filter(({ index, length }) =>
      isFocusedRange(
        editor,
        new Range(
          document.positionAt(index),
          document.positionAt(index + length),
        ),
      ),
    )
    .map(({ index, length }) => `${index}:${length}`)
    .join('|');
};

const updateDecorations = (
  editor = window.activeTextEditor,
  { force = false, restoreFocusedRange = isActiveEditor(editor) } = {},
) => {
  if (!isPreviewEditor(editor)) {
    disposeEditorDecorations(editor);
    return;
  }

  const document = editor.document;
  const { inlineTranslationPreview } = getCustomSetting(document.uri.fsPath, [
    'inlineTranslationPreview',
  ]);
  if (!force && !inlineTranslationPreview) {
    disposeEditorDecorations(editor);
    return;
  }

  const text = document.getText();
  const resolveLocaleValue = createLocaleResolver(document);
  const nextDecorationTypes = [];
  let count = 0;
  const nextFocusedKeys = [];
  getI18nKeyMatches(text, resolveLocaleValue.callers).forEach(
    ({ caller, key, index, length }) => {
      const range = new Range(
        document.positionAt(index),
        document.positionAt(index + length),
      );
      count++;
      if (restoreFocusedRange && isFocusedRange(editor, range)) {
        nextFocusedKeys.push(`${index}:${length}`);
        return;
      }

      const result = resolveLocaleValue(key, caller);
      const contentText = formatPreviewText(result);
      const decorationType = createDecorationType({
        exist: result.exist,
        source: result.source,
        contentText,
        keyLength: length,
      });
      nextDecorationTypes.push(decorationType);
      editor.setDecorations(decorationType, [
        {
          range,
          hoverMessage: result.exist
            ? buildTooltip(result)
            : new MarkdownString(missingTranslationText),
        },
      ]);
    },
  );
  const previousDecorationTypes = decorationTypesByEditor.get(editor) || [];
  decorationTypesByEditor.set(editor, nextDecorationTypes);
  setStoredFocusedKeySignature(editor, nextFocusedKeys.join('|'));
  setTimeout(() => disposeDecorationTypes(previousDecorationTypes), 0);
  return count;
};

const registerInlineTranslationPreview = (context) => {
  const refresh = (delay = 100) => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => refreshVisibleDecorations(), delay);
  };

  context.subscriptions.push(
    { dispose: disposeAllDecorationTypes },
    window.onDidChangeActiveTextEditor(() => refresh(0)),
    window.onDidChangeTextEditorSelection((event) => {
      const activeEditor = window.activeTextEditor;
      if (activeEditor && event.textEditor === activeEditor) {
        const nextFocusedKeysSignature = getFocusedKeySignature(activeEditor);
        if (
          nextFocusedKeysSignature === getStoredFocusedKeySignature(activeEditor)
        ) {
          return;
        }
        setStoredFocusedKeySignature(activeEditor, nextFocusedKeysSignature);
        updateDecorations(activeEditor, { restoreFocusedRange: true });
      }
    }),
    workspace.onDidChangeTextDocument((event) => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      refreshTimer = setTimeout(
        () => refreshDocumentDecorations(event.document),
        100,
      );
    }),
    workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('localeSail.inlineTranslationPreview') ||
        event.affectsConfiguration('localeSail.previewLocale') ||
        event.affectsConfiguration('localeSail.defaultLocalesPath') ||
        event.affectsConfiguration('localeSail.langFile') ||
        event.affectsConfiguration('localeSail.generateI18nFilesOutputDir') ||
        event.affectsConfiguration('localeSail.useHashKeyOnly') ||
        event.affectsConfiguration('localeSail.scopedTranslateFunctionNames')
      ) {
        clearLocaleFileCache();
        clearPreviewDecorationsWhenDisabled();
        refresh();
      }
    }),
    workspace.onDidSaveTextDocument(() => {
      clearLocaleFileCache();
      refresh();
    }),
  );

  setTimeout(refresh, 0);
};

module.exports = registerInlineTranslationPreview;
module.exports._private = {
  createLocaleResolver,
  clearLocaleFileCache,
  getAvailableLocales,
  getCandidateKeys,
  getFocusedKeySignature,
  getPreviewLocaleName,
  isDefaultLocalesPathFallback,
  isFocusedRange,
  formatPreviewText,
  readCachedLocaleFile,
  resolveLocaleValues,
  updateDecorations,
};
