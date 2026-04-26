const path = require("path");

/**
 * @type {import('webpack').Configuration}
 */
module.exports = {
  mode: "production",
  entry: "./tests/index.tsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "react.[contenthash].bundle.js",
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)$/, // Regex to match .js and .jsx files
        exclude: /node_modules/, // Exclude the node_modules directory
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"],
          },
        },
      },
    ],
  },
};
