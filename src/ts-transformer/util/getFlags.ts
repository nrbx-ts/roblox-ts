// for debugging purposes: extracts flag names from a bitfield

export function getFlags<T extends number>(flags: T, from: Record<string | number, string | number>) {
	const results: string[] = [];
	for (const [flagName, flagValue] of Object.entries(from)) {
		if (typeof flagValue === 'number' && flags & flagValue) {
			results.push(flagName);
		}
	}
	return results;
}
