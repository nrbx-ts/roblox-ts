import type luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformObjectBindingPattern } from 'ts-transformer/nodes/binding/transformObjectBindingPattern';
import { transformVariable } from 'ts-transformer/nodes/statements/transformVariableStatement';
import { transformInitializer } from 'ts-transformer/nodes/transformInitializer';
import { getAccessorForBindingType } from 'ts-transformer/util/binding/getAccessorForBindingType';
import { getSpreadDestructorForType } from 'ts-transformer/util/spreadDestructuring';
import { validateNotAnyType } from 'ts-transformer/util/validateNotAny';
import * as ts from 'typescript/sync';

export function transformArrayBindingPattern(
	state: TransformState,
	bindingPattern: ts.ArrayBindingPattern,
	parentId: luau.AnyIdentifier
) {
	validateNotAnyType(state, bindingPattern);

	let index = 0;
	const idStack: luau.AnyIdentifier[] = [];
	const accessor = getAccessorForBindingType(state, bindingPattern, state.getType(bindingPattern));
	const destructor = getSpreadDestructorForType(state, bindingPattern, state.getType(bindingPattern));

	for (const element of bindingPattern.elements) {
		if (ts.isOmittedExpression(element)) {
			accessor(state, parentId, index, idStack, true);
		} else {
			const name = element.name;

			const isSpreadElement = element.dotDotDotToken !== undefined;
			const value = isSpreadElement
				? destructor(state, parentId, index, idStack)
				: accessor(state, parentId, index, idStack, false);

			if (ts.isIdentifier(name)) {
				const id = transformVariable(state, name, value);
				if (element.initializer) {
					state.prereq(transformInitializer(state, id, element.initializer));
				}
			} else {
				const id = state.pushToVar(value, 'binding');
				if (element.initializer) {
					state.prereq(transformInitializer(state, id, element.initializer));
				}
				if (ts.isArrayBindingPattern(name)) {
					transformArrayBindingPattern(state, name, id);
				} else {
					transformObjectBindingPattern(state, name, id);
				}
			}
		}
		index++;
	}
}
