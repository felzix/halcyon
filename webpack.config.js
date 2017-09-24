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
       loader: 'json'
      },
      {test: /\.jsx?$/,
       loader: 'babel-loader',
       exclude: /node_modules/,
       query: {
         presets: ['es2015', 'react', 'stage-2'],
         plugins: ['transform-async-to-generator']
       }}
    ]
  }
};
