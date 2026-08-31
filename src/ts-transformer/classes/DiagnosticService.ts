import { hasErrors } from 'shared/util/hasErrors';
import type ts from 'typescript';

export class DiagnosticService {
	private static diagnostics = [] as ts.Diagnostic[];

	private static singleDiagnostics = new Set<number>();
	public static addSingleDiagnostic(diagnostic: ts.Diagnostic) {
		if (!DiagnosticService.singleDiagnostics.has(diagnostic.code)) {
			DiagnosticService.singleDiagnostics.add(diagnostic.code);
			DiagnosticService.addDiagnostic(diagnostic);
		}
	}

	public static addDiagnostic(diagnostic: ts.Diagnostic) {
		DiagnosticService.diagnostics.push(diagnostic);
	}

	public static addDiagnostics(diagnostics: ReadonlyArray<ts.Diagnostic>) {
		DiagnosticService.diagnostics.push(...diagnostics);
	}

	public static addDiagnosticWithCache<T>(cacheBy: T, diagnostic: ts.Diagnostic, cache: Set<T>) {
		if (!cache.has(cacheBy)) {
			cache.add(cacheBy);
			DiagnosticService.addDiagnostic(diagnostic);
		}
	}

	public static flush() {
		const current = DiagnosticService.diagnostics;
		DiagnosticService.diagnostics = [];
		DiagnosticService.singleDiagnostics.clear();
		return current;
	}

	public static hasErrors() {
		return hasErrors(DiagnosticService.diagnostics);
	}
}
