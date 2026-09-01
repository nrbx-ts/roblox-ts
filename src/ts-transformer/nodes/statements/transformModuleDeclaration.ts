import luau from '@roblox-ts/luau-ast';
import { errors } from 'shared/diagnostics';
import { assert } from 'shared/util/assert';
import { getOrSetDefault } from 'shared/util/getOrSetDefault';
import type { TransformState } from 'ts-transformer';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import { transformIdentifierDefined } from 'ts-transformer/nodes/expressions/transformIdentifier';
import { transformStatementList } from 'ts-transformer/nodes/transformStatementList';
import { hasMultipleDefinitions } from 'ts-transformer/util/hasMultipleDefinitions';
import { isSymbolMutable } from 'ts-transformer/util/isSymbolMutable';
import { isSymbolOfValue } from 'ts-transformer/util/isSymbolOfValue';
import { getAncestor } from 'ts-transformer/util/traversal';
import { validateIdentifier } from 'ts-transformer/util/validateIdentifier';
import * as ts from 'typescript/sync';

function isDeclarationOfNamespace(declaration: ts.Declaration) {
	const modifiers = ts.canHaveModifiers(declaration) ? ts.getModifiers(declaration) : undefined;
	if (modifiers?.some((v) => v.kind === ts.SyntaxKind.DeclareKeyword)) {
		return false;
	}

	if (ts.isModuleDeclaration(declaration) && ts.isInstantiatedModule(declaration, false)) {
		return true;
	} else if (ts.isFunctionDeclaration(declaration) && declaration.body) {
		return true;
	} else if (ts.isClassDeclaration(declaration)) {
		return true;
	}
	return false;
}

function getValueDeclarationStatement(symbol: ts.Symbol) {
	for (const declaration of symbol.getDeclarations() ?? []) {
		const statement = getAncestor(declaration, ts.isStatement);
		if (statement) {
			const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
			if (ts.isFunctionDeclaration(statement) && !statement.body) continue;
			if (ts.isTypeAliasDeclaration(statement)) continue;
			if (ts.isInterfaceDeclaration(statement)) continue;
			if (modifiers?.some((v) => v.kind === ts.SyntaxKind.DeclareKeyword)) continue;
			return statement;
		}
	}
}

function transformNamespace(state: TransformState, name: ts.Identifier, body: ts.NamespaceBody) {
	const symbol = state.typeChecker.getSymbolAtLocation(name);
	assert(symbol);

	validateIdentifier(state, name);

	const nameExp = transformIdentifierDefined(state, name);

	const statements = luau.list.make<luau.Statement>();
	const doStatements = luau.list.make<luau.Statement>();

	const containerId = luau.tempId('container');
	state.setModuleIdBySymbol(symbol, containerId);

	if (state.isHoisted.get(symbol)) {
		luau.list.push(
			statements,
			luau.create(luau.SyntaxKind.Assignment, {
				left: nameExp,
				operator: '=',
				right: luau.map(),
			})
		);
	} else {
		luau.list.push(
			statements,
			luau.create(luau.SyntaxKind.VariableDeclaration, {
				left: nameExp,
				right: luau.map(),
			})
		);
	}

	const moduleExports = state.getModuleExports(symbol);
	if (moduleExports.length > 0) {
		luau.list.push(
			doStatements,
			luau.create(luau.SyntaxKind.VariableDeclaration, { left: containerId, right: nameExp })
		);
	}

	if (ts.isModuleBlock(body)) {
		const exportsMap = new Map<ts.Statement, Array<string>>();
		if (moduleExports.length > 0) {
			for (const exportSymbol of moduleExports) {
				const originalSymbol = ts.skipAlias(exportSymbol, state.typeChecker);
				if (isSymbolOfValue(originalSymbol) && !isSymbolMutable(state, originalSymbol)) {
					const valueDeclarationStatement = getValueDeclarationStatement(exportSymbol);
					if (valueDeclarationStatement) {
						getOrSetDefault(exportsMap, valueDeclarationStatement, () => []).push(exportSymbol.name);
					}
				}
			}
		}
		luau.list.pushList(
			doStatements,
			transformStatementList(state, body, body.statements, {
				id: containerId,
				mapping: exportsMap,
			})
		);
	} else {
		assert(ts.isIdentifier(body.name));
		luau.list.pushList(doStatements, transformNamespace(state, body.name, body.body as ts.NamespaceBody));
		luau.list.push(
			doStatements,
			luau.create(luau.SyntaxKind.Assignment, {
				left: luau.property(containerId, body.name.text),
				operator: '=',
				right: transformIdentifierDefined(state, body.name),
			})
		);
	}

	luau.list.push(statements, luau.create(luau.SyntaxKind.DoStatement, { statements: doStatements }));

	return statements;
}

export function transformModuleDeclaration(state: TransformState, node: ts.ModuleDeclaration) {
	// type-only namespace
	if (!ts.isInstantiatedModule(node, false)) {
		return luau.list.make<luau.Statement>();
	}

	// disallow merging
	const symbol = state.typeChecker.getSymbolAtLocation(node.name);
	if (symbol && hasMultipleDefinitions(symbol, (declaration) => isDeclarationOfNamespace(declaration))) {
		DiagnosticService.addDiagnosticWithCache(
			symbol,
			errors.noNamespaceMerging(node),
			state.multiTransformState.isReportedByMultipleDefinitionsCache
		);
		return luau.list.make<luau.Statement>();
	}

	// ts.StringLiteral is only in the case of `declare module "X" {}`? Should be filtered out above
	assert(!ts.isStringLiteral(node.name));
	assert(node.body && !ts.isIdentifier(node.body));
	// unsure how to filter out ts.JSDocNamespaceBody
	return transformNamespace(state, node.name, node.body as ts.NamespaceBody);
}
