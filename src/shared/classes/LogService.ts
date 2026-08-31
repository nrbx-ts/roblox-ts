import { yellow } from 'shared/util/colors';

export namespace LogService {
	// biome-ignore lint/style/useConst: verbose is reassigned from outside this module (src/cli/commands/build.ts).
	export let verbose = false;
	let partial = false;

	export function write(message: string) {
		partial = !message.endsWith('\n');
		process.stdout.write(message);
	}

	export function writeLine(...messages: Array<unknown>) {
		if (partial) {
			write('\n');
		}
		for (const message of messages) {
			write(`${message}\n`);
		}
	}

	export function writeLineIfVerbose(...messages: Array<unknown>) {
		if (verbose) {
			writeLine(...messages);
		}
	}

	export function warn(message: string) {
		writeLine(`${yellow('Compiler Warning:')} ${message}`);
	}

	export function fatal(message: string): never {
		writeLine(message);
		process.exit(1);
	}
}
