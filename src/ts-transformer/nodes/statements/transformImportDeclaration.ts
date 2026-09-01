import luau from '@roblox-ts/luau-ast';
import { Lazy } from 'shared/classes/Lazy';
import { assert } from 'shared/util/assert';
import type { TransformState } from 'ts-transformer';
import { transformVariable } from 'ts-transformer/nodes/statements/transformVariableStatement';
import { cleanModuleName } from 'ts-transformer/util/cleanModuleName';
import { createImportExpression } from 'ts-transformer/util/createImportExpression';
import { getJsxFactoryRootNames } from 'ts-transformer/util/getJsxFactoryRootNames';
import { getOriginalSymbolOfNode } from 'ts-transformer/util/getOriginalSymbolOfNode';
import { getSourceFileFromModuleSpecifier } from 'ts-transformer/util/getSourceFileFromModuleSpecifier';
import { isSymbolOfValue } from 'ts-transformer/util/isSymbolOfValue';
import * as ts from 'typescript/sync';

function isReferencedAlias(state: TransformState, node: ts.ImportClause | ts.ImportSpecifier) {
	if (state.resolver.isReferencedAliasDeclaration(node)) {
		return true;
	}
	// TS7's resolver doesn't count the JSX factory as a reference, so a module imported solely for
	// use as the JSX factory (e.g. `import React from "@rbxts/react"`) would otherwise be dropped
	// even though the emitted JSX references it.
	const name = node.name;
	if (name && getJsxFactoryRootNames(state, node.getSourceFile()).has(name.text)) {
		return true;
	}
	return false;
}

function countImportExpUses(state: TransformState, importClause: ts.ImportClause) {
	let uses = 0;

	if (importClause.name) {
		const symbol = getOriginalSymbolOfNode(state.typeChecker, importClause.name);
		if (isReferencedAlias(state, importClause) && (!symbol || isSymbolOfValue(symbol))) {
			uses++;
		}
	}

	if (importClause.namedBindings) {
		if (ts.isNamespaceImport(importClause.namedBindings)) {
			uses++;
		} else {
			for (const element of importClause.namedBindings.elements) {
				const symbol = getOriginalSymbolOfNode(state.typeChecker, element.name);
				if (isReferencedAlias(state, element) && (!symbol || isSymbolOfValue(symbol))) {
					uses++;
				}
			}
		}
	}

	return uses;
}

export function transformImportDeclaration(state: TransformState, node: ts.ImportDeclaration) {
	// no emit for type only
	const importClause = node.importClause;
	if (importClause?.isTypeOnly) return luau.list.make<luau.Statement>();

	const statements = luau.list.make<luau.Statement>();

	assert(ts.isStringLiteral(node.moduleSpecifier));
	const importExp = new Lazy<luau.IndexableExpression>(() =>
		createImportExpression(state, node.getSourceFile(), node.moduleSpecifier)
	);

	if (importClause) {
		// detect if we need to push to a new var or not
		const uses = countImportExpUses(state, importClause);
		if (uses > 1) {
			const moduleName = node.moduleSpecifier.text.split('/');
			const id = luau.tempId(cleanModuleName(moduleName[moduleName.length - 1]));
			luau.list.push(
				statements,
				luau.create(luau.SyntaxKind.VariableDeclaration, {
					left: id,
					right: importExp.get(),
				})
			);
			importExp.set(id);
		}

		// default import logic
		const importClauseName = importClause.name;
		if (importClauseName) {
			const symbol = getOriginalSymbolOfNode(state.typeChecker, importClauseName);
			if (isReferencedAlias(state, importClause) && (!symbol || isSymbolOfValue(symbol))) {
				const moduleFile = getSourceFileFromModuleSpecifier(state, node.moduleSpecifier);
				const moduleSymbol = moduleFile && state.typeChecker.getSymbolAtLocation(moduleFile);
				if (moduleSymbol && state.getModuleExports(moduleSymbol).some((v) => v.name === 'default')) {
					luau.list.pushList(
						statements,
						state.capturePrereqs(() =>
							transformVariable(state, importClauseName, luau.property(importExp.get(), 'default'))
						)
					);
				} else {
					luau.list.pushList(
						statements,
						state.capturePrereqs(() => transformVariable(state, importClauseName, importExp.get()))
					);
				}
			}
		}

		const importClauseNamedBindings = importClause.namedBindings;
		if (importClauseNamedBindings) {
			// namespace import logic
			if (ts.isNamespaceImport(importClauseNamedBindings)) {
				luau.list.pushList(
					statements,
					state.capturePrereqs(() =>
						transformVariable(state, importClauseNamedBindings.name, importExp.get())
					)
				);
			} else {
				// named elements import logic
				for (const element of importClauseNamedBindings.elements) {
					const symbol = getOriginalSymbolOfNode(state.typeChecker, element.name);
					// check that import is referenced and has a value at runtime
					if (isReferencedAlias(state, element) && (!symbol || isSymbolOfValue(symbol))) {
						luau.list.pushList(
							statements,
							state.capturePrereqs(() =>
								transformVariable(
									state,
									element.name,
									luau.property(importExp.get(), (element.propertyName ?? element.name).text)
								)
							)
						);
					}
				}
			}
		}
	}

	// ensure we emit something
	if (!importClause || (state.compilerOptions.verbatimModuleSyntax && luau.list.isEmpty(statements))) {
		const expression = importExp.get();
		if (luau.isCallExpression(expression)) {
			luau.list.push(statements, luau.create(luau.SyntaxKind.CallStatement, { expression }));
		}
	}

	return statements;
}
