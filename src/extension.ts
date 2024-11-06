import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

interface BlameInfo {
	hash: string;
	author: string;
	date: string;
	message: string;
	lineNumber: number;
}

class GitBlameProvider {
	private enabled: boolean = true;
	private decorationType: vscode.TextEditorDecorationType;
	private cache: Map<string, BlameInfo[]> = new Map();
	private statusBarItem: vscode.StatusBarItem;

	constructor() {
		this.decorationType = vscode.window.createTextEditorDecorationType({
			after: {
				margin: '0 0 0 1em',
				color: new vscode.ThemeColor('editorGutter.commentRangeForeground')
			}
		});

		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left
		);
		this.statusBarItem.text = "$(git-commit) Git Blame";
		this.statusBarItem.command = 'pure-git-blame.toggle';
		this.statusBarItem.show();
	}

	private async isGitRepository(filePath: string): Promise<boolean> {
		try {
			const { stdout } = await execAsync('git rev-parse --git-dir', {
				cwd: path.dirname(filePath)
			});
			return !!stdout;
		} catch {
			return false;
		}
	}

	private async isGitInstalled(): Promise<boolean> {
		try {
			await execAsync('git --version');
			return true;
		} catch {
			return false;
		}
	}

	private async fileExists(filePath: string): Promise<boolean> {
		try {
			await fs.promises.access(filePath, fs.constants.F_OK);
			return true;
		} catch {
			return false;
		}
	}

	async getGitBlame(filePath: string): Promise<BlameInfo[]> {
		try {
			if (!await this.fileExists(filePath)) {
				throw new Error('File does not exist');
			}

			if (!await this.isGitInstalled()) {
				throw new Error('Git is not installed');
			}

			if (!await this.isGitRepository(filePath)) {
				throw new Error('Not a git repository');
			}

			const { stdout } = await execAsync(
				`git blame --line-porcelain "${filePath}"`,
				{ cwd: path.dirname(filePath) }
			);
			return this.parseBlameOutput(stdout);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			this.showError(errorMessage);
			return [];
		}
	}

	private showError(message: string) {
		if (message === 'Not a git repository' && this.cache.has('error_shown')) {
			return;
		}
		if (/.*is outside repository.*/.test(message)) {
			return;
		}

		this.cache.set('error_shown', []);

		switch (message) {
			case 'Git is not installed':
				vscode.window.showErrorMessage(
					'Git is not installed. Please install Git to use blame features.'
				);
				break;
			case 'Not a git repository':
				this.statusBarItem.text = "$(git-commit) Not a Git Repository";
				this.statusBarItem.tooltip = "Current file is not in a Git repository";
				break;
			case 'File does not exist':
				break;
			default:
				vscode.window.showErrorMessage(`Git blame error: ${message}`);
		}
	}

	private parseBlameOutput(output: string): BlameInfo[] {
		const lines = output.split('\n');
		const blame: BlameInfo[] = [];
		let currentBlame: Partial<BlameInfo> = {};
		let lineNumber = 0;

		lines.forEach(line => {
			if (line.startsWith('author ')) {
				currentBlame.author = line.substring(7);
			} else if (line.startsWith('author-time ')) {
				const timestamp = parseInt(line.substring(12));
				currentBlame.date = new Date(timestamp * 1000).toISOString().split('T')[0];
			} else if (line.startsWith('summary ')) {
				currentBlame.message = line.substring(8);
			} else if (line.match(/^[0-9a-f]{40}/)) {
				currentBlame.hash = line.substring(0, 40);
				lineNumber++;
				currentBlame.lineNumber = lineNumber;
				blame.push(currentBlame as BlameInfo);
				currentBlame = {};
			}
		});

		return blame;
	}

	async updateDecorations(editor: vscode.TextEditor) {
		if (!this.enabled || !editor) {
			return;
		}

		// 清除现有装饰
		this.clear();

		const filePath = editor.document.uri.fsPath;

		// 获取当前选中的行
		const selections = editor.selections;
		if (!selections.length) {
			return;
		}

		// 获取所有选中的行号
		const selectedLines = new Set<number>();
		selections.forEach(selection => {
			for (let line = selection.start.line; line <= selection.end.line; line++) {
				selectedLines.add(line);
			}
		});

		// 如果没有选中任何行，返回
		if (selectedLines.size === 0) {
			return;
		}

		// 跳过未保存和非文件内容
		if (editor.document.isUntitled || editor.document.uri.scheme !== 'file') {
			return;
		}

		let blame = this.cache.get(filePath);

		if (!blame) {
			blame = await this.getGitBlame(filePath);
			if (blame.length > 0) {
				this.cache.set(filePath, blame);
			}
		}

		// 只显示选中行的 blame 信息
		const decorations: vscode.DecorationOptions[] = blame
			.filter(info => selectedLines.has(info.lineNumber - 1))
			.map(info => ({
				range: editor.document.lineAt(info.lineNumber - 1).range,
				renderOptions: {
					after: {
						contentText: `  ${info.author} • ${info.date}`,
					}
				},
				hoverMessage: new vscode.MarkdownString(
					`**Commit:** ${info.hash}\n\n` +
					`**Author:** ${info.author}\n\n` +
					`**Date:** ${info.date}\n\n` +
					`**Message:** ${info.message}`
				)
			}));

		editor.setDecorations(this.decorationType, decorations);

		// 更新状态栏
		if (blame.length > 0) {
			this.statusBarItem.text = "$(git-commit) Git Blame";
			this.statusBarItem.tooltip = "Click to toggle Git blame";
		}
	}

	toggle() {
		this.enabled = !this.enabled;
		if (this.enabled) {
			this.updateDecorations(vscode.window.activeTextEditor!);
		} else {
			this.clear();
		}
		this.statusBarItem.text = this.enabled ?
			"$(git-commit) Git Blame" :
			"$(git-commit) Git Blame (Off)";
	}

	clear() {
		if (vscode.window.activeTextEditor) {
			vscode.window.activeTextEditor.setDecorations(this.decorationType, []);
		}
	}

	dispose() {
		this.decorationType.dispose();
		this.statusBarItem.dispose();
	}
}

export function activate(context: vscode.ExtensionContext) {
	const blameProvider = new GitBlameProvider();

	// 注册命令
	context.subscriptions.push(
		vscode.commands.registerCommand('pure-git-blame.toggle', () => {
			blameProvider.toggle();
		})
	);

	// 监听选择变化
	context.subscriptions.push(
		vscode.window.onDidChangeTextEditorSelection(event => {
			if (event.textEditor) {
				blameProvider.updateDecorations(event.textEditor);
			}
		})
	);

	// 监听活动编辑器变化
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor) {
				blameProvider.updateDecorations(editor);
			}
		})
	);

	// 监听文档变化
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(event => {
			const editor = vscode.window.activeTextEditor;
			if (editor && event.document === editor.document) {
				blameProvider.updateDecorations(editor);
			}
		})
	);

	// 初始化显示
	if (vscode.window.activeTextEditor) {
		blameProvider.updateDecorations(vscode.window.activeTextEditor);
	}
}

export function deactivate() { }
