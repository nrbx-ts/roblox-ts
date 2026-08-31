import type { TransformState } from 'ts-transformer';
import { transformClassLikeDeclaration } from 'ts-transformer/nodes/class/transformClassLikeDeclaration';
import type ts from 'typescript';

export function transformClassDeclaration(state: TransformState, node: ts.ClassDeclaration) {
	return transformClassLikeDeclaration(state, node).statements;
}
