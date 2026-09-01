import luau from '@roblox-ts/luau-ast';
import { createStringFromLiteral } from 'ts-transformer/util/createStringFromLiteral';
import type * as ts from 'typescript/sync';

export function transformInterpolatedStringPart(node: ts.TemplateLiteralToken | ts.StringLiteral) {
	return luau.create(luau.SyntaxKind.InterpolatedStringPart, { text: createStringFromLiteral(node) });
}
