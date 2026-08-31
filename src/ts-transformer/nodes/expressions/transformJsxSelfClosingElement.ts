import type { TransformState } from 'ts-transformer';
import { transformJsx } from 'ts-transformer/nodes/jsx/transformJsx';
import type ts from 'typescript';

export function transformJsxSelfClosingElement(state: TransformState, node: ts.JsxSelfClosingElement) {
	return transformJsx(state, node, node.tagName, node.attributes, []);
}
