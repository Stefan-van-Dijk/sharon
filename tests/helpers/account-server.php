<?php
declare(strict_types=1);

define('LOG_CONNECTION_LIBRARY_ONLY',true);
require 'server/connections.php';

$directory=sys_get_temp_dir().'/sharon-account-'.bin2hex(random_bytes(8));
$path=$directory.'/network-v1.json';
register_shutdown_function(function () use ($directory) {
    foreach (glob($directory.'/*') ?: [] as $file) unlink($file);
    if (is_dir($directory)) rmdir($directory);
});

$checks=0;
function check(bool $ok): void {
    global $checks;
    $checks++;
    if (!$ok) throw new RuntimeException('Check '.$checks.' failed.');
}
function fails(callable $run,string $reason): void {
    try { $run(); }
    catch (LogNetworkError $error) { check($error->reason===$reason); return; }
    throw new RuntimeException('Expected '.$reason);
}
function addPerson(LogNetwork $network,string $name,?array $issuer=null): array {
    $person=['personId'=>LogNetwork::id(),'deviceToken'=>LogNetwork::token(),'name'=>$name];
    $network->handle('register',$person,null);
    if ($issuer) {
        $invite=$network->handle('invite',['recipientId'=>$person['personId']],$issuer['deviceToken'])['invitation'];
        $network->handle('accept',$invite,$person['deviceToken']);
    }
    return $person;
}

$oldNetwork=new LogNetwork($path,100000);
$bootstrap=$oldNetwork->start();
$owner=addPerson($oldNetwork,'Eigenaar');
$ownerToken=$owner['deviceToken'];
$oldNetwork->handle('bootstrap',$bootstrap,$ownerToken);
$bob=addPerson($oldNetwork,'Bob',$owner);
$eve=addPerson($oldNetwork,'Eve',$owner);
$uninvited=addPerson($oldNetwork,'Kandidaat');
$before=json_decode(file_get_contents($path),true);

fails(fn()=>$oldNetwork->handle('account-email-start',['email'=>'test@example.com'],$ownerToken),'email_not_configured');

$sent=[];
$mailer=function (string $email,string $code) use (&$sent): bool {
    $sent[]=[$email,$code];
    return true;
};
$network=new LogNetwork($path,100000,$mailer);
$ownerAccount=fn()=>$network->handle('account-self',[],$ownerToken)['account'];
check($ownerAccount()===['personId'=>$owner['personId'],'emails'=>[],'organizations'=>[]]);
fails(fn()=>$network->handle('account-self',[],$uninvited['deviceToken']),'invitation_required');
fails(fn()=>$network->handle('account-email-start',['email'=>"invalid\naddress@example.com"],$ownerToken),'invalid_email');

$challenge1=$network->handle('account-email-start',['email'=>'Test@Example.com'],$ownerToken);
check(array_keys($challenge1)===['challengeId'] && $sent[0][0]==='test@example.com');
check($ownerAccount()['emails']===[]);
check(!str_contains(file_get_contents($path),$sent[0][1]));
$proof1=[...$challenge1,'code'=>$sent[0][1]];
fails(fn()=>$network->handle('account-email-verify',$proof1,$bob['deviceToken']),'email_proof_invalid');
fails(fn()=>$network->handle('account-email-verify',[...$proof1,'code'=>LogNetwork::token()],$ownerToken),'email_proof_invalid');
$verified1=$network->handle('account-email-verify',$proof1,$ownerToken);
check(array_column($verified1['emails'],'email')===['test@example.com']);
fails(fn()=>$network->handle('account-email-verify',$proof1,$ownerToken),'email_proof_invalid');
$challenge2=$network->handle('account-email-start',['email'=>'other@example.com'],$ownerToken);
$proof2=[...$challenge2,'code'=>$sent[1][1]];
$later=new LogNetwork($path,100901,$mailer);
fails(fn()=>$later->handle('account-email-verify',$proof2,$ownerToken),'email_proof_invalid');
$verified2=$network->handle('account-email-verify',$proof2,$ownerToken);
check(array_column($verified2['emails'],'email')===['test@example.com','other@example.com']);
$alreadyLinked=$network->handle('account-email-start',['email'=>'test@example.com'],$bob['deviceToken']);
fails(fn()=>$network->handle('account-email-verify',[...$alreadyLinked,'code'=>$sent[2][1]],$bob['deviceToken']),'email_unavailable');
check($network->handle('account-self',[],$bob['deviceToken'])['account']['emails']===[]);
fails(fn()=>$network->handle('account-email-remove',['email'=>'other@example.com'],$bob['deviceToken']),'email_unavailable');
$removed=$network->handle('account-email-remove',['email'=>'other@example.com'],$ownerToken);
check(array_column($removed['emails'],'email')===['test@example.com']);
$broken=new LogNetwork($path,100000,static fn()=>false);
fails(fn()=>$broken->handle('account-email-start',['email'=>'lost@example.com'],$ownerToken),'email_delivery_failed');

$first=$network->handle('organization-create',['name'=>'Eerste organisatie'],$ownerToken)['organization'];
$second=$network->handle('organization-create',['name'=>'Tweede organisatie'],$bob['deviceToken'])['organization'];
check($first['role']==='owner' && $first['class']==='organization' && strlen($first['id'])===12);
check(count($ownerAccount()['organizations'])===1);
$setRole=fn($org,$user,$role,$token)=>$network->handle('organization-set-role',
    ['organizationId'=>$org['id'],'personId'=>$user['personId'],'role'=>$role],$token);
fails(fn()=>$setRole($first,$eve,'admin',$bob['deviceToken']),'organization_forbidden');
fails(fn()=>$setRole($first,$uninvited,'member',$ownerToken),'recipient_unknown');
$setRole($first,$bob,'admin',$ownerToken);
$setRole($second,$owner,'viewer',$bob['deviceToken']);
check(count($ownerAccount()['organizations'])===2);
$setRole($first,$eve,'member',$bob['deviceToken']);
fails(fn()=>$setRole($first,$eve,'admin',$bob['deviceToken']),'organization_forbidden');
fails(fn()=>$setRole($first,$owner,null,$bob['deviceToken']),'organization_forbidden');
fails(fn()=>$network->handle('organization-members',['organizationId'=>$second['id']],$ownerToken),'organization_forbidden');
$selected=$network->handle('organization-select',['organizationId'=>$second['id']],$ownerToken)['organization'];
check($selected['role']==='viewer');
fails(fn()=>$network->handle('organization-select',['organizationId'=>$second['id']],$eve['deviceToken']),'organization_forbidden');
$members=$network->handle('organization-members',['organizationId'=>$first['id']],$ownerToken)['members'];
check(count($members)===3 && !isset($members[0]['emails']));
$setRole($first,$eve,null,$bob['deviceToken']);
fails(fn()=>$network->handle('organization-select',['organizationId'=>$first['id']],$eve['deviceToken']),'organization_forbidden');

$compact=$network->handle('shop-pair-create',['format'=>'compact'],$ownerToken);
$shopToken=LogNetwork::token();
$network->handle('shop-pair-redeem',['code'=>$compact['code'],'deviceToken'=>$shopToken],null);
$network->handle('shop-device-ack',[],$shopToken);
fails(fn()=>$network->handle('account-self',[],$shopToken),'shop_scope');
$after=json_decode(file_get_contents($path),true);
foreach (['id','ownerId','people','relations','messages','invitations'] as $key) check($before[$key]===$after[$key]);

echo json_encode(['checks'=>$checks]);
