import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformStatementList } from 'ts-transformer/nodes/transformStatementList';
import type * as ts from 'typescript/sync';

export function transformBlock(state: TransformState, node: ts.Block) {
	return luau.list.make(
		luau.create(luau.SyntaxKind.DoStatement, {
			statements: transformStatementList(state, node, node.statements),
		})
	);
}
