import luau from '@roblox-ts/luau-ast';
import { errors } from 'shared/diagnostics';
import type { TransformState } from 'ts-transformer';
import { DiagnosticService } from 'ts-transformer/classes/DiagnosticService';
import { isBreakBlockedByTryStatement } from 'ts-transformer/util/isBlockedByTryStatement';
import type ts from 'typescript';

export function transformContinueStatement(state: TransformState, node: ts.ContinueStatement) {
	if (node.label) {
		DiagnosticService.addDiagnostic(errors.noLabeledStatement(node.label));
		return luau.list.make<luau.Statement>();
	}

	if (isBreakBlockedByTryStatement(node)) {
		state.markTryUses('usesContinue');

		return luau.list.make(
			luau.create(luau.SyntaxKind.ReturnStatement, {
				expression: state.TS(node, 'TRY_CONTINUE'),
			})
		);
	}

	return luau.list.make(luau.create(luau.SyntaxKind.ContinueStatement, {}));
}
