import webpack from 'webpack';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create webpack configuration
const createConfig = (sourcePath, outputPath, options = {}) => ({
  mode: 'production',
  entry: sourcePath,
  output: {
    path: path.dirname(outputPath),
    filename: path.basename(outputPath),
    library: {
      type: 'commonjs2'
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: "defaults" }],
              '@babel/preset-react'
            ]
          }
        }
      }
    ]
  },
  // Tell webpack to look for loaders in the specified node_modules path or default to this package
  resolveLoader: {
    modules: [
      // Custom node_modules path if provided
      ...(options.nodeModulesPath ? [options.nodeModulesPath] : []),
      // Path to this project's node_modules
      path.resolve(__dirname, 'node_modules')
    ]
  },
  // Externals to avoid bundling common dependencies
  externals: {
    'react': 'commonjs react',
    'react-dom': 'commonjs react-dom',
    'classnames': 'commonjs classnames'
  }
});

// Compile function
export const compileScript = (sourcePath, outputPath, options = {}) => {
  const config = createConfig(sourcePath, outputPath, options);
  debugger;
  return new Promise((resolve, reject) => {
    webpack(config, (err, stats) => {
      if (err) {
        console.error(err);
        return reject(err);
      }

      if (stats.hasErrors()) {
        const info = stats.toJson();
        console.error(info.errors);
        return reject(new Error(info.errors.join('\n')));
      }

      console.log(stats.toString({
        colors: true,
        modules: false,
        chunks: false
      }));

      resolve();
    });
  });
};

// // Main function
// const main = async () => {
//   try {
//     const tempDir = path.resolve(__dirname, 'tmp');
//     const sourcePath = path.resolve(tempDir, 'sections/example.defaultSource.js');
//     const outputPath = path.resolve(tempDir, 'sections/example.default.js');

//     await compile(sourcePath, outputPath);
//     console.log(`Successfully compiled ${sourcePath} to ${outputPath}`);
//   } catch (error) {
//     console.error('Compilation failed:', error);
//     process.exit(1);
//   }
// };

// // Run the script
// main();