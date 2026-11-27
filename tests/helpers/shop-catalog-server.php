<?php
declare(strict_types=1);
define('LOG_CONNECTION_LIBRARY_ONLY',true);
require 'server/connections.php';
require 'tests/helpers/account-fixture.php';
$dir=sys_get_temp_dir().'/shop-pair-'.bin2hex(random_bytes(8));mkdir($dir,0700);$path=$dir.'/network.json';
register_shutdown_function(function()use($dir){foreach(glob($dir.'/*') as $f)unlink($f);rmdir($dir);});
function check($ok){if(!$ok)throw new RuntimeException('Assertion failed');}
function fail($fn,$reason){try{$fn();}catch(LogNetworkError $e){check($e->reason===$reason);return;}throw new RuntimeException('Expected '.$reason);}
$s=new LogNetwork($path,1000);$master=LogNetwork::token();$id=LogNetwork::id();$s->handle('register',['personId'=>$id,'deviceToken'=>$master,'name'=>'Owner'],null);$s->handle('bootstrap',$s->start(),$master);
$other=LogNetwork::token();$otherId=LogNetwork::id();$s->handle('register',['personId'=>$otherId,'deviceToken'=>$other,'name'=>'Other'],null);$invite=$s->handle('invite',['recipientId'=>$otherId],$master)['invitation'];$s->handle('accept',$invite,$other);

$masterAccount=verified_account_session($s,['personId'=>$id,'deviceToken'=>$master,'name'=>'Owner']);
$otherAccount=verified_account_session($s,['personId'=>$otherId,'deviceToken'=>$other,'name'=>'Other']);
$catalog=['categories'=>[['id'=>'food','name'=>'Food','entries'=>[]]],'products'=>[['id'=>'milk','name'=>'Milk','categoryId'=>'food','barcodes'=>[]]],'recipes'=>[['id'=>'trip','name'=>'Trip','kind'=>'activity','categoryId'=>'food','ingredients'=>[['productId'=>'milk','quantity'=>1,'note'=>'']]]]];
$op='00000000-0000-4000-8000-000000000001';
$r=$s->handle('shopcatalog-put',['payload'=>$catalog,'revision'=>0,'operation'=>$op],$master, $masterAccount);
check($r['catalog']['revision']===1);
check($s->handle('shopcatalog-read',[],$master, $masterAccount)['catalog']['payload']===$catalog);
check($s->handle('shopcatalog-read',['personId'=>$id],$other, $otherAccount)['catalog']['revision']===0);
check($s->handle('shopcatalog-put',['payload'=>$catalog,'revision'=>0,'operation'=>$op],$master, $masterAccount)===$r);
fail(fn()=>$s->handle('shopcatalog-put',['payload'=>$catalog,'revision'=>0,'operation'=>'00000000-0000-4000-8000-000000000002'],$master, $masterAccount),'catalog_conflict');
$bad=$catalog;$bad['recipes'][0]['ingredients'][0]['productId']='missing';
fail(fn()=>$s->handle('shopcatalog-put',['payload'=>$bad,'revision'=>1,'operation'=>$op],$master, $masterAccount),'invalid_catalog');
$pair=$s->handle('shop-pair-create',['format'=>'compact'],$master, $masterAccount);$key=LogNetwork::token();
$s->handle('shop-pair-redeem',['code'=>$pair['code'],'deviceToken'=>$key],null);$s->handle('shop-device-ack',[],$key);
check($s->handle('shopcatalog-read',[],$key)['catalog']['payload']===$catalog);
$s->handle('shop-device-revoke',[],$key);fail(fn()=>$s->handle('shopcatalog-read',[],$key),'unauthorized');
echo json_encode(['ok'=>true]);
