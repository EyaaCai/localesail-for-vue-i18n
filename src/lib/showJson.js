const {
	Range,
	workspace,
	window,
	executeCommand,
	OverviewRulerLane
} = require("../utils/vs");
const { getI18nKeyMatches } = require("../utils/regex");
const {
	getLocales,
	getEditor,
	getCustomSetting,
	getLocaleValueByKey,
	showMessage
} = require("../utils");
const { defaultStyle, errorStyle, operation } = require("../utils/constant");
const flatten = require("flat");
const fs = require("fs");
const Puid = require("puid");
const puid = new Puid();

let decorationTypesList = {};
let activeEditor;
let refreshTimer;
let isChangeListenerRegistered = false;

const clearDecorations = () => {
	Object.keys(decorationTypesList).forEach(v => {
		decorationTypesList[v].dispose();
	});
	decorationTypesList = {};
};

const updateDecorations = (currentEditor, { showNotice = true } = {}) => {
	clearDecorations();
	const text = currentEditor.document.getText();
	const documentVersion = currentEditor.document.version;
	const defaultLocalesPath = getCustomSetting(
		currentEditor.document.uri.fsPath,
		"defaultLocalesPath"
	);
	const { localesPath, exist } = getLocales({
		fsPath: currentEditor.document.uri.fsPath,
		defaultLocalesPath,
		showInfo: false,
		showError: true
	});
	if (!exist) return;
	fs.readFile(localesPath, (err, data) => {
		if (!err) {
			if (currentEditor.document.version !== documentVersion) return;
			const i18nObj = !!data.toString() ? JSON.parse(data.toString()) : {};
			const localeObj = flatten(i18nObj);
			const matches = {};
			const defaultStyleForRegExp = Object.assign({}, defaultStyle, {
				overviewRulerLane: OverviewRulerLane.Right
			});
			const errorStyleForRegExp = Object.assign({}, errorStyle, {
				overviewRulerLane: OverviewRulerLane.Right
			});
			// 重置 decorationTypes
			const decorationTypes = {};
			getI18nKeyMatches(text).forEach(({ key, index, length }) => {
				const { exist, value: contentText } = getLocaleValueByKey(localeObj, key);
				const startPos = currentEditor.document.positionAt(index);
				const endPos = currentEditor.document.positionAt(index + length);
				const styleForRegExp = exist
					? defaultStyleForRegExp
					: errorStyleForRegExp;
				const decoration = {
					range: new Range(startPos, endPos),
					renderOptions: {
						after: {
							color: exist?"rgba(153,153,153,0.8)":"red",
							contentText: ` ➟ ${contentText}`,
							fontWeight: "normal",
							fontStyle: "italic",
							// textDecoration: `underline solid ${contentText ? "green" : "red"}`
						}
					}
				};

				//重复的可以被显示
				const id = puid.generate();
				if (matches[id]) {
					matches[id].push(decoration);
				} else {
					matches[id] = [decoration];
				}
				matches[id] = [decoration];
				decorationTypes[id] = window.createTextEditorDecorationType(
					styleForRegExp
				);
			});
			const types = Object.keys(decorationTypes);
			if (types.length === 0) {
				showNotice && showMessage({
					message: `
                There are no matching values ​​in: ${localesPath}`,
					editor: currentEditor,
					file: localesPath,
					callback: {
						func: () => executeCommand(operation.replaceWithI18nKeys.cmd),
						name: operation.replaceWithI18nKeys.title
					}
				});
			} else {
				types.forEach((v, p) => {
					const decorationType = decorationTypes[v];
					decorationTypesList[v] = decorationTypes[v];
					const message =
						operation.showI18n.title + " success with: " + localesPath;
					currentEditor.setDecorations(decorationType, matches[v]);
					if (showNotice && p === types.length - 1) {
						showMessage({
							message,
							file: localesPath,
							editor: currentEditor
						});
					}
				});
			}
		}
	});
};

module.exports = ({ editor, context }) => {
	let currentEditor = getEditor(editor);
	if (!currentEditor) return;
	activeEditor = currentEditor;
	updateDecorations(currentEditor);
	//修改重置编辑器
	if (isChangeListenerRegistered) return;
	isChangeListenerRegistered = true;
	workspace.onDidChangeTextDocument(
		event => {
			if (!activeEditor || event.document !== activeEditor.document) {
				return;
			}
			if (refreshTimer) {
				clearTimeout(refreshTimer);
			}
			refreshTimer = setTimeout(() => {
				if (activeEditor && event.document === activeEditor.document) {
					updateDecorations(activeEditor, { showNotice: false });
				}
			}, 200);
		},
		null,
		context.subscriptions
	);
};
