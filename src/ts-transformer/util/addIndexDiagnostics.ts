import { errors } from 'shared/diagnostics';
import type { TransformState } from 'ts-transformer';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import { isMethod } from 'ts-transformer/util/isMethod';
import { isValidMethodIndexWithoutCall } from 'ts-transformer/util/isValidMethodIndexWithoutCall';
import { skipUpwards } from 'ts-transformer/util/traversal';
import { getFirstDefinedSymbol } from 'ts-transformer/util/types';
import ts from 'typescript';

export function addIndexDiagnostics(
	state: TransformState,
	node: ts.PropertyAccessExpression | ts.ElementAccessExpression | ts.SignatureDeclarationBase | ts.PropertyName,
	expType: ts.Type
) {
	const symbol = getFirstDefinedSymbol(state, expType);
	if (
		(symbol && state.services.macroManager.getPropertyCallMacro(symbol)) ||
		(!isValidMethodIndexWithoutCall(state, skipUpwards(node)) && isMethod(state, node))
	) {
		DiagnosticService.addDiagnostic(errors.noIndexWithoutCall(node));
	}

	if (ts.isPrototypeAccess(node)) {
		DiagnosticService.addDiagnostic(errors.noPrototype(node));
	}
}
