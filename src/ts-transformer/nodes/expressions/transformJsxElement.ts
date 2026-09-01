import type { TransformState } from 'ts-transformer';
import { transformJsx } from 'ts-transformer/nodes/jsx/transformJsx';
import type * as ts from 'typescript/sync';

export function transformJsxElement(state: TransformState, node: ts.JsxElement) {
	return transformJsx(state, node, node.openingElement.tagName, node.openingElement.attributes, node.children);
}
