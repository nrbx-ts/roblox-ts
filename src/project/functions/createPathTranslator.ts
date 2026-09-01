import path from 'node:path';
import { PathTranslator } from '@roblox-ts/path-translator';
import type { ProjectData } from 'shared/types';
import { findAncestorDir } from 'shared/util/findAncestorDir';
import { getRootDirs } from 'shared/util/getRootDirs';
import * as ts from 'typescript/sync';

export function createPathTranslator(program: ts.BuilderProgram, data: ProjectData) {
	const compilerOptions = program.getCompilerOptions();
	const rootDir = findAncestorDir([program.getProgram().getCommonSourceDirectory(), ...getRootDirs(compilerOptions)]);
	const outDir = compilerOptions.outDir!;
	let buildInfoPath = ts.getTsBuildInfoEmitOutputFilePath(compilerOptions);
	if (buildInfoPath !== undefined) {
		buildInfoPath = path.normalize(buildInfoPath);
	}
	const declaration = compilerOptions.declaration === true;
	return new PathTranslator(rootDir, outDir, buildInfoPath, declaration, data.projectOptions.luau);
}
