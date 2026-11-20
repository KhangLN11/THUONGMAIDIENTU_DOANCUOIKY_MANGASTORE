"""Generate review files and an approval-gated SQL artifact; never connects to MySQL."""
import csv
import hashlib
import html
import json
from pathlib import Path

BASE=Path(__file__).resolve().parent
ROOT=BASE.parents[2]

def literal(value):
    if value is None: return 'NULL'
    if isinstance(value,bool): return '1' if value else '0'
    if isinstance(value,int): return str(value)
    return "'"+str(value).replace("'","''")+"'"

def generate():
    raw=(BASE/'manifest.json').read_bytes()
    manifest=json.loads(raw)
    sha=hashlib.sha256(raw).hexdigest()
    products=manifest['products']
    sql=['-- Manga Store catalog: PREPARATION ONLY; do not run until the manifest is approved.',
         '-- Manifest SHA-256: '+sha,
         '-- All price/stock values are simulated. Existing rows are never updated or deleted.',
         'SET @MANGA_CATALOG_APPROVED = 0; -- change to 1 ONLY after explicit approval and backup',
         'USE manga_store;', 'SET NAMES utf8mb4;',
         "SET @catalog_lock = IF(@MANGA_CATALOG_APPROVED=1,GET_LOCK('manga-store-demo-catalog',10),0);",
         'START TRANSACTION;', 'SET @catalog_conflicts = 0;']
    for c in manifest['categories']:
        sql.append('SET @catalog_conflicts = @catalog_conflicts + (SELECT COUNT(*) FROM categories WHERE slug='+literal(c['slug'])+' AND is_active<>1);')
    for s in manifest['series']:
        sql.append('SET @catalog_conflicts = @catalog_conflicts + (SELECT COUNT(*) FROM manga_series WHERE slug='+literal(s['slug'])+' AND (BINARY title <> BINARY '+literal(s['title'])+' OR is_active<>1));')
    for p in products:
        clauses=[]
        for key in ['sku','slug','name_vi','name_en','description_vi','description_en','price_vnd','sale_price_vnd','stock_quantity','status','is_featured']:
            clauses.append('(BINARY p.'+key+' <=> BINARY '+literal(p[key])+')')
        clauses += ['(BINARY c.slug <=> BINARY '+literal(p['category_slug'])+')','(BINARY s.slug <=> BINARY '+literal(p['series_slug'])+')']
        sql.append('SET @catalog_conflicts = @catalog_conflicts + (SELECT COUNT(*) FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN manga_series s ON s.id=p.series_id WHERE (p.sku='+literal(p['sku'])+' OR p.slug='+literal(p['slug'])+') AND NOT ('+' AND '.join(clauses)+'));')
        for image in p['images']:
            url="CONCAT('/manga-store/backend/public/uploads/products/',p.id,'/"+image['filename']+"')"
            comparisons=' AND '.join('('+key+' <=> '+literal(image[key])+')' for key in ['alt_vi','alt_en','sort_order','is_primary'])
            sql.append('SET @catalog_conflicts = @catalog_conflicts + (SELECT COUNT(*) FROM product_images WHERE product_id=(SELECT p.id FROM products p WHERE p.sku='+literal(p['sku'])+') AND image_url=(SELECT '+url+' FROM products p WHERE p.sku='+literal(p['sku'])+') AND NOT ('+comparisons+'));')
            if image['is_primary']:
                sql.append('SET @catalog_conflicts = @catalog_conflicts + (SELECT COUNT(*) FROM product_images i JOIN products p ON p.id=i.product_id WHERE p.sku='+literal(p['sku'])+' AND i.is_primary=1 AND i.image_url<>'+url+');')
    sql.append('SET @catalog_ready = (@MANGA_CATALOG_APPROVED=1 AND @catalog_lock=1 AND @catalog_conflicts=0);')
    for c in manifest['categories']:
        sql.append('INSERT INTO categories (slug,name_vi,name_en,sort_order,is_active) SELECT '+','.join(literal(c[key]) for key in ['slug','name_vi','name_en','sort_order'])+',1 WHERE @catalog_ready=1 AND NOT EXISTS (SELECT 1 FROM categories WHERE slug='+literal(c['slug'])+');')
    for s in manifest['series']:
        sql.append('INSERT INTO manga_series (slug,title,is_active) SELECT '+literal(s['slug'])+','+literal(s['title'])+',1 WHERE @catalog_ready=1 AND NOT EXISTS (SELECT 1 FROM manga_series WHERE slug='+literal(s['slug'])+');')
    for p in products:
        keys=['sku','slug','name_vi','name_en','description_vi','description_en','price_vnd','sale_price_vnd','stock_quantity','status','is_featured']
        sql.append('INSERT INTO products (category_id,series_id,'+','.join(keys)+') SELECT c.id,s.id,'+','.join(literal(p[k]) for k in keys)+' FROM categories c CROSS JOIN manga_series s WHERE @catalog_ready=1 AND c.slug='+literal(p['category_slug'])+' AND s.slug='+literal(p['series_slug'])+' AND NOT EXISTS (SELECT 1 FROM products WHERE sku='+literal(p['sku'])+' OR slug='+literal(p['slug'])+');')
        for image in p['images']:
            url="CONCAT('/manga-store/backend/public/uploads/products/',p.id,'/"+image['filename']+"')"
            sql.append('INSERT INTO product_images (product_id,image_url,alt_vi,alt_en,sort_order,is_primary) SELECT p.id,'+url+','+','.join(literal(image[k]) for k in ['alt_vi','alt_en','sort_order','is_primary'])+' FROM products p WHERE @catalog_ready=1 AND p.sku='+literal(p['sku'])+' AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id=p.id AND image_url='+url+');')
    sql += ['COMMIT;',"SELECT @catalog_ready AS import_enabled, @catalog_conflicts AS conflicts, 'Restore images by SKU after SQL import; no existing products were updated.' AS note;", "SELECT IF(@catalog_lock=1,RELEASE_LOCK('manga-store-demo-catalog'),NULL) AS released;"]
    (BASE/'catalog.sql').write_text('\n'.join(sql)+'\n',encoding='utf-8')
    with (BASE/'sources.csv').open('w',encoding='utf-8-sig',newline='') as file:
        writer=csv.writer(file)
        writer.writerow(['SKU','source_page','source_image_url','local_asset','sha256','width','height','primary','sort_order','status','resolution_note','rights_note'])
        for p in products:
            for image in p['images']:
                writer.writerow([p['sku'],image['source_page'],image['source_url'],image.get('local_path',''),image.get('sha256',''),image.get('width',''),image.get('height',''),image['is_primary'],image['sort_order'],image['status'],image.get('resolution_note') or '',image.get('rights_note','')])
    with (BASE/'manifest.csv').open('w',encoding='utf-8-sig',newline='') as file:
        writer=csv.writer(file)
        writer.writerow(['Predicted ID (not reserved)','SKU','Name VI','Name EN','Category','Series','Demo VND','Demo sale VND','Demo stock','Main image source','Image status'])
        for p in products:
            main=next(i for i in p['images'] if i['is_primary'])
            writer.writerow([p['predicted_product_id'],p['sku'],p['name_vi'],p['name_en'],p['category_slug'],p['series_slug'],p['price_vnd'],p['sale_price_vnd'],p['stock_quantity'],main['source_url'],'ready '+str(len(p['images']))+'/'+str(len(p['images']))])
    doc=['# Manifest catalog – chờ duyệt', '', 'Giá/khuyến mãi/tồn kho là dữ liệu giả lập. ID chỉ là dự kiến, không được reserve hoặc dùng làm khóa import.', '', 'SHA-256 manifest: `'+sha+'`', '', '| ID dự kiến | SKU | Tên VI | Tên EN | Danh mục | Series | Giá demo VNĐ | Sale demo | Tồn kho demo | URL ảnh nguồn | Trạng thái ảnh |', '|---|---|---|---|---|---|---:|---:|---:|---|---|']
    for p in products:
        main=next(i for i in p['images'] if i['is_primary'])
        doc.append('| '+' | '.join(str(v) for v in [p['predicted_product_id'],p['sku'],p['name_vi'],p['name_en'],p['category_slug'],p['series_slug'],format(p['price_vnd'],','),format(p['sale_price_vnd'],',') if p['sale_price_vnd'] else '—',p['stock_quantity'],'[ảnh]('+main['source_url']+')',str(len(p['images']))+' ảnh local'])+' |')
    (BASE/'MANIFEST.md').write_text('\n'.join(doc)+'\n',encoding='utf-8')
    # Plain offline review document, not a replacement website or a change to Figma CSS.
    header='<!doctype html><html lang="vi"><meta charset="utf-8"><title>Manga Store — Catalog review only</title><body><h1>Catalog review — NOT IMPORTED</h1><p>23 products. Price and stock are simulated. Existing MySQL and frontend remain unchanged.</p><p>Manifest SHA-256: '+sha+'</p>'
    cards=[]
    for p in products:
        main=next(i for i in p['images'] if i['is_primary'])
        cards.append('<td width="280" valign="top"><img height="240" src="'+html.escape(main['local_path'],quote=True)+'" alt="'+html.escape(p['name_vi'],quote=True)+'"><h3>'+html.escape(p['name_vi'])+'</h3><p>'+p['sku']+'<br>'+format(p['price_vnd'],',')+' VND · demo stock '+str(p['stock_quantity'])+'</p><a href="'+html.escape(p['source_page'],quote=True)+'">Product source</a></td>')
    rows=['<tr>'+''.join(cards[i:i+4])+'</tr>' for i in range(0,len(cards),4)]
    (BASE/'preview.html').write_text(header+'<table border="1" cellpadding="8">'+''.join(rows)+'</table><h2>Notes requiring review</h2><ul>'+''.join('<li>'+html.escape(note)+'</li>' for note in manifest['review_notes'])+'</ul></body></html>',encoding='utf-8')
    galleries=[]
    for p in products:
        if p['category_slug']!='figures': continue
        galleries.append('<h2>'+html.escape(p['name_vi'])+'</h2><p>'+html.escape(str(p['facts']))+'</p>'+''.join('<img height="280" src="'+html.escape(image['local_path'],quote=True)+'" alt="'+html.escape(image['alt_vi'],quote=True)+'">' for image in p['images']))
    (BASE/'gallery-review.html').write_text(header+''.join(galleries)+'</body></html>',encoding='utf-8')
    # Optional proposal only. Not part of the base INSERT-only import.
    legacy=['DEMO-MANGA-001','DEMO-MANGA-002','DEMO-MANGA-003','DEMO-FIG-001','DEMO-ACC-001','DEMO-POS-001','DEMO-APP-001','DEMO-STA-001']
    proposal="-- OPTIONAL PROPOSAL ONLY: separate approval required; preserves IDs and references.\nSET @APPROVE_HIDE_8_OLD_DEMOS=0;\nUSE manga_store;\nSTART TRANSACTION;\nUPDATE products SET status='archived' WHERE @APPROVE_HIDE_8_OLD_DEMOS=1 AND status='active' AND sku IN ("+','.join(literal(sku) for sku in legacy)+");\nSELECT ROW_COUNT() AS legacy_products_archived;\nCOMMIT;\n"
    (BASE/'optional_hide_legacy_demo.sql').write_text(proposal,encoding='utf-8')
    print(json.dumps({'manifest_sha256':sha,'products':len(products),'images':sum(len(p['images']) for p in products),'assets_bytes':sum(image['bytes'] for p in products for image in p['images'])}))

if __name__=='__main__':generate()
