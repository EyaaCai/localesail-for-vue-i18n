const { msg, Position, Range, executeCommand } = require('../utils/vs');
const {
  getRange,
  getLocales,
  getPrefix,
  getEditor,
  changeObjeValueKey,
  getCustomSetting,
  getValueFromDotString,
  showMessage,
  isMixinFile,
} = require('../utils');
const {
  scriptRegexp,
  propertyRegexp,
  angleBracketSpaceRegexp,
  quotationRegexp,
  spaceRegexp,
  commentRegexp,
} = require('../utils/regex');
const { operation } = require('../utils/constant');
const {
  buildI18nCall,
  getI18nText,
  getTemplateInterpolationArgs,
  getVueTemplateInterpolationArgs,
  resolveTemplateInterpolationArg,
} = require('../utils/interpolation');
const flatten = require('flat');
const fs = require('fs');

const getTranslateFunc = ({ isScript, isSetup, isTS, isMixinFile }) => {
  if (isTS || isSetup) return 't';
  if (isScript && isMixinFile) return 'this.$t';
  return '$t';
};

const resoloveLine = ({
  lineText,
  reg,
  resoloveReg,
  resoloveMainReg,
  localeObj,
  isScript,
  isTemplate,
  isSetup,
  isTS,
  isMixinFile,
}) => {
  let text = lineText.replace(reg, (str) => {
    let temp = str;
    const tFunc = getTranslateFunc({
      isScript,
      isSetup,
      isTS,
      isMixinFile,
    });
    if (reg === propertyRegexp) {
      const attrPart = temp.split('=')[0].replace(resoloveReg, '');
      const prefix =
        attrPart.startsWith(':') ||
        attrPart.startsWith('@') ||
        attrPart.startsWith('v-')
          ? ` ${attrPart}`
          : ` :${attrPart}`;
      const mainStr = temp.split('=')[1].replace(resoloveMainReg, '');
      const result = localeObj[mainStr];
      if (result) {
        //$t("xx")   template下 属性替换
        return `${prefix}="${tFunc}('${result}')"`;
      }
    } else {
      const resultStr = getI18nText(str, resoloveReg, {
        vueTemplate: reg === angleBracketSpaceRegexp,
      });
      const result = localeObj[resultStr];
      if (result) {
        //{{$t("xx")}}   template下 html替换
        if (reg === angleBracketSpaceRegexp) {
          const args = getVueTemplateInterpolationArgs(str).map((arg) =>
            resolveTemplateInterpolationArg(arg, localeObj, tFunc),
          );
          return `{{${buildI18nCall(tFunc, result, args)}}}`;
        }

        if (reg === scriptRegexp) {
          const args = getTemplateInterpolationArgs(str).map((arg) =>
            resolveTemplateInterpolationArg(arg, localeObj, tFunc),
          );
          //this.$t("xx")   script下 替换
          if (isScript) {
            return buildI18nCall(tFunc, result, args);
          }

          //$t("xx")   template下 {{ "汉字" }}替换
          if (isTemplate) {
            return buildI18nCall(tFunc, result, args);
          }
        }
      }
    }
    return str;
  });
  return {
    lineText: text,
  };
};

