/* eslint-disable @typescript-eslint/ban-ts-comment -- necessary to override readonly functions */

import fs from 'node:fs';

// hack to fix playground without removing fs calls

const NOOP = () => {};

fs.cpSync ??= NOOP as typeof fs.cpSync;
fs.existsSync ??= (() => false) as typeof fs.existsSync;
fs.lstatSync ??= (() => ({})) as unknown as typeof fs.lstatSync;
fs.mkdirSync ??= NOOP as unknown as typeof fs.mkdirSync;
fs.readFileSync ??= (() => Buffer.from('')) as unknown as typeof fs.readFileSync;
fs.readdirSync ??= (() => []) as typeof fs.readdirSync;
fs.realpathSync ??= ((path: fs.PathLike) => path) as typeof fs.realpathSync;
fs.rmSync ??= NOOP as typeof fs.rmSync;
// @ts-expect-error -- statSync is a readonly property
fs.statSync ??= () => ({});
fs.writeFileSync ??= NOOP as typeof fs.writeFileSync;
