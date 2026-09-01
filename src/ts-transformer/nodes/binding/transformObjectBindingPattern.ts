import type luau from '@roblox-ts/luau-ast';
import { errors } from 'shared/diagnostics';
import { assert } from 'shared/util/assert';
import type { TransformState } from 'ts-transformer';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import { transformArrayBindingPattern } from 'ts-transformer/nodes/binding/transformArrayBindingPattern';
import { transformVariable } from 'ts-transformer/nodes/statements/transformVariableStatement';
import { transformInitializer } from 'ts-transformer/nodes/transformInitializer';
import { objectAccessor } from 'ts-transformer/util/binding/objectAccessor';
import { spreadDestructureObject } from 'ts-transformer/util/spreadDestructuring';
import { isPossiblyType, isRobloxType } from 'ts-transformer/util/types';
import { validateNotAnyType } from 'ts-transformer/util/validateNotAny';
import * as ts from 'typescript/sync';

export function transformObjectBindingPattern(
	state: TransformState,
	bindingPattern: ts.ObjectBindingPattern,
	parentId: luau.AnyIdentifier
) {
	validateNotAnyType(state, bindingPattern);
	const preSpreadNames: luau.Expression[] = [];
	for (const element of bindingPattern.elements) {
		const name = element.name;
		const prop = element.propertyName;
		const isSpread = element.dotDotDotToken !== undefined;

		if (ts.isIdentifier(name)) {
			const value = isSpread
				? spreadDestructureObject(state, parentId, preSpreadNames)
				: objectAccessor(state, parentId, state.getType(bindingPattern), prop ?? name);
			preSpreadNames.push(value);

			if (isSpread && isPossiblyType(state.getType(bindingPattern), isRobloxType(state))) {
				DiagnosticService.addDiagnostic(errors.noRestSpreadingOfRobloxTypes(element));
				continue;
			}

			const id = transformVariable(state, name, value);
			if (element.initializer) {
				state.prereq(transformInitializer(state, id, element.initializer));
			}
		} else {
			// if name is not identifier, it must be a binding pattern
			// in that case, prop is guaranteed to exist
			assert(prop);
			assert(!isSpread);
			const value = objectAccessor(state, parentId, state.getType(bindingPattern), prop);
			preSpreadNames.push(value);

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
}
