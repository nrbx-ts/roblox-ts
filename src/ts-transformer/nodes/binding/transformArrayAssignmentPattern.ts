import luau from '@roblox-ts/luau-ast';
import { errors } from 'shared/diagnostics';
import { assert } from 'shared/util/assert';
import type { TransformState } from 'ts-transformer';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import { transformObjectAssignmentPattern } from 'ts-transformer/nodes/binding/transformObjectAssignmentPattern';
import { transformInitializer } from 'ts-transformer/nodes/transformInitializer';
import { transformWritableExpression } from 'ts-transformer/nodes/transformWritable';
import { getAccessorForBindingType } from 'ts-transformer/util/binding/getAccessorForBindingType';
import { getKindName } from 'ts-transformer/util/getKindName';
import { getSpreadDestructorForType } from 'ts-transformer/util/spreadDestructuring';
import { skipDownwards } from 'ts-transformer/util/traversal';
import * as ts from 'typescript/sync';

export function transformArrayAssignmentPattern(
	state: TransformState,
	assignmentPattern: ts.ArrayLiteralExpression,
	parentId: luau.AnyIdentifier
) {
	let index = 0;
	const idStack: luau.Identifier[] = [];
	const patternType = state.typeChecker.getTypeOfAssignmentPattern(assignmentPattern);

	const accessor = getAccessorForBindingType(state, assignmentPattern, patternType);
	const destructor = getSpreadDestructorForType(state, assignmentPattern, patternType);

	for (let element of assignmentPattern.elements) {
		if (ts.isOmittedExpression(element)) {
			accessor(state, parentId, index, idStack, true);
		} else {
			let initializer: ts.Expression | undefined;
			if (ts.isBinaryExpression(element)) {
				initializer = skipDownwards(element.right);
				element = skipDownwards(element.left);
			}

			const value = ts.isSpreadElement(element)
				? destructor(state, parentId, index, idStack)
				: accessor(state, parentId, index, idStack, false);

			// diagnostic is needed because getTypeOfAssignmentPattern is implemented incorrectly:
			// it errors, if that parent of node being passed in is ts.SpreadElement
			if (
				ts.isSpreadElement(element) &&
				(ts.isObjectLiteralExpression(element.expression) || ts.isArrayLiteralExpression(element.expression))
			) {
				DiagnosticService.addDiagnostic(errors.noNestedSpreadsInAssignmentPatterns(element.parent));
				continue;
			}

			if (
				ts.isIdentifier(element) ||
				ts.isElementAccessExpression(element) ||
				ts.isPropertyAccessExpression(element) ||
				ts.isSpreadElement(element)
			) {
				const id = transformWritableExpression(
					state,
					ts.isSpreadElement(element) ? element.expression : element,
					initializer !== undefined
				);
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
			} else if (ts.isArrayLiteralExpression(element)) {
				const id = state.pushToVar(value, 'binding');
				if (initializer) {
					state.prereq(transformInitializer(state, id, initializer));
				}
				transformArrayAssignmentPattern(state, element, id);
			} else if (ts.isObjectLiteralExpression(element)) {
				const id = state.pushToVar(value, 'binding');
				if (initializer) {
					state.prereq(transformInitializer(state, id, initializer));
				}
				transformObjectAssignmentPattern(state, element, id);
			} else {
				assert(false, `transformArrayAssignmentPattern invalid element: ${getKindName(element.kind)}`);
			}
		}
		index++;
	}
}
