<?php
declare(strict_types=1);define('SHARON_CHAINS_LIBRARY_ONLY',true);require 'server/chains.php';
$checks=0;function check(bool $v):void{global $checks;$checks++;if(!$v)throw new RuntimeException('Check '.$checks.' failed');}
function fails(callable $f):void{try{$f();}catch(InvalidArgumentException $e){check(true);return;}throw new RuntimeException('Expected invalid request');}
$id='branch000001';$detail=[$id=>['id'=>$id,'chainId'=>'Q99999','sourceRef'=>'node/1','name'=>'Keten','address'=>'Straat 1','openingHours'=>'','website'=>'']];$raw=json_encode($detail);$hash=hash('sha256',$raw);
$data=['schema'=>1,'coverage'=>'NL','version'=>'v1-'.str_repeat('a',24),'chains'=>[['id'=>'Q99999','name'=>'Nieuwe keten']],'points'=>[[$id,'Q99999',5000000,52000000,'Keten','node/1']],'detailFiles'=>['b'=>$hash]];
chain_validate_browse($data);
check(count(chain_browse_query($data,['schema'=>1,'action'=>'catalog'])['chains'])===1);
$map=chain_browse_query($data,['schema'=>1,'action'=>'map','bounds'=>[4.9,51.9,5.1,52.1]]);check(count($map['points'])===1);check(!str_contains(json_encode($map),'Straat 1'));
check(count(chain_browse_query($data,['schema'=>1,'action'=>'map','bounds'=>[4.9,51.9,5.1,52.1],'chainId'=>'Q1'])['points'])===0);
fails(fn()=>chain_browse_query($data,['schema'=>1,'action'=>'map','bounds'=>[0,0,20,50]]));
fails(fn()=>chain_browse_query($data,['schema'=>1,'action'=>'catalog','gps'=>[52,5]]));
$dir=sys_get_temp_dir().'/chain-browse-'.bin2hex(random_bytes(6));mkdir($dir,0700);
register_shutdown_function(function()use($dir){foreach(glob($dir.'/*') as $p)unlink($p);rmdir($dir);});
$calls=0;$download=function($name)use(&$calls,$raw){$calls++;return $raw;};
check(chain_browse_detail($data,$id,$dir,$download)['detail']['address']==='Straat 1');chain_browse_detail($data,$id,$dir,$download);check($calls===1);
fails(fn()=>chain_browse_detail($data,'unknown00001',$dir,$download));
echo json_encode(['checks'=>$checks]);
