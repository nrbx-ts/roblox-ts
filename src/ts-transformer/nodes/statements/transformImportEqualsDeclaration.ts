import luau from '@roblox-ts/luau-ast';
import { assert } from 'shared/util/assert';
import type { TransformState } from 'ts-transformer';
import { transformVariable } from 'ts-transformer/nodes/statements/transformVariableStatement';
import { transformEntityName } from 'ts-transformer/nodes/transformEntityName';
import { createImportExpression } from 'ts-transformer/util/createImportExpression';
import { isSymbolOfValue } from 'ts-transformer/util/isSymbolOfValue';
import * as ts from 'typescript/sync';

export function transformImportEqualsDeclaration(state: TransformState, node: ts.ImportEqualsDeclaration) {
	const { moduleReference } = node;
	if (ts.isExternalModuleReference(moduleReference)) {
		assert(ts.isStringLiteral(moduleReference.expression));
		const importExp = createImportExpression(state, node.getSourceFile(), moduleReference.expression);

		const statements = luau.list.make<luau.Statement>();

		const aliasSymbol = state.typeChecker.getSymbolAtLocation(node.name);
		assert(aliasSymbol);
		if (isSymbolOfValue(ts.skipAlias(aliasSymbol, state.typeChecker))) {
			luau.list.pushList(
				statements,
				state.capturePrereqs(() => transformVariable(state, node.name, importExp))
			);
		}

		// ensure we emit something
		if (
			state.compilerOptions.verbatimModuleSyntax &&
			luau.list.isEmpty(statements) &&
			luau.isCallExpression(importExp)
		) {
			luau.list.push(statements, luau.create(luau.SyntaxKind.CallStatement, { expression: importExp }));
		}

		return statements;
	} else {
		// Identifier | QualifiedName
		// see: https://github.com/roblox-ts/roblox-ts/issues/1895
		return state.capturePrereqs(() =>
			transformVariable(state, node.name, transformEntityName(state, moduleReference))
		);
	}
}
