const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const { getCustomSetting, getLocales, showMessage, getEditor } = require('../utils/index');
const {
  executeCommand,
  file,
  Position,
  Range,
  WorkspaceEdit,
  workspace,
} = require('../utils/vs');
const safeEval = require('safe-eval');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const formatRetryDelays = [100, 250, 500, 1000];

const toJsSingleQuotedString = (value = '') =>
  `'${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')}'`;

const isJsIdentifier = (value = '') =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(String(value));

const toJsObjectKey = (value = '') =>
  isJsIdentifier(value) ? String(value) : toJsSingleQuotedString(value);

const formatLocaleModuleEntry = (key, value) =>
  `  ${toJsObjectKey(key)}: ${toJsSingleQuotedString(value)},`;

const insertLocaleModuleEntries = (
  oldContent,
  braceIndex,
  exportDefaultEndIndex,
  items,
) => {
  const body = oldContent.substring(braceIndex + 1, exportDefaultEndIndex);
  const bodyWithoutTrailingWhitespace = body.replace(/\s+$/, '');
  const trailingWhitespace = body.slice(bodyWithoutTrailingWhitespace.length);
  const hasExistingEntries = bodyWithoutTrailingWhitespace.trim().length > 0;
  const needsComma =
    hasExistingEntries && !bodyWithoutTrailingWhitespace.trimEnd().endsWith(',');
  const separator = hasExistingEntries
    ? `${needsComma ? ',' : ''}\n`
    : '';
  const nextBody =
    bodyWithoutTrailingWhitespace +
    separator +
    items.join('\n') +
    (trailingWhitespace || '\n');

  return (
    oldContent.substring(0, braceIndex + 1) +
    nextBody +
    oldContent.substring(exportDefaultEndIndex)
  );
};

const getFormatOptions = (uri) => {
  const editorConfig = workspace.getConfiguration('editor', uri);
  const tabSize = editorConfig.get('tabSize', 2);

  return {
    tabSize: typeof tabSize === 'number' ? tabSize : 2,
    insertSpaces: editorConfig.get('insertSpaces', true) !== false,
  };
};

