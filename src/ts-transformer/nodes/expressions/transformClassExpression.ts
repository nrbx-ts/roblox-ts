import type { TransformState } from 'ts-transformer';
import { transformClassLikeDeclaration } from 'ts-transformer/nodes/class/transformClassLikeDeclaration';
import type ts from 'typescript';

export function transformClassExpression(state: TransformState, node: ts.ClassExpression) {
	const { statements, name } = transformClassLikeDeclaration(state, node);
	state.prereqList(statements);
	return name;
}
