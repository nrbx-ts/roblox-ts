// A multi-stage progress reporter for the CLI, inspired by `tsc-progress`
// (https://github.com/JiangWeixian/tsc-progress), which itself borrows from
// `webpackbar`. Renders a set of stage bars to stderr so compilation has
// something to look at, while preserving any other output written meanwhile.

const ESC = '\u001B[';

function ansiEraseLines(count: number) {
	let clear = '';
	for (let i = 0; i < count; i++) {
		clear += `${ESC}A`;
		if (i < count - 1) {
			clear += `${ESC}2K`;
		}
	}
	if (count > 0) {
		clear += `${ESC}2K`;
	}
	return clear;
}

function hexToRgb(hex: string): [number, number, number] | undefined {
	const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!match) return undefined;
	return [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)];
}

// 0 = no color, 1 = basic ANSI colors, 3 = 24-bit (true) color.
function getColorSupport(): 0 | 1 | 3 {
	const { FORCE_COLOR, NODE_DISABLE_COLORS, NO_COLOR, TERM, COLORTERM } = process.env;
	if (NODE_DISABLE_COLORS != null || NO_COLOR != null || TERM === 'dumb') return 0;
	if (FORCE_COLOR != null && FORCE_COLOR !== '0' && FORCE_COLOR !== 'false') {
		const forceLevel = Number.parseInt(FORCE_COLOR, 10);
		if (Number.isNaN(forceLevel)) return 3;
		return forceLevel >= 3 ? 3 : 1;
	}
	if (process.stderr.isTTY !== true) return 0;
	if (COLORTERM === 'truecolor' || COLORTERM === '24bit') return 3;
	return 1;
}

function colorize(text: string, color: string, level: 0 | 1 | 3) {
	if (level === 0) return text;
	if (level === 3 && color.startsWith('#')) {
		const rgb = hexToRgb(color);
		if (rgb) {
			const [r, g, b] = rgb;
			return `${ESC}38;2;${r};${g};${b}m${text}${ESC}0m`;
		}
	}
	// Basic terminals can't do custom hex colors, so fall back to standard blue.
	return `${ESC}34m${text}${ESC}0m`;
}

function ansiColor(text: string, code: number, level: 0 | 1 | 3) {
	return level === 0 ? text : `${ESC}${code}m${text}${ESC}0m`;
}

const BAR_LENGTH = 25;
const BLOCK = '█';
// Cap redraws at ~30fps so large projects don't flood the terminal with writes.
const RENDER_INTERVAL_MS = 33;

function renderBar(progress: number, color: string, level: 0 | 1 | 3) {
	const filled = Math.round((progress / 100) * BAR_LENGTH);
	const fg = colorize(BLOCK, color, level);
	const bg = ansiColor(BLOCK, 90, level);
	let bar = '';
	for (let i = 0; i < BAR_LENGTH; i++) {
		bar += i < filled ? fg : bg;
	}
	return bar;
}

const originalWrite = Symbol('rbxtscProgressWrite');

type WriteFunction = (chunk: unknown, encoding?: unknown, callback?: unknown) => boolean;

/**
 * Renders an updating block of lines to stderr. While active it watches the
 * stdout/stderr streams so any other output written (warnings, diagnostics,
 * etc.) is preserved below the progress block instead of being clobbered.
 */
class LogUpdate {
	prevLineCount = 0;
	extraLines = '';
	listening = false;

	private readonly streams = [process.stdout, process.stderr];

	render(lines: string) {
		this.listen();
		const data = `${ansiEraseLines(this.prevLineCount)}${lines}\n${this.extraLines}`;
		this.write(data);
		this.prevLineCount = data.split('\n').length - 1;
	}

	write(data: string) {
		const stream = process.stderr;
		const write = stream.write as unknown as WriteFunction & { [originalWrite]?: WriteFunction };
		if (write[originalWrite]) {
			write[originalWrite].call(stream, data, 'utf-8');
		} else {
			stream.write(data, 'utf-8');
		}
	}

	stopListening() {
		for (const stream of this.streams) {
			const write = stream.write as unknown as WriteFunction & { [originalWrite]?: WriteFunction };
			if (write[originalWrite]) {
				stream.write = write[originalWrite].bind(stream) as typeof stream.write;
			}
		}
		this.listening = false;
	}

	reset() {
		this.prevLineCount = 0;
		this.extraLines = '';
	}

	private onData(data: unknown) {
		const str = String(data);
		const lines = str.split('\n').length - 1;
		if (lines > 0) {
			this.prevLineCount += lines;
			this.extraLines += data;
		}
	}

	private listen() {
		if (this.listening) return;
		for (const stream of this.streams) {
			const write = stream.write as unknown as WriteFunction & { [originalWrite]?: WriteFunction };
			if (write[originalWrite]) continue;
			const wrapper = ((chunk: unknown, encoding?: unknown, callback?: unknown) => {
				const current = (stream.write as unknown as WriteFunction & { [originalWrite]?: WriteFunction })[
					originalWrite
				];
				if (!current) {
					return stream.write(chunk as string, encoding as BufferEncoding, callback as () => void);
				}
				this.onData(chunk);
				return current.call(stream, chunk, encoding, callback);
			}) as WriteFunction & { [originalWrite]: WriteFunction };
			wrapper[originalWrite] = write;
			stream.write = wrapper as typeof stream.write;
		}
		this.listening = true;
	}
}

export interface ProgressStageUpdate {
	/** Progress from 0 to 100, or -1 for an indeterminate stage. */
	progress?: number;
	message?: string;
	detail?: string;
	hasErrors?: boolean;
}

interface ProgressStage extends Required<ProgressStageUpdate> {
	name: string;
	done: boolean;
}

