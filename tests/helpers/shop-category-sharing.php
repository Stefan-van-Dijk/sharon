<?php
declare(strict_types=1);
define('LOG_CONNECTION_LIBRARY_ONLY',true);require 'server/connections.php';
$dir=sys_get_temp_dir().'/shop-category-'.bin2hex(random_bytes(8));mkdir($dir,0700);$path=$dir.'/network.json';
register_shutdown_function(function()use($dir){foreach(glob($dir.'/*') as $f)unlink($f);rmdir($dir);});
function check($ok){if(!$ok)throw new RuntimeException('Assertion failed');}
function fail($fn,$reason){try{$fn();}catch(LogNetworkError $e){check($e->reason===$reason);return;}throw new RuntimeException('Expected '.$reason);}
$s=new LogNetwork($path,1000);$master=LogNetwork::token();$id=LogNetwork::id();$s->handle('register',['personId'=>$id,'deviceToken'=>$master,'name'=>'Owner'],null);$s->handle('bootstrap',$s->start(),$master);
$other=LogNetwork::token();$otherId=LogNetwork::id();$s->handle('register',['personId'=>$otherId,'deviceToken'=>$other,'name'=>'Other'],null);$invite=$s->handle('invite',['recipientId'=>$otherId],$master)['invitation'];$s->handle('accept',$invite,$other);
$payload=['list'=>['id'=>'weekend','name'=>'Weekend','items'=>[]],'products'=>[],'categories'=>[]];
foreach(['fruit','private'] as $c){$payload['categories'][]=['id'=>$c,'name'=>$c,'entries'=>[['type'=>'product','id'=>$c.'-p']]];$payload['products'][]=['id'=>$c.'-p','name'=>$c.' product','categoryId'=>$c,'barcodes'=>[]];$payload['list']['items'][]=['id'=>$c.'-i','productId'=>$c.'-p','quantity'=>1,'done'=>false,'note'=>''];}
$write=['id'=>'weekend','payload'=>$payload,'revision'=>0,'operation'=>'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'];
$s->handle('shoplist-create',$write,$master);
$share=['id'=>'weekend','personId'=>$otherId,'role'=>'read','categories'=>['fruit']];
$s->handle('shoplist-share',$share,$master);$read=$s->handle('shoplist-read',['id'=>'weekend'],$other);
check(count($read['list']['payload']['products'])===1);check($read['list']['payload']['products'][0]['id']==='fruit-p');
check(!str_contains(json_encode($read),'private'));check($read['list']['categoryScope']===['fruit']);
$pair=$s->handle('shop-pair-create',['format'=>'compact'],$other);$shop=LogNetwork::token();
$s->handle('shop-pair-redeem',['code'=>$pair['code'],'deviceToken'=>$shop],null);$s->handle('shop-device-ack',[],$shop);
$reopened=new LogNetwork($path,1001);check(!str_contains(json_encode($reopened->handle('shoplist-read',['id'=>'weekend'],$shop)),'private'));
check(count($s->handle('shoplist-read',['id'=>'weekend'],$master)['list']['payload']['products'])===2);
fail(fn()=>$s->handle('shoplist-put',[...$write,'revision'=>1],$other),'list_read_only');
fail(fn()=>$s->handle('shoplist-share',[...$share,'role'=>'write'],$master),'invalid_list');
fail(fn()=>$s->handle('shoplist-share',[...$share,'categories'=>['unknown']],$master),'invalid_list');
$s->handle('shoplist-share',[...$share,'categories'=>null,'role'=>'write'],$master);
check(count($s->handle('shoplist-read',['id'=>'weekend'],$other)['list']['payload']['products'])===2);
$s->handle('shoplist-share',[...$share,'categories'=>null,'role'=>null],$master);
fail(fn()=>$s->handle('shoplist-read',['id'=>'weekend'],$other),'list_forbidden');
echo json_encode(['ok'=>true]);
