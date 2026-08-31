import type { TransformState } from 'ts-transformer';
import { transformJsx } from 'ts-transformer/nodes/jsx/transformJsx';
import type ts from 'typescript';

export function transformJsxElement(state: TransformState, node: ts.JsxElement) {
	return transformJsx(state, node, node.openingElement.tagName, node.openingElement.attributes, node.children);
}
