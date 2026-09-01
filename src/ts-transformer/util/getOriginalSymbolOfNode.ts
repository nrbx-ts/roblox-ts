import * as ts from 'typescript/sync';

export function getOriginalSymbolOfNode(typeChecker: ts.TypeChecker, node: ts.Node) {
	const symbol = typeChecker.getSymbolAtLocation(node);
	if (symbol) {
		return ts.skipAlias(symbol, typeChecker);
	}
	return symbol;
}
