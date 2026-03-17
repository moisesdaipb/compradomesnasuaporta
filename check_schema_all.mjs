async function go() {
  const url = 'https://dbmptvlaogxatrnbrmkz.supabase.co/rest/v1/?apikey=sb_publishable_cghKQoC7cLKLdbmHPfANVQ_ZTSmY_iT';
  const key = 'sb_publishable_cghKQoC7cLKLdbmHPfANVQ_ZTSmY_iT';

  try {
    const res = await fetch(url, { 
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } 
    });
    const schema = await res.json();
    const salesTable = schema.definitions.sales;
    const installmentsTable = schema.definitions.installments;
    
    console.log("Sales columns:", Object.keys(salesTable.properties).join(', '));
    console.log("Installments columns:", Object.keys(installmentsTable.properties).join(', '));
  } catch (err) {
    console.error(err);
  }
}
go();
