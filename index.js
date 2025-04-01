// import sections from './sections.js'
// import snippets from './snippets.js'

// export const compileSections = sections.compileSections;
// export const compileSection = sections.compileSection;
// export const compileSnippets = snippets.compileSnippets;
// export const compileSnippet = snippets.compileSnippet;

// export default {
// 	compileSections,
// 	compileSection,
// 	compileSnippets,
// 	compileSnippet,
// }


import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import babelParser from '@babel/parser'
import babelTraverse from '@babel/traverse'
import {parseLiquid} from './parsers.js'
import * as sass from 'sass'
import crypto from 'crypto'
import prettier from 'prettier'
import liquidPlugin from "@shopify/prettier-plugin-liquid";
import {compileScript} from './compile-script.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const build = async () => {
  // Define the path to the source directory
  const rootDir = process.cwd();
  const tempDir = path.resolve(`${__dirname}/tmp`);

  fs.removeSync(tempDir)
  fs.ensureDirSync(tempDir);
  fs.copySync(rootDir, tempDir);



  const source = fs.readFileSync(path.resolve(`${tempDir}/sections/example.js`), 'utf-8');
  const {tokenizedSource, tags, variables} = getTokenizedSource(source)

  const imports = extractImports(tokenizedSource);
  const defaultExport = getExportSource(tokenizedSource, 'default');

  const defaultSource = `${imports}\n\n export default ${defaultExport}`
  const defaultInputFile = path.resolve(`${tempDir}/sections/example.defaultInput.js`);
  const defaultOutputFile = path.resolve(`${tempDir}/sections/example.defaultOutput.js`);
  fs.writeFileSync(defaultInputFile, defaultSource);

  const result = await compileScript(defaultInputFile, defaultOutputFile, {
    nodeModulesPath: path.resolve(__dirname, 'node_modules')
  });

  debugger;


  const styleExport = getExportSource(tokenizedSource, 'style');
  const schemaExport = getExportSource(tokenizedSource, 'schema');

  const compiledStyle = styleExport && compileStyle(styleExport, tags, variables)
  const styleOutput = compiledStyle && `<style>\n${compiledStyle}\n</style>`

  const compiledSchema = schemaExport && compileSchema(schemaExport)
  const schemaOutput = compiledStyle && `{% schema %}\n${compiledSchema}\n{% endschema %}`


  const sectionOutput = await prettyLiquid(`
    ${styleOutput || ''} \n
    ${styleOutput || ''} \n
    ${schemaOutput} \n
  `)
  // fs.writeFileSync(path.resolve(`${tempDir}/sectionOutput.liquid`), sectionOutput)

  // debugger;
}

function removeAllExcept(directoryPath, excludePatterns = ['node_modules']) {
  // Get all items in directory
  const items = fs.readdirSync(directoryPath)

  // Process each item
  for (const item of items) {
    // Skip excluded patterns
    if (excludePatterns.includes(item)) {
      continue
    }

    const itemPath = path.join(directoryPath, item)

    // Remove the item (file or directory)
    fs.removeSync(itemPath)
  }

  console.log(`Removed all items in ${directoryPath} except: ${excludePatterns.join(', ')}`)
}

function compileSchema(source) {
  const schemaJson = JSON.stringify(eval(`(${source})`), null, 2);
  return schemaJson;
}

function getTokenizedSource(source) {
  const  {tags, variables} = parseLiquid(source);
  let tokenizedSource = source;
  [...tags, ...variables].forEach(item => {
    tokenizedSource = tokenizedSource.replace(item.source, item.token)
  })
  return {tokenizedSource, tags, variables};
}

