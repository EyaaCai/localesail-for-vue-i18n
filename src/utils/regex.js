//当看到这个页面，说明你对Regexp赋值了↓↓↓
//欢迎使用JavaScript中的RegExp的众多陷阱之一，当flag 是global时，第二次使用它将会从第一次匹配到的lastIndex开始查。。。
//所以只要是变量赋值多次使用的Regexp，都需要使用match，或者在使用完test,exec之后重置lastIndex

//约定:所有汉字匹配均以汉字开头,所有正则针对 单行匹配
const spaceRegexp = /\s/g;
const firstSpaceRegexp = /\s+/;
const quotationRegexp = /["'`]/g;
const angleBracketsRegexp = /[<>]/g;
const templateBeginRegexp = /<template/g;
const templateEndRegexp = /<\/template/g;
const scriptBeginRegexp = /<script/g;
const scripteEndRegexp = /<\/script/g;
const scriptSetupRegexp = /<script[^>]*\ssetup\b[^>]*>/g;

//只匹配单行注释，多行注释不考虑
const commentRegexp = /(\/\/)|(<!--)|(\/\*)/g;
const disableNextLineCommentRegexp =
  /(?:\/\/|<!--|\/\*)\s*localesail-disable-next-line\b/;

//匹配js中的汉字,配合template range 判断 是否是template中的js汉字
const scriptRegexp =
  /`[^`\r\n]*[\u4e00-\u9fa5][^`\r\n]*`|["'][^"'`\r\n]*[\u4e00-\u9fa5][^"'`\r\n]*["']/g;

//匹配属性中的汉字 √
const propertyRegexp =
  /\s[:\w\.\-\@\#]+=["'](?:['"])?[^"'`\r\n]*[\u4e00-\u9fa5][^"'`\r\n]*(?:['"])?["']/g;

const vueTemplateInterpolationSource = '\\{\\{[^<\\r\\n]*?\\}\\}';
const vueTemplateTextSource =
  `(?:${vueTemplateInterpolationSource}|[^<>{}\\r\\n])*` +
  `[^<>{}\\r\\n]*[\\u4e00-\\u9fa5][^<>{}\\r\\n]*` +
  `(?:${vueTemplateInterpolationSource}|[^<>{}\\r\\n])*`;
const quotedAttributeValueSource = `(["'])(?:\\\\.|(?!\\1)[^\\r\\n])*\\1`;
const vueTemplateAttributeSource =
  `[:@#\\w.-]+\\s*=\\s*${quotedAttributeValueSource}`;

// 单行  匹配 template ><下的汉字（retrieve），允许静态文本中夹带 Vue {{ }} 插值。
const angleBracketSpaceRegexp = new RegExp(
  `(?:(?<=>)${vueTemplateTextSource}(?=<)|^(?!\\s*${vueTemplateAttributeSource}\\s*$)\\s*${vueTemplateTextSource}\\s*$)`,
  'g',
);

//匹配到特殊字符串说明前面正则匹配有问题，给出提示，去掉匹配
const warnRegexp = /[{}<>]/g;
const attributeQuotationRegexp = /["']/g;

const defaultI18nCallers = ['this.$t', 'i18n.t', '$t', 't'];

const escapeRegExpSource = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getI18nCallRegexp = (extraCallers = []) => {
  const callers = Array.from(
    new Set([...defaultI18nCallers, ...extraCallers].filter((v) => !!v)),
  )
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExpSource)
    .join('|');

  return new RegExp(
    `(^|[^\\w$.])(${callers})\\(\\s*(["'])([^"']+)\\3`,
    'g',
  );
};

const getI18nKeyMatches = (text = '', extraCallers = []) => {
  const matches = [];
  let match;
  const dollarTRegexp = getI18nCallRegexp(extraCallers);
  dollarTRegexp.lastIndex = 0;
  while ((match = dollarTRegexp.exec(text))) {
    const caller = match[2];
    const key = match[4];
    const keyIndex = match.index + match[0].lastIndexOf(key);
    matches.push({
      caller,
      key,
      index: keyIndex,
      length: key.length,
    });
  }
  dollarTRegexp.lastIndex = 0;
  return matches;
};

const getI18nKeyAtPosition = (text = '', character = 0, extraCallers = []) => {
  const match = getI18nKeyMatches(text, extraCallers).find(
    ({ index, length }) => character >= index && character <= index + length,
  );
  return match && match.key;
};

module.exports = {
  templateBeginRegexp,
  templateEndRegexp,
  scriptBeginRegexp,
  scripteEndRegexp,
  scriptRegexp,
  propertyRegexp,
  angleBracketSpaceRegexp,
  warnRegexp,
  angleBracketsRegexp,
  quotationRegexp,
  spaceRegexp,
  firstSpaceRegexp,
  commentRegexp,
  disableNextLineCommentRegexp,
  defaultI18nCallers,
  getI18nCallRegexp,
  getI18nKeyAtPosition,
  getI18nKeyMatches,
  scriptSetupRegexp,
  attributeQuotationRegexp,
};
