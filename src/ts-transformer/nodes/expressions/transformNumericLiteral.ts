import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import type ts from 'typescript';

export function transformNumericLiteral(_state: TransformState, node: ts.NumericLiteral) {
	return luau.create(luau.SyntaxKind.NumberLiteral, {
		value: node.getText(),
	});
}
