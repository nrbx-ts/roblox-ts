import { spawnSync } from 'node:child_process';
import util from 'node:util';
import { LogService } from 'shared/classes/LogService';
import { red, yellow } from 'shared/util/colors';
import { getKindName } from 'ts-transformer/util/getKindName';
import * as ts from 'typescript/sync';

type LsInfo = {
	name: string;
	version: string;
	dependencies: Record<string, LsInfo>;
};

function findTypescriptVersion(info: LsInfo): string | undefined {
	if (info.name === 'roblox-ts' && info.dependencies.typescript) {
		return info.dependencies.typescript.version;
	}
	for (const [, dep] of Object.entries(info.dependencies)) {
		const found = findTypescriptVersion(dep);
		if (found) {
			return found;
		}
	}
}

function error(message: string): never {
	/* istanbul ignore */
	const typescriptVersion = findTypescriptVersion(
		JSON.parse(spawnSync('npm ls typescript --json').stdout.toString()) as LsInfo
	);
	LogService.fatal(
		red(`Exhaustive assertion failed! ${message}`) +
			yellow('\nThis is usually caused by a TypeScript version mismatch.') +
			yellow('\nMake sure that all TS versions in your project are the same.') +
			yellow('\nYou can check the list of installed versions with `npm list typescript`') +
			(typescriptVersion ? yellow(`\nTry running \`npm install typescript@=${typescriptVersion}\``) : '')
	);
}

/**
 * Asserts at compile-time that `value` is `never`, throws at runtime.
 * @param value The value to check the exhaustiveness of
 * @param message The message of the error
 */
export function assertNever(value: never, message: string): never {
	/* istanbul ignore */
	const isTsNode = typeof value === 'object' && 'kind' in value && ts.isNode(value);
	error(
		`${message}, value was ${isTsNode ? `a TS node of kind ${getKindName((value as ts.Node).kind)}` : util.inspect(value)}`
	);
}
