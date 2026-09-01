import { LoggableError } from 'shared/errors/LoggableError';
import { formatDiagnostics } from 'shared/util/formatDiagnostics';
import type * as ts from 'typescript/sync';

export class DiagnosticError extends LoggableError {
	constructor(public readonly diagnostics: ReadonlyArray<ts.Diagnostic>) {
		super();
	}

	public toString() {
		return formatDiagnostics(this.diagnostics);
	}
}