const BULLET = '●';
const TICK = '✔';
const CROSS = '✖';
const SPINNER = '◌';

/**
 * A tsc-progress style reporter that displays the different stages of the
 * build as a set of progress bars, e.g.:
 *
 *   ● RBXTSC
 *   ● program   creating program...
 *   ● transform ██████████████░░░░░░░░░░░  45%  running transformers
 *   ● compile   ████████████████████████░  95%  (src/Main.server.ts)
 *   ● write     ░░░░░░░░░░░░░░░░░░░░░░░░░   0%
 *
 * On success `finish()` replaces the bars with a summary block, separated
 * from surrounding output by a blank line, with the lines tab-indented and
 * rendered in dark grey:
 *
 *   ✔ RBXTSC
 *   \tCompiled 12 files successfully in 193ms
 *   \tFound 0 errors, watching for file changes.
 */
export class ProgressReporter {
	private readonly colorLevel: 0 | 1 | 3;
	private readonly enabled: boolean;
	private readonly logUpdate = new LogUpdate();
	private readonly stages: ProgressStage[] = [];
	private readonly start = process.hrtime();
	private readonly summaryLines: string[] = [];
	private finished = false;
	private lastRenderTime = 0;

	constructor(
		private readonly title = 'RBXTSC',
		private readonly color = '#3156ff'
	) {
		this.colorLevel = getColorSupport();
		this.enabled = process.stderr.isTTY === true;
		if (this.enabled) {
			// Make sure a half-drawn bar never gets left behind on exit.
			process.once('exit', () => this.finish());
		}
	}

	/** Whether the reporter is actually rendering (i.e. stderr is a TTY). */
	get isEnabled() {
		return this.enabled;
	}

	getElapsedMs() {
		const [seconds, nanos] = process.hrtime(this.start);
		return seconds * 1000 + nanos / 1e6;
	}

	addStage(name: string) {
		const index = this.stages.length;
		this.stages.push({ name, progress: 0, message: '', detail: '', hasErrors: false, done: false });
		return index;
	}

	update(index: number, patch: ProgressStageUpdate) {
		const stage = this.stages[index];
		if (!stage || this.finished) return;
		Object.assign(stage, patch);
		if (stage.progress >= 100) {
			stage.done = true;
		}
		this.render(stage.hasErrors);
	}

	complete(index: number, message?: string) {
		const stage = this.stages[index];
		if (!stage || this.finished) return;
		stage.progress = 100;
		stage.done = true;
		if (message !== undefined) {
			stage.message = message;
		}
		this.render(true);
	}

	/** Queue a line to show in the summary block printed by `finish()`. */
	addSummaryLine(line: string) {
		this.summaryLines.push(line);
	}

	finish() {
		if (!this.enabled || this.finished) return;
		this.finished = true;
		const prevLineCount = this.logUpdate.prevLineCount;
		const extraLines = this.logUpdate.extraLines;
		this.logUpdate.stopListening();
		this.logUpdate.reset();
		// Erase the progress block, then write back anything that was printed
		// over it (warnings, diagnostics, etc.) so it stays on screen.
		let output = `${ansiEraseLines(prevLineCount)}${extraLines}`;
		if (this.summaryLines.length > 0) {
			if (extraLines.length > 0 && !extraLines.endsWith('\n')) {
				output += '\n';
			}
			// Blank line on either side separates the block from surrounding output.
			output += `\n${colorize(TICK, this.color, this.colorLevel)} ${colorize(this.title, this.color, this.colorLevel)}\n`;
			for (const line of this.summaryLines) {
				output += `\t\t${ansiColor(line, 90, this.colorLevel)}\n`;
			}
			output += '\n';
		}
		this.logUpdate.write(output);
	}

	private render(force = false) {
		if (!this.enabled || this.finished) return;
		const now = Date.now();
		if (!force && now - this.lastRenderTime < RENDER_INTERVAL_MS) return;
		this.lastRenderTime = now;
		const maxNameLength = Math.max(...this.stages.map((stage) => stage.name.length), 0);
		const overall = Math.round(
			this.stages.reduce((sum, stage) => sum + Math.max(stage.progress, 0), 0) / this.stages.length
		);
		const header = `${colorize(BULLET, this.color, this.colorLevel)} ${colorize(this.title, this.color, this.colorLevel)}  ${ansiColor(
			`${overall}%`,
			90,
			this.colorLevel
		)}`;
		const body = this.stages.map((stage) => this.renderStage(stage, maxNameLength)).join('\n');
		this.logUpdate.render(`${header}\n${body}`);
	}

	private renderStage(stage: ProgressStage, maxNameLength: number) {
		const name = stage.name.padEnd(maxNameLength);
		const bullet = ansiColor(BULLET, 34, this.colorLevel);
		if (stage.hasErrors) {
			const icon = ansiColor(CROSS, 31, this.colorLevel);
			const message = ansiColor(stage.message || 'failed', 31, this.colorLevel);
			return `${icon} ${name}  ${message}`;
		}
		if (stage.done) {
			const icon = colorize(TICK, this.color, this.colorLevel);
			const message = ansiColor(stage.message || 'done', 90, this.colorLevel);
			return `${icon} ${name}  ${message}`;
		}
		if (stage.progress < 0) {
			return `${bullet} ${name}  ${ansiColor(stage.message || SPINNER, 90, this.colorLevel)}`;
		}
		const bar = renderBar(stage.progress, this.color, this.colorLevel);
		const percent = `${Math.round(stage.progress)}%`.padStart(4);
		const detail = stage.detail ? `  ${ansiColor(stage.detail, 90, this.colorLevel)}` : '';
		return `${bullet} ${name} ${bar} ${percent}${detail}`;
	}
}
