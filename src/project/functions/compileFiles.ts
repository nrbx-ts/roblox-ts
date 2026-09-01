import fs from 'node:fs';
import path from 'node:path';
import { renderAST } from '@roblox-ts/luau-ast';
import type { PathTranslator } from '@roblox-ts/path-translator';
import { NetworkType, type RbxPath, RojoResolver } from '@roblox-ts/rojo-resolver';
import { checkFileName } from 'project/functions/checkFileName';
import { checkRojoConfig } from 'project/functions/checkRojoConfig';
import { createNodeModulesPathMapping } from 'project/functions/createNodeModulesPathMapping';
import transformPathsTransformer from 'project/transformers/builtin/transformPaths';
import { transformTypeReferenceDirectives } from 'project/transformers/builtin/transformTypeReferenceDirectives';
import { createTransformerList, flattenIntoTransformers } from 'project/transformers/createTransformerList';
import { createTransformerWatcher } from 'project/transformers/createTransformerWatcher';
import { getPluginConfigs } from 'project/transformers/getPluginConfigs';
import { getCustomPreEmitDiagnostics } from 'project/util/getCustomPreEmitDiagnostics';
import { LogService } from 'shared/classes/LogService';
import { ProgressReporter } from 'shared/classes/ProgressReporter';
import { ProjectType } from 'shared/constants';
import type { ProjectData } from 'shared/types';
import { assert } from 'shared/util/assert';
import { benchmarkIfVerbose } from 'shared/util/benchmark';
import { createTextDiagnostic } from 'shared/util/createTextDiagnostic';
import { getRootDirs } from 'shared/util/getRootDirs';
import { MultiTransformState, TransformState, transformSourceFile } from 'ts-transformer';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import { createTransformServices } from 'ts-transformer/util/createTransformServices';
import * as ts from 'typescript/sync';

function inferProjectType(data: ProjectData, rojoResolver: RojoResolver): ProjectType {
	if (data.isPackage) {
		return ProjectType.Package;
	} else if (rojoResolver.isGame) {
		return ProjectType.Game;
	} else {
		return ProjectType.Model;
	}
}

function emitResultFailure(messageText: string): ts.EmitResult {
	return {
		emitSkipped: true,
		diagnostics: [createTextDiagnostic(messageText)],
	};
}

