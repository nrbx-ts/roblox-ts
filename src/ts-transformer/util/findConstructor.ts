import * as ts from 'typescript/sync';

export function findConstructor(
	node: ts.ClassLikeDeclaration
): (ts.ConstructorDeclaration & { body: ts.Block }) | undefined {
	return node.members.find(
		(member): member is ts.ConstructorDeclaration & { body: ts.Block } =>
			ts.isConstructorDeclaration(member) && member.body !== undefined
	);
}
