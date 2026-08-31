import { getChangedFilePaths } from 'project/functions/getChangedFilePaths';
import ts from 'typescript';

export function getChangedSourceFiles(program: ts.BuilderProgram, pathHints?: Array<string>) {
	const sourceFiles: ts.SourceFile[] = [];
	for (const fileName of getChangedFilePaths(program, pathHints)) {
		const sourceFile = program.getSourceFile(fileName);
		if (sourceFile && !sourceFile.isDeclarationFile && !ts.isJsonSourceFile(sourceFile)) {
			sourceFiles.push(sourceFile);
		}
	}
	return sourceFiles;
}
