import * as ts from 'typescript/sync';

export function createReadBuildProgramHost() {
	return {
		getCurrentDirectory: ts.sys.getCurrentDirectory,
		readFile: ts.sys.readFile,
		useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
	};
}
