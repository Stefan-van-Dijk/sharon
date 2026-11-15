<?php
declare(strict_types=1);
define('LOG_CONNECTION_LIBRARY_ONLY',true);
require 'server/connections.php';
$dir=sys_get_temp_dir().'/shop-pair-'.bin2hex(random_bytes(8));mkdir($dir,0700);$path=$dir.'/network.json';
register_shutdown_function(function()use($dir){foreach(glob($dir.'/*') as $f)unlink($f);rmdir($dir);});
function check($ok){if(!$ok)throw new RuntimeException('Assertion failed');}
function fail($fn,$reason){try{$fn();}catch(LogNetworkError $e){check($e->reason===$reason);return;}throw new RuntimeException('Expected '.$reason);}
$s=new LogNetwork($path,1000);$master=LogNetwork::token();$id=LogNetwork::id();$s->handle('register',['personId'=>$id,'deviceToken'=>$master,'name'=>'Owner'],null);$s->handle('bootstrap',$s->start(),$master);
$other=LogNetwork::token();$otherId=LogNetwork::id();$s->handle('register',['personId'=>$otherId,'deviceToken'=>$other,'name'=>'Other'],null);$invite=$s->handle('invite',['recipientId'=>$otherId],$master)['invitation'];$s->handle('accept',$invite,$other);
$pair=$s->handle('shop-pair-create',[],$master);$parts=explode('.',$pair['code']);$key=LogNetwork::token();$claim=['id'=>$pair['id'],'code'=>$parts[2],'deviceToken'=>$key];
fail(fn()=>$s->handle('shop-pair-claim',[...$claim,'code'=>LogNetwork::token()],null),'pair_expired');
$r=$s->handle('shop-pair-claim',$claim,null);check($r['status']==='claimed');check($s->handle('shop-pair-claim',$claim,null)===$r);
fail(fn()=>$s->handle('shop-pair-claim',[...$claim,'deviceToken'=>LogNetwork::token()],null),'pair_used');
fail(fn()=>$s->handle('shoplist-index',[],$key),'pair_pending');
fail(fn()=>$s->handle('shop-pair-confirm',['id'=>$pair['id'],'fingerprint'=>$r['fingerprint']],$other),'unauthorized');
fail(fn()=>$s->handle('shop-pair-confirm',['id'=>$pair['id'],'fingerprint'=>'wrong'],$master),'pair_pending');
$s->handle('shop-pair-confirm',['id'=>$pair['id'],'fingerprint'=>$r['fingerprint']],$master);
check($s->handle('shop-device-self',[],$key)['self']['personId']===$id);check($s->handle('shoplist-index',[],$key)['lists']===[]);
foreach(['self','contacts','send','invite','set-access','share-publish','shop-pair-create','shoplist-share'] as $action)fail(fn()=>$s->handle($action,[],$key),'shop_scope');
$stored=file_get_contents($path);check(!str_contains($stored,$key)&&!str_contains($stored,$parts[2])&&!str_contains($stored,$master));
$s->handle('shop-pair-revoke',['id'=>$pair['id']],$master);fail(fn()=>$s->handle('shop-device-self',[],$key),'unauthorized');
$expired=$s->handle('shop-pair-create',[],$master);$later=new LogNetwork($path,1301);fail(fn()=>$later->handle('shop-pair-claim',['id'=>$expired['id'],'code'=>explode('.',$expired['code'])[2],'deviceToken'=>LogNetwork::token()],null),'pair_expired');
$pair=$s->handle('shop-pair-create',[],$other);$key=LogNetwork::token();$r=$s->handle('shop-pair-claim',['id'=>$pair['id'],'code'=>explode('.',$pair['code'])[2],'deviceToken'=>$key],null);$s->handle('shop-pair-confirm',['id'=>$pair['id'],'fingerprint'=>$r['fingerprint']],$other);
$s->handle('set-access',['personId'=>$otherId,'status'=>'revoked'],$master);fail(fn()=>$s->handle('shop-device-self',[],$key),'unauthorized');
echo json_encode(['ok'=>true]);
