import prettier from 'prettier'
import liquidPlugin from "@shopify/prettier-plugin-liquid";
import * as liquidParser from '@shopify/liquid-html-parser'
import React from 'react'
import ReactDOMServer from "react-dom/server";
import he from "he";
import { transformSync } from "@babel/core";
import {JSDOM} from 'jsdom'
import * as sass from 'sass'
import crypto from 'crypto'

export function parseLiquid(source) {
	const tags = getTags(source)
	const variables = getVariables(source)
	return {tags, variables}
}

export function tokenizeJsxSource(source, tags, variables) {
	[...tags, ...variables].forEach(item => {
		source = source.replace(item.source, item.token);
	})
	return source
}

export function getTags(source) {
	const regex = /{%(.*?)%}/gs;
	const tags =
		Array.from(source.matchAll(regex))
		.map(match => {
			return {
				position: {start: match.index, end: match.index + match[0].length - 1},
				innerSource: match[1],
				source: match[0],
				cleanSource: match[0].replace(/"/g, "'"),
				type: 'LiquidTag',
				token: generateToken({source: match[0]}),
			};
		})
	return tags;
}

export function getVariables(source) {
	const regex =  /{{\s*([^{}]*?)(?={{\s*[^{}]*}})?\s*}}/g;
	const variables =
		Array.from(source.matchAll(regex))
		.map(match => {
			const isValid = typeof liquidParser.toLiquidAST(match[0])?.children[0]?.markup === 'object';
			return isValid && {
				position: {start: match.index, end: match.index + match[0].length - 1},
				innerSource: match[1],
				source: match[0],
				cleanSource: match[0].replace(/"/g, "'"),
				type: 'LiquidTag',
				token: generateToken({source: match[0]}),
			};
		}).filter(v => v);
	return variables;
}

export function minify(code) {
  return code.replace(/\s+/g, ' ').trim();
}

export async function prettyLiquid(source) {
  let formatted = await prettier.format(source, {
    plugins: [liquidPlugin],
    parser: "liquid-html",
    singleQuote: false,
  });
  formatted = formatted.replace(/'/g, '"');
  return formatted;
}

export async function prettyJs(source) {
  return await prettier.format(source, {
    parser: "babel",
  });
}

export function sleep(ms=1) {
	return new Promise(r => setTimeout(r, ms))
}

export function generateToken({key=777, source=''}) {
  const hash = crypto.createHash('sha256').update(source).digest('hex');
  const numericHash = parseInt(hash.substring(0, 15), 16);
  return numericHash;
}

export async function compileScripts({ document }) {
	const scripts = Array.from(document.querySelectorAll('script[type="text/babel"]'))
	return Promise.all(scripts.map(async script => {
		const source = script.outerHTML;
		const scriptId = generateToken({source})
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

export async function compileSchema({ document }) {
  const script = document.querySelector('script[id="schema"]');
  if (!script) return;
  const schema = `{% schema %} ${JSON.stringify(eval(script.innerHTML), null, 2)} {% endschema %}`;
	script.outerHTML = schema;
	return {script, schema}
}

export async function compileStyles({document}) {
	const liquidSyntaxRegex = /({{.*?}}|{%-?.*?-?%}|{% liquid.*?%})/gs;
	const styles = Array.from(document.querySelectorAll('style[type="text/scss"]'))
	return Promise.all(styles.map(async style => {
		style.setAttribute('type', 'text/plain');
    let matches = [];
    const cssString = style.innerHTML.replace(liquidSyntaxRegex, (match) => {
			let token = generateToken({source: match});
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
		style.setAttribute('type', 'text/css');
		return {matches, cssString, css, sectionCss};
	}))
}

export async function tokenizeScriptSource(source) {
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

export function stripPreloadLinks(source) {
	const regex = /<link rel="preload"(.*?)>/gs;
	Array.from(source.matchAll(regex)).forEach(match => {
		const outer = match[0]
		source = source.replace(outer, '')
	})
	return source;
}
