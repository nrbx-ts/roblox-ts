import luau from '@roblox-ts/luau-ast';
import { errors } from 'shared/diagnostics';
import type { TransformState } from 'ts-transformer';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import { isSymbolMutable } from 'ts-transformer/util/isSymbolMutable';
import { isSymbolOfValue } from 'ts-transformer/util/isSymbolOfValue';
import ts from 'typescript';

function transformExportEquals(state: TransformState, node: ts.ExportAssignment) {
	state.hasExportEquals = true;

	const sourceFile = node.getSourceFile();
	const finalStatement = sourceFile.statements[sourceFile.statements.length - 1];
	if (finalStatement === node) {
		return luau.list.make<luau.Statement>(
			luau.create(luau.SyntaxKind.ReturnStatement, { expression: transformExpression(state, node.expression) })
		);
	} else {
		return luau.list.make<luau.Statement>(
			luau.create(luau.SyntaxKind.VariableDeclaration, {
				left: state.getModuleIdFromNode(node),
				right: transformExpression(state, node.expression),
			})
		);
	}
}

function transformExportDefault(state: TransformState, node: ts.ExportAssignment) {
	const statements = luau.list.make<luau.Statement>();

	const [expression, prereqs] = state.capture(() => transformExpression(state, node.expression));
	luau.list.pushList(statements, prereqs);
	luau.list.push(
		statements,
		luau.create(luau.SyntaxKind.VariableDeclaration, {
			left: luau.id('default'),
			right: expression,
		})
	);

	return statements;
}

export function transformExportAssignment(state: TransformState, node: ts.ExportAssignment) {
	const symbol = state.typeChecker.getSymbolAtLocation(node.expression);
	if (symbol && isSymbolMutable(state, symbol)) {
		DiagnosticService.addDiagnostic(errors.noExportAssignmentLet(node));
	}

	if (symbol && !isSymbolOfValue(ts.skipAlias(symbol, state.typeChecker))) {
		return luau.list.make<luau.Statement>();
	}

	if (node.isExportEquals) {
		return transformExportEquals(state, node);
	} else {
		return transformExportDefault(state, node);
	}
}
