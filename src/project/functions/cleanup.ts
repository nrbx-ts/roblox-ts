import fs from 'node:fs';
import path from 'node:path';
import type { PathTranslator } from '@roblox-ts/path-translator';
import { tryRemoveOutput } from 'project/functions/tryRemoveOutput';

function cleanupDirRecursively(pathTranslator: PathTranslator, dir: string) {
	if (fs.existsSync(dir)) {
		for (const name of fs.readdirSync(dir)) {
			const itemPath = path.join(dir, name);
			if (fs.statSync(itemPath).isDirectory()) {
				if (name === '.git') {
					continue;
				}
				cleanupDirRecursively(pathTranslator, itemPath);
			}
			tryRemoveOutput(pathTranslator, itemPath);
		}
	}
}

export function cleanup(pathTranslator: PathTranslator) {
	const outDir = pathTranslator.outDir;
	if (fs.existsSync(outDir)) {
		cleanupDirRecursively(pathTranslator, outDir);
	}
}
