import type luau from '@roblox-ts/luau-ast';
import { assert } from 'shared/util/assert';
import type { TransformState } from 'ts-transformer/classes/TransformState';
import { spreadDestructureArray } from 'ts-transformer/util/spreadDestructuring/spreadDestructureArray';
import { spreadDestructureGenerator } from 'ts-transformer/util/spreadDestructuring/spreadDestructureGenerator';
import { spreadDestructureMap } from 'ts-transformer/util/spreadDestructuring/spreadDestructureMap';
import { spreadDestructureSet } from 'ts-transformer/util/spreadDestructuring/spreadDestructureSet';
import { isArrayType, isDefinitelyType, isGeneratorType, isMapType, isSetType } from 'ts-transformer/util/types';
import type * as ts from 'typescript/sync';

export * from 'ts-transformer/util/spreadDestructuring/spreadDestructureArray';
export * from 'ts-transformer/util/spreadDestructuring/spreadDestructureMap';
export * from 'ts-transformer/util/spreadDestructuring/spreadDestructureObject';
export * from 'ts-transformer/util/spreadDestructuring/spreadDestructureSet';

type SpreadDestructor = (
	state: TransformState,
	parentId: luau.AnyIdentifier,
	index: number,
	idStack: Array<luau.AnyIdentifier>
) => luau.Expression;

export function getSpreadDestructorForType(state: TransformState, _node: ts.Node, type: ts.Type): SpreadDestructor {
	if (isDefinitelyType(type, isArrayType(state))) {
		return spreadDestructureArray;
	} else if (isDefinitelyType(type, isSetType(state))) {
		return spreadDestructureSet;
	} else if (isDefinitelyType(type, isMapType(state))) {
		return spreadDestructureMap;
	} else if (isDefinitelyType(type, isGeneratorType(state))) {
		return spreadDestructureGenerator;
	}

	return () => {
		assert(false, `Spread Destructuring not supported for type: ${state.typeChecker.typeToString(type)}`);
	};
}
