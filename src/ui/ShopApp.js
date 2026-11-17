import {SHOPLIST_URL} from '../core/shoplist/ShopListService.js?v=0.4.96';
export function shopAppUrl(id){
 const url=new URL(SHOPLIST_URL);url.searchParams.set('shoplist',id);url.searchParams.set('from','sharon');return url.href;
}
export function mountShopApp(body,id){
 const frame=body.ownerDocument.createElement('iframe');
 frame.className='sh-shop-app';frame.title='ShopList';frame.src=shopAppUrl(id);
 frame.allow='camera; microphone';body.replaceChildren(frame);return frame;
}
