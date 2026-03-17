async function go() {
  const url = 'https://dbmptvlaogxatrnbrmkz.supabase.co/rest/v1/installments?order=id.desc&limit=20';
  const key = 'sb_publishable_cghKQoC7cLKLdbmHPfANVQ_ZTSmY_iT';

  try {
    const res = await fetch(url, { 
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } 
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}
go();
