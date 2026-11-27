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
$pair=$s->handle('shop-pair-create',[],$master, $masterAccount);$parts=explode('.',$pair['code']);$key=LogNetwork::token();$claim=['id'=>$pair['id'],'code'=>$parts[2],'deviceToken'=>$key];
fail(fn()=>$s->handle('shop-pair-claim',[...$claim,'code'=>LogNetwork::token()],null),'pair_expired');
$r=$s->handle('shop-pair-claim',$claim,null);check($r['status']==='claimed');check($s->handle('shop-pair-claim',$claim,null)===$r);
fail(fn()=>$s->handle('shop-pair-claim',[...$claim,'deviceToken'=>LogNetwork::token()],null),'pair_used');
fail(fn()=>$s->handle('shoplist-index',[],$key),'pair_pending');
fail(fn()=>$s->handle('shop-pair-confirm',['id'=>$pair['id'],'fingerprint'=>$r['fingerprint']],$other, $otherAccount),'unauthorized');
fail(fn()=>$s->handle('shop-pair-confirm',['id'=>$pair['id'],'fingerprint'=>'wrong'],$master, $masterAccount),'pair_pending');
$s->handle('shop-pair-confirm',['id'=>$pair['id'],'fingerprint'=>$r['fingerprint']],$master, $masterAccount);
check($s->handle('shop-device-self',[],$key)['self']['personId']===$id);check($s->handle('shoplist-index',[],$key)['lists']===[]);
foreach(['self','contacts','send','invite','set-access','share-publish','shop-pair-create','shoplist-share'] as $action)fail(fn()=>$s->handle($action,[],$key),'shop_scope');
$stored=file_get_contents($path);check(!str_contains($stored,$key)&&!str_contains($stored,$parts[2])&&!str_contains($stored,$master));
$s->handle('shop-pair-revoke',['id'=>$pair['id']],$master, $masterAccount);fail(fn()=>$s->handle('shop-device-self',[],$key),'unauthorized');
$expired=$s->handle('shop-pair-create',[],$master, $masterAccount);$later=new LogNetwork($path,1301);fail(fn()=>$later->handle('shop-pair-claim',['id'=>$expired['id'],'code'=>explode('.',$expired['code'])[2],'deviceToken'=>LogNetwork::token()],null),'pair_expired');
$pair=$s->handle('shop-pair-create',[],$other, $otherAccount);$key=LogNetwork::token();$r=$s->handle('shop-pair-claim',['id'=>$pair['id'],'code'=>explode('.',$pair['code'])[2],'deviceToken'=>$key],null);$s->handle('shop-pair-confirm',['id'=>$pair['id'],'fingerprint'=>$r['fingerprint']],$other, $otherAccount);
$s->handle('set-access',['personId'=>$otherId,'status'=>'revoked'],$master);fail(fn()=>$s->handle('shop-device-self',[],$key),'unauthorized');

$pair=$s->handle('shop-pair-create',['format'=>'compact'],$master, $masterAccount);$code=$pair['code'];check(strlen($code)===12);check($pair['expiresAt']===(1000+7*86400)*1000);
check($s->handle('shop-pair-probe',['code'=>$code],null)['valid']);
check(!$s->handle('shop-pair-probe',['code'=>LogNetwork::id()],null)['valid']);
$key=LogNetwork::token();$input=['code'=>$code,'deviceToken'=>$key];
$s->handle('shop-pair-redeem',$input,null);$s->handle('shop-pair-redeem',$input,null);
check($s->handle('shop-device-self',[],$key)['needsAck']);
fail(fn()=>$s->handle('shoplist-index',[],$key),'pair_pending');
fail(fn()=>$s->handle('shop-pair-redeem',[...$input,'deviceToken'=>LogNetwork::token()],null),'pair_used');
check($s->handle('shop-pair-list',[],$master, $masterAccount)['devices'][count($s->handle('shop-pair-list',[],$master, $masterAccount)['devices'])-1]['status']==='ready');
$s->handle('shop-device-ack',[],$key);$s->handle('shop-device-ack',[],$key);
check(!$s->handle('shop-pair-probe',['code'=>$code],null)['valid']);
fail(fn()=>$s->handle('shop-pair-redeem',$input,null),'pair_expired');
check(!$s->handle('shop-device-self',[],$key)['needsAck']);check($s->handle('shoplist-index',[],$key)['lists']===[]);
check(!str_contains(file_get_contents($path),$code));
$s->handle('shop-device-revoke',[],$key);fail(fn()=>$s->handle('shop-device-self',[],$key),'unauthorized');
$pair=$s->handle('shop-pair-create',['format'=>'compact'],$master, $masterAccount);$future=new LogNetwork($path,1000+7*86400);check(!$future->handle('shop-pair-probe',['code'=>$pair['code']],null)['valid']);
fail(fn()=>$future->handle('shop-pair-redeem',['code'=>$pair['code'],'deviceToken'=>LogNetwork::token()],null),'pair_expired');
echo json_encode(['ok'=>true]);
