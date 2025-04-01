
import crypto from 'crypto'
import * as liquidParser from '@shopify/liquid-html-parser'

export function parseLiquid(source) {
  const tags = parseLiquidTags(source)
  const variables = parseLiquidVariables(source)
  return {tags, variables}
}

export function parseLiquidTags(source) {
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
        token: generateToken(match[0]),
      };
    })
  return tags;
}

export function parseLiquidVariables(source) {
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
        token: generateToken(match[0]),
      };
    }).filter(v => v);
  return variables;
}

export function generateToken(source) {
  const hash = crypto.createHash('sha256').update(source).digest('hex');
  const numericHash = parseInt(hash.substring(0, 15), 16);
  return numericHash;
}