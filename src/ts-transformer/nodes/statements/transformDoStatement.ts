import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import { transformStatementList } from 'ts-transformer/nodes/transformStatementList';
import { createTruthinessChecks } from 'ts-transformer/util/createTruthinessChecks';
import { getStatements } from 'ts-transformer/util/getStatements';
import ts from 'typescript';

export function transformDoStatement(state: TransformState, { expression, statement }: ts.DoStatement) {
	const statements = transformStatementList(state, statement, getStatements(statement));

	let conditionIsInvertedInLuau = true;
	if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken) {
		expression = expression.operand;
		conditionIsInvertedInLuau = false;
	}

	const [condition, conditionPrereqs] = state.capture(() =>
		createTruthinessChecks(state, transformExpression(state, expression), expression)
	);

	const repeatStatements = luau.list.make<luau.Statement>();
	luau.list.push(
		repeatStatements,
		luau.create(luau.SyntaxKind.DoStatement, {
			statements,
		})
	);
	luau.list.pushList(repeatStatements, conditionPrereqs);

	return luau.list.make(
		luau.create(luau.SyntaxKind.RepeatStatement, {
			statements: repeatStatements,
			condition: conditionIsInvertedInLuau ? luau.unary('not', condition) : condition,
		})
	);
}
