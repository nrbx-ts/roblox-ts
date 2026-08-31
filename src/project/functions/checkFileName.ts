import path from 'node:path';
import { FILENAME_WARNINGS } from 'shared/constants';
import { errors } from 'shared/diagnostics';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';

export function checkFileName(filePath: string) {
	const baseName = path.basename(filePath);
	const nameWarning = FILENAME_WARNINGS.get(baseName);
	if (nameWarning) {
		DiagnosticService.addDiagnostic(errors.incorrectFileName(baseName, nameWarning, filePath));
	}
}
