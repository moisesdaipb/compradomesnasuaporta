async function fetchCount() {
  const url = 'https://dbmptvlaogxatrnbrmkz.supabase.co/rest/v1/installments?select=*';
  const key = 'sb_publishable_cghKQoC7cLKLdbmHPfANVQ_ZTSmY_iT';

  try {
    const res = await fetch(url, { 
      headers: { 
        'apikey': key, 
        'Authorization': `Bearer ${key}`,
        'Range': '0-1',
        'Prefer': 'count=exact'
      } 
    });
    
    console.log('Total Count Headers:', res.headers.get('content-range'));
  } catch (err) {
    console.error(err);
  }
}

fetchCount();
