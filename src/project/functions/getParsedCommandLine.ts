import inspector from 'node:inspector';
import type { ProjectData } from 'project';
import { validateCompilerOptions } from 'project/functions/validateCompilerOptions';
import { DiagnosticError } from 'shared/errors/DiagnosticError';
import { ProjectError } from 'shared/errors/ProjectError';
import ts from 'typescript';

function createParseConfigFileHost(): ts.ParseConfigFileHost {
	return {
		fileExists: ts.sys.fileExists,
		getCurrentDirectory: ts.sys.getCurrentDirectory,
		onUnRecoverableConfigFileDiagnostic: (d) => {
			throw new DiagnosticError([d]);
		},
		readDirectory: ts.sys.readDirectory,
		readFile: ts.sys.readFile,
		useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
	};
}

export function getParsedCommandLine(data: ProjectData) {
	const parsedCommandLine = ts.getParsedCommandLineOfConfigFile(data.tsConfigPath, {}, createParseConfigFileHost());
	if (parsedCommandLine === undefined) {
		throw new ProjectError('Unable to load TS program!');
	} else if (parsedCommandLine.errors.length > 0) {
		throw new DiagnosticError(parsedCommandLine.errors);
	}

	validateCompilerOptions(parsedCommandLine.options, data.projectPath);
	return parsedCommandLine;
}
