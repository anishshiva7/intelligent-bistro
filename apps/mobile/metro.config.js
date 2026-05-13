const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all workspace packages
config.watchFolders = [workspaceRoot];

// Resolve from workspace root so shared package is found
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Allow importing from packages/shared without building
config.resolver.extraNodeModules = {
  '@bistro/shared': path.resolve(workspaceRoot, 'packages/shared/src'),
};

module.exports = withNativeWind(config, { input: './global.css' });
