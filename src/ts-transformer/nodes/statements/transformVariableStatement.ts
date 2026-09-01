import luau from '@roblox-ts/luau-ast';
import { errors } from 'shared/diagnostics';
import { assert } from 'shared/util/assert';
import type { TransformState } from 'ts-transformer';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import { transformArrayBindingPattern } from 'ts-transformer/nodes/binding/transformArrayBindingPattern';
import { transformObjectBindingPattern } from 'ts-transformer/nodes/binding/transformObjectBindingPattern';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import { transformIdentifierDefined } from 'ts-transformer/nodes/expressions/transformIdentifier';
import { transformInitializer } from 'ts-transformer/nodes/transformInitializer';
import { arrayBindingPatternContainsHoists } from 'ts-transformer/util/arrayBindingPatternContainsHoists';
import { arrayLikeExpressionContainsSpread } from 'ts-transformer/util/arrayLikeExpressionContainsSpread';
import { getTargetIdForBindingPattern } from 'ts-transformer/util/binding/getTargetIdForBindingPattern';
import { checkVariableHoist } from 'ts-transformer/util/checkVariableHoist';
import { isSymbolMutable } from 'ts-transformer/util/isSymbolMutable';
import { isLuaTupleType } from 'ts-transformer/util/types';
import { validateIdentifier } from 'ts-transformer/util/validateIdentifier';
import { wrapExpressionStatement } from 'ts-transformer/util/wrapExpressionStatement';
import * as ts from 'typescript/sync';

export function transformVariable(state: TransformState, identifier: ts.Identifier, right?: luau.Expression) {
	validateIdentifier(state, identifier);

	const symbol = state.typeChecker.getSymbolAtLocation(identifier);
	assert(symbol);

	// export let
	if (isSymbolMutable(state, symbol)) {
		const exportAccess = state.getModuleIdPropertyAccess(symbol);
		if (exportAccess) {
			if (right) {
				state.prereq(
					luau.create(luau.SyntaxKind.Assignment, {
						left: exportAccess,
						operator: '=',
						right,
					})
				);
			}
			return exportAccess;
		}
	}

	const left: luau.AnyIdentifier = transformIdentifierDefined(state, identifier);

	checkVariableHoist(state, identifier, symbol);
	if (state.isHoisted.get(symbol) === true) {
		// no need to do `x = nil` if the variable is already created
		if (right) {
			state.prereq(luau.create(luau.SyntaxKind.Assignment, { left, operator: '=', right }));
		}
	} else {
		state.prereq(luau.create(luau.SyntaxKind.VariableDeclaration, { left, right }));
	}

	return left;
}

function transformOptimizedArrayBindingPattern(
	state: TransformState,
	bindingPattern: ts.ArrayBindingPattern,
	rhs: luau.Expression | luau.List<luau.Expression>
) {
	return state.capturePrereqs(() => {
		const ids = luau.list.make<luau.AnyIdentifier>();
		const statements = state.capturePrereqs(() => {
			for (const element of bindingPattern.elements) {
				if (ts.isOmittedExpression(element)) {
					luau.list.push(ids, luau.tempId());
				} else {
					if (ts.isIdentifier(element.name)) {
						validateIdentifier(state, element.name);
						const id = transformIdentifierDefined(state, element.name);
						luau.list.push(ids, id);
						if (element.initializer) {
							state.prereq(transformInitializer(state, id, element.initializer));
						}
					} else {
						const id = luau.tempId('binding');
						luau.list.push(ids, id);
						if (element.initializer) {
							state.prereq(transformInitializer(state, id, element.initializer));
						}
						if (ts.isArrayBindingPattern(element.name)) {
							transformArrayBindingPattern(state, element.name, id);
						} else {
							transformObjectBindingPattern(state, element.name, id);
						}
					}
				}
			}
		});
		assert(!luau.list.isEmpty(ids));
		state.prereq(luau.create(luau.SyntaxKind.VariableDeclaration, { left: ids, right: rhs }));
		state.prereqList(statements);
	});
}

export function transformVariableDeclaration(
	state: TransformState,
	node: ts.VariableDeclaration
): luau.List<luau.Statement> {
	const statements = luau.list.make<luau.Statement>();
	let value: luau.Expression | undefined;
	if (node.initializer) {
		// must transform right _before_ checking isHoisted, that way references inside of value can be hoisted
		luau.list.pushList(
			statements,
			// non-null assertion on node.initializer because inside callback
			state.capturePrereqs(() => (value = transformExpression(state, node.initializer!)))
		);
	}

	const name = node.name;
	if (ts.isIdentifier(name)) {
		luau.list.pushList(
			statements,
			state.capturePrereqs(() => transformVariable(state, name, value))
		);
	} else {
		// in destructuring, rhs must be executed first
		assert(node.initializer && value);

		// optimize empty destructure
		if (name.elements.length === 0) {
			if (!luau.isArray(value) || !luau.list.isEmpty(value.members)) {
				luau.list.pushList(statements, wrapExpressionStatement(value));
			}
			return statements;
		}

		if (ts.isArrayBindingPattern(name)) {
			if (
				luau.isCall(value) &&
				isLuaTupleType(state)(state.getType(node.initializer)) &&
				!arrayBindingPatternContainsHoists(state, name) &&
				!arrayLikeExpressionContainsSpread(name)
			) {
				luau.list.pushList(statements, transformOptimizedArrayBindingPattern(state, name, value));
			} else if (
				luau.isArray(value) &&
				!luau.list.isEmpty(value.members) &&
				// we can't localize multiple variables at the same time if any of them are hoisted
				!arrayBindingPatternContainsHoists(state, name) &&
				!arrayLikeExpressionContainsSpread(name)
			) {
				luau.list.pushList(statements, transformOptimizedArrayBindingPattern(state, name, value.members));
			} else {
				luau.list.pushList(
					statements,
					state.capturePrereqs(() =>
						transformArrayBindingPattern(state, name, getTargetIdForBindingPattern(state, name, value!))
					)
				);
			}
		} else {
			luau.list.pushList(
				statements,
				state.capturePrereqs(() =>
					transformObjectBindingPattern(state, name, getTargetIdForBindingPattern(state, name, value!))
				)
			);
		}
	}

	return statements;
}

export function isVarDeclaration(node: ts.VariableDeclarationList) {
	return !(node.flags & ts.NodeFlags.Const) && !(node.flags & ts.NodeFlags.Let);
}

export function transformVariableDeclarationList(
	state: TransformState,
	node: ts.VariableDeclarationList
): luau.List<luau.Statement> {
	if (isVarDeclaration(node)) {
		DiagnosticService.addDiagnostic(errors.noVar(node));
	}

	const statements = luau.list.make<luau.Statement>();
	for (const declaration of node.declarations) {
		const [variableStatements, prereqs] = state.capture(() => transformVariableDeclaration(state, declaration));
		luau.list.pushList(statements, prereqs);
		luau.list.pushList(statements, variableStatements);
	}

	return statements;
}

export function transformVariableStatement(
	state: TransformState,
	node: ts.VariableStatement
): luau.List<luau.Statement> {
	return transformVariableDeclarationList(state, node.declarationList);
}
