// Replaces the model. Imported first by worker.js so nothing captures the real fetch.
// A turn with no tool result yet calls files_list; once the result is in, it answers.
const real = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url !== 'https://openrouter.ai/api/v1/chat/completions') throw new Error('smoke: unexpected network call ' + url);
  const body = JSON.parse(init.body);
  const last = body.messages.at(-1);
  const message = last.role === 'tool'
    ? { role: 'assistant', content: `You have ${JSON.parse(last.content).entries.length} file: leads.csv.` }
    : { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'files_list', arguments: '{"folder":"/"}' } }] };
  return new Response(JSON.stringify({ id: 'gen-smoke', choices: [{ message }], usage: { prompt_tokens: 100, completion_tokens: 20, cost: 0.0005 } }), { headers: { 'content-type': 'application/json' } });
};
export { real };
