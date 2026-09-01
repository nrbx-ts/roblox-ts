import path from 'node:path';
import { createProjectData } from 'project/functions/createProjectData';
import { createProjectProgram } from 'project/functions/createProjectProgram';
import { DEFAULT_PROJECT_OPTIONS, PACKAGE_ROOT } from 'shared/constants';
import { describe, it } from 'vitest';
import * as ts from 'typescript/sync';

function log(msg: string) {
	require('fs').appendFileSync('/tmp/order.log', msg + '\n');
}

describe('debug conditional type', () => {
	const data = createProjectData(
		path.join(PACKAGE_ROOT, 'tests', 'tsconfig.json'),
		Object.assign({}, DEFAULT_PROJECT_OPTIONS, { project: '', allowCommentDirectives: true, optimizedLoops: true })
	);
	const program = createProjectProgram(data);

	it('inspect instanceof conditional type', () => {
		const prog = program.getProgram();
		const checker = prog.getTypeChecker();
		const sf = prog.getSourceFile(path.join(PACKAGE_ROOT, 'tests/src/diagnostics/noRobloxSymbolInstanceof.9.ts'))!;
		let found = false;
		const visit = (node: ts.Node) => {
			if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) {
				const t = checker.getTypeAtLocation(node.right);
				log(`type flags: ${t.flags} (${t.flags.toString(16)})`);
				log(`isConditional: ${ts.isConditionalType(t)}`);
				log(`isUnion: ${ts.isUnionType(t)}`);
				const constraint = t.getConstraint();
				log(`constraint: ${constraint ? `flags=${constraint.flags} union=${constraint.isUnion()}` : 'undefined'}`);
				if (constraint?.isUnion()) {
					for (const ct of (constraint as ts.UnionType).types) {
						log(`  member flags=${ct.flags} symbol=${ct.symbol?.getName?.() ?? 'none'} decls=${ct.symbol?.getDeclarations?.()?.map(d => d.getSourceFile()?.fileName)?.join(';') ?? 'none'}`);
					}
				}
				found = true;
			}
			node.forEachChild(visit);
		};
		visit(sf);
		log(`found: ${found}`);
	});
});
