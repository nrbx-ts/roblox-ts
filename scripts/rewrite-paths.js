/**
 * Rewrites path-alias requires in the emitted `out/` directory to relative
 * paths. TS7 (the Go-based TypeScript port) does not support compiler plugins,
 * so this replaces what `typescript-transform-paths` used to do: turning
 * `require("project/functions/foo")` into `require("../project/functions/foo")`.
 *
 * Path aliases are defined in tsconfig.json under `paths` (`"*": ["./src/*"]`).
 * A specifier is treated as an alias only when it resolves to a file inside the
 * emitted output; everything else (node_modules, node: builtins) is left alone.
 */
const fs = require('node:fs');
const path = require('node:path');

const OUT_DIR = path.resolve(__dirname, '..', 'out');

// Matches the module specifier of a `require("...")` call.
const REQUIRE_RE = /require\(\s*["']([^"']+)["']\s*\)/g;

// Matches the module specifier of a static `from "..."` / `import "..."` in .d.ts files.
const IMPORT_RE = /(?:from|import)\s*["']([^"']+)["']/g;

function resolveOutPath(specifier) {
	if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('node:')) {
		const candidates = [
			path.join(OUT_DIR, `${specifier}.js`),
			path.join(OUT_DIR, specifier, 'index.js'),
		];
		for (const candidate of candidates) {
			if (fs.existsSync(candidate)) {
				return candidate;
			}
		}
	}
	return undefined;
}

function rewriteFile(filePath) {
	const source = fs.readFileSync(filePath, 'utf8');
	const dir = path.dirname(filePath);
	const isDeclaration = filePath.endsWith('.d.ts');
	const re = isDeclaration ? IMPORT_RE : REQUIRE_RE;
	const rewritten = source.replace(re, (match, specifier) => {
		const target = resolveOutPath(specifier);
		if (target === undefined) {
			return match;
		}
		let relative = path.relative(dir, target).replace(/\\/g, '/');
		if (!relative.startsWith('.')) {
			relative = `./${relative}`;
		}
		return match.replace(specifier, relative);
	});
	if (rewritten !== source) {
		fs.writeFileSync(filePath, rewritten);
	}
}

function walk(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const entryPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(entryPath);
		} else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.d.ts'))) {
			rewriteFile(entryPath);
		}
	}
}

if (!fs.existsSync(OUT_DIR)) {
	console.error(`rewrite-paths: output directory not found: ${OUT_DIR}`);
	process.exit(1);
}

walk(OUT_DIR);
console.log('rewrite-paths: rewritten path-alias requires in out/');
