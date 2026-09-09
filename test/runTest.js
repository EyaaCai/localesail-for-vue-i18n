const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const { runTests } = require('vscode-test');

const getCodeExecutableFromPath = () => {
	if (process.platform !== 'win32') return null;

	try {
		const codeCommand = childProcess
			.execFileSync('where.exe', ['code'], { encoding: 'utf8' })
			.split(/\r?\n/)
			.map(line => line.trim())
			.find(Boolean);
		if (!codeCommand) return null;

		const executablePath = path.resolve(
			path.dirname(codeCommand),
			'..',
			'Code.exe'
		);
		return fs.existsSync(executablePath) ? executablePath : null;
	} catch (err) {
		return null;
	}
};

const resolveVSCodeExecutablePath = () => {
	const configuredPath = process.env.VSCODE_EXECUTABLE_PATH;
	const candidates = [
		configuredPath,
		getCodeExecutableFromPath(),
		process.platform === 'win32'
			? path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe')
			: null,
		process.platform === 'win32'
			? path.join(process.env.ProgramFiles || '', 'Microsoft VS Code', 'Code.exe')
			: null,
	].filter(Boolean);

	return candidates.find(candidate => fs.existsSync(candidate)) || null;
};

async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to the extension test script
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');
		const vscodeExecutablePath = resolveVSCodeExecutablePath();

		if (!vscodeExecutablePath) {
			throw new Error(
				'未找到本机 VS Code。请设置 VSCODE_EXECUTABLE_PATH 后再运行测试。'
			);
		}

		// Use an existing local VS Code installation. This test entry never downloads VS Code.
		const testDataDir = path.resolve(__dirname, '../.vscode-test/user-data');
		const testExtensionsDir = path.resolve(__dirname, '../.vscode-test/extensions');
		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			vscodeExecutablePath,
			launchArgs: [
				`--user-data-dir=${testDataDir}`,
				`--extensions-dir=${testExtensionsDir}`,
			],
		});
	} catch (err) {
		console.error(err && err.message ? err.message : 'Failed to run tests');
		process.exit(1);
	}
}

main();
