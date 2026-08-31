import luau from '@roblox-ts/luau-ast';
import { errors } from 'shared/diagnostics';
import { assert } from 'shared/util/assert';
import type { TransformState } from 'ts-transformer';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import { getAddIterableToArrayBuilder } from 'ts-transformer/util/getAddIterableToArrayBuilder';
import { isArrayType, isDefinitelyType } from 'ts-transformer/util/types';
import { validateNotAnyType } from 'ts-transformer/util/validateNotAny';
import ts from 'typescript';

export function transformSpreadElement(state: TransformState, node: ts.SpreadElement) {
	validateNotAnyType(state, node.expression);

	// array literal is caught and handled separately in transformArrayLiteralExpression.ts
	assert(!ts.isArrayLiteralExpression(node.parent) && node.parent.arguments);
	if (node.parent.arguments[node.parent.arguments.length - 1] !== node) {
		DiagnosticService.addDiagnostic(errors.noPrecedingSpreadElement(node));
	}

	const expression = transformExpression(state, node.expression);

	const type = state.getType(node.expression);
	if (isDefinitelyType(type, isArrayType(state))) {
		return luau.call(luau.globals.unpack, [expression]);
	} else {
		const addIterableToArrayBuilder = getAddIterableToArrayBuilder(state, node.expression, type);
		const arrayId = state.pushToVar(luau.array(), 'array');
		const lengthId = state.pushToVar(luau.number(0), 'length');
		state.prereqList(addIterableToArrayBuilder(state, expression, arrayId, lengthId, 0, false));
		return luau.call(luau.globals.unpack, [arrayId]);
	}
}
