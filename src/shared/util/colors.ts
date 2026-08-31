// Minimal ANSI color helpers (replaces the kleur dependency).
// Color support detection mirrors kleur's behavior.

const { FORCE_COLOR, NODE_DISABLE_COLORS, NO_COLOR, TERM } = process.env;
const isTTY = process.stdout.isTTY === true;

const enabled =
	!NODE_DISABLE_COLORS &&
	NO_COLOR == null &&
	TERM !== 'dumb' &&
	((FORCE_COLOR != null && FORCE_COLOR !== '0') || isTTY);

function color(code: number, text: string) {
	return enabled ? `\u001b[${code}m${text}\u001b[0m` : text;
}

export const red = (text: string) => color(31, text);
export const yellow = (text: string) => color(33, text);
export const grey = (text: string) => color(90, text);
