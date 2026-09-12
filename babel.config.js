module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Drizzle's generated migrations.js imports .sql files; inline them as strings.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
