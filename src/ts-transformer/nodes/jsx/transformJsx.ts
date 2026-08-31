import luau from '@roblox-ts/luau-ast';
import { assert } from 'shared/util/assert';
import type { TransformState } from 'ts-transformer';
import { transformJsxAttributes } from 'ts-transformer/nodes/jsx/transformJsxAttributes';
import { transformJsxChildren } from 'ts-transformer/nodes/jsx/transformJsxChildren';
import { transformJsxTagName } from 'ts-transformer/nodes/jsx/transformJsxTagName';
import { transformEntityName } from 'ts-transformer/nodes/transformEntityName';
import { convertToIndexableExpression } from 'ts-transformer/util/convertToIndexableExpression';
import { createMapPointer, type MapPointer } from 'ts-transformer/util/pointer';
import type ts from 'typescript';

export function transformJsx(
	state: TransformState,
	node: ts.JsxElement | ts.JsxSelfClosingElement,
	tagName: ts.JsxTagNameExpression,
	attributes: ts.JsxAttributes,
	children: ReadonlyArray<ts.JsxChild>
) {
	// jsxFactoryEntity seems to always be defined and will default to `React.createElement`
	const jsxFactoryEntity = state.resolver.getJsxFactoryEntity(node);
	assert(jsxFactoryEntity, 'Expected jsxFactoryEntity to be defined');

	const createElementExpression = convertToIndexableExpression(transformEntityName(state, jsxFactoryEntity));

	const tagNameExp = transformJsxTagName(state, tagName);

	let attributesPtr: MapPointer | undefined;
	if (attributes.properties.length > 0) {
		attributesPtr = createMapPointer('attributes');
		transformJsxAttributes(state, attributes, attributesPtr);
	}

	const transformedChildren = transformJsxChildren(state, children);

	const args = [tagNameExp];

	if (attributesPtr) {
		args.push(attributesPtr.value);
	} else if (transformedChildren.length > 0) {
		args.push(luau.nil());
	}

	args.push(...transformedChildren);

	return luau.call(createElementExpression, args);
}
