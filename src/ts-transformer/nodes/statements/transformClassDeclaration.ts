import type { TransformState } from 'ts-transformer';
import { transformClassLikeDeclaration } from 'ts-transformer/nodes/class/transformClassLikeDeclaration';
import type * as ts from 'typescript/sync';

export function transformClassDeclaration(state: TransformState, node: ts.ClassDeclaration) {
	return transformClassLikeDeclaration(state, node).statements;
}
