import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformInterpolatedStringPart } from 'ts-transformer/nodes/transformInterpolatedStringPart';
import { ensureTransformOrder } from 'ts-transformer/util/ensureTransformOrder';
import type ts from 'typescript';

export function transformTemplateExpression(state: TransformState, node: ts.TemplateExpression) {
	const parts = luau.list.make<luau.InterpolatedStringPart | luau.Expression>();

	if (node.head.text.length > 0) {
		luau.list.push(parts, transformInterpolatedStringPart(node.head));
	}

	const orderedExpressions = ensureTransformOrder(
		state,
		node.templateSpans.map((templateSpan) => templateSpan.expression)
	);

	for (let i = 0; i < node.templateSpans.length; i++) {
		luau.list.push(parts, orderedExpressions[i]);

		const templateSpan = node.templateSpans[i];
		if (templateSpan.literal.text.length > 0) {
			luau.list.push(parts, transformInterpolatedStringPart(templateSpan.literal));
		}
	}

	return luau.create(luau.SyntaxKind.InterpolatedString, { parts });
}
