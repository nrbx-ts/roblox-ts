import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformExpressionStatementInner } from 'ts-transformer/nodes/statements/transformExpressionStatement';
import { skipDownwards } from 'ts-transformer/util/traversal';
import type ts from 'typescript';

export function transformVoidExpression(state: TransformState, node: ts.VoidExpression) {
	state.prereqList(transformExpressionStatementInner(state, skipDownwards(node.expression)));
	return luau.create(luau.SyntaxKind.NilLiteral, {});
}
