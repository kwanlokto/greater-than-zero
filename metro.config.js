const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle Drizzle's generated .sql migrations with the app.
config.resolver.sourceExts.push('sql');

module.exports = config;
