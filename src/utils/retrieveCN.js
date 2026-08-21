const Puid = require('puid');
const { getRange } = require('.');
const {
  scriptRegexp,
  propertyRegexp,
  angleBracketSpaceRegexp,
  quotationRegexp,
  spaceRegexp,
  commentRegexp,
  disableNextLineCommentRegexp,
  warnRegexp,
  attributeQuotationRegexp,
} = require('./regex');
const {
  getI18nText,
  getTemplateInterpolationLiteralTexts,
  getVueTemplateDynamicAttributeLineState,
  getVueTemplateInterpolationLineState,
  getVueTemplateLiteralTexts,
  hasTemplateInterpolation,
  hasVueTemplateInterpolation,
} = require('./interpolation');

const cnRegexp = /[\u4e00-\u9fa5]/;
const defaultHashLength = 8;
const minHashLength = 6;
const maxHashLength = 24;

const normalizeHashLength = (hashLength) => {
  const parsed = Number(hashLength);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(maxHashLength, Math.max(minHashLength, Math.floor(parsed)));
};

const getLineCnWord = ({ lineText, reg, resoloveReg, initWordArr = [] }) => {
  let word = lineText.match(reg);
  if (!word) return initWordArr;
  if (Array.isArray(word) && word.length > 0) {
    word = word
      .reduce((result, v) => {
        //过滤特殊字符的匹配
        if (
          v.match(warnRegexp) &&
          !hasTemplateInterpolation(v) &&
          !(reg === angleBracketSpaceRegexp && hasVueTemplateInterpolation(v))
        ) {
          return result;
        }

        if (reg === angleBracketSpaceRegexp && hasVueTemplateInterpolation(v)) {
          result.push(...getVueTemplateLiteralTexts(v));
          return result;
        }

        const i18nText =
          reg === propertyRegexp
            ? v.split('=')[1].replace(attributeQuotationRegexp, '')
            : getI18nText(v, resoloveReg, {
                vueTemplate: reg === angleBracketSpaceRegexp,
              });

        if (cnRegexp.test(i18nText)) {
          result.push(i18nText);
        }

        if (hasTemplateInterpolation(v)) {
          result.push(...getTemplateInterpolationLiteralTexts(v));
        }

        return result;
      }, [])
      .concat(initWordArr);
  }
  return word;
};

const generateHash = (puid, hashLength, exists) => {
  let id = puid.generate();
  const length = normalizeHashLength(hashLength);
  if (length) {
    id = id.slice(-length);
  }
  while (exists(id)) {
    id = puid.generate();
    if (length) {
      id = id.slice(-length);
    }
  }
  return id;
};

const getlinesObj = (arr, puid, hashLength, existingKeys = []) => {
  const existingKeySet = new Set(existingKeys);
  return arr.reduce((p, c) => {
    const id = generateHash(
      puid,
      hashLength,
      (key) =>
        existingKeySet.has(key) || Object.prototype.hasOwnProperty.call(p, key),
    );
    existingKeySet.add(id);
    p[id] = c;
    return p;
  }, {});
};

//return linesObj
module.exports = (currentEditor, options = {}) => {
  if (!currentEditor || !currentEditor.document) return {};
  const config =
    typeof options === 'string'
      ? {
          puidType: options,
        }
      : options || {};
  const {
    puidType = 'short',
    hashLength = defaultHashLength,
    existingKeys = [],
  } = config;
  const { lineCount, languageId, lineAt } = currentEditor.document;
  const isJavascript =
    languageId === 'javascript' || languageId === 'javascriptreact';
  const isTypescript =
    languageId === 'typescript' || languageId === 'typescriptreact';
  const isVue = languageId === 'vue';

  const { template, script } = getRange(currentEditor);
  const lines = [];
  let inVueTemplateInterpolation = false;
  let vueTemplateDynamicAttributeQuote = null;
  let skipNextLine = false;
  for (let i = 0; i < lineCount; i++) {
    const lineText = lineAt(i).text;
    let cnWordArr = [];

    if (skipNextLine) {
      skipNextLine = false;
      continue;
    }
    if (lineText.match(disableNextLineCommentRegexp)) {
      skipNextLine = true;
      continue;
    }

    //跳过单行注释
    if (lineText.match(commentRegexp)) {
      continue;
    }
    //js文件(诸如mixin.js等)
    if (isJavascript || isTypescript) {
      cnWordArr = getLineCnWord({
        lineText,
        reg: scriptRegexp,
        resoloveReg: quotationRegexp,
        initWordArr: cnWordArr,
      });
    }

    //vue文件
    if (isVue) {
      const inVueTemplate = i <= template.end && i >= template.begin;
      const inVueScript = i <= script.end && i >= script.begin;
      if (inVueTemplate) {
        const vueTemplateInterpolationState =
          getVueTemplateInterpolationLineState(
            lineText,
            inVueTemplateInterpolation,
          );
        const vueTemplateDynamicAttributeState =
          getVueTemplateDynamicAttributeLineState(
            lineText,
            vueTemplateDynamicAttributeQuote,
          );
        /*
				vue template 三种位置
				1. 标签,空行之间
				2.标签属性
				3.{{""}}之间
				*/
        const inAngleBracketSpacet = lineText.match(angleBracketSpaceRegexp);
        const inProperty = lineText.match(propertyRegexp);
        const inTemplateScript = lineText.match(scriptRegexp);
        if (
          inAngleBracketSpacet &&
          !vueTemplateInterpolationState.inInterpolationLine &&
          !vueTemplateDynamicAttributeState.suppressTemplateText
        ) {
          cnWordArr = getLineCnWord({
            lineText,
            reg: angleBracketSpaceRegexp,
            resoloveReg: spaceRegexp,
            initWordArr: cnWordArr,
          });
        }
        if (inProperty) {
          cnWordArr = getLineCnWord({
            lineText,
            reg: propertyRegexp,
            resoloveReg: quotationRegexp,
            initWordArr: cnWordArr,
          });
        }
        if (inTemplateScript) {
          cnWordArr = getLineCnWord({
            lineText,
            reg: scriptRegexp,
            resoloveReg: quotationRegexp,
            initWordArr: cnWordArr,
          });
        }
        inVueTemplateInterpolation =
          vueTemplateInterpolationState.nextInInterpolation;
        vueTemplateDynamicAttributeQuote =
          vueTemplateDynamicAttributeState.nextActiveQuote;
      }
      if (inVueScript) {
        cnWordArr = getLineCnWord({
          lineText,
          reg: scriptRegexp,
          resoloveReg: quotationRegexp,
          initWordArr: cnWordArr,
        });
      }
    }
    if (cnWordArr.length > 0) {
      lines.push(...cnWordArr);
    }
  }
  const puid = new Puid(puidType === 'short');
  const result = getlinesObj(
    Array.from(new Set(lines)),
    puid,
    hashLength,
    existingKeys,
  );
  return result;
};
