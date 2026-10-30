import { ConnectionService } from '../core/connection/ConnectionService.js?v=0.4.37';
const QR_PREFIX='sharing.qr.';
export const qrShareKey=id=>QR_PREFIX+id;
export async function sharingRecords(store,objectId){
  const [meta,objects]=await Promise.all([store.getAll('meta'),store.getAll('objects')]);
  return [
    ...meta.filter(row=>row.key.startsWith(QR_PREFIX)).map(row=>({...row.value,channel:'qr'})),
    ...objects.filter(row=>row.type==='chat-message'&&row.sharedObjectId).map(row=>({
      id:row.id,sourceId:row.sharedObjectId,relatedIds:row.sharedRelatedIds||[],channel:'chat',chatId:row.chatId,recipientName:row.sharedRecipientName||'',
      state:row.delivery==='sent'?'sent':'pending',verifiedAt:row.sharedConfirmedAt||row.updatedAt||row.at||row.createdAt
    }))
  ].filter(row=>!objectId||(row.sourceId===objectId||row.relatedIds?.includes(objectId)));
}
export function sharingSummary(records,now=Date.now()){
  if(!records.length)return null;
  const online=records.some(row=>row.channel==='qr'&&row.state==='online'&&row.expiresAt>now);
  const sent=records.some(row=>row.channel==='chat'&&row.state==='sent');
  const uncertain=records.some(row=>['unknown','pending'].includes(row.state)&&!(row.channel==='qr'&&row.expiresAt<=now));
  return online?{state:'online',label:'Online',description:'QR-deling online; bekijk de deelstatus voor de laatste controle.'}:
    sent?{state:'shared',label:'Gedeeld',description:'Bevestigd gedeeld met een persoon.'}:
    uncertain?{state:'unknown',label:'Controleren',description:'De online deelstatus is nog niet bevestigd.'}:
    null;
}
export function sharingBadge(summary){
  if(!summary)return '';
  return `<span class="sh-sharing-dot" data-sharing-state="${summary.state}" title="${summary.description}" role="img" aria-label="${summary.description}"></span>`;
}
// Status reads use the existing authenticated-by-code endpoint. No server upload is required.
export async function refreshQrShares(store,objectId,{force=false}={}){
  const rows=(await sharingRecords(store,objectId)).filter(row=>row.channel==='qr');
  const service=new ConnectionService(store);
  for(const row of rows){
    if(['missing','withdrawn'].includes(row.state)||(!force&&Date.now()-Math.max(row.checkedAt||0,row.verifiedAt||0)<60000))continue;
    let next;
    if(row.expiresAt<=Date.now())next={...row,state:'expired'};
    else {
      // request() deliberately presents friendly errors; inspect HTTP status here to
      // distinguish a missing file from a connection or authorization failure.
      let status=0;
      const requestService=new ConnectionService(store,{fetcher:async(url,options)=>{
        const response=await service.fetcher(url,options);status=response.status;return response;
      }});
      try {
        const result=await requestService.request('share-read',{id:row.id,access:row.access});
        if(!result.payload?.iv||!result.payload?.data)throw Error('Ongeldig serverantwoord.');
        next={...row,state:'online',verifiedAt:Date.now(),checkedAt:Date.now()};
      }catch{
        next={...row,state:status===410?'missing':'unknown',checkedAt:Date.now()};
      }
    }
    await store.put('meta',{key:qrShareKey(row.id),value:next});
  }
  return sharingRecords(store,objectId);
}
export async function mountSharingBadges(root,store,{refresh=true}={}){
  const rows=await sharingRecords(store);
  if(!root.isConnected)return;
  for(const strip of root.querySelectorAll('[data-swipe-row]')){
    const surface=strip.querySelector('[data-swipe-surface]');if(!surface)continue;
    surface.querySelector('[data-sharing-state]')?.remove();
    const summary=sharingSummary(rows.filter(row=>(row.sourceId===strip.dataset.swipeRow||row.relatedIds?.includes(strip.dataset.swipeRow))));
    if(summary)surface.insertAdjacentHTML('beforeend',sharingBadge(summary));
  }
  const visibleIds=new Set([...root.querySelectorAll('[data-swipe-row]')].map(strip=>strip.dataset.swipeRow));
  if(refresh&&rows.some(row=>row.channel==='qr'&&(visibleIds.has(row.sourceId)||row.relatedIds?.some(id=>visibleIds.has(id))))) {
    refreshQrShares(store).then(()=>mountSharingBadges(root,store,{refresh:false})).catch(()=>{});
  }
}
