'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash, randomUUID} = require('node:crypto');
const lockfile = require('proper-lockfile');

const hash = value => createHash('sha256').update(value).digest('hex');
function ensure(condition, message) { if (!condition) throw new Error(message); }
async function readJSON(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
async function exists(file) {
  try { await fs.access(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
async function atomic(file, data) {
  const tmp = file + '.' + randomUUID() + '.tmp';
  try { await fs.writeFile(tmp, data); await fs.rename(tmp, file); }
  finally { await fs.rm(tmp, {force:true}); }
}
const writeJSON = (file, value) => atomic(file, JSON.stringify(value, null, 2) + '\n');
async function exclusive(target, work) {
  await fs.mkdir(path.dirname(target), {recursive:true});
  const release = await lockfile.lock(target, {realpath:false, stale:30000, update:5000});
  try { return await work(); } finally { await release(); }
}
module.exports = {fs,path,hash,ensure,readJSON,exists,atomic,writeJSON,exclusive};
