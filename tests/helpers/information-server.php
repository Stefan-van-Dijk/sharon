<?php
declare(strict_types=1);
define('LOG_CONNECTION_LIBRARY_ONLY',true);
require 'server/connections.php';
$dir=sys_get_temp_dir().'/information-'.bin2hex(random_bytes(6));mkdir($dir,0700);
register_shutdown_function(function()use($dir){foreach(glob($dir.'/*') as $file)unlink($file);rmdir($dir);});
$path=$dir.'/network.json';$s=new LogNetwork($path);$checks=0;
function check(bool $ok): void { global $checks; $checks++; if(!$ok)throw new RuntimeException('Check '.$checks.' failed'); }
function fails(callable $fn,string $expected):void{
    try{$fn();}catch(LogNetworkError $e){check($e->reason===$expected);return;}
    throw new RuntimeException('Expected '.$expected);
}
function person(LogNetwork $s):array{
    $p=['personId'=>LogNetwork::id(),'deviceToken'=>LogNetwork::token(),'name'=>'Tester'];
    $s->handle('register',$p,null);return $p;
}
function operation():string{return '00000000-0000-4000-8000-'.bin2hex(random_bytes(6));}
function state(bool $liked=false,bool $read=false):array{return ['opened'=>true,'read'=>$read,'liked'=>$liked,'disliked'=>false];}
$bootstrap=$s->start();$owner=person($s);$s->handle('bootstrap',$bootstrap,$owner['deviceToken']);
$bob=person($s);$waiting=person($s);
$invite=$s->handle('invite',[],$owner['deviceToken'])['invitation'];$s->handle('accept',$invite,$bob['deviceToken']);
$item=['source'=>'wikipedia','id'=>'Q42','uri'=>'https://www.wikidata.org/entity/Q42'];
$summary=fn($who,$ref=null)=>$s->handle('information-summary',['items'=>[$ref ?? $item]],$who['deviceToken'])['items'][0];
check($summary($owner)['counts']['liked']===0);
fails(fn()=>$s->handle('information-summary',['items'=>[$item]],null),'invalid_token');
fails(fn()=>$summary($waiting),'invitation_required');
$first=['item'=>$item,'operation'=>operation(),'version'=>0,'state'=>state(true,true)];
$result=$s->handle('information-feedback',$first,$owner['deviceToken']);
check($result['accepted']&&$result['version']===1);
check($summary($owner)['counts']===['opened'=>1,'read'=>1,'liked'=>1,'disliked'=>0]);
check($s->handle('information-feedback',$first,$owner['deviceToken'])['version']===1);
check($summary($owner)['counts']['liked']===1);
fails(fn()=>$s->handle('information-feedback',[...$first,'state'=>state(false)],$owner['deviceToken']),'information_operation_conflict');
$unlike=[...$first,'operation'=>operation(),'version'=>1,'state'=>state(false)];
check($s->handle('information-feedback',$unlike,$owner['deviceToken'])['accepted']);
check($summary($owner)['counts']===['opened'=>1,'read'=>0,'liked'=>0,'disliked'=>0]);
// Replayed old request cannot restore the old like or advance the revision.
check(!$s->handle('information-feedback',$first,$owner['deviceToken'])['accepted']);
check($summary($owner)['version']===2&&$summary($owner)['counts']['liked']===0);
check($s->handle('information-feedback',$first,$bob['deviceToken'])['accepted']);
check($summary($owner)['counts']['liked']===1&&$summary($owner)['counts']['opened']===2);
check($summary($owner)['own']['liked']===false&&$summary($bob)['own']['liked']===true);
check(!array_key_exists('feedback',$summary($owner))&&!array_key_exists('personId',$summary($owner)));
$policy=['baseRadius'=>500,'maxRadius'=>2000,'weight'=>0.7];
fails(fn()=>$s->handle('information-policy',['item'=>$item,'policy'=>$policy],$bob['deviceToken']),'owner_required');
$s->handle('information-policy',['item'=>$item,'policy'=>$policy,'context'=>['title'=>'Voorbeeld','categories'=>['Erfgoed'],'location'=>['lat'=>52,'lng'=>5]]],$owner['deviceToken']);
check($summary($bob)['policy']===$policy);
fails(fn()=>$s->handle('information-policy',['item'=>$item,'policy'=>[...$policy,'baseRadius'=>3000]],$owner['deviceToken']),'invalid_information_policy');
check($summary($owner)['policy']===$policy);
$web=['source'=>'web','id'=>'Q42','uri'=>'https://example.com/article'];
$s->handle('information-feedback',[...$first,'item'=>$web],$bob['deviceToken']);
check($summary($owner,$web)['counts']['liked']===1&&$summary($owner)['counts']['liked']===1);
check($summary($owner,$web)['context']===null);
fails(fn()=>$s->handle('information-feedback',[...$first,'item'=>[...$web,'uri'=>'javascript:alert(1)']],$owner['deviceToken']),'invalid_information');
fails(fn()=>$s->handle('information-feedback',[...$first,'item'=>[...$web,'uri'=>'https://example.com/other']],$owner['deviceToken']),'information_uri_conflict');
fails(fn()=>$s->handle('information-feedback',[...$unlike,'state'=>['opened'=>true,'read'=>false,'liked'=>true,'disliked'=>true]],$owner['deviceToken']),'invalid_information');
$s->handle('set-access',['personId'=>$bob['personId'],'status'=>'revoked'],$owner['deviceToken']);
check($summary($owner)['counts']['liked']===0);
fails(fn()=>$summary($bob),'unauthorized');
$s=new LogNetwork($path);
check($summary($owner)['counts']['liked']===0&&$summary($owner)['policy']===$policy);
echo json_encode(['ok'=>true,'checks'=>$checks]);
