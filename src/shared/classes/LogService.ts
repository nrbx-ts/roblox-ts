import kleur from 'kleur';

export class LogService {
	public static verbose = false;
	private static partial = false;

	static write(message: string) {
		LogService.partial = !message.endsWith('\n');
		process.stdout.write(message);
	}

	static writeLine(...messages: Array<unknown>) {
		if (LogService.partial) {
			LogService.write('\n');
		}
		for (const message of messages) {
			LogService.write(`${message}\n`);
		}
	}

	static writeLineIfVerbose(...messages: Array<unknown>) {
		if (LogService.verbose) {
			LogService.writeLine(...messages);
		}
	}

	static warn(message: string) {
		LogService.writeLine(`${kleur.yellow('Compiler Warning:')} ${message}`);
	}

	static fatal(message: string): never {
		LogService.writeLine(message);
		process.exit(1);
	}
}
