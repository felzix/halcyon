const path = require('path');

module.exports = {
  entry: './entry',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  node: {
    fs: 'empty'
  },
  module: {
    loaders: [
      {test: /\.json$/,
       loader: 'json-loader'
      },
      {test: /\.jsx?$/,
       loader: 'babel-loader',
       exclude: [/node_modules/, 'test.js', 'node-server.js']}
    ]
  }
};
