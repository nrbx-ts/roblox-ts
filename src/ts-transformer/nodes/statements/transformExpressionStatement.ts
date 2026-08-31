import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import { transformLogicalOrCoalescingAssignmentExpressionStatement } from 'ts-transformer/nodes/transformLogicalOrCoalescingAssignmentExpression';
import { transformWritableAssignment, transformWritableExpression } from 'ts-transformer/nodes/transformWritable';
import { isUnaryAssignmentOperator } from 'ts-transformer/typeGuards';
import { createCompoundAssignmentStatement, getSimpleAssignmentOperator } from 'ts-transformer/util/assignment';
import { getAssignableValue } from 'ts-transformer/util/getAssignableValue';
import { skipDownwards } from 'ts-transformer/util/traversal';
import { wrapExpressionStatement } from 'ts-transformer/util/wrapExpressionStatement';
import ts from 'typescript';

function transformUnaryExpressionStatement(
	state: TransformState,
	node: ts.PrefixUnaryExpression | ts.PostfixUnaryExpression
) {
	const writable = transformWritableExpression(state, node.operand, false);
	const operator: luau.AssignmentOperator = node.operator === ts.SyntaxKind.PlusPlusToken ? '+=' : '-=';
	return luau.create(luau.SyntaxKind.Assignment, {
		left: writable,
		operator,
		right: luau.number(1),
	});
}

export function transformExpressionStatementInner(
	state: TransformState,
	expression: ts.Expression
): luau.List<luau.Statement> {
	if (ts.isBinaryExpression(expression)) {
		const operatorKind = expression.operatorToken.kind;
		if (ts.isLogicalOrCoalescingAssignmentExpression(expression)) {
			return transformLogicalOrCoalescingAssignmentExpressionStatement(state, expression);
		} else if (
			ts.isAssignmentOperator(operatorKind) &&
			!ts.isArrayLiteralExpression(expression.left) &&
			!ts.isObjectLiteralExpression(expression.left)
		) {
			const writableType = state.getType(expression.left);
			const valueType = state.getType(expression.right);
			const operator = getSimpleAssignmentOperator(
				writableType,
				operatorKind as ts.AssignmentOperator,
				valueType
			);
			const { writable, readable, value } = transformWritableAssignment(
				state,
				expression.left,
				expression.right,
				operator === undefined,
				operator === undefined
			);
			if (operator !== undefined) {
				return luau.list.make(
					luau.create(luau.SyntaxKind.Assignment, {
						left: writable,
						operator,
						right: getAssignableValue(operator, value, valueType),
					})
				);
			} else {
				return luau.list.make(
					createCompoundAssignmentStatement(
						state,
						expression,
						writable,
						writableType,
						readable,
						operatorKind,
						value,
						valueType
					)
				);
			}
		}
	} else if (
		(ts.isPrefixUnaryExpression(expression) || ts.isPostfixUnaryExpression(expression)) &&
		isUnaryAssignmentOperator(expression.operator)
	) {
		return luau.list.make(transformUnaryExpressionStatement(state, expression));
	}

	return wrapExpressionStatement(transformExpression(state, expression));
}

export function transformExpressionStatement(state: TransformState, node: ts.ExpressionStatement) {
	const expression = skipDownwards(node.expression);
	return transformExpressionStatementInner(state, expression);
}
