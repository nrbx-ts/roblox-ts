import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformIdentifierDefined } from 'ts-transformer/nodes/expressions/transformIdentifier';
import { validateIdentifier } from 'ts-transformer/util/validateIdentifier';
import type * as ts from 'typescript/sync';

export function createHoistDeclaration(state: TransformState, statement: ts.Statement | ts.CaseClause) {
	const hoists = state.hoistsByStatement.get(statement);
	if (hoists && hoists.length > 0) {
		hoists.forEach((hoist) => {
			validateIdentifier(state, hoist);
		});
		return luau.create(luau.SyntaxKind.VariableDeclaration, {
			left: luau.list.make(...hoists.map((hoistId) => transformIdentifierDefined(state, hoistId))),
			right: undefined,
		});
	}
}
