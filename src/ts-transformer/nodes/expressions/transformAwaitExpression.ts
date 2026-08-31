import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import { skipDownwards } from 'ts-transformer/util/traversal';
import type ts from 'typescript';

export function transformAwaitExpression(state: TransformState, node: ts.AwaitExpression) {
	return luau.call(state.TS(node, 'await'), [transformExpression(state, skipDownwards(node.expression))]);
}
