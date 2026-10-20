import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const result = await build({ entryPoints: ['islands/widget-grid.island.jsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic' });
const module = { exports: {} };
vm.runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require: () => { throw new Error('Unexpected external dependency'); }, process, console, setTimeout, clearTimeout, queueMicrotask });
const { layout, restoreOrder, moveTo } = module.exports;
const data = { window: {} };
vm.runInNewContext(readFileSync('data.js', 'utf8'), data);
const entries = data.window.DH_DATA.journey.slice(0, 10).map((e) => ({ id: String(e.day), size: e.arc_color === 'gold' ? 'lg' : e.arc_color === 'blue' ? 'wide' : 'sm' }));
let cases = 0;
for (const count of [6, 10]) for (const columns of [2, 3, 4]) for (let index = 0; index < count; index++) {
  const items = moveTo(entries.slice(0, count), entries[0].id, index);
  const places = layout(items, columns);
  assert.equal(places.length, count);
  const cells = new Set();
  let rows = 0;
  for (const p of places) {
    assert(p.col >= 0 && p.col + p.w <= columns);
    rows = Math.max(rows, p.row + p.h);
    for (let y = p.row; y < p.row + p.h; y++) for (let x = p.col; x < p.col + p.w; x++) {
      const cell = `${x},${y}`;
      assert(!cells.has(cell), `overlap at ${cell}`); cells.add(cell);
    }
  }
  assert.equal(cells.size, rows * columns, `gap: ${count} entries, ${columns} columns, move ${index}`);
  cases++;
}
for (const bad of [null, {}, ['353', '353'], [353], ['bad', null], Array(101).fill('x')]) assert.equal(restoreOrder(entries, bad), entries);
assert.deepEqual(Array.from(restoreOrder(entries, ['removed', entries[1].id]), (e) => e.id), [entries[1].id, ...entries.filter((e) => e.id !== entries[1].id).map((e) => e.id)]);
console.log(`P3 self-check: ${cases} gap-free layouts, storage validation and new-entry reconciliation passed.`);
