import luau from '@roblox-ts/luau-ast';
import { warnings } from 'shared/diagnostics';
import type { TransformState } from 'ts-transformer';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import { binaryExpressionChain } from 'ts-transformer/util/expressionChain';
import { isEmptyStringType, isNaNType, isNumberLiteralType, isPossiblyType } from 'ts-transformer/util/types';
import type ts from 'typescript';

export function willCreateTruthinessChecks(type: ts.Type) {
	return (
		isPossiblyType(type, isNumberLiteralType(0)) ||
		isPossiblyType(type, isNaNType) ||
		isPossiblyType(type, isEmptyStringType)
	);
}

export function createTruthinessChecks(state: TransformState, exp: luau.Expression, node: ts.Expression) {
	const type = state.getType(node);
	const isAssignableToZero = isPossiblyType(type, isNumberLiteralType(0));
	const isAssignableToNaN = isPossiblyType(type, isNaNType);
	const isAssignableToEmptyString = isPossiblyType(type, isEmptyStringType);

	if (isAssignableToZero || isAssignableToNaN || isAssignableToEmptyString) {
		exp = state.pushToVarIfComplex(exp, 'value');
	}

	const checks: luau.Expression[] = [];

	if (isAssignableToZero) {
		checks.push(luau.binary(exp, '~=', luau.number(0)));
	}

	// workaround for https://github.com/microsoft/TypeScript/issues/32778
	if (isAssignableToZero || isAssignableToNaN) {
		checks.push(luau.binary(exp, '==', exp));
	}

	if (isAssignableToEmptyString) {
		checks.push(luau.binary(exp, '~=', luau.string('')));
	}

	checks.push(exp);

	if (
		state.data.projectOptions.logTruthyChanges &&
		(isAssignableToZero || isAssignableToNaN || isAssignableToEmptyString)
	) {
		const checkStrs: string[] = [];
		if (isAssignableToZero) checkStrs.push('0');
		if (isAssignableToZero || isAssignableToNaN) checkStrs.push('NaN');
		if (isAssignableToEmptyString) checkStrs.push('""');
		DiagnosticService.addDiagnostic(warnings.truthyChange(checkStrs.join(', '))(node));
	}

	return binaryExpressionChain(checks, 'and');
}
