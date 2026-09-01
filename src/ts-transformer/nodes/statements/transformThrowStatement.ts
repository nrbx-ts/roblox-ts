import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import type * as ts from 'typescript/sync';

export function transformThrowStatement(state: TransformState, node: ts.ThrowStatement) {
	const args: luau.Expression[] = [];
	if (node.expression !== undefined) {
		args.push(transformExpression(state, node.expression));
	}
	return luau.list.make(
		luau.create(luau.SyntaxKind.CallStatement, {
			expression: luau.call(luau.globals.error, args),
		})
	);
}
