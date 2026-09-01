import luau from '@roblox-ts/luau-ast';
import type { TransformState } from 'ts-transformer';
import { transformExpression } from 'ts-transformer/nodes/expressions/transformExpression';
import { transformStatementList } from 'ts-transformer/nodes/transformStatementList';
import { createTruthinessChecks } from 'ts-transformer/util/createTruthinessChecks';
import { getStatements } from 'ts-transformer/util/getStatements';
import * as ts from 'typescript/sync';

export function transformIfStatementInner(state: TransformState, node: ts.IfStatement): luau.IfStatement {
	const condition = createTruthinessChecks(state, transformExpression(state, node.expression), node.expression);

	const statements = transformStatementList(state, node.thenStatement, getStatements(node.thenStatement));

	const elseStatement = node.elseStatement;

	let elseBody: luau.IfStatement | luau.List<luau.Statement>;
	if (elseStatement === undefined) {
		elseBody = luau.list.make<luau.Statement>();
	} else if (ts.isIfStatement(elseStatement)) {
		const [elseIf, elseIfPrereqs] = state.capture(() => transformIfStatementInner(state, elseStatement));
		if (luau.list.isEmpty(elseIfPrereqs)) {
			elseBody = elseIf;
		} else {
			const elseIfStatements = luau.list.make<luau.Statement>();
			luau.list.pushList(elseIfStatements, elseIfPrereqs);
			luau.list.push(elseIfStatements, elseIf);
			elseBody = elseIfStatements;
		}
	} else {
		elseBody = transformStatementList(state, elseStatement, getStatements(elseStatement));
	}

	return luau.create(luau.SyntaxKind.IfStatement, {
		condition,
		statements,
		elseBody,
	});
}

export function transformIfStatement(state: TransformState, node: ts.IfStatement) {
	return luau.list.make(transformIfStatementInner(state, node));
}
