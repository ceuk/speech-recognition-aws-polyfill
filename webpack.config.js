/* global __dirname, module require */
const path = require('path')
const webpack = require('webpack')

module.exports = [
  'source-map'
].map(devtool => ({
  mode: 'development',
  entry: './src/index.js',
  module: {
    rules: [
      {
        test: /\.(js)$/,
        exclude: /node_modules/,
        use: ['babel-loader']
      }
    ]
  },
  resolve: {
    extensions: ['*', '.js'],
    fallback: {
      util: require.resolve('util/'),
      stream: require.resolve('stream-browserify'),
      crypto: require.resolve('crypto-browserify')
    }
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    libraryTarget: 'umd',
    globalObject: "typeof self !== 'undefined' ? self : this"
  },
  devServer: {
    contentBase: path.resolve(__dirname, './dist')
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser'
    })
  ],
  devtool
}))
