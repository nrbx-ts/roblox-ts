import fs from 'node:fs';
import path from 'node:path';
import { compileFiles } from 'project/functions/compileFiles';
import { copyFiles } from 'project/functions/copyFiles';
import { copyInclude } from 'project/functions/copyInclude';
import { createPathTranslator } from 'project/functions/createPathTranslator';
import { createProjectData } from 'project/functions/createProjectData';
import { createProjectProgram } from 'project/functions/createProjectProgram';
import { getChangedSourceFiles } from 'project/functions/getChangedSourceFiles';
import { DEFAULT_PROJECT_OPTIONS, PACKAGE_ROOT, TS_EXT, TSX_EXT } from 'shared/constants';
import { type DiagnosticFactory, errors, getDiagnosticId } from 'shared/diagnostics';
import { assert } from 'shared/util/assert';
import { formatDiagnostics } from 'shared/util/formatDiagnostics';
import { getRootDirs } from 'shared/util/getRootDirs';
import { isPathDescendantOf } from 'shared/util/isPathDescendantOf';
import { describe, it } from 'vitest';

const DIAGNOSTIC_TEST_NAME_REGEX = /^(\w+)(?:\.\d+)?$/;

describe('should compile tests project', () => {
	const data = createProjectData(
		path.join(PACKAGE_ROOT, 'tests', 'tsconfig.json'),
		Object.assign({}, DEFAULT_PROJECT_OPTIONS, {
			project: '',
			allowCommentDirectives: true,
			optimizedLoops: true,
		})
	);
	const program = createProjectProgram(data);
	const pathTranslator = createPathTranslator(program, data);

	// clean outDir between test runs
	fs.rmSync(program.getCompilerOptions().outDir!, { recursive: true, force: true });

	it('should copy include files', () => copyInclude(data));

	it('should copy non-compiled files', () =>
		copyFiles(data, pathTranslator, new Set(getRootDirs(program.getCompilerOptions()))));

	const diagnosticsFolder = path.join(PACKAGE_ROOT, 'tests', 'src', 'diagnostics');

	for (const sourceFile of getChangedSourceFiles(program)) {
		const fileName = path.relative(process.cwd(), sourceFile.fileName);
		if (isPathDescendantOf(path.normalize(sourceFile.fileName), diagnosticsFolder)) {
			let fileBaseName = path.basename(sourceFile.fileName);
			const ext = path.extname(fileBaseName);
			if (ext === TS_EXT || ext === TSX_EXT) {
				fileBaseName = path.basename(sourceFile.fileName, ext);
			}
			const diagnosticName = fileBaseName.match(DIAGNOSTIC_TEST_NAME_REGEX)?.[1] as keyof typeof errors;
			assert(diagnosticName && errors[diagnosticName], `Diagnostic test for unknown diagnostic ${fileBaseName}`);
			const expectedId = (errors[diagnosticName] as DiagnosticFactory).id;
			it(`should compile ${fileName} and report diagnostic ${diagnosticName}`, () => {
				process.env.ROBLOX_TS_EXPECTED_DIAGNOSTIC_ID = String(expectedId);
				const emitResult = compileFiles(program.getProgram(), data, pathTranslator, [sourceFile]);
				delete process.env.ROBLOX_TS_EXPECTED_DIAGNOSTIC_ID;
				if (
					emitResult.diagnostics.length === 0 ||
					!emitResult.diagnostics.every((d) => getDiagnosticId(d) === expectedId)
				) {
					if (emitResult.diagnostics.length === 0) {
						throw new Error(`Expected diagnostic ${diagnosticName} to be reported.`);
					}
					throw new Error(`Unexpected diagnostics:\n${formatDiagnostics(emitResult.diagnostics)}`);
				}
			});
		} else {
			it(`should compile ${fileName}`, () => {
				const emitResult = compileFiles(program.getProgram(), data, pathTranslator, [sourceFile]);
				if (emitResult.diagnostics.length > 0) {
					throw new Error(`\n${formatDiagnostics(emitResult.diagnostics)}`);
				}
			});
		}
	}
});
