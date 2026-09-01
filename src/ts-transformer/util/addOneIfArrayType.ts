import type luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { offset } from 'ts-transformer/util/offset';
import { isArrayType, isDefinitelyType, isUndefinedType } from 'ts-transformer/util/types';
import type * as ts from 'typescript/sync';

export function addOneIfArrayType(state: TransformState, type: ts.Type, expression: luau.Expression) {
	if (isDefinitelyType(type, isArrayType(state), isUndefinedType)) {
		return offset(expression, 1);
	} else {
		return expression;
	}
}
