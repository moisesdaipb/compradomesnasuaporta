async function go() {
  const url = 'https://dbmptvlaogxatrnbrmkz.supabase.co/rest/v1/installments?limit=1';
  const key = 'sb_publishable_cghKQoC7cLKLdbmHPfANVQ_ZTSmY_iT';

  try {
    const res = await fetch(url, { 
      method: 'GET',
      headers: { 
        'apikey': key, 
        'Authorization': `Bearer ${key}`,
        'Prefer': 'count=exact'
      } 
    });
    const data = await res.json();
    console.log("Full keys for one installment row:");
    console.log(Object.keys(data[0] || {}).join(', '));
  } catch (err) {
    console.error(err);
  }
}
go();
