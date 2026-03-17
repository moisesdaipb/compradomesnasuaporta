const url = 'https://dbmptvlaogxatrnbrmkz.supabase.co/rest/v1/installments?sale_id=eq.8ef75eca-6d28-46ee-b8b1-324b363dface';
const key = 'sb_publishable_cghKQoC7cLKLdbmHPfANVQ_ZTSmY_iT';

fetch(url, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } })
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(console.error);
