import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import { transformOptionalChain } from 'ts-transformer/nodes/transformOptionalChain';
import { addIndexDiagnostics } from 'ts-transformer/util/addIndexDiagnostics';
import { addOneIfArrayType } from 'ts-transformer/util/addOneIfArrayType';
import { convertToIndexableExpression } from 'ts-transformer/util/convertToIndexableExpression';
import { getConstantValueLiteral } from 'ts-transformer/util/getConstantValueLiteral';
import { offset } from 'ts-transformer/util/offset';
import { skipUpwards } from 'ts-transformer/util/traversal';
import { isLuaTupleType } from 'ts-transformer/util/types';
import { validateNotAnyType } from 'ts-transformer/util/validateNotAny';
import * as ts from 'typescript/sync';

export function transformElementAccessExpressionInner(
	state: TransformState,
	node: ts.ElementAccessExpression,
	expression: luau.Expression,
	argumentExpression: ts.Expression
) {
	// a in a[b]
	validateNotAnyType(state, node.expression);
	// b in a[b]
	validateNotAnyType(state, node.argumentExpression);

	const expType = state.typeChecker.getNonOptionalType(state.getType(node.expression));
	addIndexDiagnostics(state, node, expType);

	const [index, prereqs] = state.capture(() => transformExpression(state, argumentExpression));

	if (!luau.list.isEmpty(prereqs)) {
		// hack because wrapReturnIfLuaTuple will not wrap this, but now we need to!
		if (isLuaTupleType(state)(expType)) {
			expression = luau.array([expression]);
		}

		expression = state.pushToVar(expression, 'exp');
		state.prereqList(prereqs);
	}

	// LuaTuple<T> checks
	if (luau.isCall(expression) && isLuaTupleType(state)(expType)) {
		// wrap in select() if it isn't the first value
		if (!luau.isNumberLiteral(index) || Number(index.value) !== 0) {
			expression = luau.call(luau.globals.select, [offset(index, 1), expression]);
		}
		// parentheses to trim off the rest of the values
		return luau.create(luau.SyntaxKind.ParenthesizedExpression, { expression });
	}

	if (ts.isDeleteExpression(skipUpwards(node).parent)) {
		state.prereq(
			luau.create(luau.SyntaxKind.Assignment, {
				left: luau.create(luau.SyntaxKind.ComputedIndexExpression, {
					expression: convertToIndexableExpression(expression),
					index: addOneIfArrayType(state, expType, index),
				}),
				operator: '=',
				right: luau.nil(),
			})
		);
		return luau.none();
	}

	return luau.create(luau.SyntaxKind.ComputedIndexExpression, {
		expression: convertToIndexableExpression(expression),
		index: addOneIfArrayType(state, expType, index),
	});
}

export function transformElementAccessExpression(state: TransformState, node: ts.ElementAccessExpression) {
	const constantValue = getConstantValueLiteral(state, node);
	if (constantValue) {
		return constantValue;
	}

	return transformOptionalChain(state, node);
}
