import { errors } from 'shared/diagnostics';
import type { ProjectData } from 'shared/types';
import type ts from 'typescript';

export function fileUsesCommentDirectives(data: ProjectData, sourceFile: ts.SourceFile) {
	if (data.projectOptions.allowCommentDirectives) {
		return [];
	}

	const diagnostics: ts.Diagnostic[] = [];

	for (const commentDirective of sourceFile.commentDirectives ?? []) {
		diagnostics.push(
			errors.noCommentDirectives({
				sourceFile,
				range: commentDirective.range,
			})
		);
	}

	const tsNoCheckPragma = sourceFile.pragmas.get('ts-nocheck');
	if (tsNoCheckPragma) {
		for (const pragma of Array.isArray(tsNoCheckPragma) ? tsNoCheckPragma : [tsNoCheckPragma]) {
			diagnostics.push(
				errors.noCommentDirectives({
					sourceFile,
					range: pragma.range,
				})
			);
		}
	}

	return diagnostics;
}
