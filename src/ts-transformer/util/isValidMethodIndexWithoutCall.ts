import type { TransformState } from 'ts-transformer';
import { CALL_MACROS } from 'ts-transformer/macros/callMacros';
import { getFirstDefinedSymbol } from 'ts-transformer/util/types';
import * as ts from 'typescript/sync';

export function isValidMethodIndexWithoutCall(state: TransformState, node: ts.Node): boolean {
	const { parent } = node;
	// a.b !== undefined
	if (ts.isBinaryExpression(parent)) {
		return true;
	}

	// !a.b
	if (ts.isPrefixUnaryExpression(parent)) {
		return true;
	}

	// typeIs/typeOf macros
	if (ts.isCallExpression(parent)) {
		const expType = state.typeChecker.getNonOptionalType(state.getType(parent.expression));
		const symbol = getFirstDefinedSymbol(state, expType);
		if (symbol) {
			const macro = state.services.macroManager.getCallMacro(symbol);
			if (
				// typeIs will be a TypeError if usage is not the first argument
				macro === CALL_MACROS.typeIs ||
				macro === CALL_MACROS.typeOf
			) {
				return true;
			}
		}
	}

	return false;
}
