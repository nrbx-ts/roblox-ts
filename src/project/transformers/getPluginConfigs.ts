import path from 'node:path';
import { ProjectError } from 'shared/errors/ProjectError';
import type { TransformerPluginConfig } from 'shared/types';
import * as ts from 'typescript/sync';

export function getPluginConfigs(tsConfigPath: string) {
	const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
	if (configFile.error) {
		throw new ProjectError(configFile.error.messageText?.toString() ?? '');
	}

	const pluginConfigs: TransformerPluginConfig[] = [];
	const config = configFile.config;
	const plugins = config.compilerOptions?.plugins;
	if (plugins && Array.isArray(plugins)) {
		for (const pluginConfig of plugins) {
			if (pluginConfig.transform && typeof pluginConfig.transform === 'string') {
				pluginConfigs.push(pluginConfig);
			}
		}
	}

	if (config.extends) {
		const extendedPath = require.resolve(config.extends, {
			paths: [path.dirname(tsConfigPath)],
		});
		pluginConfigs.push(...getPluginConfigs(extendedPath));
	}

	return pluginConfigs;
}
