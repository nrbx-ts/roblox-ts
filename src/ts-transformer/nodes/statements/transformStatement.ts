import luau from '@roblox-ts/luau-ast';
import { type DiagnosticFactory, errors } from 'shared/diagnostics';
import { assert } from 'shared/util/assert';
import type { TransformState } from 'ts-transformer';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import { transformBlock } from 'ts-transformer/nodes/statements/transformBlock';
import { transformBreakStatement } from 'ts-transformer/nodes/statements/transformBreakStatement';
import { transformClassDeclaration } from 'ts-transformer/nodes/statements/transformClassDeclaration';
import { transformContinueStatement } from 'ts-transformer/nodes/statements/transformContinueStatement';
import { transformDoStatement } from 'ts-transformer/nodes/statements/transformDoStatement';
import { transformEnumDeclaration } from 'ts-transformer/nodes/statements/transformEnumDeclaration';
import { transformExportAssignment } from 'ts-transformer/nodes/statements/transformExportAssignment';
import { transformExportDeclaration } from 'ts-transformer/nodes/statements/transformExportDeclaration';
import { transformExpressionStatement } from 'ts-transformer/nodes/statements/transformExpressionStatement';
import { transformForOfStatement } from 'ts-transformer/nodes/statements/transformForOfStatement';
import { transformForStatement } from 'ts-transformer/nodes/statements/transformForStatement';
import { transformFunctionDeclaration } from 'ts-transformer/nodes/statements/transformFunctionDeclaration';
import { transformIfStatement } from 'ts-transformer/nodes/statements/transformIfStatement';
import { transformImportDeclaration } from 'ts-transformer/nodes/statements/transformImportDeclaration';
import { transformImportEqualsDeclaration } from 'ts-transformer/nodes/statements/transformImportEqualsDeclaration';
import { transformModuleDeclaration } from 'ts-transformer/nodes/statements/transformModuleDeclaration';
import { transformReturnStatement } from 'ts-transformer/nodes/statements/transformReturnStatement';
import { transformSwitchStatement } from 'ts-transformer/nodes/statements/transformSwitchStatement';
import { transformThrowStatement } from 'ts-transformer/nodes/statements/transformThrowStatement';
import { transformTryStatement } from 'ts-transformer/nodes/statements/transformTryStatement';
import { transformVariableStatement } from 'ts-transformer/nodes/statements/transformVariableStatement';
import { transformWhileStatement } from 'ts-transformer/nodes/statements/transformWhileStatement';
import { getKindName } from 'ts-transformer/util/getKindName';
import * as ts from 'typescript/sync';

const NO_EMIT = () => luau.list.make<luau.Statement>();

const DIAGNOSTIC = (factory: DiagnosticFactory) => (_state: TransformState, node: ts.Statement) => {
	DiagnosticService.addDiagnostic(factory(node));
	return NO_EMIT();
};

type Validate<T> = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- typecheck only works with `any`
	[k in keyof T]: T[k] extends [infer Kind, infer C extends (...args: any) => unknown]
		? 'kind' extends keyof Parameters<C>[1]
			? Kind extends Parameters<C>[1]['kind']
				? T[k]
				: never
			: T[k]
		: never;
};

function createTransformerMap<
	T extends Array<
		[
			ts.SyntaxKind,
			{ bivariant(state: TransformState, statement: ts.Statement): luau.List<luau.Statement> }['bivariant'],
		]
	>,
>(
	values: Validate<[...T]>
): Map<ts.SyntaxKind, (state: TransformState, statement: ts.Statement) => luau.List<luau.Statement>> {
	return new Map(values);
}

const TRANSFORMER_BY_KIND = createTransformerMap([
	// no emit
	[ts.SyntaxKind.InterfaceDeclaration, NO_EMIT],
	[ts.SyntaxKind.TypeAliasDeclaration, NO_EMIT],
	[ts.SyntaxKind.EmptyStatement, NO_EMIT],

	// banned statements
	[ts.SyntaxKind.ForInStatement, DIAGNOSTIC(errors.noForInStatement)],
	[ts.SyntaxKind.LabeledStatement, DIAGNOSTIC(errors.noLabeledStatement)],
	[ts.SyntaxKind.DebuggerStatement, DIAGNOSTIC(errors.noDebuggerStatement)],

	// regular transforms
	[ts.SyntaxKind.Block, transformBlock],
	[ts.SyntaxKind.BreakStatement, transformBreakStatement],
	[ts.SyntaxKind.ClassDeclaration, transformClassDeclaration],
	[ts.SyntaxKind.ContinueStatement, transformContinueStatement],
	[ts.SyntaxKind.DoStatement, transformDoStatement],
	[ts.SyntaxKind.EnumDeclaration, transformEnumDeclaration],
	[ts.SyntaxKind.ExportAssignment, transformExportAssignment],
	[ts.SyntaxKind.ExportDeclaration, transformExportDeclaration],
	[ts.SyntaxKind.ExpressionStatement, transformExpressionStatement],
	[ts.SyntaxKind.ForOfStatement, transformForOfStatement],
	[ts.SyntaxKind.ForStatement, transformForStatement],
	[ts.SyntaxKind.FunctionDeclaration, transformFunctionDeclaration],
	[ts.SyntaxKind.IfStatement, transformIfStatement],
	[ts.SyntaxKind.ImportDeclaration, transformImportDeclaration],
	[ts.SyntaxKind.ImportEqualsDeclaration, transformImportEqualsDeclaration],
	[ts.SyntaxKind.ModuleDeclaration, transformModuleDeclaration],
	[ts.SyntaxKind.ReturnStatement, transformReturnStatement],
	[ts.SyntaxKind.SwitchStatement, transformSwitchStatement],
	[ts.SyntaxKind.ThrowStatement, transformThrowStatement],
	[ts.SyntaxKind.TryStatement, transformTryStatement],
	[ts.SyntaxKind.VariableStatement, transformVariableStatement],
	[ts.SyntaxKind.WhileStatement, transformWhileStatement],
]);

/**
 * Transforms a singular `ts.Statement` in a `luau.list<...>`.
 * @param state The current transform state.
 * @param node The `ts.Statement` to transform.
 */
export function transformStatement(state: TransformState, node: ts.Statement): luau.List<luau.Statement> {
	// if any modifiers of the node include the `declare` keyword we do not transform
	// `declare` tells us that the identifier of the node is defined somewhere else and we should trust it
	const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
	if (modifiers?.some((v) => v.kind === ts.SyntaxKind.DeclareKeyword)) return NO_EMIT();
	const transformer = TRANSFORMER_BY_KIND.get(node.kind);
	if (transformer) {
		return transformer(state, node);
	}
	assert(false, `Unknown statement: ${getKindName(node.kind)}`);
}
