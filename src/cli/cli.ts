#!/usr/bin/env node

import { CLIError } from 'cli/errors/CLIError';
import { LogService } from 'shared/classes/LogService';
import { COMPILER_VERSION, PACKAGE_ROOT } from 'shared/constants';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

const cli = yargs(hideBin(process.argv));

cli
	// help
	.usage('roblox-ts - A TypeScript-to-Luau Compiler for Roblox')
	.help('help')
	.alias('h', 'help')
	.describe('help', 'show help information')

	// version
	.version(COMPILER_VERSION)
	.alias('v', 'version')
	.describe('version', 'show version information')

	// commands
	.commandDir(`${PACKAGE_ROOT}/out/cli/commands`)

	// options
	.recommendCommands()
	.strict()
	.wrap(cli.terminalWidth())

	// execute
	// .fail() is necessary to properly `.toString()` custom error objects like CLIError
	.fail((str) => {
		process.exitCode = 1;
		if (str) {
			LogService.fatal(str);
		}
	})
	.parseAsync()
	.catch((e) => {
		if (e instanceof CLIError) {
			e.log();
		} else {
			throw e;
		}
	});
