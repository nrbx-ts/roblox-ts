import fs from 'node:fs';

export function realPathExistsSync(fsPath: string) {
	if (fs.existsSync(fsPath)) {
		return fs.realpathSync(fsPath);
	}
}
