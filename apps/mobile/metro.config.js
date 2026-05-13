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

// Pin singleton packages to the app's node_modules to prevent duplicate instances
// when Metro also searches the workspace root (which has its own copies).
const appNodeModules = path.resolve(projectRoot, 'node_modules');
config.resolver.extraNodeModules = {
  '@bistro/shared': path.resolve(workspaceRoot, 'packages/shared/src'),
  'react': path.resolve(appNodeModules, 'react'),
  'react-dom': path.resolve(appNodeModules, 'react-dom'),
  'react-native': path.resolve(appNodeModules, 'react-native'),
};

module.exports = withNativeWind(config, { input: './global.css' });
