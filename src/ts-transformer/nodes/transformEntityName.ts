import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer/classes/TransformState';
import { transformIdentifier } from 'ts-transformer/nodes/expressions/transformIdentifier';
import { convertToIndexableExpression } from 'ts-transformer/util/convertToIndexableExpression';
import { validateIdentifier } from 'ts-transformer/util/validateIdentifier';
import * as ts from 'typescript/sync';

export function transformEntityName(state: TransformState, node: ts.EntityName) {
	if (ts.isIdentifier(node)) {
		validateIdentifier(state, node);
		return transformIdentifier(state, node);
	} else {
		return transformQualifiedName(state, node);
	}
}

function transformQualifiedName(state: TransformState, node: ts.QualifiedName): luau.PropertyAccessExpression {
	return luau.property(convertToIndexableExpression(transformEntityName(state, node.left)), node.right.text);
}
