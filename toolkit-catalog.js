// One product entry, one honest launch target. Source links are not running apps.
globalThis.deepToolkitCatalog = function(items) {
  const beam = items.some(x=>x.title === 'ChampBeam');
  return items.filter(x=>['tool','repo'].includes(x.category) && x.status !== 'internal' && !['deependhq-site','ChampOps','ChampGraph','B2B Pulse'].includes(x.title) && !(beam && x.title === 'ChampUTM')).map(x=>{
    const shared = x.title === 'Lead Scorer';
    const external = typeof x.site === 'string' && /^https:\/\//.test(x.site);
    const source = typeof x.url === 'string' && /^https:\/\/github\.com\//.test(x.url);
    return {...x,description:String(x.description || '').split(/(?<=[.!?])\s+/)[0],free:x.title === 'ChamPDF',mode:shared ? 'shared' : x.title === 'Event Scout' ? 'preview' : external ? 'external' : source ? 'source' : 'preview',href:shared ? '/lead-scorer' : external ? x.site : source ? x.url : null};
  });
};
