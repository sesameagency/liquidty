import * as liquidParser from '@shopify/liquid-html-parser'
import prettier from 'prettier'
import liquidPlugin from "@shopify/prettier-plugin-liquid";

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
				token: generateToken(),
			};
		})
	return tags;
}

export function getVariables(source) {
	const regex =  /{{\s*([^{}]*?)(?={{\s*[^{}]*}})?\s*}}/g;
	const variables =
		Array.from(source.matchAll(regex))
		.map(match => {
			return {
				position: {start: match.index, end: match.index + match[0].length - 1},
				innerSource: match[1],
				source: match[0],
				cleanSource: match[0].replace(/"/g, "'"),
				type: 'LiquidTag',
				token: generateToken(),
			};
		})
	return variables;
}

export function minify(code) {
  return code.replace(/\s+/g, ' ').trim(); // Remove excess whitespace and newlines
}

export async function prettyLiquid(source) {
  return await prettier.format(source, {
    plugins: [liquidPlugin],
    parser: "liquid-html",
  });
}

export async function prettyJs(source) {
  return await prettier.format(source, {
    parser: "babel",
  });
}

export async function printAllNodes(source) {
  const document = liquidParser.toLiquidHtmlAST(source)
  const nodes = traverse(document).nodes();
  nodes.forEach(node => node?.type && console.log({
    nodeSource: source.slice(node.position.start, node.position.end),
    type: node.type,
    name: node.name === 'string' ? node.name : typeof node.name,
    keys: Object.keys(node).join(', ')
  }))
}

export function sleep(ms=1) {
	return new Promise(r => setTimeout(r, ms))
}

export function generateToken(key=777) {
  const randomNumber = Math.floor(Math.random() * 1e10); // 1e10 is 10^10
  const tenDigitNumber = randomNumber.toString().padStart(10, '0'); // Ensure it's 10 digits
  return Number(`${key}${tenDigitNumber}${key}`);
}