const vscode = require('vscode');
module.exports = {
	msg: {
		info: vscode.window.showInformationMessage, //消息通知
		warn: vscode.window.showWarningMessage, //警告通知
		error: vscode.window.showErrorMessage, //错误通知
	},
	registerCommand: vscode.commands.registerCommand, //注册命令
	executeCommand: vscode.commands.executeCommand, //注册命令
	file: vscode.Uri.file, //获取文件
	open: vscode.window.showTextDocument, //在Editor打开对应路径的文件,
	Range: vscode.Range,
	Position: vscode.Position,
	Selection: vscode.Selection,
	ViewColumn: vscode.ViewColumn,
	workspace: vscode.workspace,
	window: vscode.window,
	languages: vscode.languages,
	OverviewRulerLane: vscode.OverviewRulerLane,
	registerHoverProvider: vscode.languages.registerHoverProvider,
	registerInlayHintsProvider: vscode.languages.registerInlayHintsProvider,
	EventEmitter: vscode.EventEmitter,
	Hover: vscode.Hover,
	InlayHint: vscode.InlayHint,
	InlayHintKind: vscode.InlayHintKind,
	MarkdownString: vscode.MarkdownString,
	WorkspaceEdit: vscode.WorkspaceEdit,
};
