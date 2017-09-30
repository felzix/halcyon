const path = require('path');

module.exports = {
  entry: './entry',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  module: {
    loaders: [
      {test: /\.json$/,
       loader: 'json-loader'
      },
      {test: /\.jsx?$/,
       loader: 'babel-loader',
       exclude: /node_modules/}
    ]
  }
};
