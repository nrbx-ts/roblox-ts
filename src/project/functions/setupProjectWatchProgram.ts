import fs from 'node:fs';
import watcher from '@parcel/watcher';
import type { PathTranslator } from '@roblox-ts/path-translator';
import type { ProjectData } from 'project';
import { checkFileName } from 'project/functions/checkFileName';
import { cleanup } from 'project/functions/cleanup';
import { compileFiles } from 'project/functions/compileFiles';
import { copyFiles } from 'project/functions/copyFiles';
import { copyInclude } from 'project/functions/copyInclude';
import { copyItem } from 'project/functions/copyItem';
import { createPathTranslator } from 'project/functions/createPathTranslator';
import { createProgramFactory } from 'project/functions/createProgramFactory';
import { getChangedSourceFiles } from 'project/functions/getChangedSourceFiles';
import { getParsedCommandLine } from 'project/functions/getParsedCommandLine';
import { tryRemoveOutput } from 'project/functions/tryRemoveOutput';
import { isCompilableFile } from 'project/util/isCompilableFile';
import { walkDirectorySync } from 'project/util/walkDirectorySync';
import { ProgressReporter } from 'shared/classes/ProgressReporter';
import { DTS_EXT } from 'shared/constants';
import { DiagnosticError } from 'shared/errors/DiagnosticError';
import { assert } from 'shared/util/assert';
import { getRootDirs } from 'shared/util/getRootDirs';
import * as ts from 'typescript/sync';

function fixSlashes(fsPath: string) {
	return fsPath.replace(/\\/g, '/');
}

