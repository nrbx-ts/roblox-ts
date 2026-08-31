import fs from 'fs-extra';
import { INCLUDE_PATH, ProjectType } from 'shared/constants';
import type { ProjectData } from 'shared/types';
import { benchmarkIfVerbose } from 'shared/util/benchmark';

export function copyInclude(data: ProjectData) {
	if (
		!data.projectOptions.noInclude &&
		data.projectOptions.type !== ProjectType.Package &&
		!(data.projectOptions.type === undefined && data.isPackage)
	) {
		benchmarkIfVerbose('copy include files', () =>
			fs.copySync(INCLUDE_PATH, data.projectOptions.includePath, { dereference: true })
		);
	}
}