function getExportSource(source, exportName) {
  // Check if we're looking for default export
  const isDefault = exportName === 'default';

  // Parse code into AST
  const ast = babelParser.parse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'] // Add any plugins you need
  });

  // Track all declarations and their sources
  const declarations = {};

  // First pass: collect all declarations (functions, variables, etc.)
  babelTraverse.default(ast, {
    FunctionDeclaration(path) {
      if (path.node.id) {
        const name = path.node.id.name;
        declarations[name] = {
          type: 'function',
          start: path.node.start,
          end: path.node.end,
          source: source.substring(path.node.start, path.node.end)
        };
      }
    },

    VariableDeclarator(path) {
      if (path.node.id.type === 'Identifier') {
        const name = path.node.id.name;

        if (path.node.init) {
          if (path.node.init.type === 'Identifier') {
            // Reference to another variable
            declarations[name] = {
              type: 'reference',
              refName: path.node.init.name
            };
          } else if (path.node.init.type === 'StringLiteral') {
            // String literal - store without quotes
            declarations[name] = {
              type: 'string',
              value: path.node.init.value
            };
          } else if (path.node.init.type === 'TemplateLiteral') {
            // Template literal - get content without backticks
            let templateContent = source.substring(path.node.init.start + 1, path.node.init.end - 1);
            declarations[name] = {
              type: 'template',
              value: templateContent
            };
          } else {
            // Other expressions (objects, functions, etc.)
            declarations[name] = {
              type: 'value',
              start: path.node.init.start,
              end: path.node.init.end,
              source: source.substring(path.node.init.start, path.node.init.end)
            };
          }
        }
      }
    }
  });

  let exportInfo = null;

  // Second pass: Find the export
  babelTraverse.default(ast, {
    ExportDefaultDeclaration(path) {
      if (isDefault) {
        if (path.node.declaration.type === 'Identifier') {
          // Default export is a reference to another variable
          const referencedName = path.node.declaration.name;
          exportInfo = { name: referencedName, type: 'reference' };
        } else if (path.node.declaration.type === 'StringLiteral') {
          // Direct string export - store without quotes
          exportInfo = {
            type: 'string',
            value: path.node.declaration.value
          };
        } else if (path.node.declaration.type === 'TemplateLiteral') {
          // Direct template export - get content without backticks
          let templateContent = source.substring(path.node.declaration.start + 1, path.node.declaration.end - 1);
          exportInfo = {
            type: 'template',
            value: templateContent
          };
        } else {
          // Other direct export
          exportInfo = {
            type: 'direct',
            start: path.node.declaration.start,
            end: path.node.declaration.end,
            source: source.substring(path.node.declaration.start, path.node.declaration.end)
          };
        }
      }
    },

    ExportNamedDeclaration(path) {
      if (!isDefault) {
        // Named export specifiers (export { x })
        path.node.specifiers.forEach(specifier => {
          if (specifier.exported.name === exportName) {
            const localName = specifier.local.name;
            exportInfo = { name: localName, type: 'reference' };
          }
        });

        // Direct named exports (export const x = ...)
        if (path.node.declaration && path.node.declaration.declarations) {
          path.node.declaration.declarations.forEach(declaration => {
            if (declaration.id.name === exportName) {
              if (declaration.init.type === 'Identifier') {
                // Export references another variable
                exportInfo = { name: declaration.init.name, type: 'reference' };
              } else if (declaration.init.type === 'StringLiteral') {
                // String literal - store without quotes
                exportInfo = {
                  type: 'string',
                  value: declaration.init.value
                };
              } else if (declaration.init.type === 'TemplateLiteral') {
                // Template literal - get content without backticks
                let templateContent = source.substring(declaration.init.start + 1, declaration.init.end - 1);
                exportInfo = {
                  type: 'template',
                  value: templateContent
                };
              } else {
                // Other direct value export
                exportInfo = {
                  type: 'direct',
                  start: declaration.init.start,
                  end: declaration.init.end,
                  source: source.substring(declaration.init.start, declaration.init.end)
                };
              }
            }
          });
        }
      }
    }
  });

  // Resolve the export if it's a reference
  if (exportInfo && exportInfo.type === 'reference') {
    let currentName = exportInfo.name;
    let maxDepth = 10; // Prevent infinite loops

    // Follow the reference chain
    while (declarations[currentName] && declarations[currentName].type === 'reference' && maxDepth > 0) {
      currentName = declarations[currentName].refName;
      maxDepth--;
    }

    // Return the final resolved source
    if (declarations[currentName]) {
      if (declarations[currentName].type === 'string' || declarations[currentName].type === 'template') {
        return declarations[currentName].value;
      }
      return declarations[currentName].source;
    }
  } else if (exportInfo) {
    if (exportInfo.type === 'string' || exportInfo.type === 'template') {
      return exportInfo.value;
    } else if (exportInfo.type === 'direct') {
      // Handle direct exports that might be strings or templates
      // Check if it's a string literal without quotes or a template literal without backticks
      if (exportInfo.source.startsWith('"') && exportInfo.source.endsWith('"') ||
          exportInfo.source.startsWith("'") && exportInfo.source.endsWith("'")) {
        // Remove the quotes
        return exportInfo.source.substring(1, exportInfo.source.length - 1);
      } else if (exportInfo.source.startsWith('`') && exportInfo.source.endsWith('`')) {
        // Remove the backticks
        return exportInfo.source.substring(1, exportInfo.source.length - 1);
      }
      return exportInfo.source;
    }
  }

  return null;
}

