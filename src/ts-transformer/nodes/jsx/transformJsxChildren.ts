import luau from '@roblox-ts/luau-ast';
import { errors } from 'shared/diagnostics';
import { findLastIndex } from 'shared/util/findLastIndex';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import type { TransformState } from 'ts-transformer/classes/TransformState';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import { ensureTransformOrder } from 'ts-transformer/util/ensureTransformOrder';
import { fixupWhitespaceAndDecodeEntities } from 'ts-transformer/util/fixupWhitespaceAndDecodeEntities';
import * as ts from 'typescript/sync';

export function transformJsxChildren(state: TransformState, children: ReadonlyArray<ts.JsxChild>) {
	const lastJsxChildIndex = findLastIndex(
		children,
		(child) => !ts.isJsxText(child) || !child.containsOnlyTriviaWhiteSpaces
	);

	for (let i = 0; i < lastJsxChildIndex; i++) {
		const child = children[i];
		if (ts.isJsxExpression(child) && child.dotDotDotToken) {
			DiagnosticService.addDiagnostic(errors.noPrecedingJsxSpreadElement(child));
		}
	}

	return ensureTransformOrder(
		state,
		children
			// ignore jsx text that only contains whitespace
			.filter((v) => !ts.isJsxText(v) || !v.containsOnlyTriviaWhiteSpaces)
			// ignore empty jsx expressions, i.e. `{}`
			.filter((v) => !ts.isJsxExpression(v) || v.expression !== undefined),
		(state, node) => {
			if (ts.isJsxText(node)) {
				const text = fixupWhitespaceAndDecodeEntities(node.text) ?? '';
				return luau.string(text.replace(/\\/g, '\\\\'));
			}
			return transformExpression(state, node);
		}
	);
}
