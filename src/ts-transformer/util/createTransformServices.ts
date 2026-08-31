import { MacroManager } from 'ts-transformer';
import type { TransformServices } from 'ts-transformer/types';
import type ts from 'typescript';

export function createTransformServices(typeChecker: ts.TypeChecker): TransformServices {
	const macroManager = new MacroManager(typeChecker);

	return { macroManager };
}
