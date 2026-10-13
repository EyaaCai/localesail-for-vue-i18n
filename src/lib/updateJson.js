const {
	openFileByPath,
	getPrefix,
	getLocales,
	getProjectRoot,
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
	WorkspaceEdit,
	workspace,
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

const writeJson = async (
	currentEditor,
	localesPath,
	{ hashLength, headless = false, dryRun = false, finish = () => {} } = {}
) => {
	const { useCompactPathMode } = getCustomSetting(
		currentEditor.document.uri.fsPath,
		["useCompactPathMode"]
	);
	if (
		headless &&
		useCompactPathMode &&
		!getProjectRoot(
			currentEditor.document.uri.fsPath,
			currentEditor.document.uri
		)
	) {
		// 不静默降级：前缀算不出完整路径时明确报错，避免写出不完整的 key
		finish({
			ok: false,
			error: "no-project-root",
			hint: "目标文件向上找不到 package.json，无法确定 key 前缀；请将文件所在项目加入工作区或确认路径"
		});
		return;
	}
	const prefix = getPrefix(currentEditor);

	let _data = {};
	if (fs.existsSync(localesPath)) {
		const localesDocument = await workspace.openTextDocument(localesPath);
		const text = localesDocument.getText();
		if (text) {
			try {
				_data = JSON.parse(text);
			} catch (e) {
				finish({ ok: false, error: "locales-json-invalid", localesPath });
				return;
			}
		}
	}

	let temp = _data[prefix] ||
		(useCompactPathMode ? null : getValueFromDotString(_data, prefix));
	const linesObj = retrieveCN(currentEditor, {
		hashLength,
		existingKeys: temp ? Object.keys(temp) : []
	});

	if (Object.keys(linesObj).length === 0) {
		if (headless) {
			finish({ ok: false, error: "no-chinese-found", localesPath });
		} else {
			showMessage({
				message: "There are no Chinese match in :",
				file: localesPath,
				needOpen: false
			});
		}
		return;
	}

	//已存在 => 智能替换（1.相同val时(含提取转义还原后相同)，新的key,val替换原来的key,val。2.不同val时，保存新增key,val和原有的key,val,）
	if (!temp || Object.keys(temp).length === 0) {
		temp = linesObj;
	} else {
		temp = mergeExtractedEntries(temp, linesObj);
	}
	_data[prefix] = temp;

	if (dryRun) {
		finish({
			ok: true,
			dryRun: true,
			localesPath,
			prefix,
			totalEntries: Object.keys(temp).length,
			newEntries: linesObj
		});
		return;
	}

	console.log('Final Data Keys Before Stringify:', Object.keys(_data));
	const str = JSON.stringify(_data, null, 4);

	if (fs.existsSync(localesPath)) {
		// 已存在的语言包走编辑器 API 全量替换，避免绕过文档模型造成保存冲突
		const localesDocument = await workspace.openTextDocument(localesPath);
		const edit = new WorkspaceEdit();
		const lastLine = localesDocument.lineAt(
			Math.max(localesDocument.lineCount - 1, 0)
		);
		edit.replace(
			localesDocument.uri,
			new Range(new Position(0, 0), lastLine.range.end),
			str
		);
		const applied = await workspace.applyEdit(edit);
		if (!applied) {
			finish({ ok: false, error: "apply-edit-failed", localesPath });
			return;
		}
		const saved = await localesDocument.save();
		if (!saved) {
			finish({ ok: false, error: "save-failed", localesPath });
			return;
		}
	} else {
		try {
			fs.writeFileSync(localesPath, str, "utf8");
		} catch (e) {
			finish({ ok: false, error: "write-failed", localesPath });
			return;
		}
	}

	finish({
		ok: true,
		localesPath,
		prefix,
		totalEntries: Object.keys(temp).length,
		newEntries: linesObj
	});

	if (!headless) {
		showMessage({
			message: `${operation.updateI18n.title} Success : ${localesPath}`,
			file: localesPath,
			editor: currentEditor
		});
	}
};

const tipBeforeWriteJson = (currentEditor, localesPath, options = {}) => {
	const { notAlertBeforeUpdateI18n, hashLength } = getCustomSetting(
		currentEditor.document.uri.fsPath,
		["notAlertBeforeUpdateI18n", "hashLength"]
	);
	const writeOptions = Object.assign({}, options, { hashLength });
	if (notAlertBeforeUpdateI18n || options.headless) {
		writeJson(currentEditor, localesPath, writeOptions);
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
					writeJson(currentEditor, localesPath, writeOptions);
				}
			});
	}
};

module.exports = ({ editor, context, headless = false, dryRun = false }) => {
	let finishHeadless = null;
	const headlessResult = headless
		? new Promise((resolve) => {
			finishHeadless = resolve;
		})
		: null;
	const finish = (payload) => {
		if (finishHeadless) finishHeadless(payload);
	};

	let currentEditor = getEditor(editor);
	if (!currentEditor) {
		finish({ ok: false, error: "unsupported-document" });
		return headlessResult;
	}
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
	const writeOptions = { headless, dryRun, finish };
	if (!exist) {
		mkdir(path.dirname(localesPath), () => {
			tipBeforeWriteJson(currentEditor, localesPath, writeOptions);
		});
	} else {
		tipBeforeWriteJson(currentEditor, localesPath, writeOptions);
	}
	return headlessResult;
};

module.exports._private = { mergeExtractedEntries };
