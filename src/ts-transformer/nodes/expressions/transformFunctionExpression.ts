import luau from '@roblox-ts/luau-ast';
import { errors } from 'shared/diagnostics';
import type { TransformState } from 'ts-transformer';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import { transformReturnStatementInner } from 'ts-transformer/nodes/statements/transformReturnStatement';
import { transformParameters } from 'ts-transformer/nodes/transformParameters';
import { transformStatementList } from 'ts-transformer/nodes/transformStatementList';
import { wrapStatementsAsGenerator } from 'ts-transformer/util/wrapStatementsAsGenerator';
import ts from 'typescript';

export function transformFunctionExpression(state: TransformState, node: ts.FunctionExpression | ts.ArrowFunction) {
	if (node.name) {
		DiagnosticService.addDiagnostic(errors.noFunctionExpressionName(node.name));
	}

	let { statements, parameters, hasDotDotDot } = transformParameters(state, node);

	const body = node.body;
	if (ts.isFunctionBody(body)) {
		luau.list.pushList(statements, transformStatementList(state, body, body.statements));
	} else {
		const [returnStatements, prereqs] = state.capture(() => transformReturnStatementInner(state, body));
		luau.list.pushList(statements, prereqs);
		luau.list.pushList(statements, returnStatements);
	}

	const isAsync = ts.hasSyntacticModifier(node, ts.ModifierFlags.Async);

	if (node.asteriskToken) {
		if (isAsync) {
			DiagnosticService.addDiagnostic(errors.noAsyncGeneratorFunctions(node));
		}
		statements = wrapStatementsAsGenerator(state, node, statements);
	}

	let expression: luau.Expression = luau.create(luau.SyntaxKind.FunctionExpression, {
		hasDotDotDot,
		parameters,
		statements,
	});

	if (isAsync) {
		expression = luau.call(state.TS(node, 'async'), [expression]);
	}

	return expression;
}
