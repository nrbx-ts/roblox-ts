import luau from '@roblox-ts/luau-ast';
import { createStringFromLiteral } from 'ts-transformer/util/createStringFromLiteral';
import type ts from 'typescript';

export function transformInterpolatedStringPart(node: ts.TemplateLiteralToken | ts.StringLiteral) {
	return luau.create(luau.SyntaxKind.InterpolatedStringPart, { text: createStringFromLiteral(node) });
}
