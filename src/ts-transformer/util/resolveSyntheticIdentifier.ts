import type { TransformState } from 'ts-transformer/classes/TransformState';
import * as ts from 'typescript/sync';

/**
 * TS7's EmitResolver.getJsxFactoryEntity() / getJsxFragmentFactoryEntity() return fully synthetic
 * entity names that have no parent and cannot be resolved to symbols. Searches the source file for
 * the first identifier with the same text that resolves to a symbol, so JSX factory references can
 * be transformed as normal identifiers (e.g. emitting `_react` instead of `React`).
 */
export function resolveSyntheticIdentifier(
	state: TransformState,
	identifier: ts.Identifier,
	sourceFile: ts.SourceFile
): ts.Identifier | undefined {
	const text = identifier.text;
	let result: ts.Identifier | undefined;
	const visit = (node: ts.Node) => {
		if (result) {
			return;
		}
		if (ts.isIdentifier(node) && node.text === text && node !== identifier) {
			const symbol = state.typeChecker.getSymbolAtLocation(node);
			if (symbol && !state.typeChecker.isUnknownSymbol(symbol)) {
				result = node;
				return;
			}
		}
		node.forEachChild(visit);
	};
	visit(sourceFile);
	return result;
}
