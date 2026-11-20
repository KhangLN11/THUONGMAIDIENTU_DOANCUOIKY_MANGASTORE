"""Temporary file fixtures only; no MySQL writes. All fixtures are removed in finally."""
import hashlib
import json
from pathlib import Path
import secrets
import struct
import subprocess
import urllib.error
import urllib.request
import zlib

ROOT = Path(__file__).resolve().parents[2]
PHP = 'C:/xampp/php/php.exe'
STORAGE = (ROOT / 'backend/public/uploads/products').resolve()
ARTIFACTS = ROOT / 'frontend/.artifacts'
FIXTURES = ARTIFACTS / 'image-http-fixtures.json'

def request(url):
    try:
        response = urllib.request.urlopen(url, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    return response.status, response.headers, response.read()

def png(red, green, blue):
    def chunk(name, data):
        return struct.pack('!I', len(data)) + name + data + struct.pack('!I', zlib.crc32(name + data) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', 16, 24, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress((b'\0' + bytes([red, green, blue]) * 16) * 24)) + chunk(b'IEND', b'')

def setup():
    ARTIFACTS.mkdir(exist_ok=True)
    assert not FIXTURES.exists(), 'Clean up previous fixtures before setup'
    # Isolated directory does not correspond to any database product.
    directory = STORAGE / ('9' + str(secrets.randbelow(10**11)).zfill(11))
    directory.mkdir()
    paths = []
    images = []
    try:
        for index, color in enumerate([(220,220,220),(150,150,150),(70,70,70)]):
            file = directory / (secrets.token_hex(16) + '.png')
            data = png(*color)
            file.write_bytes(data)
            paths.append(file)
            image_url = '/manga-store/backend/public/uploads/products/' + directory.name + '/' + file.name
            for origin in ['http://localhost', 'http://localhost:8443']:
                status, headers, body = request(origin + image_url)
                assert status == 200, (origin, status, body[:100])
                assert headers['Content-Type'].startswith('image/png')
                assert body == data, 'Proxy must preserve image bytes'
                assert headers.get('X-Content-Type-Options') == 'nosniff'
            images.append({'id':index+1,'image_url':image_url,'alt_vi':'Anh '+str(index+1),'alt_en':'Image '+str(index+1),'sort_order':index*10,'is_primary':index==1})
        # Test script-like and invalid names without executing the script.
        for name in ['probe.php','probe.phtml','probe.txt',secrets.token_hex(16)+'.jpg.php']:
            file = directory / name
            file.write_bytes(b'<?php echo "SHOULD_NEVER_EXECUTE";')
            paths.append(file)
            for origin in ['http://localhost', 'http://localhost:8443']:
                status, _, body = request(origin + '/manga-store/backend/public/uploads/products/' + directory.name + '/' + name)
                assert status == 403, (name,status)
                assert b'SHOULD_NEVER_EXECUTE' not in body
        status,_,_ = request('http://localhost/manga-store/backend/public/uploads/products/' + directory.name + '/')
        assert status == 403, 'No directory listing'
        status,_,_=request('http://localhost' + images[0]['image_url'] + '/extra.php')
        assert status in (403,404), status
        # CLI dry-run validates source/product but must not create a product folder or DB row.
        output = subprocess.check_output([PHP,str(ROOT/'backend/scripts/store_product_image.php'),'--source='+str(paths[0]),'--product-id=1'])
        result=json.loads(output)
        assert result['written'] is False and result['mime_type']=='image/png'
        FIXTURES.write_text(json.dumps({'directory':str(directory),'files':[str(p) for p in paths],'images':images}),encoding='utf-8')
        print('PASS HTTP: 3 temporary raster files via Apache/Vite; safe names only; PHP denied; directory listing/path-info denied; CLI dry-run')
        print('Fixtures ready for browser gallery tests; run --cleanup afterwards.')
    except BaseException:
        for file in paths:
            file.unlink(missing_ok=True)
        directory.rmdir()
        raise

def cleanup():
    if not FIXTURES.exists():
        return
    fixture=json.loads(FIXTURES.read_text(encoding='utf-8'))
    directory=Path(fixture['directory']).resolve()
    assert directory.parent == STORAGE, 'Cleanup directory escaped storage'
    for raw in fixture['files']:
        file=Path(raw).resolve()
        assert file.parent == directory, 'Cleanup file escaped fixture directory'
        file.unlink(missing_ok=True)
    directory.rmdir()
    FIXTURES.unlink()
    print('PASS: exact temporary HTTP fixtures removed; no catalog files touched')

if __name__=='__main__':
    import sys
    cleanup() if '--cleanup' in sys.argv else setup()
