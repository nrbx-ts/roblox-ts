import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import type ts from 'typescript';

export function transformJsxExpression(state: TransformState, node: ts.JsxExpression) {
	if (node.expression) {
		const expression = transformExpression(state, node.expression);
		if (node.dotDotDotToken) {
			return luau.call(luau.globals.unpack, [expression]);
		}
		return expression;
	}
	return luau.none();
}