const getFormatEdits = async (
  uri,
  {
    execute = executeCommand,
    openTextDocument = workspace.openTextDocument,
    wait = delay,
  } = {},
) => {
  let lastError;
  for (let attempt = 0; attempt <= formatRetryDelays.length; attempt++) {
    if (attempt > 0) await wait(formatRetryDelays[attempt - 1]);

    try {
      await openTextDocument(uri);
      const edits = await execute(
        'vscode.executeFormatDocumentProvider',
        uri,
        getFormatOptions(uri),
      );
      if (edits === undefined || edits === null) return [];
      if (Array.isArray(edits)) return edits;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return [];
};

const syncDocumentWithFile = async (uri, document) => {
  const diskContent = fs.readFileSync(uri.fsPath, 'utf8');
  if (document.getText() === diskContent) return;

  const edit = new WorkspaceEdit();
  edit.replace(
    uri,
    new Range(new Position(0, 0), document.positionAt(document.getText().length)),
    diskContent,
  );
  const applied = await workspace.applyEdit(edit);
  if (!applied) {
    throw new Error(`Failed to refresh generated document: ${uri.fsPath}`);
  }
};

const saveDocument = async (
  uri,
  {
    openTextDocument = workspace.openTextDocument,
    wait = delay,
  } = {},
) => {
  let lastError;
  for (let attempt = 0; attempt <= formatRetryDelays.length; attempt++) {
    if (attempt > 0) await wait(formatRetryDelays[attempt - 1]);

    try {
      const document = await openTextDocument(uri);
      if (await document.save()) return true;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    console.error(`Failed to save formatted file: ${uri.fsPath}`, lastError);
  }
  return false;
};

const formatFiles = async (filePaths) => {
  const failedFiles = [];
  for (const filePath of filePaths) {
    try {
      const uri = file(filePath);
      const sourceDocument = await workspace.openTextDocument(uri);
      await syncDocumentWithFile(uri, sourceDocument);
      const edits = await getFormatEdits(uri);
      if (Array.isArray(edits) && edits.length) {
        const edit = new WorkspaceEdit();
        edit.set(uri, edits);
        const applied = await workspace.applyEdit(edit);
        if (!applied) {
          throw new Error(`Failed to apply formatting edits: ${filePath}`);
        }
      }
      const saved = await saveDocument(uri);
      if (!saved) {
        throw new Error(`Failed to save formatted file: ${filePath}`);
      }
    } catch (error) {
      failedFiles.push(filePath);
      console.error(`Failed to format generated file: ${filePath}`, error);
    }
  }
  if (failedFiles.length > 0) {
    throw new Error(`Failed to format generated files: ${failedFiles.join(', ')}`);
  }
};

module.exports = ({ context, uri }) => {
  let fileFsPath;
  if (uri && uri.fsPath) {
    fileFsPath = uri.fsPath;
  } else if (uri && uri.path) {
    fileFsPath = uri.path;
  } else {
    const currentEditor = getEditor();
    if (currentEditor) {
      fileFsPath = currentEditor.document.uri.fsPath;
    }
  }

  if (!fileFsPath) {
    showMessage({
      type: 'error',
      message: 'Can not resolve workspace folder without opening a file.',
      needOpen: false
    });
    return;
  }

  const {
    useCompactPathMode = true,
    useHashKeyOnly = false,
    generateI18nFilesOutputDir = 'src/i18n/lang/zh-cn',
    generateI18nFilesExt = 'auto',
    defaultLocalesPath = 'src/locales',
  } = getCustomSetting(fileFsPath, {
    useCompactPathMode: 'useCompactPathMode',
    useHashKeyOnly: 'useHashKeyOnly',
    generateI18nFilesOutputDir: 'generateI18nFilesOutputDir',
    generateI18nFilesExt: 'generateI18nFilesExt',
    defaultLocalesPath: 'defaultLocalesPath'
  });

  if (!useCompactPathMode) {
    showMessage({
      type: 'error',
      message: 'This feature only works when "useCompactPathMode" is enabled.',
      needOpen: false
    });
    return;
  }

  const { localesPath, exist } = getLocales({
    fsPath: fileFsPath,
    defaultLocalesPath,
    showError: true,
    showInfo: false,
  });

  if (!exist) return;

    const filesToFormat = [];
    fs.readFile(localesPath, 'utf8', async (err, data) => {
      if (err) return;

    let _data = {};
    try {
      _data = JSON.parse(data);
    } catch (e) {
      showMessage({ type: 'error', message: 'Failed to parse JSON string of locales.' });
      return;
    }

    const rootPath = getLocales({ fsPath: fileFsPath, isGetRootPath: true, defaultLocalesPath });
    if (!rootPath || typeof rootPath !== 'string') {
      showMessage({ type: 'error', message: 'Could not resolve workspace root path.' });
      return;
    }

    let targetExt = generateI18nFilesExt;
    if (targetExt === 'auto') {
      const tsConfigPath = path.join(rootPath, 'tsconfig.json');
      targetExt = fs.existsSync(tsConfigPath) ? 'ts' : 'js';
    }

    const outputBaseDir = path.isAbsolute(generateI18nFilesOutputDir)
      ? generateI18nFilesOutputDir
      : path.join(rootPath, generateI18nFilesOutputDir);

    Object.keys(_data).forEach((key) => {
      if (typeof _data[key] !== 'object' || Array.isArray(_data[key])) return;

      const obj = _data[key];
      const items = Object.keys(obj).map(k => {
        const finalKey = useHashKeyOnly ? k : `${key}.${k}`;
        return formatLocaleModuleEntry(finalKey, obj[k] || '');
      });
      if (items.length === 0) return;

      const parts = key.split('.');
      const fileName = parts.pop();
      const relativeDirPath = parts.join(path.sep);
      const targetDir = path.join(outputBaseDir, relativeDirPath);
      const targetFilePath = path.join(targetDir, `${fileName}.${targetExt}`);

      if (fs.existsSync(targetFilePath)) {
        let oldContent = '';
        try {
          oldContent = fs.readFileSync(targetFilePath, 'utf8');
        } catch (e) {
          console.error(`Failed to read existing file: ${targetFilePath}`, e);
          return;
        }

        let existingObj = {};
        let startIndex = oldContent.indexOf('export default');
        let exportDefaultEndIndex = -1;
        let braceIndex = -1;

        if (startIndex !== -1) {
          braceIndex = oldContent.indexOf('{', startIndex);
          if (braceIndex !== -1) {
            let braceCount = 0;
            for (let i = braceIndex; i < oldContent.length; i++) {
              if (oldContent[i] === '{') braceCount++;
              else if (oldContent[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  exportDefaultEndIndex = i;
                  break;
                }
              }
            }
            if (exportDefaultEndIndex !== -1) {
              const objStr = oldContent.substring(braceIndex, exportDefaultEndIndex + 1);
              try {
                existingObj = safeEval('(' + objStr + ')') || {};
              } catch (e) {
                console.error(`Failed to parse existing file object: ${targetFilePath}`, e);
              }
            }
          }
        }

        // 合并现有对象与新数据，实现“存在则更新，不存在则新增”
        const mergedObj = { ...existingObj };
        let hasChange = false;
        let hasExistingValueChange = false;
        const addedItems = [];
        Object.keys(_data[key]).forEach(k => {
          const finalKey = useHashKeyOnly ? k : `${key}.${k}`;
          const newVal = String(_data[key][k] || '');
          if (mergedObj[finalKey] !== newVal) {
            if (Object.prototype.hasOwnProperty.call(mergedObj, finalKey)) {
              hasExistingValueChange = true;
            } else {
              addedItems.push(formatLocaleModuleEntry(finalKey, newVal));
            }
            mergedObj[finalKey] = newVal;
            hasChange = true;
          }
        });

        if (hasChange && exportDefaultEndIndex !== -1 && braceIndex !== -1) {
          // 重新构造 export default 块的内容，保留括号前后的原始代码（如 import 等）
          const contentStr =
            !hasExistingValueChange && addedItems.length > 0
              ? insertLocaleModuleEntries(
                  oldContent,
                  braceIndex,
                  exportDefaultEndIndex,
                  addedItems,
                )
              : (() => {
                  const mergedItems = Object.keys(mergedObj).map(fk =>
                    formatLocaleModuleEntry(fk, mergedObj[fk]),
                  );
                  const beforeBrace = oldContent.substring(0, braceIndex + 1);
                  const afterBrace = oldContent.substring(exportDefaultEndIndex);
                  return (
                    beforeBrace +
                    '\n' +
                    mergedItems.join('\n') +
                    '\n' +
                    afterBrace
                  );
                })();

          try {
            fs.writeFileSync(targetFilePath, contentStr, 'utf8');
            filesToFormat.push(targetFilePath);
          } catch (e) {
            console.error(`Failed to write targeted file: ${targetFilePath}`, e);
          }
        }
      } else {
        const itemsToInsert = Object.keys(_data[key]).map(k => {
          const finalKey = useHashKeyOnly ? k : `${key}.${k}`;
          return formatLocaleModuleEntry(finalKey, _data[key][k] || '');
        });
        if (itemsToInsert.length === 0) return;
        mkdirp.sync(targetDir);
        const contentStr = `export default {\n${itemsToInsert.join('\n')}\n};\n`;
        fs.writeFileSync(targetFilePath, contentStr, 'utf8');
        filesToFormat.push(targetFilePath);
      }
    });

    if (filesToFormat.length > 0) {
      try {
        await formatFiles(filesToFormat);
      } catch (e) {
        console.error('Failed to format generated i18n files:', e);
        showMessage({
          type: 'error',
          message: 'Split i18n files were generated, but formatting failed. Source JSON has not been cleared.',
          needOpen: false
        });
        return;
      }
    }

    try {
      fs.writeFileSync(localesPath, '{}\n', 'utf8');
    } catch (e) {
      console.error(`Failed to clear locales file: ${localesPath}`, e);
      showMessage({
        type: 'error',
        message: `Split i18n files were generated, but failed to clear source JSON: ${localesPath}`,
        needOpen: false
      });
      return;
    }

    showMessage({
      type: 'info',
      message: `Split i18n files have been generated to ${generateI18nFilesOutputDir} successfully.`,
      needOpen: false
    });
  });
};

module.exports._private = {
  formatLocaleModuleEntry,
  formatFiles,
  getFormatEdits,
  saveDocument,
  isJsIdentifier,
  insertLocaleModuleEntries,
  getFormatOptions,
  toJsObjectKey,
  toJsSingleQuotedString,
};