function compileStyle(source, tags, variables) {
  if(!source) return;
	const styleRegex = /({{.*?}}|{%-?.*?-?%}|{% liquid.*?%})/gs;
  const hydratedSource =  hydrateSource(source, tags, variables)
  let matches = [];
  const cssString = hydratedSource.replace(styleRegex, (match) => {
    let token = generateToken(match);
    let replace = "";
    if (match.startsWith("{{")) replace = Number(`${token}`)
    if (match.startsWith("{%")) replace = String(`/*${token}*/`);
    matches.push({ replace, match });
    return replace;
  });
  const { css } = sass.compileString(cssString, { style: "expanded" });
  let hydratedCss = css;
  matches.forEach((match) => {
    if(!match.match.startsWith('{%')) return;
    hydratedCss = hydratedCss.replace(match.replace, match.match);
  });
  matches.forEach((match) => {
    if(!match.match.startsWith("{{")) return;
    const regex = new RegExp(match.replace, 'g')
    hydratedCss = hydratedCss.replace(regex, match.match);
  });
  return hydratedCss;
}

function hydrateSource(source, tags, variables) {
  [...tags, ...variables].forEach(item => {
    source = source.replace(item.token, item.source)
  })
  return source;
}

function generateToken(source) {
  const hash = crypto.createHash('sha256').update(source).digest('hex');
  const numericHash = parseInt(hash.substring(0, 15), 16);
  return numericHash;
}

async function prettyLiquid(source) {
  let formatted = await prettier.format(source, {
    plugins: [liquidPlugin],
    parser: "liquid-html",
    singleQuote: false,
  });
  // formatted = formatted.replace(/'/g, '"');
  return formatted;
}

function extractImports(source) {
  try {
    // Parse the code with Babel
    const ast = babelParser.parse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'] // Add any other plugins you might need
    })

    const imports = []

    // Traverse the AST and find import declarations
    babelTraverse.default(ast, {
      ImportDeclaration(path) {
        const node = path.node

        // Basic import information
        const importInfo = {
          // The raw import statement
          statement: source.substring(node.start, node.end),
          // The module path being imported
          source: node.source.value,
          // Start and end positions in the source
          position: {
            start: node.start,
            end: node.end
          },
          // Array of imported specifiers (what's being imported)
          specifiers: []
        }

        // Extract all specifiers (the imported items)
        node.specifiers.forEach(specifier => {
          if (specifier.type === 'ImportDefaultSpecifier') {
            // For: import Name from 'module'
            importInfo.specifiers.push({
              type: 'default',
              local: specifier.local.name
            })
          } else if (specifier.type === 'ImportSpecifier') {
            // For: import { name } from 'module'
            importInfo.specifiers.push({
              type: 'named',
              imported: specifier.imported.name,
              local: specifier.local.name
            })
          } else if (specifier.type === 'ImportNamespaceSpecifier') {
            // For: import * as name from 'module'
            importInfo.specifiers.push({
              type: 'namespace',
              local: specifier.local.name
            })
          }
        })

        imports.push(importInfo)
      }
    })

    return imports?.length && imports.map(i => i.statement).join('\n')
  } catch (error) {
    console.error('Error extracting imports:', error)
    return []
  }
}