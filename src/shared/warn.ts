import { LogService } from 'shared/classes/LogService';
import { yellow } from 'shared/util/colors';

/**
 * Prints out a 'Compiler Warning' message.
 * @param message
 */
export function warn(message: string) {
	LogService.writeLine(`${yellow('Compiler Warning:')} ${message}`);
}
