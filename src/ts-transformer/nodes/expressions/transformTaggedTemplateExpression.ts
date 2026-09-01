import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import { convertToIndexableExpression } from 'ts-transformer/util/convertToIndexableExpression';
import { ensureTransformOrder } from 'ts-transformer/util/ensureTransformOrder';
import * as ts from 'typescript/sync';

export function transformTaggedTemplateExpression(state: TransformState, node: ts.TaggedTemplateExpression) {
	const tagExp = transformExpression(state, node.tag);

	if (ts.isTemplateExpression(node.template)) {
		const strings: luau.Expression[] = [];
		strings.push(luau.string(node.template.head.text));
		for (const templateSpan of node.template.templateSpans) {
			strings.push(luau.string(templateSpan.literal.text));
		}

		const expressions = ensureTransformOrder(
			state,
			node.template.templateSpans.map((templateSpan) => templateSpan.expression)
		);

		return luau.call(convertToIndexableExpression(tagExp), [luau.array(strings), ...expressions]);
	} else {
		return luau.call(convertToIndexableExpression(tagExp), [luau.array([luau.string(node.template.text)])]);
	}
}
