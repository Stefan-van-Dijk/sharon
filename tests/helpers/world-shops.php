<?php
// Offline fixtures: no public Overpass requests during CI.
define('SHARON_CHAINS_LIBRARY_ONLY',true);require __DIR__.'/../../server/chains.php';
$checks=0;function check($condition){global $checks;if(!$condition)throw new RuntimeException('World shop check failed: '.$checks);$checks++;}
$input=['schema'=>1,'world'=>true,'action'=>'map','bounds'=>[139.6,35.6,139.8,35.8],'chainId'=>''];
$query=world_shop_query($input);check(str_contains($query,'35.600000,139.600000,35.800000,139.800000'));check(str_contains($query,'out body center 2001'));check(!str_contains($query,'area('));
foreach([['bounds'=>[-180,-90,180,90]],['bounds'=>['bad',0,1,1]],['chainId'=>'Q1"];out;'],['personId'=>'secret']] as $patch){try{world_shop_query([...$input,...$patch]);throw new LogicException('accepted invalid');}catch(InvalidArgumentException $e){$checks++;}}
$elements=[['type'=>'node','id'=>123,'lat'=>35.7,'lon'=>139.7,'tags'=>['shop'=>'bakery','name'=>'パン屋','opening_hours'=>'Mo-Fr 09:00-17:00','website'=>'https://example.org']],['type'=>'way','id'=>234,'center'=>['lat'=>35.71,'lon'=>139.71],'tags'=>['amenity'=>'cafe','name'=>'Coffee','brand:wikidata'=>'Q1234']],['type'=>'node','id'=>345,'lat'=>35.7,'lon'=>139.7,'tags'=>['office'=>'company']]];
$result=world_shop_result(['elements'=>$elements],$input);check(count($result['points'])===2);check($result['coverage']==='WORLD');check($result['points'][0][1]==='');check($result['points'][0][4]==='パン屋');check(!str_contains(json_encode($result),'09:00'));
$id=$result['points'][0][0];check(strlen($id)===12);check($result['kinds'][$id]==='bakery');
$detailInput=['schema'=>1,'world'=>true,'action'=>'detail','id'=>$id,'sourceRef'=>'node/123'];check(str_contains(world_shop_query($detailInput),'node(123)'));
$detail=world_shop_result(['elements'=>[$elements[0]]],$detailInput);check($detail['detail']['openingHours']==='Mo-Fr 09:00-17:00');
try{world_shop_query([...$detailInput,'id'=>'wrong0000000']);throw new LogicException('accepted invalid');}catch(InvalidArgumentException $e){$checks++;}
$directory=sys_get_temp_dir().'/sharon-world-'.bin2hex(random_bytes(5));$calls=0;
try{$download=function($query)use(&$calls,$elements){$calls++;return json_encode(['elements'=>$elements]);};world_shop_fetch($input,$directory,$download);world_shop_fetch($input,$directory,$download);check($calls===1);}finally{foreach(glob($directory.'/*')?:[] as $path)unlink($path);@rmdir($directory);}
echo json_encode(['checks'=>$checks]);
