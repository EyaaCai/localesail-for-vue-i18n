const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { before } = require('mocha');

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const vscode = require('vscode');
const {
	scriptRegexp,
	propertyRegexp,
	angleBracketSpaceRegexp,
	spaceRegexp,
	getI18nKeyAtPosition,
	getI18nKeyMatches
} = require('../../src/utils/regex');
const {
	buildI18nCall,
	getI18nText,
	getTemplateInterpolationArgs,
	getTemplateInterpolationLiteralTexts,
	getVueTemplateDynamicAttributeLineState,
	getVueTemplateInterpolationLineState,
	getVueTemplateLiteralTexts,
	resolveTemplateInterpolationArg,
	getVueTemplateInterpolationArgs
} = require('../../src/utils/interpolation');
const retrieveCN = require('../../src/utils/retrieveCN');
const {
	getExistingTranslateFunc,
	getTranslateFunc,
} = require('../../src/lib/replaceWithI18nKeys')._private;
const { isMixinFile } = require('../../src/utils');
const { getLocaleValueByKey } = require('../../src/utils');
const { defaultConfig } = require('../../src/utils/constant');
const {
	extractExportDefaultObject,
	getSplitFileCandidates,
	getScopedTranslateScopes,
	getUseLocaleScopes,
	getUseI18nTranslateCallers,
	readSplitLocaleFile
} = require('../../src/utils/inlineTranslationResolver');
const {
	createLocaleResolver,
	clearLocaleFileCache,
	formatPreviewText,
	getAvailableLocales,
	getPreviewLocaleName,
	isDefaultLocalesPathFallback,
	readCachedLocaleFile,
	resolveLocaleValues
} = require('../../src/lib/inlineTranslationPreview')._private;
const packageJson = require('../../package.json');
// const myExtension = require('../extension');
const createEditor = (text, languageId) => {
	const lines = text.split('\n');
	return {
		document: {
			languageId,
			lineCount: lines.length,
			lineAt: (line) => ({ text: lines[line] }),
			getWordRangeAtPosition: (position, regex) => {
				regex.lastIndex = 0;
				const matched = regex.test(lines[position.line]);
				regex.lastIndex = 0;
				if (!matched) return undefined;
				return { start: { line: position.line } };
			}
		}
	};
};

