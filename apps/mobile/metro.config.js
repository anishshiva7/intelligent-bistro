const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const appNodeModules = path.resolve(projectRoot, 'node_modules');

const config = getDefaultConfig(projectRoot);

// Watch all workspace packages so Metro picks up shared types live.
config.watchFolders = [workspaceRoot];

// Search the app's node_modules first, then the workspace root.
config.resolver.nodeModulesPaths = [
  appNodeModules,
  path.resolve(workspaceRoot, 'node_modules'),
];

// Map @bistro/shared to source so it doesn't need a build step.
config.resolver.extraNodeModules = {
  '@bistro/shared': path.resolve(workspaceRoot, 'packages/shared/src'),
};

// Force React, ReactDOM, and React Native to always resolve to the single copy
// in apps/mobile/node_modules (19.1.0), preventing a dual-instance crash when
// the workspace root also has a different version hoisted.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const singletons = ['react', 'react-dom'];
  if (singletons.includes(moduleName)) {
    return {
      filePath: require.resolve(moduleName, { paths: [appNodeModules] }),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
