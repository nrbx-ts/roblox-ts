import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer/classes/TransformState';

export function spreadDestructureArray(_state: TransformState, parentId: luau.AnyIdentifier, index: number) {
	return luau.call(luau.globals.table.move, [
		parentId,
		luau.number(index + 1),
		luau.unary('#', parentId),
		luau.number(1),
		luau.array(),
	]);
}