suite('Extension Test Suite', () => {
	before(() => {
		vscode.window.showInformationMessage('Start all tests.');
	});

	test('Sample test', () => {
		assert.equal(-1, [1, 2, 3].indexOf(5));
		assert.equal(-1, [1, 2, 3].indexOf(0));
	});

	test('CJK extraction does not require CJK as the first character', () => {
		const cn = '\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587';
		const mixed = 'english \u4e2d\u6587 text';
		assert.deepStrictEqual(
			`const label = '1. ${cn}...';`.match(scriptRegexp),
			[`'1. ${cn}...'`]
		);
		assert.deepStrictEqual(
			`const label = "${mixed}";`.match(scriptRegexp),
			[`"${mixed}"`]
		);
		assert.deepStrictEqual(
			`<span title="1. ${cn}..."></span>`.match(propertyRegexp),
			[` title="1. ${cn}..."`]
		);
		assert.deepStrictEqual(
			`<span title="${mixed}"></span>`.match(propertyRegexp),
			[` title="${mixed}"`]
		);
		assert.deepStrictEqual(
			`<span>1. ${cn}...</span>`.match(angleBracketSpaceRegexp),
			[`1. ${cn}...`]
		);
		assert.deepStrictEqual(
			`<span>${mixed}</span>`.match(angleBracketSpaceRegexp),
			[mixed]
		);
	});

	test('Standalone attribute lines are excluded from template text extraction', () => {
		const line = '          label="\u5df2\u9000\u6b3e"';
		assert.strictEqual(line.match(angleBracketSpaceRegexp), null);
		assert.deepStrictEqual(line.match(propertyRegexp), [
			' label="\u5df2\u9000\u6b3e"',
		]);
		const editor = createEditor(
			[
				'<template>',
				'  <ServiceFeeLine',
				'    v-if="row.alibbTotalRefundAmount"',
				'    label="\u5df2\u9000\u6b3e"',
				'    :value="row.alibbTotalRefundAmount"',
				'  />',
				'</template>',
			].join('\n'),
			'vue'
		);
		assert.deepStrictEqual(Object.values(retrieveCN(editor)), [
			'\u5df2\u9000\u6b3e',
		]);
	});

	test('Disable next line comments skip extraction for the following line', () => {
		const editor = createEditor(
			[
				'<template>',
				'  <!-- localesail-disable-next-line -->',
				'  <div>\u8df3\u8fc7\u6211</div>',
				'  <div>\u4fdd\u7559\u6211</div>',
				'</template>',
			].join('\n'),
			'vue'
		);
		assert.deepStrictEqual(Object.values(retrieveCN(editor)), [
			'\u4fdd\u7559\u6211',
		]);
	});

	test('Generated hash key length is configurable', () => {
		const editor = createEditor(
			[
				'<template>',
				'  <div>\u4f60\u597d</div>',
				'  <div>\u4e16\u754c</div>',
				'</template>',
			].join('\n'),
			'vue'
		);
		assert.deepStrictEqual(
			Object.keys(retrieveCN(editor, { hashLength: 8 }))
				.map((key) => key.length),
			[8, 8]
		);
		assert.deepStrictEqual(
			Object.keys(retrieveCN(editor, { hashLength: 3 }))
				.map((key) => key.length),
			[6, 6]
		);
	});

	test('Bound attribute expressions are not extracted as template text', () => {
		const ternaryLine = `          :title="isAdd ? '\u6dfb\u52a0' : '\u5220\u9664'"`;
		const i18nArgsLine =
			`          :title="t('5zmpjxrt99s0', ['\u54c8\u55bd'])"`;
		assert.strictEqual(ternaryLine.match(angleBracketSpaceRegexp), null);
		assert.strictEqual(i18nArgsLine.match(angleBracketSpaceRegexp), null);
		assert.deepStrictEqual(ternaryLine.match(scriptRegexp), [
			"'\u6dfb\u52a0'",
			"'\u5220\u9664'",
		]);
		assert.deepStrictEqual(i18nArgsLine.match(scriptRegexp), [
			"'\u54c8\u55bd'",
		]);

		const editor = createEditor(
			[
				'<template>',
				'  <el-button',
				ternaryLine,
				'  />',
				'  <el-button',
				i18nArgsLine,
				'  />',
				'</template>',
			].join('\n'),
			'vue'
		);
		assert.deepStrictEqual(Object.values(retrieveCN(editor)).sort(), [
			'\u5220\u9664',
			'\u54c8\u55bd',
			'\u6dfb\u52a0',
		].sort());
	});

	test('Multiline bound attribute expressions are not extracted as template text', () => {
		const source = [
			'<template>',
			'  <el-button',
			'    :title="',
			'      a',
			"        ? '\u4f60\u597d'",
			"        : '\u4e16\u754c'",
			'    "',
			'  />',
			'</template>',
		];
		let state = getVueTemplateDynamicAttributeLineState(source[2], null);
		assert.strictEqual(state.inDynamicAttributeLine, true);
		state = getVueTemplateDynamicAttributeLineState(source[4], state.nextActiveQuote);
		assert.strictEqual(state.inDynamicAttributeLine, true);
		assert.deepStrictEqual(source[4].match(scriptRegexp), ["'\u4f60\u597d'"]);
		assert.strictEqual(state.suppressTemplateText, true);
		assert.strictEqual(
			getVueTemplateDynamicAttributeLineState(
				'          <strong v-if="!isEdit">\u901a\u884c\u8bc1{{ index + 1 }}</strong>',
				null,
			).suppressTemplateText,
			false
		);

		const editor = createEditor(source.join('\n'), 'vue');
		assert.deepStrictEqual(Object.values(retrieveCN(editor)).sort(), [
			'\u4e16\u754c',
			'\u4f60\u597d',
		].sort());
	});

	test('Template expressions with Chinese remain script matches', () => {
		const mixed = 'english \u4e2d\u6587';
		const lineText = `<span>{{ test ? "${mixed}" : "" }}</span>`;
		assert.strictEqual(lineText.match(angleBracketSpaceRegexp), null);
		assert.deepStrictEqual(lineText.match(scriptRegexp), [`"${mixed}"`]);
	});

	test('Multiline Vue interpolation expressions are not extracted as template text', () => {
		const source = [
			'<template>',
			'  <div>',
			'    {{',
			'      IS_XIONGYITONG_MODE',
			"        ? '\u4f60\u731c'",
			"        : '\u4e0d\u5bf9'",
			'    }}',
			'  </div>',
			'</template>',
		];
		let state = getVueTemplateInterpolationLineState(source[2], false);
		assert.strictEqual(state.inInterpolationLine, true);
		state = getVueTemplateInterpolationLineState(source[4], state.nextInInterpolation);
		assert.strictEqual(state.inInterpolationLine, true);
		assert.deepStrictEqual(source[4].match(scriptRegexp), ["'\u4f60\u731c'"]);

		const editor = createEditor(source.join('\n'), 'vue');
		assert.deepStrictEqual(Object.values(retrieveCN(editor)).sort(), [
			'\u4e0d\u5bf9',
			'\u4f60\u731c',
		].sort());
	});

	test('Vue template text with interpolation extracts static copy only', () => {
		const text = '\u53d1\u8fd0\u5355\u53f7\uff1a{{ detail.carriageId }}';
		assert.deepStrictEqual(
			`<div>${text}</div>`.match(angleBracketSpaceRegexp),
			[text]
		);
		assert.deepStrictEqual(
			getVueTemplateLiteralTexts(text),
			['\u53d1\u8fd0\u5355\u53f7\uff1a']
		);
		assert.deepStrictEqual(
			getVueTemplateInterpolationArgs(text),
			['detail.carriageId']
		);
		assert.strictEqual(
			buildI18nCall('$t', '6gsy9j06ouo0', getVueTemplateInterpolationArgs(text)),
			"$t('6gsy9j06ouo0', [detail.carriageId])"
		);
	});

	test('Update I18n extracts static template text around Vue interpolations', () => {
		const source = [
			'<template>',
			'  <div class="ship-order-sn">\u53d1\u8fd0\u5355\u53f7\uff1a{{ detail.carriageId }}</div>',
			'  <div class="pass-list">',
			'    <Form ref="passForm" :model="form" :label-width="110">',
			'      <div v-for="(pass, index) in form.arrivalPassList" :key="pass.localKey" class="pass-card">',
			'        <div class="pass-card-title">',
			'          <strong v-if="!isEdit">\u901a\u884c\u8bc1{{ index + 1 }}</strong>',
			'          <span',
			'            v-if="!isEdit && form.arrivalPassList.length > 1"',
			'            class="tms-text-btn delete-pass"',
			'            type="text"',
			'            @click="handleRemove(index)"',
			'          >',
			'            \u5220\u9664',
			'          </span>',
			'        </div>',
			'      </div>',
			'    </Form>',
			'  </div>',
			'  <Button v-if="!isEdit && form.arrivalPassList.length < 10" type="dashed" long @click="handleAdd">',
			'    + \u65b0\u589e\u901a\u884c\u8bc1',
			'  </Button>',
			'</template>',
		];
		const editor = createEditor(source.join('\n'), 'vue');
		const values = Object.values(retrieveCN(editor)).sort();
		assert.deepStrictEqual(values, [
			'+ \u65b0\u589e\u901a\u884c\u8bc1',
			'\u5220\u9664',
			'\u53d1\u8fd0\u5355\u53f7\uff1a',
			'\u901a\u884c\u8bc1',
		].sort());
	});

	test('Template literal interpolation is normalized and restored as i18n params', () => {
		const normalized =
			'\u672c\u6b21\u5171\u6253\u5370{0}\u4e2a\u8ba2\u5355' +
			'\uff0c\u8bf7\u786e\u8ba4\u662f\u5426\u5df2\u5168\u90e8\u6253\u5370';
		const text =
			'`\u672c\u6b21\u5171\u6253\u5370${successOrderIds.value.length}' +
			'\u4e2a\u8ba2\u5355\uff0c\u8bf7\u786e\u8ba4\u662f\u5426' +
			'\u5df2\u5168\u90e8\u6253\u5370`';
		assert.deepStrictEqual(text.match(scriptRegexp), [text]);
		assert.strictEqual(
			getI18nText(text, /["'`]/g),
			normalized
		);
		assert.deepStrictEqual(
			getTemplateInterpolationArgs(text),
			['successOrderIds.value.length']
		);
		assert.strictEqual(
			buildI18nCall('t', '6gsy9j06ouo0', getTemplateInterpolationArgs(text)),
			"t('6gsy9j06ouo0', [successOrderIds.value.length])"
		);
	});

	test('Template literal interpolation supports quotes inside expressions', () => {
		const emptyFallback = "`\u4f60\u597d${this.text ? this.text : ''}`";
		const cnFallback = "`\u4f60\u597d${this.text ? this.text : '\u4e16\u754c'}`";
		assert.deepStrictEqual(emptyFallback.match(scriptRegexp), [emptyFallback]);
		assert.deepStrictEqual(cnFallback.match(scriptRegexp), [cnFallback]);
		assert.strictEqual(getI18nText(emptyFallback, /["'`]/g), '\u4f60\u597d{0}');
		assert.strictEqual(getI18nText(cnFallback, /["'`]/g), '\u4f60\u597d{0}');
		assert.deepStrictEqual(
			getTemplateInterpolationArgs(emptyFallback),
			["this.text ? this.text : ''"]
		);
		assert.deepStrictEqual(
			getTemplateInterpolationArgs(cnFallback),
			["this.text ? this.text : '\u4e16\u754c'"]
		);
		assert.deepStrictEqual(
			getTemplateInterpolationLiteralTexts(emptyFallback),
			[]
		);
		assert.deepStrictEqual(
			getTemplateInterpolationLiteralTexts(cnFallback),
			['\u4e16\u754c']
		);
		assert.strictEqual(
			resolveTemplateInterpolationArg(
				"this.text ? this.text : '\u4e16\u754c'",
				{ '\u4e16\u754c': 'pages.home.world' },
				'this.$t'
			),
			"this.text ? this.text : this.$t('pages.home.world')"
		);
	});

	test('Update I18n extracts Chinese literals inside template interpolation expressions', () => {
		const source = "const label = `\u4f60\u597d${this.text ? this.text : '\u4e16\u754c'}`;";
		const editor = createEditor(source, 'javascript');
		const values = Object.values(retrieveCN(editor)).sort();
		assert.deepStrictEqual(values, [
			'\u4f60\u597d{0}',
			'\u4e16\u754c',
		].sort());
	});

	test('Mixin detection enables this.$t for mixins path or Vue options export', () => {
		assert.strictEqual(
			isMixinFile({ fsPath: 'D:/project/src/mixins/user.js' }),
			true
		);
		assert.strictEqual(
			isMixinFile({ fsPath: 'D:/project/src/mixin.js' }),
			true
		);
		assert.strictEqual(
			isMixinFile({
				fsPath: 'D:/project/src/helpers/user.js',
				text: 'export default { methods: { greet() { return "\u4f60\u597d"; } } }'
			}),
			true
		);
		assert.strictEqual(
			isMixinFile({
				fsPath: 'D:/project/src/utils/user.js',
				text: 'export const greet = () => "\u4f60\u597d";'
			}),
			false
		);
	});

	test('Replace I18n reuses existing translate function style', () => {
		assert.strictEqual(
			getExistingTranslateFunc("const title = $t('common.title')"),
			'$t'
		);
		assert.strictEqual(
			getExistingTranslateFunc("const { t: tt } = useI18n(); tt('common.title')"),
			'tt'
		);
		assert.strictEqual(
			getExistingTranslateFunc("const { t } = useI18n(); t('common.title')"),
			't'
		);
		assert.strictEqual(
			getTranslateFunc({
				isSetup: true,
				isTS: false,
				isScript: true,
				isMixinFile: false,
				existingTranslateFunc: '$t',
			}),
			'$t'
		);
		assert.strictEqual(
			getTranslateFunc({
				isSetup: true,
				isTS: false,
				isScript: true,
				isMixinFile: false,
				existingTranslateFunc: null,
			}),
			't'
		);
	});

	test('I18n detail lookup supports generated translate calls', () => {
		const lineText =
			"this.$t('pages.home.title'); $t(\"common.ok\"); t('setup.title'); i18n.t('global.name'); tt('alias.title')";
		assert.deepStrictEqual(
			getI18nKeyMatches(lineText, ['tt']).map(({ key }) => key),
			['pages.home.title', 'common.ok', 'setup.title', 'global.name', 'alias.title']
		);
		assert.strictEqual(
			getI18nKeyAtPosition(lineText, lineText.indexOf('setup.title') + 2),
			'setup.title'
		);
		assert.strictEqual(
			getI18nKeyAtPosition(lineText, lineText.indexOf('alias.title') + 2, ['tt']),
			'alias.title'
		);
		assert.deepStrictEqual(
			getI18nKeyMatches(lineText, ['tt']).map(({ caller }) => caller),
			['this.$t', '$t', 't', 'i18n.t', 'tt']
		);
	});

	test('I18n detail lookup resolves hash-only keys from nested locale paths', () => {
		const localeObj = {
			'views.account.print_page.print_invoice.index.6gt5yaxm60k0':
				'1.本次共打印${0}个订单，请确认是否已全部打印'
		};
		assert.deepStrictEqual(
			getLocaleValueByKey(localeObj, '6gt5yaxm60k0'),
			{
				exist: true,
				key: 'views.account.print_page.print_invoice.index.6gt5yaxm60k0',
				value: '1.本次共打印${0}个订单，请确认是否已全部打印'
			}
		);
	});

	test('Inline translation preview resolves split locale files by key path', () => {
		const baseDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'localesail-inline-preview-')
		);
		const targetDir = path.join(baseDir, 'views', 'user');
		const targetFile = path.join(targetDir, 'list.js');
		fs.mkdirSync(targetDir, { recursive: true });
		fs.writeFileSync(
			targetFile,
			[
				'import shared from "./shared";',
				'export default {',
				"  'views.user.list.title': '用户列表',",
				"  'views.user.list.description': '用户描述',",
				'};',
			].join('\n'),
			'utf8'
		);

		assert.deepStrictEqual(
			getSplitFileCandidates(baseDir, 'views.user.list.title'),
			[
				path.join(baseDir, 'views', 'user', 'list.js'),
				path.join(baseDir, 'views', 'user', 'list.ts')
			]
		);
		assert.strictEqual(
			extractExportDefaultObject(fs.readFileSync(targetFile, 'utf8')),
			[
				'{',
				"  'views.user.list.title': '用户列表',",
				"  'views.user.list.description': '用户描述',",
				'}'
			].join('\n')
		);
		assert.deepStrictEqual(readSplitLocaleFile(targetFile), {
			'views.user.list.title': '用户列表',
			'views.user.list.description': '用户描述'
		});
	});

	test('Inline translation preview detects useLocale scoped short keys', () => {
		const text =
			"const t = useLocale('views.customer.home.home_index.index');\n" +
			"const tt = useScopedI18n('views.order.detail');\n" +
			"const { t: scopedT } = useScopedI18n('views.product.detail');\n" +
			"const { t: tx } = useI18n();\n" +
			"const composer = useI18n();\n" +
			"const title = t('6anxu4s45zs0');\n" +
			"const order = tt('title');\n" +
			"const product = scopedT('name');\n" +
			"const save = composer.t('common.save');\n" +
			"const global = tx('common.ok');";

		assert.deepStrictEqual(getUseLocaleScopes(text), {
			t: 'views.customer.home.home_index.index',
			't.t': 'views.customer.home.home_index.index'
		});
		assert.deepStrictEqual(
			getScopedTranslateScopes(text, ['useLocale', 'useScopedI18n']),
			{
				t: 'views.customer.home.home_index.index',
				't.t': 'views.customer.home.home_index.index',
				tt: 'views.order.detail',
				'tt.t': 'views.order.detail',
				scopedT: 'views.product.detail'
			}
		);
		assert.deepStrictEqual(getUseI18nTranslateCallers(text), ['tx', 'composer.t']);
	});

	test('Inline translation preview uses one locale and hover resolves all locales', () => {
		const rootDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'localesail-multi-locale-')
		);
		const sourceFile = path.join(rootDir, 'src', 'views', 'user', 'list.vue');
		const zhDir = path.join(rootDir, 'src', 'i18n', 'lang', 'zh-cn', 'views', 'user');
		const enDir = path.join(rootDir, 'src', 'i18n', 'lang', 'en-us', 'views', 'user');
		const localesDir = path.join(rootDir, 'src', 'locales');

		fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
		fs.mkdirSync(zhDir, { recursive: true });
		fs.mkdirSync(enDir, { recursive: true });
		fs.mkdirSync(localesDir, { recursive: true });
		fs.writeFileSync(path.join(rootDir, 'package.json'), '{}', 'utf8');
		fs.writeFileSync(
			path.join(rootDir, 'localesailrc.json'),
			JSON.stringify({
				defaultLocalesPath: 'src/locales',
				generateI18nFilesOutputDir: 'src/i18n/lang/zh-cn',
				langFile: 'zh-cn.json',
				previewLocale: 'en-us',
				scopedTranslateFunctionNames: ['useLocale']
			}),
			'utf8'
		);
		fs.writeFileSync(
			path.join(zhDir, 'list.js'),
			"export default { 'views.user.list.title': '用户列表' };",
			'utf8'
		);
		fs.writeFileSync(
			path.join(enDir, 'list.js'),
			"export default { 'views.user.list.title': 'Users' };",
			'utf8'
		);
		fs.writeFileSync(
			path.join(localesDir, 'ja-jp.json'),
			JSON.stringify({ views: { user: { list: { title: 'ユーザー' } } } }),
			'utf8'
		);

		const document = {
			uri: { fsPath: sourceFile },
			getText: () =>
				"const t = useLocale('views.user.list');\nconst title = t('title');"
		};
		const resolver = createLocaleResolver(document);
		const allResults = resolveLocaleValues(document, 'title', 't');

		assert.strictEqual(getPreviewLocaleName(sourceFile), 'en-us');
		assert.deepStrictEqual(
			getAvailableLocales(sourceFile).map(({ name }) => name),
			['en-us', 'ja-jp', 'zh-cn']
		);
		assert.strictEqual(resolver('title', 't').value, 'Users');
		assert.strictEqual(resolver('title', 't').source, 'split');
		assert.deepStrictEqual(
			allResults.map(({ localeName, value, source }) => [localeName, value, source]),
			[
				['en-us', 'Users', 'split'],
				['ja-jp', 'ユーザー', 'defaultLocalesPath'],
				['zh-cn', '用户列表', 'split']
			]
		);
		assert.strictEqual(isDefaultLocalesPathFallback(allResults[1]), true);
		assert.strictEqual(
			formatPreviewText(allResults[1]),
			'[D] ユーザー'
		);
		assert.strictEqual(formatPreviewText(allResults[0]), 'Users');
	});

	test('Inline translation preview caches locale files until they change', () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'localesail-locale-cache-')
		);
		const localeFile = path.join(tempDir, 'zh-cn.json');
		let parseCount = 0;
		const parser = (filePath) => {
			parseCount += 1;
			return JSON.parse(fs.readFileSync(filePath, 'utf8'));
		};

		clearLocaleFileCache();
		fs.writeFileSync(localeFile, '{"title":"用户"}', 'utf8');
		assert.deepStrictEqual(readCachedLocaleFile(localeFile, parser), {
			title: '用户'
		});
		assert.deepStrictEqual(readCachedLocaleFile(localeFile, parser), {
			title: '用户'
		});
		assert.strictEqual(parseCount, 1);

		fs.writeFileSync(localeFile, '{"title":"用户列表"}', 'utf8');
		assert.deepStrictEqual(readCachedLocaleFile(localeFile, parser), {
			title: '用户列表'
		});
		assert.strictEqual(parseCount, 2);
		clearLocaleFileCache();
	});

	test('Generated workspace config contains every contributed configuration key', () => {
		const contributedKeys = Object.keys(
			packageJson.contributes.configuration.properties
		).map((key) => key.replace('localeSail.', ''));
		assert.deepStrictEqual(
			Object.keys(defaultConfig).sort(),
			contributedKeys.sort()
		);
	});
});
