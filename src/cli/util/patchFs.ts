/* eslint-disable @typescript-eslint/ban-ts-comment -- necessary to override readonly functions */

import fs from 'fs-extra';

// hack to fix playground without removing fs calls

const NOOP = () => {};
const ASYNC_NOOP = async () => {};

fs.copy ??= ASYNC_NOOP;
fs.copySync ??= NOOP;
fs.existsSync ??= () => false;
fs.outputFile ??= ASYNC_NOOP;
fs.outputFileSync ??= NOOP;
fs.pathExists ??= async () => false;
fs.pathExistsSync ??= () => false;
// @ts-expect-error
fs.readdir ??= async () => [];
fs.readdirSync ??= () => [];
fs.readFileSync ??= () => Buffer.from('') as Buffer & string;
// @ts-expect-error
fs.readJson ??= ASYNC_NOOP;
// @ts-expect-error
fs.readJSONSync ??= NOOP;
fs.realpathSync ??= ((path: fs.PathLike) => path) as typeof fs.realpathSync;
fs.removeSync ??= NOOP;
// @ts-expect-error
fs.stat ??= () => ({}) as Promise<fs.Stats>;
// @ts-expect-error
fs.statSync ??= () => ({});
