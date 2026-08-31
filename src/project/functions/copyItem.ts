import fs from 'node:fs';
import type { PathTranslator } from '@roblox-ts/path-translator';
import type { ProjectData } from 'project';
import { isCompilableFile } from 'project/util/isCompilableFile';
import { DTS_EXT } from 'shared/constants';

export function copyItem(data: ProjectData, pathTranslator: PathTranslator, item: string) {
	fs.cpSync(item, pathTranslator.getOutputPath(item), {
		recursive: true,
		filter: (src, dest) => {
			if (
				data.projectOptions.writeOnlyChanged &&
				fs.existsSync(dest) &&
				!fs.lstatSync(src).isDirectory() &&
				fs.readFileSync(src, 'utf8') === fs.readFileSync(dest, 'utf8')
			) {
				return false;
			}

			if (src.endsWith(DTS_EXT)) {
				return pathTranslator.declaration;
			}

			return !isCompilableFile(src);
		},
		dereference: true,
	});
}
