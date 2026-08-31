import { fileUsesCommentDirectives } from 'project/preEmitDiagnostics/fileUsesCommentDirectives';
import type { ProjectData } from 'shared/types';
import type ts from 'typescript';

export type PreEmitChecker = (data: ProjectData, sourceFile: ts.SourceFile) => Array<ts.Diagnostic>;
const PRE_EMIT_DIAGNOSTICS: Array<PreEmitChecker> = [fileUsesCommentDirectives];

export function getCustomPreEmitDiagnostics(data: ProjectData, sourceFile: ts.SourceFile) {
	const diagnostics: ts.Diagnostic[] = [];
	for (const check of PRE_EMIT_DIAGNOSTICS) {
		diagnostics.push(...check(data, sourceFile));
	}
	return diagnostics;
}
