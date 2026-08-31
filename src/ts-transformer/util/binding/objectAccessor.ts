import luau from '@roblox-ts/luau-ast';
import { errors } from 'shared/diagnostics';
import type { TransformState } from 'ts-transformer';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import { addIndexDiagnostics } from 'ts-transformer/util/addIndexDiagnostics';
import { addOneIfArrayType } from 'ts-transformer/util/addOneIfArrayType';
import { assertNever } from 'ts-transformer/util/assertNever';
import ts from 'typescript';

export const objectAccessor = (
	state: TransformState,
	parentId: luau.AnyIdentifier,
	type: ts.Type,
	name: ts.PropertyName
): luau.Expression => {
	addIndexDiagnostics(state, name, state.getType(name));
	if (ts.isIdentifier(name)) {
		return luau.property(parentId, name.text);
	} else if (ts.isComputedPropertyName(name)) {
		return luau.create(luau.SyntaxKind.ComputedIndexExpression, {
			expression: parentId,
			index: addOneIfArrayType(state, type, transformExpression(state, name.expression)),
		});
	} else if (ts.isNumericLiteral(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
		return luau.create(luau.SyntaxKind.ComputedIndexExpression, {
			expression: parentId,
			index: transformExpression(state, name),
		});
	} else if (ts.isPrivateIdentifier(name)) {
		DiagnosticService.addDiagnostic(errors.noPrivateIdentifier(name));
		return luau.none();
	}
	return assertNever(name, 'objectAccessor');
};
