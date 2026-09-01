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

// A braille cell is roughly half the width of a full block, so use more of them
// to keep the bar a similar on-screen size.
const BRAILLE_BAR_LENGTH = 40;
const BRAILLE_DOTS_PER_CELL = 8;
// Progressive braille cell states, from empty to full (⣿), built up dot by dot.
// Dots are added bottom-to-top within the left column, then the right column,
// so the bar reads like a building being erected left-to-right.
const BRAILLE_STATES = Array.from({ length: BRAILLE_DOTS_PER_CELL + 1 }, (_, dots) =>
	String.fromCodePoint(0x2800 + ((1 << dots) - 1))
);
// Cap redraws at ~30fps so large projects don't flood the terminal with writes.
const RENDER_INTERVAL_MS = 33;

function renderBrailleBar(progress: number, color: string, level: 0 | 1 | 3) {
	const totalDots = BRAILLE_BAR_LENGTH * BRAILLE_DOTS_PER_CELL;
	const filledDots = Math.round((progress / 100) * totalDots);
	let bar = '';
	for (let i = 0; i < BRAILLE_BAR_LENGTH; i++) {
		const dots = Math.max(0, Math.min(BRAILLE_DOTS_PER_CELL, filledDots - i * BRAILLE_DOTS_PER_CELL));
		const glyph = BRAILLE_STATES[dots];
		bar += dots === 0 ? ansiColor(glyph, 90, level) : colorize(glyph, color, level);
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
// Rotating braille spinner, shown next to the title while any stage is active.
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPINNER_INTERVAL_MS = 80;
// Indeterminate stages get a looping "building" animation: the bar fills from
// left to right over this many milliseconds, then starts building again.
const INDETERMINATE_INTERVAL_MS = 20;

function getSpinnerFrame() {
	return SPINNER_FRAMES[Math.floor(Date.now() / SPINNER_INTERVAL_MS) % SPINNER_FRAMES.length];
}

function renderIndeterminateBar(color: string, level: 0 | 1 | 3) {
	const phase = (Date.now() / INDETERMINATE_INTERVAL_MS) % 100;
	return renderBrailleBar(phase, color, level);
}

const bold = {
	open: '\u001B[1m',
	close: '\u001B[22m',
};

function applyBold(text: string) {
	return bold.open + text + bold.close;
}

export class ProgressReporter {
	private readonly colorLevel: 0 | 1 | 3;
	private readonly enabled: boolean;
	private readonly logUpdate = new LogUpdate();
	private readonly stages: ProgressStage[] = [];
	private readonly start = process.hrtime();
	private readonly summaryLines: string[] = [];
	private finished = false;
	private lastRenderTime = 0;
	private animationTimer: NodeJS.Timeout | undefined;

	constructor(
		private readonly title = applyBold('RBXTSC'),
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
		if (this.animationTimer) {
			clearInterval(this.animationTimer);
			this.animationTimer = undefined;
		}
		const prevLineCount = this.logUpdate.prevLineCount;
		const extraLines = this.logUpdate.extraLines;
		this.logUpdate.stopListening();
		this.logUpdate.reset();

		let output = `${ansiEraseLines(prevLineCount)}${extraLines}`;
		if (this.summaryLines.length > 0) {
			if (extraLines.length > 0 && !extraLines.endsWith('\n')) output += '\n';
			output += `\n    ${colorize(TICK, this.color, this.colorLevel)} ${colorize(this.title, this.color, this.colorLevel)}\n`;
			for (const line of this.summaryLines) output += `        ${ansiColor(line, 90, this.colorLevel)}\n`;
			output += '\n';
		}

		this.logUpdate.write(output);
	}

	private render(force = false) {
		if (!this.enabled || this.finished) return;
		this.startAnimationLoop();
		const now = Date.now();
		if (!force && now - this.lastRenderTime < RENDER_INTERVAL_MS) return;
		this.lastRenderTime = now;
		const maxNameLength = Math.max(...this.stages.map((stage) => stage.name.length), 0);
		const overall = Math.round(
			this.stages.reduce((sum, stage) => sum + Math.max(stage.progress, 0), 0) / this.stages.length
		);
		const spinning = this.stages.some((stage) => !stage.done);
		const icon = spinning
			? colorize(getSpinnerFrame(), this.color, this.colorLevel)
			: colorize(BULLET, this.color, this.colorLevel);
		const header = `\n    ${icon} ${colorize(this.title, this.color, this.colorLevel)}  ${ansiColor(
			`${overall}%`,
			90,
			this.colorLevel
		)}`;
		const body = this.stages.map((stage) => this.renderStage(stage, maxNameLength)).join('\n');
		this.logUpdate.render(`${header}\n${body}\n`);
	}

	private renderStage(stage: ProgressStage, maxNameLength: number) {
		const name = stage.name.padEnd(maxNameLength);
		const bullet = ansiColor(BULLET, 34, this.colorLevel);
		if (stage.hasErrors) {
			const icon = ansiColor(CROSS, 31, this.colorLevel);
			const message = ansiColor(stage.message || 'failed', 31, this.colorLevel);
			return `        ${icon} ${name}  ${message}`;
		}
		if (stage.done) {
			const icon = colorize(TICK, this.color, this.colorLevel);
			const message = ansiColor(stage.message || 'done', 90, this.colorLevel);
			return `        ${icon} ${name}  ${message}`;
		}
		if (stage.progress < 0) {
			const bar = renderIndeterminateBar(this.color, this.colorLevel);
			const message = stage.message ? `  ${ansiColor(stage.message, 90, this.colorLevel)}` : '';
			return `        ${bullet} ${name} ${bar}${message}`;
		}
		const bar = renderBrailleBar(stage.progress, this.color, this.colorLevel);
		const percent = `${Math.round(stage.progress)}%`.padStart(4);
		const detail = stage.detail ? `  ${ansiColor(stage.detail, 90, this.colorLevel)}` : '';
		return `        ${bullet} ${name} ${bar} ${percent}${detail}`;
	}

	private startAnimationLoop() {
		if (this.animationTimer) return;
		this.animationTimer = setInterval(() => this.render(), RENDER_INTERVAL_MS);
		// Don't keep the process alive just to animate the progress bars.
		this.animationTimer.unref();
	}
}
