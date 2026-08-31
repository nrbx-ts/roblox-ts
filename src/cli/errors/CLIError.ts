import { DiagnosticError } from 'shared/errors/DiagnosticError';
import { createTextDiagnostic } from 'shared/util/createTextDiagnostic';

export class CLIError extends DiagnosticError {
	constructor(message: string) {
		super([createTextDiagnostic(message)]);
	}
}
