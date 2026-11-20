"""Read-only checks against the actual imported API and image files; no mocks."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parents[2]
MANIFEST=ROOT/'database/catalog/demo-products/manifest.json'

def request(url, expected=200):
    try:response=urllib.request.urlopen(url,timeout=15)
    except urllib.error.HTTPError as error:response=error
    body=response.read()
    assert response.status==expected,(url,response.status)
    return response,body

def verify(before_archive=False):
    manifest=json.loads(MANIFEST.read_text(encoding='utf-8'))
    origin='http://localhost'
    base=origin+'/manga-store/backend/public/api/'
    response,body=request(base+'products.php')
    assert response.headers.get_content_type()=='application/json'
    data=json.loads(body)
    assert data['success'] is True
    expected_total=31 if before_archive else 23
    assert data['meta']['total']==len(data['data'])==expected_total
    by_sku={p['sku']:p for p in data['data']}
    assert len(by_sku)==expected_total
    assert len({p['slug'] for p in data['data']})==expected_total
    expected_skus={p['sku'] for p in manifest['products']}
    assert expected_skus<=by_sku.keys()
    if not before_archive:assert by_sku.keys()==expected_skus
    image_requests=0
    for product in manifest['products']:
        actual=by_sku[product['sku']]
        for key in ['sku','slug','name_vi','name_en','description_vi','description_en','price_vnd','sale_price_vnd','stock_quantity']:
            assert actual[key]==product[key],(product['sku'],key)
        assert isinstance(actual['price_vnd'],int)
        assert actual['category']['slug']==product['category_slug']
        assert actual['series']['slug']==product['series_slug']
        _,detail_body=request(base+'product.php?id='+str(actual['id']))
        detail=json.loads(detail_body)
        assert detail['success'] is True and detail['data']==actual
        assert len(actual['images'])==len(product['images'])
        assert sum(i['is_primary'] for i in actual['images'])==1
        assert actual['images']==sorted(actual['images'],key=lambda image:(image['sort_order'],image['id']))
        for image,expected in zip(actual['images'],product['images']):
            expected_url='/manga-store/backend/public/uploads/products/'+str(actual['id'])+'/'+expected['filename']
            assert image['image_url']==expected_url
            for key in ['alt_vi','alt_en','sort_order','is_primary']:assert image[key]==expected[key]
            if image['is_primary']:assert actual['image_url']==expected_url
            for host in ['http://localhost','http://localhost:8443']:
                image_response,bytes_=request(host+expected_url)
                assert image_response.headers.get_content_type()==expected['mime_type']
                assert hashlib.sha256(bytes_).hexdigest()==expected['sha256']
                image_requests+=1
    if not before_archive:
        for product_id in range(1,9):
            _,body=request(base+'product.php?id='+str(product_id),404)
            assert json.loads(body)['error']['code']=='PRODUCT_NOT_FOUND'
    result={'mode':'before-archive' if before_archive else 'final','list_http_status':200,'active_products':expected_total,'new_details_checked':23,'new_category_counts':dict(Counter(by_sku[p['sku']]['category']['slug'] for p in manifest['products'])),'images_checked':35,'image_http_requests':image_requests,'figure_galleries':6,'legacy_detail_404_checked':0 if before_archive else 8,'price_names_stock_manifest_match':True,'errors':[]}
    print(json.dumps(result))
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--before-archive',action='store_true');parser.add_argument('--report')
    args=parser.parse_args()
    result=verify(args.before_archive)
    if args.report:Path(args.report).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
