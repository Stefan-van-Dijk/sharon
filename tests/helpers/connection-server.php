<?php
declare(strict_types=1);
define('LOG_CONNECTION_LIBRARY_ONLY',true);
require 'server/connections.php';
$temporary=[];
register_shutdown_function(function()use(&$temporary){foreach($temporary as $path){foreach(glob(dirname($path).'/*') as $file)unlink($file);rmdir(dirname($path));}});
$checks=0;
function check(bool $result): void { global $checks; $checks++; if(!$result)throw new RuntimeException('Check '.$checks.' failed'); }
function fails(callable $fn, string $reason): void {
    try { $fn(); } catch(LogNetworkError $e) { check($e->reason===$reason); return; }
    throw new RuntimeException('Expected '.$reason);
}
function fixture(): array {
    global $temporary;
    $dir=sys_get_temp_dir().'/log-json-'.bin2hex(random_bytes(6));mkdir($dir,0700);
    $db=$dir.'/network.json';$temporary[]=$db;
    $s=new LogNetwork($db,1000000);$start=$s->start();
    $owner=['personId'=>LogNetwork::id(),'deviceToken'=>LogNetwork::token(),'name'=>'Eigenaar'];
    $s->handle('register',$owner,null);
    $s->handle('bootstrap',$start,$owner['deviceToken']);
    return [$db,$s,$start,$owner];
}
function person(LogNetwork $s, string $name='Persoon'): array {
    $p=['personId'=>LogNetwork::id(),'deviceToken'=>LogNetwork::token(),'name'=>$name];
    $s->handle('register',$p,null);return $p;
}
function joinPerson(LogNetwork $s, array $issuer, array $recipient): array {
    $invite=$s->handle('invite',['recipientId'=>$recipient['personId']],$issuer['deviceToken'])['invitation'];
    return $s->handle('accept',$invite,$recipient['deviceToken'])['self'];
}
[$db,$s,$start,$owner]=fixture();
check(json_decode(file_get_contents($db),true)['schema']==='sharon-network-v1');
check($s->handle('bootstrap',$start,$owner['deviceToken'])['self']['line']===0);
$bob=person($s,'Bob');$eve=person($s,'<img src=x onerror=alert(1)>');
fails(fn()=>$s->handle('bootstrap',$start,$bob['deviceToken']),'invitation_used');
fails(fn()=>$s->handle('register',[...$owner,'deviceToken'=>LogNetwork::token()],null),'identity_exists');
fails(fn()=>$s->handle('self',[],LogNetwork::token()),'unauthorized');
fails(fn()=>$s->handle('contacts',[],$bob['deviceToken']),'invitation_required');
fails(fn()=>$s->handle('invite',['recipientId'=>LogNetwork::id()],$owner['deviceToken']),'recipient_unknown');
$invite=$s->handle('invite',['recipientId'=>$bob['personId']],$owner['deviceToken'])['invitation'];
fails(fn()=>$s->handle('accept',$invite,$eve['deviceToken']),'invalid_invitation');
fails(fn()=>$s->handle('accept',[...$invite,'networkId'=>LogNetwork::id()],$bob['deviceToken']),'wrong_network');
fails(fn()=>$s->handle('accept',[...$invite,'token'=>LogNetwork::token()],$bob['deviceToken']),'invalid_invitation');
check($s->handle('accept',$invite,$bob['deviceToken'])['self']['line']===1);
check($s->handle('accept',$invite,$bob['deviceToken'])['self']['line']===1);
$contacts=$s->handle('contacts',[],$owner['deviceToken'])['contacts'];
check(count($contacts)===1&&$contacts[0]['personId']===$bob['personId']);
$chat=$contacts[0]['chatId'];
joinPerson($s,$owner,$eve);
fails(fn()=>$s->handle('messages',['chatId'=>$chat],$eve['deviceToken']),'chat_forbidden');
fails(fn()=>$s->handle('send',['chatId'=>$chat,'id'=>LogNetwork::id(),'text'=>'spion'],$eve['deviceToken']),'chat_forbidden');
$id=LogNetwork::id();
$sent=$s->handle('send',['chatId'=>$chat,'id'=>$id,'text'=>'Hallo <script>test</script>'],$owner['deviceToken'])['message'];
check($sent['senderId']===$owner['personId']&&$sent['id']===$id);
check($s->handle('send',['chatId'=>$chat,'id'=>$id,'text'=>$sent['text']],$owner['deviceToken'])['message']===$sent);
fails(fn()=>$s->handle('send',['chatId'=>$chat,'id'=>$id,'text'=>'anders'],$owner['deviceToken']),'message_conflict');
fails(fn()=>$s->handle('send',['chatId'=>$chat,'id'=>$id,'text'=>$sent['text']],$bob['deviceToken']),'message_conflict');
check(count($s->handle('messages',['chatId'=>$chat],$bob['deviceToken'])['messages'])===1);
check($s->handle('messages',['chatId'=>$chat,'after'=>$sent['seq']],$bob['deviceToken'])['messages']===[]);
fails(fn()=>$s->handle('messages',['chatId'=>$chat,'after'=>-1],$bob['deviceToken']),'invalid_cursor');
fails(fn()=>$s->handle('send',['chatId'=>$chat,'id'=>LogNetwork::id(),'text'=>str_repeat('x',8001)],$bob['deviceToken']),'invalid_message');
$second=person($s);$third=person($s);$fourth=person($s);
check(joinPerson($s,$bob,$second)['line']===2);
check(joinPerson($s,$second,$third)['line']===3);
fails(fn()=>$s->handle('invite',['recipientId'=>$fourth['personId']],$third['deviceToken']),'depth_limit');
check(joinPerson($s,$owner,$third)['line']===3); // Connects, never reparents.
$beforeGrant=array_values(array_filter(json_decode(file_get_contents($db),true)['relations'],fn($r)=>$r['type']==='grants-access' && $r['toId']===$bob['personId']))[0]['id'];
fails(fn()=>$s->handle('set-access',['personId'=>$bob['personId'],'status'=>'revoked'],$eve['deviceToken']),'owner_required');
$s->handle('set-access',['personId'=>$bob['personId'],'status'=>'revoked'],$owner['deviceToken']);
$s->handle('set-access',['personId'=>$bob['personId'],'status'=>'active'],$owner['deviceToken']);
check($s->handle('self',[],$bob['deviceToken'])['self']['line']===1);
check(json_decode(file_get_contents($db),true)['relations'][$beforeGrant]['status']==='active');
$s->handle('set-access',['personId'=>$bob['personId'],'status'=>'revoked'],$owner['deviceToken']);
fails(fn()=>$s->handle('messages',['chatId'=>$chat],$bob['deviceToken']),'unauthorized');
fails(fn()=>$s->handle('send',['chatId'=>$chat,'id'=>LogNetwork::id(),'text'=>'hoi'],$owner['deviceToken']),'chat_forbidden');
check($s->handle('self',[],$second['deviceToken'])['self']['line']===2); // No cascade.
fails(fn()=>$s->start(),'already_activated');
$waiting=person($s);$expired=$s->handle('invite',['recipientId'=>$waiting['personId']],$owner['deviceToken'])['invitation'];
$future=new LogNetwork($db,1086401);
fails(fn()=>$future->handle('accept',$expired,$waiting['deviceToken']),'invitation_expired');
check($s->handle('self',[],$waiting['deviceToken'])['self']['line']===null);
[$otherDb,$fresh,$oldStart,$unusedOwner]=fixture();
// Independent, unclaimed JSON network for expiry and first-100 tests.
$state=json_decode(file_get_contents($otherDb),true);$state['ownerId']=null;$state['people']=[];
file_put_contents($otherDb,json_encode($state));$first=$fresh->start();
$new=person($fresh);$futureFresh=new LogNetwork($otherDb,1000900);
fails(fn()=>$futureFresh->handle('bootstrap',$first,$new['deviceToken']),'invitation_expired');
$rotated=$fresh->start();
fails(fn()=>$fresh->handle('bootstrap',$first,$new['deviceToken']),'invalid_invitation');
check($fresh->handle('bootstrap',$rotated,$new['deviceToken'])['self']['line']===0);
for($i=0;$i<100;$i++) {
    $p=person($fresh);
    check(joinPerson($fresh,$new,$p)['line']===1);
}
$overflow=person($fresh);
fails(fn()=>$fresh->handle('invite',['recipientId'=>$overflow['personId']],$new['deviceToken']),'capacity');
$fresh->handle('set-access',['personId'=>$p['personId'],'status'=>'revoked'],$new['deviceToken']);
fails(fn()=>$fresh->handle('invite',['recipientId'=>$overflow['personId']],$new['deviceToken']),'capacity');
for($i=0;$i<120;$i++)$s->throttle('test-ip',str_repeat('a',43),false);
fails(fn()=>$s->throttle('test-ip',str_repeat('a',43),false),'rate_limit');
$state=json_decode(file_get_contents($db),true);
$grants=array_values(array_filter($state['relations'],fn($r)=>$r['type']==='grants-access'));
$chats=array_values(array_filter($state['relations'],fn($r)=>$r['type']==='chat'));
check(count($grants)===4 && count($chats)===5);
foreach($state['relations'] as $r)check(strlen($r['id'])===12 && strlen($r['fromId'])===12 && strlen($r['toId'])===12);
check(!str_contains(file_get_contents($db),$owner['deviceToken']));
$before=file_get_contents($db);
fails(fn()=>$s->handle('send',['chatId'=>$chat,'id'=>LogNetwork::id(),'text'=>'No access'],$owner['deviceToken']),'chat_forbidden');
check(file_get_contents($db)===$before);
file_put_contents($db,'{invalid');
try{$s->handle('self',[],$owner['deviceToken']);throw new RuntimeException('Corruption was ignored');}catch(JsonException $e){check(file_get_contents($db)==='{invalid');}
// An open QR is claimed atomically by its first scanner, without a known ID.
[$qrPath,$qr,$qrStart,$qrOwner]=fixture();
$open=$qr->handle('invite',[],$qrOwner['deviceToken'])['invitation'];
check(!isset($open['recipientId']));
check($qr->handle('invite-status',$open,$qrOwner['deviceToken'])['claimed']===false);
$a=person($qr,'Alice');$b=person($qr,'Ben');
fails(fn()=>$qr->handle('accept',$open,$qrOwner['deviceToken']),'invalid_invitation');
$accepted=$qr->handle('accept',$open,$a['deviceToken']);
check($accepted['self']['line']===1);
check($accepted['contact']['personId']===$qrOwner['personId']);
check($qr->handle('accept',$open,$a['deviceToken'])===$accepted);
fails(fn()=>$qr->handle('accept',$open,$b['deviceToken']),'invalid_invitation');
$status=$qr->handle('invite-status',$open,$qrOwner['deviceToken']);
check($status['claimed']&&$status['contact']['name']==='Alice');
fails(fn()=>$qr->handle('invite-status',$open,$a['deviceToken']),'invalid_invitation');
$next=$qr->handle('invite',[],$a['deviceToken'])['invitation'];
check($qr->handle('accept',$next,$b['deviceToken'])['self']['line']===2);
$state=json_decode(file_get_contents($qrPath),true);
check(count(array_filter($state['relations'],fn($r)=>$r['type']==='grants-access'))===2);
// Compact links contain only encrypted invitation data, published by the issuer.
$refInvite=$qr->handle('invite',[],$qrOwner['deviceToken'])['invitation'];
$ref=['id'=>'InviteRef001','token'=>$refInvite['token'],'payload'=>['v'=>1,'iv'=>str_repeat('a',16),'data'=>str_repeat('b',44)]];
fails(fn()=>$qr->handle('invitation-publish',$ref,$a['deviceToken']),'invalid_invitation');
check($qr->handle('invitation-publish',$ref,$qrOwner['deviceToken'])['ok']);
check($qr->handle('invitation-resolve',['id'=>'InviteRef001'],null)['payload']===$ref['payload']);
fails(fn()=>$qr->handle('invitation-publish',$ref,$qrOwner['deviceToken']),'identity_exists');
fails(fn()=>$qr->handle('invitation-resolve',['id'=>'MissingRef01'],null),'invalid_reference');
$expired=new LogNetwork($qrPath,1000000+86401);
fails(fn()=>$expired->handle('invitation-resolve',['id'=>'InviteRef001'],null),'invalid_reference');
// Bare contact IDs never disclose an invitation token or key.
[$codePath,$cs,$codeStart,$codeOwner]=fixture();
$first=person($cs,'Eerste');$second=person($cs,'Tweede');
$ci=$cs->handle('invite',[],$codeOwner['deviceToken'])['invitation'];
fails(fn()=>$cs->handle('invite-code',['token'=>$ci['token']],$first['deviceToken']),'invitation_required');
$code=$cs->handle('invite-code',['token'=>$ci['token']],$codeOwner['deviceToken']);
check(strlen($code['id'])===12 && count($code)===1);
check($cs->handle('invite-code-check',$code,null)===['valid'=>true]);
check($cs->handle('invite-code-check',['id'=>'UnknownCode1'],null)===['valid'=>false]);
fails(fn()=>$cs->handle('accept-code',$code,null),'invalid_token');
fails(fn()=>$cs->handle('accept-code',$code,LogNetwork::token()),'unauthorized');
fails(fn()=>$cs->handle('accept-code',$code,$codeOwner['deviceToken']),'invalid_invitation');
$connected=$cs->handle('accept-code',$code,$first['deviceToken']);
check($connected['self']['line']===1 && $connected['contact']['personId']===$codeOwner['personId']);
check($cs->handle('accept-code',$code,$first['deviceToken'])===$connected);
fails(fn()=>$cs->handle('accept-code',$code,$second['deviceToken']),'invalid_invitation');
$late=new LogNetwork($codePath,1000000+86401);
fails(fn()=>$late->handle('accept-code',$code,$first['deviceToken']),'invitation_expired');
check(!isset(json_decode(file_get_contents($codePath),true)['invitationCodes'][$code['id']]));
$bound=$cs->handle('invite',['recipientId'=>$second['personId']],$codeOwner['deviceToken'])['invitation'];
$boundCode=$cs->handle('invite-code',['token'=>$bound['token']],$codeOwner['deviceToken']);
fails(fn()=>$cs->handle('accept-code',$boundCode,$first['deviceToken']),'invalid_invitation');
check($cs->handle('accept-code',$boundCode,$second['deviceToken'])['contact']['personId']===$codeOwner['personId']);
fails(fn()=>$cs->handle('invite-code',['token'=>$bound['token']],$codeOwner['deviceToken']),'invalid_invitation');
echo json_encode(['checks'=>$checks,'ok'=>true]);
