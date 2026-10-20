<?php
declare(strict_types=1);
require 'server/connection/Connection.php';
$checks=0;
function check(bool $result): void { global $checks; $checks++; if(!$result)throw new RuntimeException('Check '.$checks.' failed'); }
function fails(callable $fn, string $reason): void {
    try { $fn(); } catch(ConnectionError $e) { check($e->reason===$reason); return; }
    throw new RuntimeException('Expected '.$reason);
}
function fixture(): array {
    $db=new PDO('sqlite::memory:');$s=new Connection($db,1000000);$start=$s->install();
    $owner=['personId'=>Connection::id(),'deviceToken'=>Connection::token(),'name'=>'Eigenaar'];
    $s->handle('register',$owner,null);
    $s->handle('bootstrap',$start,$owner['deviceToken']);
    return [$db,$s,$start,$owner];
}
function person(Connection $s, string $name='Persoon'): array {
    $p=['personId'=>Connection::id(),'deviceToken'=>Connection::token(),'name'=>$name];
    $s->handle('register',$p,null);return $p;
}
function joinPerson(Connection $s, array $issuer, array $recipient): array {
    $invite=$s->handle('invite',['recipientId'=>$recipient['personId']],$issuer['deviceToken'])['invitation'];
    return $s->handle('accept',$invite,$recipient['deviceToken'])['self'];
}
[$db,$s,$start,$owner]=fixture();
check($s->ready());
check($s->handle('bootstrap',$start,$owner['deviceToken'])['self']['line']===0);
$bob=person($s,'Bob');$eve=person($s,'<img src=x onerror=alert(1)>');
fails(fn()=>$s->handle('bootstrap',$start,$bob['deviceToken']),'invitation_used');
fails(fn()=>$s->handle('register',[...$owner,'deviceToken'=>Connection::token()],null),'identity_exists');
fails(fn()=>$s->handle('self',[],Connection::token()),'unauthorized');
fails(fn()=>$s->handle('contacts',[],$bob['deviceToken']),'invitation_required');
fails(fn()=>$s->handle('invite',['recipientId'=>Connection::id()],$owner['deviceToken']),'recipient_unknown');
$invite=$s->handle('invite',['recipientId'=>$bob['personId']],$owner['deviceToken'])['invitation'];
fails(fn()=>$s->handle('accept',$invite,$eve['deviceToken']),'invalid_invitation');
fails(fn()=>$s->handle('accept',[...$invite,'networkId'=>Connection::id()],$bob['deviceToken']),'wrong_network');
fails(fn()=>$s->handle('accept',[...$invite,'token'=>Connection::token()],$bob['deviceToken']),'invalid_invitation');
check($s->handle('accept',$invite,$bob['deviceToken'])['self']['line']===1);
check($s->handle('accept',$invite,$bob['deviceToken'])['self']['line']===1);
$contacts=$s->handle('contacts',[],$owner['deviceToken'])['contacts'];
check(count($contacts)===1&&$contacts[0]['personId']===$bob['personId']);
$chat=$contacts[0]['chatId'];
joinPerson($s,$owner,$eve);
fails(fn()=>$s->handle('messages',['chatId'=>$chat],$eve['deviceToken']),'chat_forbidden');
fails(fn()=>$s->handle('send',['chatId'=>$chat,'id'=>Connection::id(),'text'=>'spion'],$eve['deviceToken']),'chat_forbidden');
$id=Connection::id();
$sent=$s->handle('send',['chatId'=>$chat,'id'=>$id,'text'=>'Hallo <script>test</script>'],$owner['deviceToken'])['message'];
check($sent['senderId']===$owner['personId']&&$sent['id']===$id);
check($s->handle('send',['chatId'=>$chat,'id'=>$id,'text'=>$sent['text']],$owner['deviceToken'])['message']===$sent);
fails(fn()=>$s->handle('send',['chatId'=>$chat,'id'=>$id,'text'=>'anders'],$owner['deviceToken']),'message_conflict');
fails(fn()=>$s->handle('send',['chatId'=>$chat,'id'=>$id,'text'=>$sent['text']],$bob['deviceToken']),'message_conflict');
check(count($s->handle('messages',['chatId'=>$chat],$bob['deviceToken'])['messages'])===1);
check($s->handle('messages',['chatId'=>$chat,'after'=>$sent['seq']],$bob['deviceToken'])['messages']===[]);
fails(fn()=>$s->handle('messages',['chatId'=>$chat,'after'=>-1],$bob['deviceToken']),'invalid_cursor');
fails(fn()=>$s->handle('send',['chatId'=>$chat,'id'=>Connection::id(),'text'=>str_repeat('x',8001)],$bob['deviceToken']),'invalid_message');
$second=person($s);$third=person($s);$fourth=person($s);
check(joinPerson($s,$bob,$second)['line']===2);
check(joinPerson($s,$second,$third)['line']===3);
fails(fn()=>$s->handle('invite',['recipientId'=>$fourth['personId']],$third['deviceToken']),'depth_limit');
check(joinPerson($s,$owner,$third)['line']===3); // Connects, never reparents.
$db->exec('UPDATE people SET status="revoked" WHERE id='.$db->quote($bob['personId']));
fails(fn()=>$s->handle('messages',['chatId'=>$chat],$bob['deviceToken']),'unauthorized');
fails(fn()=>$s->handle('send',['chatId'=>$chat,'id'=>Connection::id(),'text'=>'hoi'],$owner['deviceToken']),'chat_forbidden');
check($s->handle('self',[],$second['deviceToken'])['self']['line']===2); // No cascade.
fails(fn()=>$s->install(),'already_activated');
$waiting=person($s);$expired=$s->handle('invite',['recipientId'=>$waiting['personId']],$owner['deviceToken'])['invitation'];
$future=new Connection($db,1086401);
fails(fn()=>$future->handle('accept',$expired,$waiting['deviceToken']),'invitation_expired');
check($s->handle('self',[],$waiting['deviceToken'])['self']['line']===null);
$otherDb=new PDO('sqlite::memory:');$fresh=new Connection($otherDb,1000000);$first=$fresh->install();
$new=person($fresh);$futureFresh=new Connection($otherDb,1000900);
fails(fn()=>$futureFresh->handle('bootstrap',$first,$new['deviceToken']),'invitation_expired');
$rotated=$fresh->install();
fails(fn()=>$fresh->handle('bootstrap',$first,$new['deviceToken']),'invalid_invitation');
check($fresh->handle('bootstrap',$rotated,$new['deviceToken'])['self']['line']===0);
for($i=0;$i<100;$i++) {
    $p=person($fresh);
    check(joinPerson($fresh,$new,$p)['line']===1);
}
$overflow=person($fresh);
fails(fn()=>$fresh->handle('invite',['recipientId'=>$overflow['personId']],$new['deviceToken']),'capacity');
$otherDb->exec('UPDATE people SET status="revoked" WHERE id=(SELECT id FROM people WHERE line=1 LIMIT 1)');
fails(fn()=>$fresh->handle('invite',['recipientId'=>$overflow['personId']],$new['deviceToken']),'capacity');
$s->rate('test',2,60);$s->rate('test',2,60);
fails(fn()=>$s->rate('test',2,60),'rate_limit');
echo json_encode(['checks'=>$checks,'ok'=>true]);
