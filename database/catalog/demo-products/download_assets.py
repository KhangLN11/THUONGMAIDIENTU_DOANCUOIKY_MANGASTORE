"""Download public source images into the review bundle only. Never connects to MySQL."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.error
import urllib.parse
import urllib.request

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
PHP = 'C:/xampp/php/php.exe'
ALLOWED_HOSTS = {'production.image.azuki.co','bizweb.dktcdn.net','product.hstatic.net','cdn0.fahasa.com','cdn1.fahasa.com','www.goodsmile.com','images.goodsmile.info','cdn11.bigcommerce.com'}
TYPES = {'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'}

def download(job):
    product, image = job
    destination = BASE / 'assets' / product['sku'] / image['filename']
    try:
        if destination.exists():
            digest = hashlib.sha256(destination.read_bytes()).hexdigest()
            if digest != image.get('sha256'):
                raise ValueError('Existing image differs; refusing to overwrite')
            return product['sku'], 'cached'
        url=image['source_url']
        parsed=urllib.parse.urlsplit(url)
        if parsed.scheme!='https' or parsed.hostname not in ALLOWED_HOSTS:
            raise ValueError('Source host/protocol not approved')
        # No cookies, login, anti-bot workarounds, referrer spoofing or retry on 403/503.
        with urllib.request.urlopen(url, timeout=25) as response:
            if urllib.parse.urlsplit(response.url).hostname not in ALLOWED_HOSTS:
                raise ValueError('Unapproved redirect host')
            mime=response.headers.get_content_type()
            if mime not in TYPES:
                raise ValueError('Source is not a supported raster image: '+mime)
            data=response.read(10*1024*1024+1)
            if not data or len(data)>10*1024*1024:
                raise ValueError('Image size outside permitted limits')
        image['filename']=Path(image['filename']).stem+TYPES[mime]
        destination=BASE/'assets'/product['sku']/image['filename']
        destination.parent.mkdir(parents=True,exist_ok=True)
        with destination.open('xb') as handle:
            handle.write(data)
        php_code = "require 'backend/src/ProductImageStorage.php'; $s=new ProductImageStorage('backend/public/uploads/products'); echo json_encode($s->stage($argv[1],$argv[2]));"
        validation=subprocess.run([PHP,'-r',php_code,str(destination),str(product['predicted_product_id'])],cwd=ROOT,capture_output=True)
        if validation.returncode:
            # Exact newly created file only, never a pre-existing asset.
            destination.unlink()
            raise ValueError('Storage validation failed: '+validation.stderr.decode('utf-8',errors='replace')[:180])
        info=json.loads(validation.stdout)
        image.update(status='downloaded',sha256=hashlib.sha256(data).hexdigest(),bytes=len(data),width=info['width'],height=info['height'],mime_type=mime,local_path='assets/'+product['sku']+'/'+image['filename'])
        image.pop('error',None)
        return product['sku'],str(info['width'])+'x'+str(info['height'])
    except Exception as error:
        image['status']='manual_required'
        image['error']=str(error)
        return product['sku'],'MANUAL: '+str(error)

if __name__=='__main__':
    manifest=json.loads((BASE/'manifest.json').read_text(encoding='utf-8'))
    jobs=[(product,image) for product in manifest['products'] for image in product['images']]
    with ThreadPoolExecutor(max_workers=5) as executor:
        for sku,status in executor.map(download,jobs):
            print(sku+': '+status,flush=True)
    (BASE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    ready=sum(all(image['status']=='downloaded' for image in product['images']) for product in manifest['products'])
    print(json.dumps({'complete_products':ready,'products':len(manifest['products']),'downloaded_images':sum(image['status']=='downloaded' for _,image in jobs),'requested_images':len(jobs)}))