function formatElapsed(ms: number) {
	if (ms < 1000) {
		return `${Math.round(ms)}ms`;
	}
	return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * A transformer that reports per-file progress back to the reporter, so the
 * "transform" stage bar moves as plugins process each source file.
 */
function createProgressTransformer(
	reporter: ProgressReporter,
	stage: number,
	total: number
): ts.TransformerFactory<ts.SourceFile | ts.Bundle> {
	let loaded = 0;
	return () => (sourceFile) => {
		loaded++;
		reporter.update(stage, {
			progress: (loaded / total) * 100,
			detail: path.relative(process.cwd(), ts.isSourceFile(sourceFile) ? sourceFile.fileName : ''),
		});
		return sourceFile;
	};
}

/**
 * 'transpiles' TypeScript project into a logically identical Luau project.
 *
 * writes rendered Luau source to the out directory.
 */
export function compileFiles(
	program: ts.Program,
	data: ProjectData,
	pathTranslator: PathTranslator,
	sourceFiles: Array<ts.SourceFile>,
	reporter?: ProgressReporter
): ts.EmitResult {
	const compilerOptions = program.getCompilerOptions();

	const ownsReporter = reporter === undefined;
	reporter ??= new ProgressReporter();
	const hasPlugins = compilerOptions.plugins !== undefined && compilerOptions.plugins.length > 0;
	const transformStage = hasPlugins ? reporter.addStage('transform') : undefined;
	const compileStage = reporter.addStage('compile');
	const writeStage = reporter.addStage('write');

	const multiTransformState = new MultiTransformState();

	const outDir = compilerOptions.outDir!;

	const rojoResolver = data.rojoConfigPath
		? RojoResolver.fromPath(data.rojoConfigPath)
		: RojoResolver.synthetic(outDir);

	for (const warning of rojoResolver.getWarnings()) {
		LogService.warn(warning);
	}

	checkRojoConfig(data, rojoResolver, getRootDirs(compilerOptions), pathTranslator);

	for (const sourceFile of program.getSourceFiles()) {
		if (!path.normalize(sourceFile.fileName).startsWith(data.nodeModulesPath)) {
			checkFileName(sourceFile.fileName);
		}
	}

	const pkgRojoResolvers = compilerOptions.typeRoots!.map(RojoResolver.synthetic);
	const nodeModulesPathMapping = createNodeModulesPathMapping(compilerOptions.typeRoots!);

	const projectType = data.projectOptions.type ?? inferProjectType(data, rojoResolver);

	if (projectType !== ProjectType.Package && data.rojoConfigPath === undefined) {
		if (ownsReporter) reporter.finish();
		return emitResultFailure('Non-package projects must have a Rojo project file!');
	}

	let runtimeLibRbxPath: RbxPath | undefined;
	if (projectType !== ProjectType.Package) {
		runtimeLibRbxPath = rojoResolver.getRbxPathFromFilePath(
			path.join(data.projectOptions.includePath, 'RuntimeLib.lua')
		);
		if (!runtimeLibRbxPath) {
			if (ownsReporter) reporter.finish();
			return emitResultFailure('Rojo project contained no data for include folder!');
		} else if (rojoResolver.getNetworkType(runtimeLibRbxPath) !== NetworkType.Unknown) {
			if (ownsReporter) reporter.finish();
			return emitResultFailure('Runtime library cannot be in a server-only or client-only container!');
		} else if (rojoResolver.isIsolated(runtimeLibRbxPath)) {
			if (ownsReporter) reporter.finish();
			return emitResultFailure('Runtime library cannot be in an isolated container!');
		}
	}

	if (DiagnosticService.hasErrors()) {
		if (ownsReporter) reporter.finish();
		return { emitSkipped: true, diagnostics: DiagnosticService.flush() };
	}

	LogService.writeLineIfVerbose(`compiling as ${projectType}..`);

	const fileWriteQueue: { sourceFile: ts.SourceFile; source: string }[] = [];
	const progressMaxLength = `${sourceFiles.length}/${sourceFiles.length}`.length;

	let proxyProgram = program;

	if (compilerOptions.plugins && compilerOptions.plugins.length > 0) {
		benchmarkIfVerbose(`running transformers..`, () => {
			const pluginConfigs = getPluginConfigs(data.tsConfigPath);
			const transformerList = createTransformerList(program, pluginConfigs, data.projectPath);
			const transformers = flattenIntoTransformers(transformerList);
			if (transformers.length > 0) {
				assert(transformStage !== undefined);
				transformers.push(createProgressTransformer(reporter, transformStage, sourceFiles.length));
				const transformerWatcher = data.transformerWatcher ?? createTransformerWatcher(program);
				data.transformerWatcher = transformerWatcher;
				const { service, updateFile } = transformerWatcher;
				const transformResult = ts.transformNodes(
					undefined,
					undefined,
					ts.factory,
					compilerOptions,
					sourceFiles,
					transformers,
					false
				);

				if (transformResult.diagnostics) DiagnosticService.addDiagnostics(transformResult.diagnostics);

				for (const sourceFile of transformResult.transformed) {
					if (ts.isSourceFile(sourceFile)) {
						// transformed nodes don't have symbol or type information (or they have out of date information)
						// there's no way to "rebind" an existing file, so we have to reprint it
						const source = ts.createPrinter().printFile(sourceFile);
						updateFile(sourceFile.fileName, source);
						if (data.projectOptions.writeTransformedFiles) {
							const outPath = pathTranslator.getOutputTransformedPath(sourceFile.fileName);
							fs.mkdirSync(path.dirname(outPath), { recursive: true });
							fs.writeFileSync(outPath, source);
						}
					}
				}

				proxyProgram = service.getProgram()!;
				reporter.complete(transformStage, `transformed ${sourceFiles.length} files`);
			} else {
				assert(transformStage !== undefined);
				reporter.complete(transformStage, 'no transformers found');
			}
		});
	}

	if (DiagnosticService.hasErrors()) {
		if (ownsReporter) reporter.finish();
		return { emitSkipped: true, diagnostics: DiagnosticService.flush() };
	}

	const typeChecker = proxyProgram.getTypeChecker();
	const services = createTransformServices(typeChecker);

	for (let i = 0; i < sourceFiles.length; i++) {
		const sourceFile = proxyProgram.getSourceFile(sourceFiles[i].fileName);
		assert(sourceFile);
		reporter.update(compileStage, {
			progress: ((i + 1) / sourceFiles.length) * 100,
			detail: path.relative(process.cwd(), sourceFile.fileName),
		});
		const progress = `${i + 1}/${sourceFiles.length}`.padStart(progressMaxLength);
		benchmarkIfVerbose(`${progress} compile ${path.relative(process.cwd(), sourceFile.fileName)}`, () => {
			DiagnosticService.addDiagnostics(ts.getPreEmitDiagnostics(proxyProgram, sourceFile));
			DiagnosticService.addDiagnostics(getCustomPreEmitDiagnostics(data, sourceFile));
			if (DiagnosticService.hasErrors()) return;

			const transformState = new TransformState(
				proxyProgram,
				data,
				services,
				pathTranslator,
				multiTransformState,
				compilerOptions,
				rojoResolver,
				pkgRojoResolvers,
				nodeModulesPathMapping,
				runtimeLibRbxPath,
				typeChecker,
				projectType,
				sourceFile
			);

			const luauAST = transformSourceFile(transformState, sourceFile);
			if (DiagnosticService.hasErrors()) return;

			const source = renderAST(luauAST);

			fileWriteQueue.push({ sourceFile, source });
		});
	}

	if (DiagnosticService.hasErrors()) {
		if (ownsReporter) reporter.finish();
		return { emitSkipped: true, diagnostics: DiagnosticService.flush() };
	}

	reporter.complete(compileStage, `compiled ${sourceFiles.length} files`);

	const emittedFiles: string[] = [];
	if (fileWriteQueue.length > 0) {
		benchmarkIfVerbose('writing compiled files', () => {
			const afterDeclarations = compilerOptions.declaration
				? [transformTypeReferenceDirectives, transformPathsTransformer(program, {})]
				: undefined;
			for (let i = 0; i < fileWriteQueue.length; i++) {
				reporter.update(writeStage, {
					progress: ((i + 1) / fileWriteQueue.length) * 100,
				});
				const { sourceFile, source } = fileWriteQueue[i];
				const outPath = pathTranslator.getOutputPath(sourceFile.fileName);
				if (
					!data.projectOptions.writeOnlyChanged ||
					!fs.existsSync(outPath) ||
					fs.readFileSync(outPath, 'utf8') !== source
				) {
					fs.mkdirSync(path.dirname(outPath), { recursive: true });
					fs.writeFileSync(outPath, source);
					emittedFiles.push(outPath);
				}
				if (compilerOptions.declaration) {
					proxyProgram.emit(sourceFile, ts.sys.writeFile, undefined, true, { afterDeclarations });
				}
			}
		});
	}

	program.emitBuildInfo();

	reporter.complete(writeStage, `wrote ${emittedFiles.length} files`);

	if (reporter.isEnabled) {
		LogService.writeLine(`Compiled ${sourceFiles.length} files in ${formatElapsed(reporter.getElapsedMs())}`);
	}

	if (ownsReporter) reporter.finish();

	return { emittedFiles, emitSkipped: false, diagnostics: DiagnosticService.flush() };
}
