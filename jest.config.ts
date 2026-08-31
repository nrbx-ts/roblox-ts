import type { Config } from "jest";

const config: Config = {
	preset: "ts-jest",
	testEnvironment: "node",
	testRegex: "/src/cli/test\\.ts$",
	modulePathIgnorePatterns: ["<rootDir>/out/"],
	moduleNameMapper: {
		"^(project|shared|cli|ts-transformer)/(.*)$": "<rootDir>/src/$1/$2",
		"^(project|shared|cli|ts-transformer)$": "<rootDir>/src/$1",
	},
	collectCoverageFrom: [
		"src/**/*.ts",
		"!src/cli/**",
		"!src/project/**",
		"!src/shared/classes/LogService.ts",
		"!src/ts-transformer/util/getFlags.ts",
		"!src/ts-transformer/util/getKindName.ts",
		"!src/ts-transformer/util/jsx/constants.ts",
	],
	coverageDirectory: "coverage",
	coverageReporters: ["lcov", "text"],
	verbose: true,
	transform: {
		"^.+\\.tsx?$": ["ts-jest", { tsconfig: "src/cli/tsconfig.json" }],
	},
};

export default config;
