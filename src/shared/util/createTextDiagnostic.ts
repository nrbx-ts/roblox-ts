import * as ts from 'typescript/sync';

export function createTextDiagnostic(
	messageText: string,
	category: ts.DiagnosticCategory = ts.DiagnosticCategory.Error
): ts.Diagnostic {
	return {
		category,
		code: ' roblox-ts' as unknown as number,
		file: undefined,
		messageText,
		// TS7's diagnostic formatter reads `text`; keep `messageText` for reporters.
		text: messageText,
		start: undefined,
		length: undefined,
	};
}
