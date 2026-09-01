import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import * as ts from 'typescript/sync';

export function transformPropertyName(state: TransformState, name: ts.PropertyName) {
	// identifier directly is from `{ a: value }`, so key must be "a"
	if (ts.isIdentifier(name)) {
		return luau.string(name.text);
	} else {
		// `name.expression`, if identifier, is from `{ [a]: value }`
		return transformExpression(state, ts.isComputedPropertyName(name) ? name.expression : name);
	}
}
