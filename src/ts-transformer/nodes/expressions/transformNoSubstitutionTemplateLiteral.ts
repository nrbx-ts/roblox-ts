import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer/classes/TransformState';
import { transformInterpolatedStringPart } from 'ts-transformer/nodes/transformInterpolatedStringPart';
import type ts from 'typescript';

// backtick string literals without interpolation expressions should be preserved
// as they still are valid in luau
export function transformNoSubstitutionTemplateLiteral(_state: TransformState, node: ts.NoSubstitutionTemplateLiteral) {
	return luau.create(luau.SyntaxKind.InterpolatedString, {
		parts: luau.list.make(transformInterpolatedStringPart(node)),
	});
}
