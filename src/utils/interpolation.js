const templateInterpolationRegexp = /\$\{([^{}]+)\}/g;
const vueTemplateInterpolationRegexp = /\{\{\s*([^]*?)\s*\}\}/g;
const interpolationLiteralRegexp =
  /(["'])(?:\\.|(?!\1)[^\\\r\n])*[\u4e00-\u9fa5](?:\\.|(?!\1)[^\\\r\n])*\1/g;

const hasTemplateInterpolation = (str = '') =>
  str.startsWith('`') &&
  str.endsWith('`') &&
  /\$\{[^{}]+\}/.test(str);

const hasVueTemplateInterpolation = (str = '') =>
  /\{\{[^]*?\}\}/.test(str);

const getVueTemplateInterpolationLineState = (
  str = '',
  isInInterpolation = false,
) => {
  let nextInInterpolation = isInInterpolation;
  const tokenRegexp = /\{\{|\}\}/g;
  let match;
  tokenRegexp.lastIndex = 0;
  while ((match = tokenRegexp.exec(str))) {
    nextInInterpolation = match[0] === '{{';
  }
  tokenRegexp.lastIndex = 0;
  return {
    inInterpolationLine: isInInterpolation || nextInInterpolation,
    nextInInterpolation,
  };
};

const findClosingQuoteIndex = (str = '', quote, startIndex = 0) => {
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === '\\') {
      i += 1;
      continue;
    }
    if (str[i] === quote) return i;
  }
  return -1;
};

const getVueTemplateDynamicAttributeLineState = (
  str = '',
  activeQuote = null,
) => {
  let nextActiveQuote = activeQuote;
  let inDynamicAttributeLine = Boolean(activeQuote);
  let index = 0;
  const dynamicAttributeRegexp =
    /(?:^|\s)(?:(?::|@|#)[\w:.-]+|v-[\w-]+(?::[\w.-]+)?)\s*=\s*(["'])/g;

  while (index < str.length) {
    if (nextActiveQuote) {
      const closeIndex = findClosingQuoteIndex(str, nextActiveQuote, index);
      if (closeIndex === -1) break;
      index = closeIndex + 1;
      nextActiveQuote = null;
      continue;
    }

    dynamicAttributeRegexp.lastIndex = index;
    const match = dynamicAttributeRegexp.exec(str);
    if (!match) break;
    inDynamicAttributeLine = true;
    nextActiveQuote = match[1];
    index = match.index + match[0].length;
  }
  dynamicAttributeRegexp.lastIndex = 0;

  return {
    inDynamicAttributeLine,
    nextActiveQuote,
    suppressTemplateText:
      Boolean(activeQuote) ||
      Boolean(nextActiveQuote) ||
      (inDynamicAttributeLine && !/[<>]/.test(str)),
  };
};

const stripWrapperQuotes = (str = '') =>
  str.replace(/^["'`]|["'`]$/g, '');

const normalizeTemplateInterpolation = (str = '') => {
  let index = 0;
  return stripWrapperQuotes(str).replace(templateInterpolationRegexp, () => {
    const result = '{' + index + '}';
    index += 1;
    return result;
  });
};

const normalizeVueTemplateInterpolation = (str = '') => {
  let index = 0;
  return str.replace(vueTemplateInterpolationRegexp, () => {
    const result = '{' + index + '}';
    index += 1;
    return result;
  });
};

const getTemplateInterpolationArgs = (str = '') => {
  if (!hasTemplateInterpolation(str)) return [];
  const args = [];
  stripWrapperQuotes(str).replace(templateInterpolationRegexp, (_, expression) => {
    args.push(expression.trim());
    return _;
  });
  return args;
};

const getTemplateInterpolationLiteralTexts = (str = '') => {
  if (!hasTemplateInterpolation(str)) return [];
  const texts = [];
  stripWrapperQuotes(str).replace(templateInterpolationRegexp, (_, expression) => {
    let match;
    interpolationLiteralRegexp.lastIndex = 0;
    while ((match = interpolationLiteralRegexp.exec(expression))) {
      texts.push(stripWrapperQuotes(match[0]));
    }
    interpolationLiteralRegexp.lastIndex = 0;
    return _;
  });
  return texts;
};

const resolveTemplateInterpolationArg = (arg = '', localeObj = {}, funcName) => {
  if (!arg || !funcName) return arg;
  return arg.replace(interpolationLiteralRegexp, (literal) => {
    const text = literal.slice(1, -1);
    const key = localeObj[text];
    return key ? buildI18nCall(funcName, key) : literal;
  });
};

const getVueTemplateInterpolationArgs = (str = '') => {
  if (!hasVueTemplateInterpolation(str)) return [];
  const args = [];
  str.replace(vueTemplateInterpolationRegexp, (_, expression) => {
    args.push(expression.trim());
    return _;
  });
  return args;
};

const getVueTemplateLiteralTexts = (str = '') => {
  if (!hasVueTemplateInterpolation(str)) return [];
  const texts = [];
  let lastIndex = 0;
  let match;
  vueTemplateInterpolationRegexp.lastIndex = 0;
  while ((match = vueTemplateInterpolationRegexp.exec(str))) {
    texts.push(str.slice(lastIndex, match.index).trim());
    lastIndex = match.index + match[0].length;
  }
  texts.push(str.slice(lastIndex).trim());
  vueTemplateInterpolationRegexp.lastIndex = 0;
  return texts.filter((text) => /[\u4e00-\u9fa5]/.test(text));
};

const getI18nText = (str = '', resoloveReg, options = {}) => {
  if (hasTemplateInterpolation(str)) {
    return normalizeTemplateInterpolation(str);
  }
  if (options.vueTemplate) {
    const text = hasVueTemplateInterpolation(str)
      ? normalizeVueTemplateInterpolation(str)
      : str;
    return text.trim();
  }
  return str.replace(resoloveReg, '');
};

const buildI18nCall = (funcName, key, args = []) => {
  const params = args.length > 0 ? `, [${args.join(', ')}]` : '';
  return `${funcName}('${key}'${params})`;
};

module.exports = {
  buildI18nCall,
  getI18nText,
  getTemplateInterpolationArgs,
  getTemplateInterpolationLiteralTexts,
  resolveTemplateInterpolationArg,
  getVueTemplateInterpolationArgs,
  getVueTemplateDynamicAttributeLineState,
  hasTemplateInterpolation,
  hasVueTemplateInterpolation,
  getVueTemplateInterpolationLineState,
  normalizeTemplateInterpolation,
  normalizeVueTemplateInterpolation,
  getVueTemplateLiteralTexts,
};
