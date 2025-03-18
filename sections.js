import React from 'react'
import ReactDOMServer from "react-dom/server";
import he from "he";
import fs from 'fs-extra'
import { transformSync } from "@babel/core";
import path from 'path'
import {JSDOM} from 'jsdom'
import * as sass from 'sass'
import {
	parseLiquid,
	tokenizeJsxSource,
	prettyLiquid,
	prettyJs,
	generateToken
} from './utils.js'

export default {
	compileSections,
	compileSection,
}

export async function compileSections({inputPath, outputPath} = {}) {
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
			})
	}))
}

export async function compileSection({inputPath, outputPath} = {}) {
	const root = process.cwd();
	inputPath = path.resolve(path.isAbsolute(inputPath) ? inputPath : `${root}/${inputPath}`)
	outputPath = path.resolve(outputPath || `${root}/sections/${path.basename(inputPath)}`)
	const inputSource = fs.readFileSync(inputPath, 'utf-8');

	const dom = new JSDOM(`<html><body>${inputSource}</body></html>`);
  const { window } = dom;
  const { document } = window;

	await compileSchema({dom, window, document})
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

async function compileScripts({ document }) {
	const scripts = Array.from(document.querySelectorAll('script[type="text/babel"]'))
	return Promise.all(scripts.map(async script => {
		const scriptId = generateToken()
		const source = script.outerHTML;
	  const {tokenizedSource, tags, variables} = await tokenizeScriptSource(source, false)
		const {hydratedJs, tokenizedJs} = await compileJs({
			tokenizedSource,
			tags,
			variables,
		})
		const {hydratedHtml, tokenizedHtml} = await compileHtml({
			tokenizedJs,
			tags,
			variables,
		})
		script.outerHTML = `
			<div class="root root-${scriptId}">${hydratedHtml}</div>
			<script type="module">
				${hydratedJs}
				ReactDOMClient
					.createRoot(document.querySelector('#shopify-section-{{section.id}} .root-${scriptId}'))
					.render(React.createElement(App));
			</script>
		`
		return {scriptId, source, tokenizedSource, tags, variables, hydratedJs, tokenizedJs, hydratedHtml, tokenizedHtml}
	}))
}

async function compileSchema({ document }) {
  const script = document.querySelector('script[id="schema"]');
  if (!script) return;
  const schema = `{% schema %} ${JSON.stringify(eval(script.innerHTML), null, 2)} {% endschema %}`;
	script.outerHTML = schema;
	return {script, schema}
}

async function compileStyles({document}) {
	const liquidSyntaxRegex = /({{.*?}}|{%-?.*?-?%}|{% liquid.*?%})/gs;
	const styles = Array.from(document.querySelectorAll('style[type="text/scss"]'))
	return Promise.all(styles.map(async style => {
		style.setAttribute('type', 'text/plain');
    let matches = [];
    const cssString = style.innerHTML.replace(liquidSyntaxRegex, (match) => {
			let token = generateToken();
      let replace = "";
      if (match.startsWith("{{")) replace = Number(`${token}`)
      if (match.startsWith("{%")) replace = String(`/*${token}*/`);
      matches.push({ replace, match });
      return replace;
    });
    const { css } = sass.compileString(cssString, { style: "expanded" });
    let sectionCss = css;
    matches.forEach((match) => {
			if(!match.match.startsWith('{%')) return;
			sectionCss = sectionCss.replace(match.replace, match.match);
		});
    matches.forEach((match) => {
			if(!match.match.startsWith("{{")) return;
			const regex = new RegExp(match.replace, 'g')
			sectionCss = sectionCss.replace(regex, match.match);
		});
		style.innerHTML = sectionCss;
		style.removeAttribute('type');
		return {matches, cssString, css, sectionCss};
	}))
}

async function tokenizeScriptSource(source) {
	source = await prettyLiquid(source)
	const {tags, variables} = parseLiquid(source);
	const tokenizedSource = tokenizeJsxSource(source, tags, variables)
	return {tokenizedSource, tags, variables}
}

export async function compileJs({tokenizedSource, tags, variables}) {
	const scriptDom = new JSDOM(`<html><body>${tokenizedSource}</body></html>`);
	const strippedSource = scriptDom.window.document.querySelector('script').innerHTML
	tokenizedSource = await prettyJs(strippedSource);
  let tokenizedJs = transformSync(tokenizedSource, {
    presets: ["@babel/preset-react"],
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  }).code;
	tokenizedJs = await prettyJs(tokenizedJs);
  let hydratedJs = tokenizedJs;
  tags.forEach(tag => {
    hydratedJs = hydratedJs.replace(tag.token, tag.cleanSource)
  })
  variables.forEach(variable => {
    hydratedJs = hydratedJs.replace(variable.token, variable.cleanSource)
  })
  return {tokenizedJs, hydratedJs};
}

export async function compileHtml({tokenizedJs, tags, variables, functionName='App'}) {
  const App = new Function(`
    const React = arguments[0];
    const _react = {default: arguments[0]};
    ${tokenizedJs};
    return typeof ${functionName} === 'function' ? ${functionName} : _${functionName};
  `)(React);

  let tokenizedHtml = he.decode(ReactDOMServer.renderToString(React.createElement(App)));
  let hydratedHtml =  stripPreloadLinks(tokenizedHtml)

  tags.forEach(tag => {
    hydratedHtml = hydratedHtml.replace(tag.token, tag.cleanSource)
  })
  variables.forEach(variable => {
    hydratedHtml = hydratedHtml.replace(variable.token, variable.cleanSource)
  })

  return {tokenizedHtml, hydratedHtml};
}

function stripPreloadLinks(source) {
	const regex = /<link rel="preload"(.*?)>/gs;
	Array.from(source.matchAll(regex)).forEach(match => {
		const outer = match[0]
		source = source.replace(outer, '')
	})
	return source;
}
