import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformOptionalChain } from 'ts-transformer/nodes/transformOptionalChain';
import { addIndexDiagnostics } from 'ts-transformer/util/addIndexDiagnostics';
import { convertToIndexableExpression } from 'ts-transformer/util/convertToIndexableExpression';
import { getConstantValueLiteral } from 'ts-transformer/util/getConstantValueLiteral';
import { skipUpwards } from 'ts-transformer/util/traversal';
import { validateNotAnyType } from 'ts-transformer/util/validateNotAny';
import * as ts from 'typescript/sync';

export function transformPropertyAccessExpressionInner(
	state: TransformState,
	node: ts.PropertyAccessExpression,
	expression: luau.Expression,
	name: string
) {
	// a in a.b
	validateNotAnyType(state, node.expression);

	addIndexDiagnostics(state, node, state.typeChecker.getNonOptionalType(state.getType(node)));

	if (ts.isDeleteExpression(skipUpwards(node).parent)) {
		state.prereq(
			luau.create(luau.SyntaxKind.Assignment, {
				left: luau.property(convertToIndexableExpression(expression), name),
				operator: '=',
				right: luau.nil(),
			})
		);
		return luau.none();
	}

	return luau.property(convertToIndexableExpression(expression), name);
}

export function transformPropertyAccessExpression(state: TransformState, node: ts.PropertyAccessExpression) {
	const constantValue = getConstantValueLiteral(state, node);
	if (constantValue) {
		return constantValue;
	}

	return transformOptionalChain(state, node);
}
