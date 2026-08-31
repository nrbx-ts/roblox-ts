import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import { skipDownwards } from 'ts-transformer/util/traversal';
import type ts from 'typescript';

export function transformParenthesizedExpression(state: TransformState, node: ts.ParenthesizedExpression) {
	const expression = transformExpression(state, skipDownwards(node.expression));
	if (luau.isSimple(expression)) {
		return expression;
	} else {
		return luau.create(luau.SyntaxKind.ParenthesizedExpression, { expression });
	}
}
