import luau from '@roblox-ts/luau-ast';
import { isDefinitelyType, isStringType } from 'ts-transformer/util/types';
import type * as ts from 'typescript/sync';

export function getAssignableValue(operator: luau.AssignmentOperator, value: luau.Expression, valueType: ts.Type) {
	if (operator === '..=' && !isDefinitelyType(valueType, isStringType)) {
		return luau.call(luau.globals.tostring, [value]);
	}
	return value;
}
