import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			project: path.resolve(__dirname, 'src/project'),
			shared: path.resolve(__dirname, 'src/shared'),
			cli: path.resolve(__dirname, 'src/cli'),
			'ts-transformer': path.resolve(__dirname, 'src/ts-transformer'),
		},
	},
	test: {
		environment: 'node',
		include: ['src/cli/test.ts'],
		coverage: {
			provider: 'v8',
			include: [
				'src/**/*.ts',
				'!src/cli/**',
				'!src/project/**',
				'!src/shared/classes/LogService.ts',
				'!src/ts-transformer/util/getFlags.ts',
				'!src/ts-transformer/util/getKindName.ts',
				'!src/ts-transformer/util/jsx/constants.ts',
			],
			reporter: ['lcov', 'text'],
		},
	},
});
