import assert from 'node:assert/strict';
import {initialShopFilters,selectShopProducts,validPriceRange,SHOP_PAGE_SIZE,foldShop} from '../../frontend/src/shop/shopModel.ts';
const p=(id,price,stock,name)=>({id,name,price,series:'One Piece',category:'Manga',categoryKey:'manga',source:'api',stockQuantity:stock,api:{name_vi:name,name_en:name,sku:'SKU-'+id,series:{slug:'one-piece'}}});
const products=[p(3,90000,0,'Đại Chiến Titan'),p(2,30000,5,'Naruto'),p(1,30000,2,'One Piece')];
const select=f=>selectShopProducts(products,{...initialShopFilters,...f},'vi',x=>x);
assert.equal(foldShop('ĐẠI CHIẾN'),'dai chien');assert.deepEqual(select({query:'dai chien'}).map(p=>p.id),[3]);assert.deepEqual(select({query:'SKU-2'}).map(p=>p.id),[2]);assert.deepEqual(select({sort:'price_asc'}).map(p=>p.id),[1,2,3]);assert.deepEqual(select({stock:'in',min:'30000',max:'30000'}).map(p=>p.id),[2,1]);assert.deepEqual(select({stock:'out'}).map(p=>p.id),[3]);
for(const values of [{min:'5',max:'1'},{min:'-1'},{max:'1e999'},{min:'1.5'}])assert.equal(validPriceRange({...initialShopFilters,...values}),false);
assert.equal(SHOP_PAGE_SIZE,24);const large=Array.from({length:53},(_,i)=>p(i+1,30000,5,'Test'));const ids=selectShopProducts(large,{...initialShopFilters,sort:'price_asc'},'en',x=>x).map(p=>p.id);const pages=[ids.slice(0,24),ids.slice(24,48),ids.slice(48)];assert.deepEqual(pages.map(p=>p.length),[24,24,5]);assert.equal(new Set(pages.flat()).size,53);console.log('PASS Shop model: accent/case/SKU search, stock/price validation, stable sort, 24-row pagination without duplicates');
