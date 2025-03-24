import he from "he";
import fs from 'fs-extra'
import path from 'path'
import {JSDOM} from 'jsdom'
import {
  prettyLiquid,
  compileScripts,
  compileStyles,
} from './utils.js'

export default {
  compileSnippets,
  compileSnippet,
}

export async function compileSnippets({inputPath, outputPath} = {}) {
  const root = process.cwd();
  inputPath = path.resolve(inputPath ? (
    path.isAbsolute(inputPath)
      ? inputPath
      : `${root}/${inputPath}`
    ) : path.resolve(`${root}/src/snippets`)
  )
  outputPath = path.resolve(outputPath || `${root}/snippets`)

  const fileNames =
    fs.readdirSync(inputPath)
    .filter(f => path.extname(f) === '.liquid' && !f.endsWith('.jsx.liquid'))
  return Promise.all(
    fileNames.map(fileName => {
      const fileInputPath = path.resolve(`${inputPath}/${fileName}`)
      const fileOutputPath = path.resolve(`${outputPath}/${fileName}`)
      return compileSnippet({
        inputPath: fileInputPath,
        outputPath: fileOutputPath,
      })
  }))
}

export async function compileSnippet({inputPath, outputPath} = {}) {
  const root = process.cwd();
  inputPath = path.resolve(path.isAbsolute(inputPath) ? inputPath : `${root}/${inputPath}`)
  outputPath = path.resolve(outputPath || `${root}/sections/${path.basename(inputPath)}`)
  const inputSource = fs.readFileSync(inputPath, 'utf-8');

  const dom = new JSDOM(`<html><body>${inputSource}</body></html>`);
  const { window } = dom;
  const { document } = window;

  await compileStyles({dom, window, document})
  await compileScripts({dom, window, document})

  const outputSource = await prettyLiquid(he.decode(document.body.innerHTML));
  fs.writeFileSync(outputPath, outputSource);

  return {
    inputPath,
    outputPath,
    inputSource,
    outputSource,
  }
}

