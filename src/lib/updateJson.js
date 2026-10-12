const {
	openFileByPath,
	getPrefix,
	getLocales,
	getValueFromDotString,
	getEditor,
	showMessage,
	getCustomSetting
} = require("../utils");
const {  operation } = require("../utils/constant");
const unflatten = require("unflatten");
const fs = require("fs");
const path = require("path");
const mkdir = require("mkdirp");
const retrieveCN = require("../utils/retrieveCN");
const {
	msg,
	Position,
	Range,
} = require("../utils/vs");
const { unescapeStringLiteral } = require("../utils/interpolation");

const mergeExtractedEntries = (existing, entries) => {
	Object.keys(entries).forEach(v => {
		Object.keys(existing).forEach(p => {
			if (unescapeStringLiteral(existing[p]) === entries[v]) {
				delete existing[p];
			}
		});
		existing[v] = entries[v];
	});
	return existing;
};

const tipBeforeWriteJson = (currentEditor, localesPath) => {
	const { notAlertBeforeUpdateI18n, hashLength } = getCustomSetting(
		currentEditor.document.uri.fsPath,
		["notAlertBeforeUpdateI18n", "hashLength"]
	);
	if (notAlertBeforeUpdateI18n) {
		writeJson(currentEditor, localesPath, { hashLength });
	} else {
		msg
			.info(
				`${operation.updateI18n.title} will update the key which has same value in: \n${localesPath}`,
				{ modal: true },
				"OK", //此处的顺序位置 对应 enter的响应
				"View it"
			)
			.then(result => {
				if (result === "View it") {
					openFileByPath(localesPath, {
						selection: new Range(new Position(0, 0), new Position(0, 0)),
						preview: false,
						viewColumn: currentEditor.viewColumn + 1
					});
				}
				if (result === "OK") {
					writeJson(currentEditor, localesPath, { hashLength });
				}
			});
	}
};
const writeJson = (currentEditor, localesPath, keyOptions) => {
	const prefix = getPrefix(currentEditor);
	const { useCompactPathMode } = getCustomSetting(
		currentEditor.document.uri.fsPath,
		["useCompactPathMode"]
	);

	fs.readFile(localesPath, (err, data) => {
		let _data;
		if (err) {
			_data = {};
		} else {
			_data = !data.toString() ? {} : JSON.parse(data.toString());
		}

		let temp = _data[prefix] ||
			(useCompactPathMode ? null : getValueFromDotString(_data, prefix));
		const linesObj = retrieveCN(currentEditor, {
			...keyOptions,
			existingKeys: temp ? Object.keys(temp) : []
		});

		if (Object.keys(linesObj).length !== 0) {
			//已存在 => 智能替换（1.相同val时(含提取转义还原后相同)，新的key,val替换原来的key,val。2.不同val时，保存新增key,val和原有的key,val,）
			if (!temp || Object.keys(temp).length === 0) {
				temp = linesObj;
			} else {
				temp = mergeExtractedEntries(temp, linesObj);
			}

			if (useCompactPathMode) {
				_data[prefix] = temp;
			} else {
				// 保持原有逻辑，不支持层级直接赋值
				_data[prefix] = temp;
			}
		} else {
			showMessage({
				message: "There are no Chinese match in :",
				file: localesPath,
				needOpen: false
			});
			return;
		}
		console.log('Final Data Keys Before Stringify:', Object.keys(_data));
		let str = JSON.stringify(_data, null, 4);
		fs.writeFile(localesPath, str, err => {
			if (!err) {
				showMessage({
					message: `${operation.updateI18n.title} Success : ${localesPath}`,
					file: localesPath,
					editor: currentEditor
				});
			}
		});
	});
};

module.exports = ({ editor, context }) => {
	let currentEditor = getEditor(editor);
	if (!currentEditor) return;
	const defaultLocalesPath = getCustomSetting(
		currentEditor.document.uri.fsPath,
		"defaultLocalesPath"
	);
	const { localesPath, exist } = getLocales({
		fsPath: currentEditor.document.uri.fsPath,
		defaultLocalesPath,
		showError: false,
		showInfo: false
	});
	if (!exist) {
		mkdir(path.dirname(localesPath), () => {
			tipBeforeWriteJson(currentEditor, localesPath);
		});
	} else {
		tipBeforeWriteJson(currentEditor, localesPath);
	}
};

module.exports._private = { mergeExtractedEntries };
