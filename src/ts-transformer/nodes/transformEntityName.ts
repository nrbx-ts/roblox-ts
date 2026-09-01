import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer/classes/TransformState';
import { transformIdentifier } from 'ts-transformer/nodes/expressions/transformIdentifier';
import { convertToIndexableExpression } from 'ts-transformer/util/convertToIndexableExpression';
import { resolveSyntheticIdentifier } from 'ts-transformer/util/resolveSyntheticIdentifier';
import { validateIdentifier } from 'ts-transformer/util/validateIdentifier';
import * as ts from 'typescript/sync';

export function transformEntityName(state: TransformState, node: ts.EntityName, sourceFile?: ts.SourceFile) {
	if (ts.isIdentifier(node)) {
		// TS7's getJsxFactoryEntity()/getJsxFragmentFactoryEntity() return fully synthetic entity
		// names that can't be resolved to symbols. When the caller provides the source file,
		// resolve synthetic identifiers to a real reference first so the JSX factory emits the
		// imported binding (e.g. `_react`) instead of a literal.
		if (sourceFile && (!node.parent || ts.positionIsSynthesized(node.pos))) {
			const resolved = resolveSyntheticIdentifier(state, node, sourceFile);
			if (resolved) {
				validateIdentifier(state, resolved);
				return transformIdentifier(state, resolved);
			}
		}
		validateIdentifier(state, node);
		return transformIdentifier(state, node);
	} else {
		return transformQualifiedName(state, node, sourceFile);
	}
}

function transformQualifiedName(
	state: TransformState,
	node: ts.QualifiedName,
	sourceFile?: ts.SourceFile
): luau.PropertyAccessExpression {
	return luau.property(convertToIndexableExpression(transformEntityName(state, node.left, sourceFile)), node.right.text);
}
