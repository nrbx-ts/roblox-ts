import type { TransformState } from 'ts-transformer';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import type * as ts from 'typescript/sync';

export function transformTypeExpression(
	state: TransformState,
	node:
		| ts.AsExpression
		| ts.NonNullExpression
		| ts.SatisfiesExpression
		| ts.TypeAssertion
		| ts.ExpressionWithTypeArguments
) {
	return transformExpression(state, node.expression);
}
