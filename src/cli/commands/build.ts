import fs from 'node:fs';
import path from 'node:path';
import { type ArgsDef, defineCommand } from 'citty';
import { CLIError } from 'cli/errors/CLIError';
import { cleanup } from 'project/functions/cleanup';
import { compileFiles } from 'project/functions/compileFiles';
import { copyFiles } from 'project/functions/copyFiles';
import { copyInclude } from 'project/functions/copyInclude';
import { createPathTranslator } from 'project/functions/createPathTranslator';
import { createProjectData } from 'project/functions/createProjectData';
import { createProjectProgram } from 'project/functions/createProjectProgram';
import { getChangedSourceFiles } from 'project/functions/getChangedSourceFiles';
import { setupProjectWatchProgram } from 'project/functions/setupProjectWatchProgram';
import { LogService } from 'shared/classes/LogService';
import { DEFAULT_PROJECT_OPTIONS, ProjectType } from 'shared/constants';
import { LoggableError } from 'shared/errors/LoggableError';
import type { ProjectOptions } from 'shared/types';
import { getRootDirs } from 'shared/util/getRootDirs';
import { hasErrors } from 'shared/util/hasErrors';
import ts from 'typescript';

function getTsConfigProjectOptions(tsConfigPath?: string): Partial<ProjectOptions> | undefined {
	if (tsConfigPath !== undefined) {
		const rawJson = ts.sys.readFile(tsConfigPath);
		if (rawJson !== undefined) {
			return ts.parseConfigFileTextToJson(tsConfigPath, rawJson).config.rbxts;
		}
	}
}

function findTsConfigPath(projectPath: string) {
	let tsConfigPath: string | undefined = path.resolve(projectPath);
	if (!fs.existsSync(tsConfigPath) || !fs.statSync(tsConfigPath).isFile()) {
		tsConfigPath = ts.findConfigFile(tsConfigPath, ts.sys.fileExists);
		if (tsConfigPath === undefined) {
			throw new CLIError('Unable to find tsconfig.json!');
		}
	}
	return path.resolve(process.cwd(), tsConfigPath);
}

export const buildArgs = {
	project: {
		type: 'string',
		alias: 'p',
		default: '.',
		description: 'project path',
		valueHint: 'path',
	},
	// DO NOT PROVIDE DEFAULTS BELOW HERE, USE DEFAULT_PROJECT_OPTIONS
	watch: {
		type: 'boolean',
		alias: 'w',
		description: 'enable watch mode',
	},
	verbose: {
		type: 'boolean',
		description: 'enable verbose logs',
	},
	noInclude: {
		type: 'boolean',
		description: 'do not copy include files',
	},
	logTruthyChanges: {
		type: 'boolean',
		description: 'logs changes to truthiness evaluation from Lua truthiness rules',
	},
	writeOnlyChanged: {
		type: 'boolean',
		description: 'only writes files that changed since the last build',
	},
	writeTransformedFiles: {
		type: 'boolean',
		description: 'writes resulting TypeScript ASTs after transformers to out directory',
	},
	optimizedLoops: {
		type: 'boolean',
		description: 'enables optimized loop transformations',
	},
	type: {
		type: 'enum',
		options: [ProjectType.Game, ProjectType.Model, ProjectType.Package],
		description: 'override project type',
	},
	includePath: {
		type: 'string',
		alias: 'i',
		description: 'folder to copy runtime files to',
		valueHint: 'path',
	},
	rojo: {
		type: 'string',
		description: 'manually select Rojo project file',
		valueHint: 'path',
	},
	allowCommentDirectives: {
		type: 'boolean',
		description: 'allows comment directives in source files',
	},
	luau: {
		type: 'boolean',
		description: 'emit files with .luau extension',
	},
} satisfies ArgsDef;

/**
 * Defines the behavior for the `rbxtsc build` command.
 */
export const buildCommand = defineCommand({
	meta: {
		name: 'build',
		description: 'Build a project',
	},

	args: buildArgs,

	async run({ args }) {
		try {
			const tsConfigPath = findTsConfigPath(args.project);

			// parse the contents of the retrieved JSON path as a partial `ProjectOptions`
			const projectOptions: ProjectOptions = Object.assign(
				{},
				DEFAULT_PROJECT_OPTIONS,
				getTsConfigProjectOptions(tsConfigPath),
				args
			);

			LogService.verbose = projectOptions.verbose === true;

			const diagnosticReporter = ts.createDiagnosticReporter(ts.sys, true);

			const data = createProjectData(tsConfigPath, projectOptions);
			if (projectOptions.watch) {
				await setupProjectWatchProgram(data);
			} else {
				const program = createProjectProgram(data);
				const pathTranslator = createPathTranslator(program, data);
				cleanup(pathTranslator);
				copyInclude(data);
				copyFiles(data, pathTranslator, new Set(getRootDirs(program.getCompilerOptions())));
				const emitResult = compileFiles(
					program.getProgram(),
					data,
					pathTranslator,
					getChangedSourceFiles(program)
				);
				for (const diagnostic of emitResult.diagnostics) {
					diagnosticReporter(diagnostic);
				}
				if (hasErrors(emitResult.diagnostics)) {
					process.exitCode = 1;
				}
			}
		} catch (e) {
			process.exitCode = 1;
			if (e instanceof LoggableError) {
				e.log();
			} else {
				throw e;
			}
		}
	},
});
