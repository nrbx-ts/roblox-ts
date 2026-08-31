import { getOrSetDefault } from 'shared/util/getOrSetDefault';
import type { TransformState } from 'ts-transformer/classes/TransformState';
import { getAncestor, isAncestorOf } from 'ts-transformer/util/traversal';
import ts from 'typescript';

export function checkVariableHoist(state: TransformState, node: ts.Identifier, symbol: ts.Symbol) {
	if (state.isHoisted.get(symbol) !== undefined) {
		return;
	}

	const statement = getAncestor(node, ts.isStatement);
	if (!statement) {
		return;
	}

	const caseClause = statement.parent;
	if (!ts.isCaseClause(caseClause)) {
		return;
	}
	const caseBlock = caseClause.parent;

	const isUsedOutsideOfCaseClause =
		ts.FindAllReferences.Core.eachSymbolReferenceInFile(
			node,
			state.typeChecker,
			node.getSourceFile(),
			(token) => {
				if (!isAncestorOf(caseClause, token)) {
					return true;
				}
			},
			caseBlock
		) === true;

	if (isUsedOutsideOfCaseClause) {
		getOrSetDefault(state.hoistsByStatement, statement.parent, () => [] as ts.Identifier[]).push(node);
		state.isHoisted.set(symbol, true);
	}
}
