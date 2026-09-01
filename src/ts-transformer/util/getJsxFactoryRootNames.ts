import type { TransformState } from 'ts-transformer/classes/TransformState';
import * as ts from 'typescript/sync';

function getEntityNameRootText(entity: ts.EntityName | undefined): string | undefined {
	if (!entity) {
		return undefined;
	}
	let left: ts.EntityName = entity;
	while (ts.isQualifiedName(left)) {
		left = left.left;
	}
	return ts.isIdentifier(left) ? left.text : undefined;
}

function getRootNames(state: TransformState, sourceFile: ts.SourceFile): ReadonlySet<string> {
	// All JSX in a file shares the same effective factory, so only the first JSX node is needed.
	let firstJsx: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment | undefined;
	const findJsx = (node: ts.Node) => {
		if (firstJsx) {
			return;
		}
		if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
			firstJsx = node;
			return;
		}
		node.forEachChild(findJsx);
	};
	findJsx(sourceFile);

	if (!firstJsx) {
		return new Set();
	}

	const rootNames = new Set<string>();
	const elementRoot = getEntityNameRootText(state.resolver.getJsxFactoryEntity(firstJsx));
	const fragmentRoot = getEntityNameRootText(state.resolver.getJsxFragmentFactoryEntity(firstJsx));
	if (elementRoot) {
		rootNames.add(elementRoot);
	}
	if (fragmentRoot) {
		rootNames.add(fragmentRoot);
	}
	return rootNames;
}

/**
 * Returns the root identifier name(s) of the effective JSX factory / fragment factory for a source
 * file (e.g. `React` for `React.createElement`). Returns an empty set when the file contains no JSX.
 *
 * TS7's EmitResolver does not count the JSX factory as a reference to its import, so this is used to
 * keep the factory's import alive during import transformation.
 */
export function getJsxFactoryRootNames(state: TransformState, sourceFile: ts.SourceFile): ReadonlySet<string> {
	const cache = state.multiTransformState.jsxFactoryRootNamesCache;
	let rootNames = cache.get(sourceFile);
	if (rootNames === undefined) {
		rootNames = getRootNames(state, sourceFile);
		cache.set(sourceFile, rootNames);
	}
	return rootNames;
}
