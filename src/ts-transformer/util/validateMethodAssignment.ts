import { errors } from 'shared/diagnostics';
import type { TransformState } from 'ts-transformer';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import { isMethodFromType } from 'ts-transformer/util/isMethod';
import { walkTypes } from 'ts-transformer/util/types';
import * as ts from 'typescript/sync';

function hasCallSignatures(type: ts.Type) {
	let hasCallSignatures = false;
	walkTypes(type, (t) => {
		hasCallSignatures ||= t.getCallSignatures().length > 0;
	});
	return hasCallSignatures;
}

function validateTypes(state: TransformState, node: ts.Node, baseType: ts.Type, assignmentType: ts.Type) {
	if (hasCallSignatures(baseType) && hasCallSignatures(assignmentType)) {
		const assignmentIsMethod = isMethodFromType(state, node, assignmentType);
		if (isMethodFromType(state, node, baseType) !== assignmentIsMethod) {
			if (assignmentIsMethod) {
				DiagnosticService.addDiagnostic(errors.expectedMethodGotFunction(node));
			} else {
				DiagnosticService.addDiagnostic(errors.expectedFunctionGotMethod(node));
			}
		}
	}
}

function validateObjectLiteralElement(state: TransformState, node: ts.ObjectLiteralElementLike) {
	const type = state.getType(node);
	const contextualType = state.typeChecker.getContextualTypeForObjectLiteralElement(node);
	if (contextualType && contextualType !== type) {
		validateTypes(state, node, type, contextualType);
	}
}

function validateHeritageClause(state: TransformState, node: ts.ClassElement, typeNode: ts.ExpressionWithTypeArguments) {
	const name = ts.getPropertyNameForPropertyNameNode(
		(node as ts.MethodDeclaration | ts.PropertyDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration)
			.name!
	);
	if (!name) return;

	const type = state.getType(node);
	const propertyType = state.typeChecker.getTypeOfPropertyOfType(state.getType(typeNode), name);
	if (!propertyType) return;

	validateTypes(state, node, type, propertyType);
}

function validateSpread(state: TransformState, node: ts.SpreadAssignment) {
	const type = state.getType(node.expression);
	const contextualType = state.typeChecker.getContextualType(node.expression);
	if (!contextualType) return;

	for (const property of type.getProperties()) {
		const basePropertyType = state.typeChecker.getTypeOfPropertyOfType(type, property.name);
		const assignmentPropertyType = state.typeChecker.getTypeOfPropertyOfType(contextualType, property.name);
		if (!basePropertyType) continue;
		if (!assignmentPropertyType) continue;

		validateTypes(state, node, basePropertyType, assignmentPropertyType);
	}
}

export function validateMethodAssignment(state: TransformState, node: ts.ObjectLiteralElementLike | ts.ClassElement) {
	if (
		ts.isClassElement(node) &&
		ts.isClassLike(node.parent) &&
		(node as ts.MethodDeclaration | ts.PropertyDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration).name
	) {
		for (const typeNode of ts.getAllSuperTypeNodes(node.parent)) {
			validateHeritageClause(state, node, typeNode);
		}
	} else if (ts.isObjectLiteralElementLike(node)) {
		if (ts.isSpreadAssignment(node)) {
			if (!ts.isObjectLiteralExpression(node.expression)) {
				validateSpread(state, node);
			}
		} else {
			validateObjectLiteralElement(state, node);
		}
	}
}
