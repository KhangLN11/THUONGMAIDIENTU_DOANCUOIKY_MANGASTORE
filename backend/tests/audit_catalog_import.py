"""Audit the real catalog against the private pre-import backup; SELECT only."""
from pathlib import Path
import hashlib
import json
import re
import subprocess

ROOT=Path(__file__).resolve().parents[2]
SESSION=ROOT/'frontend/.artifacts/catalog-b-session.json'

def audit():
    session=json.loads(SESSION.read_text(encoding='utf-8'))
    backup=Path(session['backup_dir'])
    before=json.loads((backup/'before.json').read_text(encoding='utf-8'))
    after=json.loads(subprocess.check_output(['C:/xampp/php/php.exe',str(ROOT/'backend/scripts/catalog_snapshot.php')]))
    products=after['tables']['products']['rows'];by_id={p['id']:p for p in products}
    assert len(products)==31
    assert sum(p['status']=='active' for p in products)==23
    assert sum(p['status']=='archived' for p in products)==8
    assert after['tables']['categories']['count']==7 and after['tables']['manga_series']['count']==18
    assert after['tables']['product_images']['count']==35
    assert len({p['sku'] for p in products})==len({p['slug'] for p in products})==31
    for row in before['tables']['products']['rows']:
        assert by_id[row['id']]=={**row,'status':'archived'},'Legacy field changed beyond status: '+row['sku']
    for table in ['categories','manga_series']:
        existing={row['id']:row for row in after['tables'][table]['rows']}
        for row in before['tables'][table]['rows']:assert existing[row['id']]==row,'Existing category/series changed'
    unrelated=[]
    for name,table in before['tables'].items():
        # Empty tables omit AUTO_INCREMENT=1 in SHOW CREATE TABLE. Ignore only this table option.
        normalize=lambda schema:re.sub(r' AUTO_INCREMENT=\d+','',schema)
        assert normalize(table['schema'])==normalize(after['tables'][name]['schema']),'Schema changed: '+name
        if name not in ['products','product_images','categories','manga_series']:
            assert table['sha256']==after['tables'][name]['sha256'],'Unrelated rows changed: '+name
            unrelated.append(name)
    protected=json.loads((backup/'frontend_hashes.json').read_text(encoding='utf-8'))
    for name,sha in protected.items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==sha,'Frontend changed: '+name
    path=ROOT/'database/catalog/demo-products/manifest.json'
    assert hashlib.sha256(path.read_bytes()).hexdigest()==session['manifest_sha256']
    manifest=json.loads(path.read_text(encoding='utf-8'))
    new_by_sku={p['sku']:p for p in products if p['sku'].startswith('CAT-')}
    image_rows=after['tables']['product_images']['rows']
    file_map=[]
    for item in manifest['products']:
        product=new_by_sku[item['sku']]
        images=[image for image in image_rows if image['product_id']==product['id']]
        assert len(images)==len(item['images']) and sum(image['is_primary'] for image in images)==1
        for expected in item['images']:
            relative='backend/public/uploads/products/'+str(product['id'])+'/'+expected['filename']
            file=ROOT/relative
            assert file.is_file() and hashlib.sha256(file.read_bytes()).hexdigest()==expected['sha256']
            file_map.append({'sku':item['sku'],'product_id':product['id'],'path':relative,'sha256':expected['sha256']})
    assert len([p for p in (ROOT/'backend/public/uploads/products').rglob('*') if p.is_file() and not p.name.startswith('.')])==35
    (backup/'after.json').write_text(json.dumps(after,ensure_ascii=False,indent=2),encoding='utf-8')
    (backup/'imported_files.json').write_text(json.dumps(file_map,indent=2)+'\n',encoding='utf-8')
    summary={'before':{'products':8,'categories':6,'series':3,'images':0},'after':{'products':31,'active':23,'archived':8,'categories':7,'series':18,'images':35},'legacy_changed_fields':['status'],'legacy_ids_skus_and_updated_at_preserved':True,'unrelated_tables_unchanged':len(unrelated),'schema_unchanged':True,'frontend_source_files_unchanged':len(protected),'approved_manifest_unchanged':True,'duplicate_skus_or_slugs':0,'local_image_hash_errors':[],'backup_dir':str(backup)}
    (ROOT/'frontend/.artifacts/catalog-b-integrity.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary))
    return summary

if __name__=='__main__':audit()
