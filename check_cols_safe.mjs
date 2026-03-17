async function go() {
  const base = 'https://dbmptvlaogxatrnbrmkz.supabase.co/rest/v1';
  const key = 'sb_publishable_cghKQoC7cLKLdbmHPfANVQ_ZTSmY_iT';
  const headers = { 'apikey': key, 'Authorization': `Bearer ${key}` };

  try {
    const sRes = await fetch(`${base}/sales?limit=1`, { headers });
    const sData = await sRes.json();
    console.log("Sales columns:", Object.keys(sData[0] || {}).join(', '));

    const iRes = await fetch(`${base}/installments?limit=1`, { headers });
    const iData = await iRes.json();
    console.log("Installments columns:", Object.keys(iData[0] || {}).join(', '));
  } catch (err) {
    console.error(err);
  }
}
go();
