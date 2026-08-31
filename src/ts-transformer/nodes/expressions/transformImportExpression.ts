import luau from '@roblox-ts/luau-ast';
import { errors } from 'shared/diagnostics';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import type { TransformState } from 'ts-transformer/classes/TransformState';
import { createImportExpression } from 'ts-transformer/util/createImportExpression';
import ts from 'typescript';

export function transformImportExpression(state: TransformState, node: ts.CallExpression) {
	const moduleSpecifier = node.arguments[0];

	if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier)) {
		DiagnosticService.addDiagnostic(errors.noNonStringModuleSpecifier(node));
		return luau.none();
	}

	const importExpression = createImportExpression(state, node.getSourceFile(), moduleSpecifier);
	const resolveId = luau.id('resolve');

	return luau.call(luau.property(state.TS(node, 'Promise'), 'new'), [
		luau.create(luau.SyntaxKind.FunctionExpression, {
			hasDotDotDot: false,
			parameters: luau.list.make(resolveId),
			statements: luau.list.make(
				luau.create(luau.SyntaxKind.CallStatement, {
					expression: luau.call(resolveId, [importExpression]),
				})
			),
		}),
	]);
}
