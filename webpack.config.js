"use strict";


module.exports = {
  entry: './src/entry',
  output: {
    path: './bundles',
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
         presets: ['es2015', 'react'],
         plugins: ["transform-async-to-generator"]
       }},
      {test: /\.css$/,
       loader: 'style-loader!css-loader'}
    ]
  }
};
