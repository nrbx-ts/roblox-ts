import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import { convertToIndexableExpression } from 'ts-transformer/util/convertToIndexableExpression';
import { ensureTransformOrder } from 'ts-transformer/util/ensureTransformOrder';
import { getFirstConstructSymbol } from 'ts-transformer/util/types';
import { validateNotAnyType } from 'ts-transformer/util/validateNotAny';
import type * as ts from 'typescript/sync';

export function transformNewExpression(state: TransformState, node: ts.NewExpression) {
	validateNotAnyType(state, node.expression);

	const symbol = getFirstConstructSymbol(state, node.expression);
	if (symbol) {
		const macro = state.services.macroManager.getConstructorMacro(symbol);
		if (macro) {
			return macro(state, node);
		}
	}

	const expression = convertToIndexableExpression(transformExpression(state, node.expression));
	const args = node.arguments ? ensureTransformOrder(state, node.arguments) : [];
	return luau.call(luau.property(expression, 'new'), args);
}
