import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { createStringFromLiteral } from 'ts-transformer/util/createStringFromLiteral';
import type ts from 'typescript';

export function transformStringLiteral(_state: TransformState, node: ts.StringLiteral) {
	return luau.string(createStringFromLiteral(node));
}
