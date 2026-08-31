import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformArrayBindingPattern } from 'ts-transformer/nodes/binding/transformArrayBindingPattern';
import { transformObjectBindingPattern } from 'ts-transformer/nodes/binding/transformObjectBindingPattern';
import { transformIdentifierDefined } from 'ts-transformer/nodes/expressions/transformIdentifier';
import ts from 'typescript';

export function transformBindingName(
	state: TransformState,
	name: ts.BindingName,
	initializers: luau.List<luau.Statement>
) {
	let id: luau.AnyIdentifier;
	if (ts.isIdentifier(name)) {
		id = transformIdentifierDefined(state, name);
	} else {
		id = luau.tempId('binding');
		luau.list.pushList(
			initializers,
			state.capturePrereqs(() => {
				if (ts.isArrayBindingPattern(name)) {
					transformArrayBindingPattern(state, name, id);
				} else {
					transformObjectBindingPattern(state, name, id);
				}
			})
		);
	}
	return id;
}
