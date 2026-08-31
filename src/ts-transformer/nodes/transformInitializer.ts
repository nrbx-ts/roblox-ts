import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import type ts from 'typescript';

export function transformInitializer(state: TransformState, id: luau.WritableExpression, initializer: ts.Expression) {
	return luau.create(luau.SyntaxKind.IfStatement, {
		condition: luau.binary(id, '==', luau.nil()),
		elseBody: luau.list.make(),
		statements: state.capturePrereqs(() => {
			state.prereq(
				luau.create(luau.SyntaxKind.Assignment, {
					left: id,
					operator: '=',
					right: transformExpression(state, initializer),
				})
			);
		}),
	});
}
