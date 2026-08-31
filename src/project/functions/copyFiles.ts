import type { PathTranslator } from '@roblox-ts/path-translator';
import { copyItem } from 'project/functions/copyItem';
import type { ProjectData } from 'shared/types';
import { benchmarkIfVerbose } from 'shared/util/benchmark';

export function copyFiles(data: ProjectData, pathTranslator: PathTranslator, sources: Set<string>) {
	benchmarkIfVerbose('copy non-compiled files', () => {
		for (const source of sources) {
			copyItem(data, pathTranslator, source);
		}
	});
}