module.exports = ({ editor, context }) => {
  let currentEditor = getEditor(editor);
  if (!currentEditor) return;

  const { languageId } = currentEditor.document;
  const isTS = languageId === 'typescript' || languageId === 'typescriptreact';
  const lineCount = currentEditor.document.lineCount;
  const defaultLocalesPath = getCustomSetting(
    currentEditor.document.uri.fsPath,
    'defaultLocalesPath',
  );
  const range = getRange(currentEditor);
  const prefix = getPrefix(currentEditor);
  const isMixinFileContext = isMixinFile({
    fsPath: currentEditor.document.uri.fsPath,
    text: currentEditor.document.getText(),
  });
  const { localesPath, exist } = getLocales({
    fsPath: currentEditor.document.uri.fsPath,
    defaultLocalesPath,
    showError: true,
    showInfo: false,
  });
  if (!exist) return;

  const { useCompactPathMode, useHashKeyOnly } = getCustomSetting(
    currentEditor.document.uri.fsPath,
    ['useCompactPathMode', 'useHashKeyOnly'],
  );

  fs.readFile(localesPath, (err, data) => {
    if (!err) {
      const _data = JSON.parse(data.toString());
      const localeObj = changeObjeValueKey(
        _data[prefix] ||
          (useCompactPathMode ? null : getValueFromDotString(_data, prefix)),
        prefix,
        useHashKeyOnly,
      );
      // flatten(JSON.parse(data.toString()))[prefix] || {}
      if (!localeObj || Object.keys(localeObj).length === 0) {
        msg.error(localesPath + ` not contains property '${prefix}'`);
        return;
      }
      const lines = [];
      for (let i = 0; i < lineCount; i++) {
        //使用text替换,getWordRangeAtPosition无法替换全部
        const line = currentEditor.document.lineAt(i);
        let lineData = {
          lineText: line.text || '',
        };
        const isTemplate = range.template.end && i < range.template.end;
        const isScript = !range.template.end || i > range.template.end;
        if (
          (!range.template.begin &&
            range.template.begin !== 0 &&
            range.template.end) ||
          (range.template.begin &&
            !range.template.end &&
            range.template.end !== 0)
        ) {
          msg.error('当前vue文件template标签不完整');
          return;
        }
        if (
          (!range.script.begin &&
            range.script.begin !== 0 &&
            range.script.end) ||
          (range.script.begin && !range.script.end && range.script.end !== 0)
        ) {
          msg.error('当前vue文件script标签不完整');
          return;
        }

        //过滤单行注释，多行注释不考虑
        if (!lineData.lineText.match(commentRegexp)) {
          //匹配 template ><下的汉字
          if (lineData.lineText.match(angleBracketSpaceRegexp)) {
            lineData = resoloveLine({
              lineText: lineData.lineText,
              reg: angleBracketSpaceRegexp,
              resoloveReg: spaceRegexp,
              resoloveMainReg: quotationRegexp,
              localeObj,
              isScript,
              isTemplate,
              isSetup: range.isSetup,
              isTS,
              isMixinFile: isMixinFileContext,
            });
          }

          //匹配属性中的汉字
          if (lineData.lineText.match(propertyRegexp)) {
            lineData = resoloveLine({
              lineText: lineData.lineText,
              reg: propertyRegexp,
              resoloveReg: spaceRegexp,
              resoloveMainReg: quotationRegexp,
              localeObj,
              isScript,
              isTemplate,
              isSetup: range.isSetup,
              isTS,
              isMixinFile: isMixinFileContext,
            });
          }

          //匹配script中的汉字
          if (lineData.lineText.match(scriptRegexp)) {
            lineData = resoloveLine({
              lineText: lineData.lineText,
              reg: scriptRegexp,
              resoloveReg: quotationRegexp,
              resoloveMainReg: quotationRegexp,
              localeObj,
              isScript,
              isTemplate,
              isSetup: range.isSetup,
              isTS,
              isMixinFile: isMixinFileContext,
            });
          }
        }
        lines.push(lineData.lineText);
      }
      const editText = lines.join('\n');
      currentEditor
        .edit((editBuilder) => {
          const end = new Position(lineCount + 1, 0);
          editBuilder.replace(new Range(new Position(0, 0), end), editText);
        })
        .then((success) => {
          if (success) {
            showMessage({
              message: `${operation.replaceWithI18nKeys.title} success with \'${prefix}\' in ${localesPath}!`,
              needOpen: false,
              callback: {
                func: () => executeCommand(operation.showI18n.cmd),
                name: operation.showI18n.title,
              },
            });
          }
        });
    }
  });
};
