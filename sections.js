import he from "he";
import fs from 'fs-extra'
import path from 'path'
import {JSDOM} from 'jsdom'
import {
  compileScripts,
  compileSchema,
  compileStyles,
} from './utils.js'

export default {
	compileSections,
	compileSection,
}

export async function compileSections({inputPath, outputPath, modules} = {}) {
	const root = process.cwd();
	inputPath = path.resolve(inputPath ? (
		path.isAbsolute(inputPath)
			? inputPath
			: `${root}/${inputPath}`
		) : path.resolve(`${root}/src/sections`)
	)
	outputPath = path.resolve(outputPath || `${root}/sections`)

	const fileNames =
		fs.readdirSync(inputPath)
		.filter(f => path.extname(f) === '.liquid')
	return Promise.all(
		fileNames.map(fileName => {
			const fileInputPath = path.resolve(`${inputPath}/${fileName}`)
			const fileOutputPath = path.resolve(`${outputPath}/${fileName}`)
			return compileSection({
				inputPath: fileInputPath,
				outputPath: fileOutputPath,
        modules,
			})
	}))
}

export async function compileSection({inputPath, outputPath, modules} = {}) {
	const root = process.cwd();
	inputPath = path.resolve(path.isAbsolute(inputPath) ? inputPath : `${root}/${inputPath}`)
	outputPath = path.resolve(outputPath || `${root}/sections/${path.basename(inputPath)}`)
	const inputSource = fs.readFileSync(inputPath, 'utf-8');

	const dom = new JSDOM(`<html><body>${inputSource}</body></html>`);
  const { window } = dom;
  const { document } = window;

	await compileSchema({dom, window, document, modules, inputPath, outputPath})
	await compileStyles({dom, window, document, modules, inputPath, outputPath})
	await compileScripts({dom, window, document, modules, inputPath, outputPath})

  const outputSource = he.decode(document.body.innerHTML);
	fs.writeFileSync(outputPath, outputSource);

	return {
		inputPath,
		outputPath,
		inputSource,
		outputSource,
	}
}

