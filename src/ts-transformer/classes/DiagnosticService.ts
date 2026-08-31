import { hasErrors as hasAnyErrors } from 'shared/util/hasErrors';
import type ts from 'typescript';

export namespace DiagnosticService {
	let diagnostics = [] as ts.Diagnostic[];
	const singleDiagnostics = new Set<number>();

	export function addSingleDiagnostic(diagnostic: ts.Diagnostic) {
		if (!singleDiagnostics.has(diagnostic.code)) {
			singleDiagnostics.add(diagnostic.code);
			addDiagnostic(diagnostic);
		}
	}

	export function addDiagnostic(diagnostic: ts.Diagnostic) {
		diagnostics.push(diagnostic);
	}

	export function addDiagnostics(newDiagnostics: ReadonlyArray<ts.Diagnostic>) {
		diagnostics.push(...newDiagnostics);
	}

	export function addDiagnosticWithCache<T>(cacheBy: T, diagnostic: ts.Diagnostic, cache: Set<T>) {
		if (!cache.has(cacheBy)) {
			cache.add(cacheBy);
			addDiagnostic(diagnostic);
		}
	}

	export function flush() {
		const current = diagnostics;
		diagnostics = [];
		singleDiagnostics.clear();
		return current;
	}

	export function hasErrors() {
		return hasAnyErrors(diagnostics);
	}
}