export async function setupProjectWatchProgram(data: ProjectData) {
	const { fileNames, options } = getParsedCommandLine(data);
	const fileNamesSet = new Set(fileNames);

	let initialCompileCompleted = false;
	let collecting = false;
	let filesToAdd = new Set<string>();
	let filesToChange = new Set<string>();
	let filesToDelete = new Set<string>();

	const watchReporter = ts.createWatchStatusReporter(ts.sys, true);
	const diagnosticReporter = ts.createDiagnosticReporter(ts.sys, true);

	function reportText(messageText: string) {
		watchReporter(
			{
				category: ts.DiagnosticCategory.Message,
				messageText,
				code: 0,
				file: undefined,
				length: undefined,
				start: undefined,
			},
			ts.sys.newLine,
			options
		);
	}

	function reportEmitResult({ emitResult, reporter }: { emitResult: ts.EmitResult; reporter: ProgressReporter }) {
		for (const diagnostic of emitResult.diagnostics) {
			diagnosticReporter(diagnostic);
		}
		const amtErrors = emitResult.diagnostics.filter((v) => v.category === ts.DiagnosticCategory.Error).length;
		const message = `Found ${amtErrors} error${amtErrors === 1 ? '' : 's'}, watching for file changes.`;
		if (reporter.isEnabled && amtErrors === 0) {
			reporter.addSummaryLine(message);
		} else {
			reportText(message);
		}
		reporter.finish();
	}

	let program: ts.EmitAndSemanticDiagnosticsBuilderProgram | undefined;
	let pathTranslator: PathTranslator | undefined;
	const createProgram = createProgramFactory(data, options);
	function refreshProgram() {
		program = createProgram([...fileNamesSet], options);
		pathTranslator = createPathTranslator(program, data);
	}

	function runInitialCompile(reporter: ProgressReporter) {
		const programStage = reporter.addStage('program');
		const copyStage = reporter.addStage('copy');
		reporter.update(programStage, { progress: -1, message: 'creating program...' });
		refreshProgram();
		reporter.complete(programStage, 'program created');
		assert(program && pathTranslator);
		reporter.update(copyStage, { progress: -1, message: 'copying files...' });
		cleanup(pathTranslator);
		copyInclude(data);
		copyFiles(data, pathTranslator, new Set(getRootDirs(options)));
		reporter.complete(copyStage, 'files copied');
		const sourceFiles = getChangedSourceFiles(program);
		const emitResult = compileFiles(program.getProgram(), data, pathTranslator, sourceFiles, reporter);
		if (!emitResult.emitSkipped) {
			initialCompileCompleted = true;
		}
		return emitResult;
	}

	const filesToCompile = new Set<string>();
	const filesToCopy = new Set<string>();
	const filesToClean = new Set<string>();
	function runIncrementalCompile(
		additions: Set<string>,
		changes: Set<string>,
		removals: Set<string>,
		reporter: ProgressReporter
	): ts.EmitResult {
		const programStage = reporter.addStage('program');
		const copyStage = reporter.addStage('copy');
		reporter.update(programStage, { progress: -1, message: 'creating program...' });
		for (const fsPath of additions) {
			if (fs.statSync(fsPath).isDirectory()) {
				walkDirectorySync(fsPath, (item) => {
					if (isCompilableFile(item)) {
						fileNamesSet.add(item);
						filesToCompile.add(item);
					}
				});
			} else if (isCompilableFile(fsPath)) {
				fileNamesSet.add(fsPath);
				filesToCompile.add(fsPath);
			} else {
				// checks for copying `init.*.d.ts`
				checkFileName(fsPath);
				filesToCopy.add(fsPath);
			}
		}

		for (const fsPath of changes) {
			if (isCompilableFile(fsPath)) {
				filesToCompile.add(fsPath);
			} else {
				// Transformers use a separate program that must be updated separately (which is done in compileFiles),
				// however certain files (such as d.ts files) aren't passed to that function and must be updated here.
				if (fsPath.endsWith(DTS_EXT)) {
					const transformerWatcher = data.transformerWatcher;
					if (transformerWatcher) {
						// Using ts.sys.readFile instead of fs.readFileSync here as it performs some utf conversions implicitly
						// and is also used by the program host to read files.
						const contents = ts.sys.readFile(fsPath);
						if (contents) {
							transformerWatcher.updateFile(fsPath, contents);
						}
					}
				}

				filesToCopy.add(fsPath);
			}
		}

		for (const fsPath of removals) {
			fileNamesSet.delete(fsPath);
			filesToClean.add(fsPath);
		}

		refreshProgram();
		reporter.complete(programStage, 'program created');
		assert(program && pathTranslator);
		const sourceFiles = getChangedSourceFiles(program, options.incremental ? undefined : [...filesToCompile]);
		const emitResult = compileFiles(program.getProgram(), data, pathTranslator, sourceFiles, reporter);
		if (emitResult.emitSkipped) {
			// exit before copying to prevent half-updated out directory
			return emitResult;
		}

		reporter.update(copyStage, { progress: -1, message: 'copying files...' });
		for (const fsPath of filesToClean) {
			tryRemoveOutput(pathTranslator, pathTranslator.getOutputPath(fsPath));
			if (options.declaration) {
				tryRemoveOutput(pathTranslator, pathTranslator.getOutputDeclarationPath(fsPath));
			}
		}
		for (const fsPath of filesToCopy) {
			copyItem(data, pathTranslator, fsPath);
		}
		reporter.complete(copyStage, 'files copied');

		filesToCompile.clear();
		filesToCopy.clear();
		filesToClean.clear();

		return emitResult;
	}

	function runCompile(): { emitResult: ts.EmitResult; reporter: ProgressReporter } {
		const reporter = new ProgressReporter();
		// Start each watch cycle on a fresh screen so the progress bars and
		// summary block are easy to see.
		if (reporter.isEnabled) {
			console.clear();
		}
		try {
			if (!initialCompileCompleted) {
				return { emitResult: runInitialCompile(reporter), reporter };
			} else {
				const additions = filesToAdd;
				const changes = filesToChange;
				const removals = filesToDelete;
				filesToAdd = new Set();
				filesToChange = new Set();
				filesToDelete = new Set();
				return { emitResult: runIncrementalCompile(additions, changes, removals, reporter), reporter };
			}
		} catch (e) {
			if (e instanceof DiagnosticError) {
				return { emitResult: { emitSkipped: true, diagnostics: e.diagnostics }, reporter };
			} else {
				reporter.finish();
				throw e;
			}
		}
	}

	function closeEventCollection() {
		collecting = false;
		reportEmitResult(runCompile());
	}

	function openEventCollection() {
		if (!collecting) {
			collecting = true;
			reportText('File change detected. Starting incremental compilation...');
			setTimeout(closeEventCollection, 100);
		}
	}

	function collectAddEvent(fsPath: string) {
		filesToAdd.add(fixSlashes(fsPath));
		openEventCollection();
	}

	function collectChangeEvent(fsPath: string) {
		filesToChange.add(fixSlashes(fsPath));
		openEventCollection();
	}

	function collectDeleteEvent(fsPath: string) {
		filesToDelete.add(fixSlashes(fsPath));
		openEventCollection();
	}

	for (const rootDir of getRootDirs(options)) {
		await watcher.subscribe(rootDir, (err, events) => {
			if (err) return;
			for (const event of events) {
				switch (event.type) {
					case 'create':
						collectAddEvent(event.path);
						break;
					case 'update':
						collectChangeEvent(event.path);
						break;
					case 'delete':
						collectDeleteEvent(event.path);
						break;
				}
			}
		});
	}

	reportEmitResult(runCompile());
}
