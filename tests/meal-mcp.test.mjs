import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMealMcpHandler } from '../lib/meal-mcp.ts';

function fixture() {
  const calls = [];
  const handler = createMealMcpHandler({
    search: filters => { calls.push(filters); return [{ id: 'one', sodiumMg: 300 }]; },
    get: id => id === 'one' ? { id, sodiumMg: 300, source: 'Restaurant' } : undefined,
    compare: (ids, filters) => ({ ids, filters }),
  });
  const send = async (method, params, id = 1) => {
    const response = await handler(new Request('https://example.test/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) }));
    return { response, body: response.status === 204 ? null : await response.json() };
  };
  return { handler, send, calls };
}

test('discovers and lists only read-only tools', async () => {
  const { send } = fixture();
  const { body } = await send('server/discover');
  assert.deepEqual(body.result.supportedVersions, ['2026-07-28']);
  const list = (await send('tools/list')).body.result.tools;
  assert.deepEqual(list.map(tool => tool.name), ['search_meals', 'get_meal_details', 'compare_meals']);
  assert.ok(list.every(tool => tool.annotations.readOnlyHint && !tool.annotations.destructiveHint));
});

test('passes explicit targets without silently changing them', async () => {
  const { send, calls } = fixture();
  const input = { maxSodiumMg: 0, minProteinG: 25, minFibreG: 5, maxCalories: 700, location: 'Scarborough', category: 'bowls', excludedIngredients: ['peanut'] };
  const { body } = await send('tools/call', { name: 'search_meals', arguments: input });
  assert.deepEqual(calls, [input]);
  assert.equal(JSON.parse(body.result.content[0].text)[0].id, 'one');
});

test('rejects diagnosis interpretation and invalid nutrient input before catalogue access', async () => {
  const { send, calls } = fixture();
  for (const input of [{ condition: 'liver disease' }, { maxSodiumMg: '500' }, { maxSodiumMg: -1 }, { excludedIngredients: [4] }]) {
    const { body } = await send('tools/call', { name: 'search_meals', arguments: input });
    assert.equal(body.result.isError, true);
  }
  assert.equal(calls.length, 0);
});

test('missing meals and duplicate comparisons return tool errors', async () => {
  const { send } = fixture();
  assert.equal((await send('tools/call', { name: 'get_meal_details', arguments: { id: 'missing' } })).body.result.isError, true);
  assert.equal((await send('tools/call', { name: 'compare_meals', arguments: { ids: ['one', 'one'] } })).body.result.isError, true);
  const valid = (await send('tools/call', { name: 'compare_meals', arguments: { ids: ['one', 'two'], filters: { minProteinG: 20 } } })).body;
  assert.deepEqual(JSON.parse(valid.result.content[0].text), { ids: ['one', 'two'], filters: { minProteinG: 20 } });
});

test('notifications return no response and never invoke catalogue tools', async () => {
  const { handler, calls } = fixture();
  const response = await handler(new Request('https://example.test/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'search_meals' } }) }));
  assert.equal(response.status, 204);
  assert.equal(calls.length, 0);
});

test('malformed JSON and unknown methods have protocol errors', async () => {
  const { handler, send } = fixture();
  const response = await handler(new Request('https://example.test/mcp', { method: 'POST', body: '{broken' }));
  assert.equal((await response.json()).error.code, -32700);
  assert.equal((await send('unknown')).body.error.code, -32601);
});
