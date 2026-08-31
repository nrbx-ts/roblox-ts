import fs from 'node:fs';
import type { PathTranslator } from '@roblox-ts/path-translator';
import { LogService } from 'shared/classes/LogService';
import { DTS_EXT } from 'shared/constants';

function isOutputFileOrphaned(pathTranslator: PathTranslator, filePath: string) {
	if (filePath.endsWith(DTS_EXT) && !pathTranslator.declaration) {
		return true;
	}

	for (const path of pathTranslator.getInputPaths(filePath)) {
		if (fs.existsSync(path)) {
			return false;
		}
	}

	if (pathTranslator.buildInfoOutputPath === filePath) {
		return false;
	}

	return true;
}

export function tryRemoveOutput(pathTranslator: PathTranslator, outPath: string) {
	if (isOutputFileOrphaned(pathTranslator, outPath)) {
		fs.rmSync(outPath, { recursive: true, force: true });
		LogService.writeLineIfVerbose(`remove ${outPath}`);
	}
}
