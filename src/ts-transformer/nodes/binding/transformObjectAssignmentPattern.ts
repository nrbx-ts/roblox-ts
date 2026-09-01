import luau from '@roblox-ts/luau-ast';
import { errors } from 'shared/diagnostics';
import { assert } from 'shared/util/assert';
import type { TransformState } from 'ts-transformer';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import { transformArrayAssignmentPattern } from 'ts-transformer/nodes/binding/transformArrayAssignmentPattern';
import { transformInitializer } from 'ts-transformer/nodes/transformInitializer';
import { transformWritableExpression } from 'ts-transformer/nodes/transformWritable';
import { objectAccessor } from 'ts-transformer/util/binding/objectAccessor';
import { getKindName } from 'ts-transformer/util/getKindName';
import { spreadDestructureObject } from 'ts-transformer/util/spreadDestructuring';
import { skipDownwards } from 'ts-transformer/util/traversal';
import * as ts from 'typescript/sync';

export function transformObjectAssignmentPattern(
	state: TransformState,
	assignmentPattern: ts.ObjectLiteralExpression,
	parentId: luau.AnyIdentifier
) {
	const preSpreadNames: luau.Expression[] = [];
	for (const property of assignmentPattern.properties) {
		if (ts.isShorthandPropertyAssignment(property)) {
			const name = property.name;
			const value = objectAccessor(
				state,
				parentId,
				state.typeChecker.getTypeOfAssignmentPattern(assignmentPattern),
				name
			);
			preSpreadNames.push(value);

			const id = transformWritableExpression(state, name, property.objectAssignmentInitializer !== undefined);
			state.prereq(
				luau.create(luau.SyntaxKind.Assignment, {
					left: id,
					operator: '=',
					right: value,
				})
			);
			assert(luau.isAnyIdentifier(id));
			if (property.objectAssignmentInitializer) {
				state.prereq(transformInitializer(state, id, property.objectAssignmentInitializer));
			}
		} else if (ts.isSpreadAssignment(property)) {
			const value = spreadDestructureObject(state, parentId, preSpreadNames);
			const expression = property.expression;

			// diagnostic is needed because getTypeOfAssignmentPattern is implemented incorrectly:
			// it errors, if that parent of node being passed in is ts.SpreadElement
			if (ts.isObjectLiteralExpression(expression) || ts.isArrayLiteralExpression(expression)) {
				DiagnosticService.addDiagnostic(errors.noNestedSpreadsInAssignmentPatterns(property));
				continue;
			}

			assert(
				ts.isIdentifier(expression),
				`transformObjectAssignmentPattern unexpected expression type: ${getKindName(expression.kind)}`
			);
			const id = transformWritableExpression(state, expression, true);
			state.prereq(
				luau.create(luau.SyntaxKind.Assignment, {
					left: id,
					operator: '=',
					right: value,
				})
			);
		} else if (ts.isPropertyAssignment(property)) {
			const name = property.name;
			let init = property.initializer;
			let initializer: ts.Expression | undefined;
			if (ts.isBinaryExpression(property.initializer)) {
				initializer = skipDownwards(property.initializer.right);
				init = skipDownwards(property.initializer.left);
			}

			const value = objectAccessor(
				state,
				parentId,
				state.typeChecker.getTypeOfAssignmentPattern(assignmentPattern),
				name
			);
			preSpreadNames.push(value);

			if (ts.isIdentifier(init) || ts.isElementAccessExpression(init) || ts.isPropertyAccessExpression(init)) {
				const id = transformWritableExpression(state, init, initializer !== undefined);
				state.prereq(
					luau.create(luau.SyntaxKind.Assignment, {
						left: id,
						operator: '=',
						right: value,
					})
				);
				if (initializer) {
					state.prereq(transformInitializer(state, id, initializer));
				}
			} else if (ts.isArrayLiteralExpression(init)) {
				const id = state.pushToVar(value, 'binding');
				if (initializer) {
					state.prereq(transformInitializer(state, id, initializer));
				}
				assert(ts.isIdentifier(name));
				transformArrayAssignmentPattern(state, init, id);
			} else if (ts.isObjectLiteralExpression(init)) {
				const id = state.pushToVar(value, 'binding');
				if (initializer) {
					state.prereq(transformInitializer(state, id, initializer));
				}
				transformObjectAssignmentPattern(state, init, id);
			} else {
				assert(false, `transformObjectAssignmentPattern invalid initializer: ${getKindName(init.kind)}`);
			}
		} else {
			assert(false, `transformObjectAssignmentPattern invalid property: ${getKindName(property.kind)}`);
		}
	}
}
