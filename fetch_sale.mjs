async function go() {
  const url = 'https://dbmptvlaogxatrnbrmkz.supabase.co/rest/v1/sales?id=eq.8ef75eca-6d28-46ee-b8b1-324b363dface';
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
