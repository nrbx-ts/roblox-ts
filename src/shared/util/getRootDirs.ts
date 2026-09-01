import { assert } from 'shared/util/assert';
import type * as ts from 'typescript/sync';

export function getRootDirs(compilerOptions: ts.CompilerOptions) {
	const rootDirs = compilerOptions.rootDir ? [compilerOptions.rootDir] : compilerOptions.rootDirs;
	assert(rootDirs);
	return rootDirs;
}
