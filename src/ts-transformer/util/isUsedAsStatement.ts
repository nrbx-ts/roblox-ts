import { skipUpwards } from 'ts-transformer/util/traversal';
import * as ts from 'typescript/sync';

export function isUsedAsStatement(expression: ts.Expression) {
	const child = skipUpwards(expression);
	const parent = child.parent;

	if (ts.isExpressionStatement(parent)) {
		return true;
	}

	// if part of for statement definition, except if used as the condition
	if (ts.isForStatement(parent) && parent.condition !== child) {
		return true;
	}

	if (ts.isDeleteExpression(parent) && isUsedAsStatement(parent)) {
		return true;
	}

	return false;
}
