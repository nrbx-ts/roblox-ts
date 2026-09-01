import fs from 'node:fs';
import type { ProjectData } from 'project';
import { createReadBuildProgramHost } from 'project/util/createReadBuildProgramHost';
import { COMPILER_VERSION } from 'shared/constants';
import { assert } from 'shared/util/assert';
import * as ts from 'typescript/sync';

function createCompilerHost(data: ProjectData, compilerOptions: ts.CompilerOptions) {
	const host = ts.createIncrementalCompilerHost(compilerOptions);

	let contentsToHash = '';
	contentsToHash += `version=${COMPILER_VERSION},`;
	contentsToHash += `type=${String(data.projectOptions.type)},`;
	contentsToHash += `isPackage=${String(data.isPackage)},`;
	contentsToHash += `plugins=${JSON.stringify(compilerOptions.plugins ?? [])},`;

	if (data.rojoConfigPath && fs.existsSync(data.rojoConfigPath)) {
		contentsToHash += fs.readFileSync(data.rojoConfigPath, 'utf8');
	}

	assert(host.createHash);
	const origCreateHash = host.createHash;
	host.createHash = (data: string) => origCreateHash(contentsToHash + data);

	return host;
}

export function createProgramFactory(
	data: ProjectData,
	options: ts.CompilerOptions
): ts.CreateProgram<ts.EmitAndSemanticDiagnosticsBuilderProgram> {
	return (
		rootNames: ReadonlyArray<string> | undefined,
		compilerOptions: ts.CompilerOptions | undefined = options,
		host = createCompilerHost(data, options),
		oldProgram = ts.readBuilderProgram(options, createReadBuildProgramHost())
	) => ts.createEmitAndSemanticDiagnosticsBuilderProgram(rootNames ?? [], compilerOptions, host, oldProgram);
}
