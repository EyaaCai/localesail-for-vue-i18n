const assert = require('assert');
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
	resolveTemplateInterpolationArg,
	getVueTemplateInterpolationArgs
} = require('../../src/utils/interpolation');
const retrieveCN = require('../../src/utils/retrieveCN');
const { isMixinFile } = require('../../src/utils');
const { getLocaleValueByKey } = require('../../src/utils');
const { defaultConfig } = require('../../src/utils/constant');
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
		assert.deepStrictEqual(Object.values(retrieveCN(editor, 'short')), [
			'\u5df2\u9000\u6b3e',
		]);
	});

	test('Template expressions with Chinese remain script matches', () => {
		const mixed = 'english \u4e2d\u6587';
		const lineText = `<span>{{ test ? "${mixed}" : "" }}</span>`;
		assert.strictEqual(lineText.match(angleBracketSpaceRegexp), null);
		assert.deepStrictEqual(lineText.match(scriptRegexp), [`"${mixed}"`]);
	});

	test('Vue template text with interpolation is normalized as i18n params', () => {
		const text = '\u53d1\u8fd0\u5355\u53f7\uff1a{{ detail.carriageId }}';
		assert.deepStrictEqual(
			`<div>${text}</div>`.match(angleBracketSpaceRegexp),
			[text]
		);
		assert.strictEqual(
			getI18nText(text, spaceRegexp, { vueTemplate: true }),
			'\u53d1\u8fd0\u5355\u53f7\uff1a{0}'
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

	test('Update I18n extracts template text around Vue interpolations', () => {
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
		const values = Object.values(retrieveCN(editor, 'short')).sort();
		assert.deepStrictEqual(values, [
			'+ \u65b0\u589e\u901a\u884c\u8bc1',
			'\u5220\u9664',
			'\u53d1\u8fd0\u5355\u53f7\uff1a{0}',
			'\u901a\u884c\u8bc1{0}',
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
		const values = Object.values(retrieveCN(editor, 'short')).sort();
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

	test('I18n detail lookup supports generated translate calls', () => {
		const lineText =
			"this.$t('pages.home.title'); $t(\"common.ok\"); t('setup.title'); i18n.t('global.name')";
		assert.deepStrictEqual(
			getI18nKeyMatches(lineText).map(({ key }) => key),
			['pages.home.title', 'common.ok', 'setup.title', 'global.name']
		);
		assert.strictEqual(
			getI18nKeyAtPosition(lineText, lineText.indexOf('setup.title') + 2),
			'setup.title'
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
