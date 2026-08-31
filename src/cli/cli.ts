#!/usr/bin/env node

import { defineCommand, runMain } from 'citty';
import { buildArgs, buildCommand } from 'cli/commands/build';
import { COMPILER_VERSION } from 'shared/constants';

const mainCommand = defineCommand({
	meta: {
		name: 'rbxtsc',
		version: COMPILER_VERSION,
		description: 'roblox-ts - A TypeScript-to-Luau Compiler for Roblox',
	},

	args: buildArgs,

	subCommands: {
		build: buildCommand,
	},

	default: 'build',
});

runMain(mainCommand);
