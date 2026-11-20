"""Read-only API checks. Run from project root: python backend/tests/test_api.py"""
import json
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.request

BASE = os.environ.get('MANGA_API_BASE', 'http://localhost/manga-store/backend/public/')

def request(path, status, method='GET'):
    try:
        response = urllib.request.urlopen(urllib.request.Request(BASE + path, method=method), timeout=10)
    except urllib.error.HTTPError as exc:
        response = exc
    body = response.read().decode('utf-8')
    assert response.code == status, (path, response.code, body)
    if path.startswith('api/'):
        assert 'application/json' in response.headers.get('Content-Type', '')
        assert 'charset=utf-8' in response.headers.get('Content-Type', '').lower()
        data = json.loads(body)
        assert data['success'] == (status == 200)
        assert all(word not in body.lower() for word in ['sqlstate', 'password', 'pdoexception', 'xampp', 'stack trace'])
        return data, response
    return body, response

result, _ = request('api/products.php', 200)
if result['data'] and all(product['sku'].startswith('CAT-') for product in result['data']):
    # The approved live catalog replaces the legacy eight-product test fixture.
    from test_live_catalog import verify
    live_report = verify()
    report_path = Path(__file__).resolve().parents[2] / 'frontend/.artifacts/catalog-live-api.json'
    report_path.write_text(json.dumps(live_report, indent=2) + '\n', encoding='utf-8')
else:
    assert result['meta']['total'] == len(result['data']) == 8
    for product in result['data']:
        assert product['image_url'] is None
        assert product['images'] == []
        assert isinstance(product['price_vnd'], int)
        assert product['sale_price_vnd'] is None or isinstance(product['sale_price_vnd'], int)
        detail, _ = request('api/product.php?id=' + str(product['id']), 200)
        assert detail['data'] == product
    assert result['data'][0]['name_vi'] == 'H\u00e0nh Tr\u00ecnh M\u01b0a \u0110\u00eam \u2013 T\u1eadp 1'
    assert result['data'][0]['price_vnd'] == 45000
    assert result['data'][0]['sale_price_vnd'] is None
    assert result['data'][1]['sale_price_vnd'] == 49000
    assert any(product['series'] is None for product in result['data'])
    print('PASS: list of 8, all 8 details, Vietnamese UTF-8, integer VND, null images/series, sale prices')
for query in ['', '?id=0', '?id=-1', '?id=abc', '?id=1.5', '?id[]=1', '?id=1%20OR%201=1', '?id=999999999999999999999999999999']:
    assert request('api/product.php' + query, 400)[0]['error']['code'] == 'INVALID_ID'
print('PASS: 8 invalid ID cases -> 400')
assert request('api/product.php?id=999999', 404)[0]['error']['code'] == 'PRODUCT_NOT_FOUND'
for endpoint in ['api/products.php', 'api/product.php?id=1']:
    data, response = request(endpoint, 405, 'POST')
    assert response.headers['Allow'] == 'GET'
print('PASS: missing product -> 404, POST -> 405 with Allow GET')
for path in ['../config/database.local.php', '../config/database.example.php', '../src/Database.php']:
    request(path, 403)
print('PASS: config and src denied by Apache')
# Override only this child CLI process; no Apache or database settings are modified.
root = Path(__file__).resolve().parents[2]
env = os.environ.copy()
env['DB_PORT'] = '1'
code = "$_SERVER['REQUEST_METHOD']='GET'; require 'backend/public/api/products.php';"
process = subprocess.run([os.environ.get('PHP_BINARY', 'C:/xampp/php/php.exe'), '-r', code], cwd=root, env=env, capture_output=True, check=True)
error = json.loads(process.stdout.decode('utf-8'))
assert error['error']['code'] == 'DATABASE_ERROR'
assert error['error']['message'] == 'Kh\u00f4ng th\u1ec3 t\u1ea3i d\u1eef li\u1ec7u.'
assert b'password' not in process.stdout.lower() and b'SQLSTATE' not in process.stdout
print('PASS: simulated DB connection failure sanitized (CLI)')
request('health.php', 200)
print('PASS: existing health endpoint')
