<?php
declare(strict_types=1);
define('LOG_CONNECTION_LIBRARY_ONLY',true);
require 'server/connections.php';
$dir=sys_get_temp_dir().'/sharon-accounts-'.bin2hex(random_bytes(8));mkdir($dir,0700);
$path=$dir.'/network.json';
register_shutdown_function(function()use($dir){foreach(glob($dir.'/*') as $file)unlink($file);rmdir($dir);});
$checks=0;
function check(bool $value):void {global $checks;$checks++;if(!$value)throw new RuntimeException('Failed check '.$checks);}
function fails(callable $callback,string $reason):void {
 try{$callback();}catch(LogNetworkError $error){check($error->reason===$reason);return;}
 throw new RuntimeException('Expected '.$reason);
}
function device(string $name):array {return ['personId'=>LogNetwork::id(),'deviceToken'=>LogNetwork::token(),'name'=>$name];}
function mailCode(LogNetwork $service,string $email,string $kind='verify'):string {
 $code=null;
 $service->deliverAccountMail(function($item)use(&$code,$email,$kind){if($item['email']===$email&&$item['kind']===$kind)$code=$item['code'];return true;});
 if($code===null)throw new RuntimeException('Mail missing for '.$kind);
 return $code;
}
$s=new LogNetwork($path,1000);
$alice=device('Alice');$bob=device('Bob');$password='account-password-123';
$email='alice@example.test';
$input=['email'=>$email,'password'=>$password];
check($s->handle('account-status',[],null)['account']===null);
check($s->handle('account-register',$input,null)===['ok'=>true]);
check($s->handle('account-register',$input,null)===['ok'=>true]);
check(!str_contains(json_encode($s->handle('account-register',$input,null)),'code'));
$pending=$s->deliverAccountMail(fn($item)=>false);check($pending===['sent'=>0,'pending'=>1]);
$attempts=0;$s->deliverAccountMail(function($item)use(&$attempts){$attempts++;return true;});check($attempts===0);
$later=new LogNetwork($path,1061);$code=mailCode($later,$email);
fails(fn()=>$s->handle('account-login',[...$input,...$alice],null),'account_unverified');
fails(fn()=>$s->handle('account-verify',['email'=>$email,'code'=>'bad','password'=>$password],null),'account_verification');
fails(fn()=>$s->handle('account-verify',['email'=>$email,'code'=>$code,'password'=>'short'],null),'account_password');
check($s->handle('account-verify',[...$input,'code'=>$code],null)===['ok'=>true]);
fails(fn()=>$s->handle('account-verify',[...$input,'code'=>$code],null),'account_verification');
$login=$s->handle('account-login',[...$input,...$alice],null);$session=$login['sessionToken'];
check(strlen($session)===43);check($login['account']['personId']===$alice['personId']);check($login['account']['email']===$email);
check($s->handle('self',[],$alice['deviceToken'])['self']['line']===null);
check($s->handle('account-status',[],null,$session)['account']===$login['account']);
fails(fn()=>$s->handle('account-app-code',['app'=>'eventline'],null),'account_required');
fails(fn()=>$s->handle('account-app-code',['app'=>'other'],null,$session),'unknown_action');
$appCode=$s->handle('account-app-code',['app'=>'eventline'],null,$session)['code'];
check(!str_contains(file_get_contents($path),$appCode));
fails(fn()=>$s->redeemAccountAppCode('other',$appCode),'account_verification');
check($s->redeemAccountAppCode('eventline',$appCode)['account']===$login['account']+['name'=>'Alice']);
fails(fn()=>$s->redeemAccountAppCode('eventline',$appCode),'account_verification');
$expiredCode=$s->handle('account-app-code',['app'=>'eventline'],null,$session)['code'];
fails(fn()=>$later->redeemAccountAppCode('eventline',$expiredCode),'account_verification');
fails(fn()=>$s->handle('shop-pair-list',[],$alice['deviceToken']),'account_required');
check($s->handle('shop-pair-list',[],$alice['deviceToken'],$session)['devices']===[]);
fails(fn()=>$s->handle('contacts',[],$alice['deviceToken'],$session),'invitation_required');
$pair=$s->handle('shop-pair-create',['format'=>'compact'],$alice['deviceToken'],$session);
$shopToken=LogNetwork::token();$s->handle('shop-pair-redeem',['code'=>$pair['code'],'deviceToken'=>$shopToken],null);
check($s->handle('shop-device-self',[],$shopToken)['self']['personId']===$alice['personId']);
$s->handle('shop-device-ack',[],$shopToken);check($s->handle('shoplist-index',[],$shopToken)['lists']===[]);
fails(fn()=>$s->handle('shop-pair-list',[],$shopToken,$session),'shop_scope');
$stored=file_get_contents($path);check(!str_contains($stored,$session));check(!str_contains($stored,$alice['deviceToken']));check(!str_contains($stored,$password));
fails(fn()=>$s->handle('account-login',[...$input,'password'=>'wrong-password'],null),'account_credentials');
fails(fn()=>$s->handle('account-login',[...$input,...$bob],null),'account_identity_conflict');
fails(fn()=>$s->handle('account-login',[...$input,...$alice,'deviceToken'=>LogNetwork::token()],null),'account_identity_conflict');
$otherEmail='bob@example.test';$otherInput=['email'=>$otherEmail,'password'=>$password];
$s->handle('account-register',$otherInput,null);$otherCode=mailCode($s,$otherEmail);$s->handle('account-verify',[...$otherInput,'code'=>$otherCode],null);
fails(fn()=>$s->handle('account-login',[...$otherInput,...$alice],null),'account_identity_conflict');
$bobLogin=$s->handle('account-login',[...$otherInput,...$bob],null);
fails(fn()=>$s->handle('shop-pair-list',[],$alice['deviceToken'],$bobLogin['sessionToken']),'account_identity_conflict');
check($s->handle('account-status',[],null,LogNetwork::token())['account']===null);
$expired=new LogNetwork($path,8201);check($expired->handle('account-status',[],null,$bobLogin['sessionToken'])['account']===null);
$another=$s->handle('account-login',[...$input,...$alice],null,$session);
check($another['sessionToken']!==$session);check($s->handle('account-status',[],null,$session)['account']===null);
$session=$another['sessionToken'];
check($s->handle('account-forgot',['email'=>'unknown@example.test'],null)===['ok'=>true]);
$s->handle('account-forgot',['email'=>$email],null);$reset=mailCode($s,$email,'reset');
fails(fn()=>$s->handle('account-reset',[...$input,'code'=>'bad'],null),'account_verification');
$newPassword='new-password-456';$s->handle('account-reset',['email'=>$email,'code'=>$reset,'password'=>$newPassword],null);
check($s->handle('account-status',[],null,$session)['account']===null);
fails(fn()=>$s->handle('account-reset',[...$input,'code'=>$reset],null),'account_verification');
fails(fn()=>$s->handle('account-login',[...$input,...$alice],null),'account_credentials');
$again=$s->handle('account-login',[...$input,...$alice,'password'=>$newPassword],null);
$revokedCode=$s->handle('account-app-code',['app'=>'eventline'],null,$again['sessionToken'])['code'];
$s->handle('account-logout',[],null,$again['sessionToken']);
fails(fn()=>$s->redeemAccountAppCode('eventline',$revokedCode),'account_required');check($s->handle('account-status',[],null,$again['sessionToken'])['account']===null);
fails(fn()=>$s->handle('shop-pair-list',[],$alice['deviceToken'],$again['sessionToken']),'account_required');
// An email owner can recover a malicious pre-registration by choosing a password on confirmation.
$victim='victim@example.test';$s->handle('account-register',['email'=>$victim,'password'=>'attacker-password-1'],null);
$s->handle('account-resend',['email'=>$victim],null);$verify=mailCode($s,$victim);
$s->handle('account-verify',['email'=>$victim,'code'=>$verify,'password'=>'victim-password-2'],null);
fails(fn()=>$s->handle('account-login',['email'=>$victim,'password'=>'attacker-password-1',...device('Victim')],null),'account_credentials');
check(isset($s->handle('account-login',['email'=>$victim,'password'=>'victim-password-2',...device('Victim')],null)['sessionToken']));
// A reset request can confirm an unverified mailbox, and a used or expired code cannot be replayed.
$pendingEmail='pending@example.test';
$s->handle('account-register',['email'=>$pendingEmail,'password'=>$password],null);
$oldCode=mailCode($s,$pendingEmail);
$s->handle('account-resend',['email'=>$pendingEmail],null);$newCode=mailCode($s,$pendingEmail);
check($oldCode!==$newCode);
fails(fn()=>$s->handle('account-verify',['email'=>$pendingEmail,'code'=>$oldCode,'password'=>$password],null),'account_verification');
$farFuture=new LogNetwork($path,5000);
fails(fn()=>$farFuture->handle('account-verify',['email'=>$pendingEmail,'code'=>$newCode,'password'=>$password],null),'account_verification');
$s->handle('account-forgot',['email'=>$pendingEmail],null);$pendingReset=mailCode($s,$pendingEmail,'reset');
$s->handle('account-reset',['email'=>$pendingEmail,'code'=>$pendingReset,'password'=>$newPassword],null);
check(isset($s->handle('account-login',['email'=>$pendingEmail,'password'=>$newPassword,...device('Pending')],null)['sessionToken']));
// Account-level limits persist across different IPs and combine mail-sending actions.
for($i=0;$i<4;$i++)$s->throttleAccount('ip-'.$i,['account-register','account-resend','account-forgot','account-resend'][$i],'limits@example.test');
fails(fn()=>$s->throttleAccount('other-ip','account-forgot','LIMITS@example.test'),'rate_limit');
$afterLimit=new LogNetwork($path,1901);$afterLimit->throttleAccount('another-ip','account-forgot','limits@example.test');
check(true);
echo json_encode(['ok'=>true,'checks'=>$checks]);
