const fs = require("fs");
const path = require("path");
const { Hover, MarkdownString } = require("../utils/vs");
const { operation } = require("../utils/constant");
const { getCustomSetting } = require("../utils");
const { getI18nKeyMatches } = require("../utils/regex");
const {
	getScopedTranslateScopes,
	getUseI18nTranslateCallers,
} = require("../utils/inlineTranslationResolver");
const {
	isDefaultLocalesPathFallback,
	resolveLocaleValues
} = require("./inlineTranslationPreview")._private;
const missingTranslationText = "未翻译";
const defaultLocalesPathFallbackBadge = "[D]";

const buildOpenLocaleCommandLink = ({ label, filePath, key }) =>
	`[${label}](command:${
		operation.openI18nFile.cmd
	}?${encodeURIComponent(
		JSON.stringify({
			fPath: filePath,
			key,
		})
	)} "Show In '${path.basename(filePath)}'")`;

const isExistingFile = (filePath) => {
	try {
		return !!filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile();
	} catch (e) {
		return false;
	}
};

const getHoverMsg = (results) => {
	const message = results
		.map((result) => {
			const canOpenFile = isExistingFile(result.filePath);
			const localeLabel = canOpenFile
				? buildOpenLocaleCommandLink({
						label: `\`${result.localeName}\``,
						filePath: result.filePath,
						key: result.key,
				  })
				: `\`${result.localeName}\``;
			const valueLabel = result.exist && canOpenFile
				? buildOpenLocaleCommandLink({
						label: String(result.value),
						filePath: result.filePath,
						key: result.key,
				  })
				: result.exist
				? String(result.value)
				: `**${missingTranslationText}**`;
			const sourceLabel = isDefaultLocalesPathFallback(result)
				? ` **${defaultLocalesPathFallbackBadge}**`
				: "";

			return `* _${localeLabel}_${sourceLabel}&nbsp;&nbsp;${valueLabel}`;
		})
		.join("\n");
	const markdown = new MarkdownString(message);
	markdown.isTrusted = true;
	return markdown;
};

/**
 * 鼠标悬停提示，当鼠标停在xxx.vue/xxx.js时，
 * 自动显示对应语言国际化的value
 * @param document The document in which the commandT was invoked.
 * @param position The position at which the command was invoked.
 * @param token A cancellation token.
 * @return A hover or a thenable that resolves to such. The lack of a result can be
 * signaled by returning `undefined` or `null`.
 */
const provideHover = (document, position, token) => {
	const lineNum = position.line;
	const lineText = document.lineAt(lineNum).text;
	const { fsPath } = document.uri;

	const { i18nValueHover } = getCustomSetting(fsPath, [
		"i18nValueHover"
	]);
	if (i18nValueHover) {
		const text = document.getText();
		const { scopedTranslateFunctionNames } = getCustomSetting(fsPath, [
			"scopedTranslateFunctionNames",
		]);
		const scopedTranslateScopes = getScopedTranslateScopes(
			text,
			scopedTranslateFunctionNames,
		);
		const extraCallers = [
			...Object.keys(scopedTranslateScopes),
			...getUseI18nTranslateCallers(text),
		];
		const match = getI18nKeyMatches(lineText, extraCallers).find(
			({ index, length }) =>
				position.character >= index && position.character <= index + length,
		);
		if (match) {
			const msg = getHoverMsg(
				resolveLocaleValues(document, match.key, match.caller),
			);

			return new Hover(msg);
		}
	}
};

module.exports = {
	provideHover
};
