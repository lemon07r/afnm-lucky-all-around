const path = require('path');
const packageJson = require('./package.json');
const webpack = require('webpack');

const isProduction =
  process.env.NODE_ENV === 'production' ||
  (process.argv.includes('--mode') &&
    process.argv[process.argv.indexOf('--mode') + 1] === 'production') ||
  process.argv.includes('production');

module.exports = {
  mode: 'development',
  devtool: false,
  entry: './src/mod.ts',
  optimization: {
    minimize: false,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            compilerOptions: {
              sourceMap: !isProduction,
              inlineSourceMap: false,
              removeComments: isProduction,
            },
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: 'mod.js',
    path: path.resolve(__dirname, `dist/${packageJson.name}`),
    library: {
      name: 'AFNMMod',
      type: 'umd',
      export: 'default',
    },
    globalObject: 'this',
    publicPath: 'mod://',
  },
  plugins: [
    new webpack.DefinePlugin({
      MOD_METADATA: JSON.stringify({
        name: packageJson.name,
        version: packageJson.version,
        author: packageJson.author,
        description: packageJson.description,
        gameVersion: packageJson.gameVersion,
      }),
    }),
  ],
};
