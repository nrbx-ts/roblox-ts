import luau from '@roblox-ts/luau-ast';
import { errors } from 'shared/diagnostics';
import type { TransformState } from 'ts-transformer';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import type ts from 'typescript';

export function validateIdentifier(_state: TransformState, node: ts.Identifier) {
	if (!luau.isValidIdentifier(node.text)) {
		DiagnosticService.addDiagnostic(errors.noInvalidIdentifier(node));
	} else if (luau.isReservedIdentifier(node.text)) {
		DiagnosticService.addDiagnostic(errors.noReservedIdentifier(node));
	}
}
