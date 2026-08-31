import { errors } from 'shared/diagnostics';
import type { TransformState } from 'ts-transformer';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import { getOriginalSymbolOfNode } from 'ts-transformer/util/getOriginalSymbolOfNode';
import { skipDownwards } from 'ts-transformer/util/traversal';
import { isAnyType, isArrayType, isDefinitelyType } from 'ts-transformer/util/types';
import ts from 'typescript';

export function validateNotAnyType(state: TransformState, node: ts.Node) {
	if (ts.isSpreadElement(node)) {
		node = skipDownwards(node.expression);
	}

	let type = state.getType(node);

	if (isDefinitelyType(type, isArrayType(state))) {
		// Array<T> -> T
		const indexType = state.typeChecker.getIndexTypeOfType(type, ts.IndexKind.Number);
		if (indexType) {
			type = indexType;
		}
	}

	if (isDefinitelyType(type, isAnyType(state))) {
		// given a type like `a: { [index: string]: any }`, `a["b"]` will not have a symbol
		const symbol = getOriginalSymbolOfNode(state.typeChecker, node);
		if (symbol) {
			if (!state.multiTransformState.isReportedByNoAnyCache.has(symbol)) {
				state.multiTransformState.isReportedByNoAnyCache.add(symbol);
				DiagnosticService.addDiagnostic(errors.noAny(node));
			}
		} else {
			DiagnosticService.addDiagnostic(errors.noAny(node));
		}
	}
}
