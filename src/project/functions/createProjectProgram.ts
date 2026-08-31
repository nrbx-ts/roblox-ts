import { createProgramFactory } from 'project/functions/createProgramFactory';
import { getParsedCommandLine } from 'project/functions/getParsedCommandLine';
import type { ProjectData } from 'shared/types';
import type ts from 'typescript';

export function createProjectProgram(data: ProjectData, host?: ts.CompilerHost) {
	const { fileNames, options } = getParsedCommandLine(data);
	const createProgram = createProgramFactory(data, options);
	return createProgram(fileNames, options, host);
}
