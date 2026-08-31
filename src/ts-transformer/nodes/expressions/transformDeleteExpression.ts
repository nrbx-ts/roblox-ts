import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import { isUsedAsStatement } from 'ts-transformer/util/isUsedAsStatement';
import type ts from 'typescript';

export function transformDeleteExpression(state: TransformState, node: ts.DeleteExpression) {
	// we just want the prereqs, deleting is done in the index expression transforms
	transformExpression(state, node.expression);
	return !isUsedAsStatement(node) ? luau.bool(true) : luau.none();
}
