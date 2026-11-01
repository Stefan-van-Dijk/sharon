<?php
// Offline fixtures: no public Overpass requests during CI.
define('SHARON_CHAINS_LIBRARY_ONLY',true);require __DIR__.'/../../server/chains.php';
$checks=0;function check($condition){global $checks;if(!$condition)throw new RuntimeException('World shop check failed: '.$checks);$checks++;}
$input=['schema'=>1,'world'=>true,'action'=>'map','bounds'=>[139.6,35.6,139.8,35.8],'chainId'=>''];
$query=world_shop_query($input);check(str_contains($query,'maxsize:67108864'));check(str_contains($query,'35.600000,139.600000,35.800000,139.800000'));check(str_contains($query,'out body center 2001'));check(!str_contains($query,'area('));
foreach([['bounds'=>[-180,-90,180,90]],['bounds'=>['bad',0,1,1]],['chainId'=>'Q1"];out;'],['personId'=>'secret']] as $patch){try{world_shop_query([...$input,...$patch]);throw new LogicException('accepted invalid');}catch(InvalidArgumentException $e){$checks++;}}
$elements=[['type'=>'node','id'=>123,'lat'=>35.7,'lon'=>139.7,'tags'=>['shop'=>'bakery','name'=>'パン屋','opening_hours'=>'Mo-Fr 09:00-17:00','website'=>'https://example.org']],['type'=>'way','id'=>234,'center'=>['lat'=>35.71,'lon'=>139.71],'tags'=>['amenity'=>'cafe','name'=>'Coffee','brand:wikidata'=>'Q1234']],['type'=>'node','id'=>345,'lat'=>35.7,'lon'=>139.7,'tags'=>['office'=>'company']]];
$result=world_shop_result(['elements'=>$elements],$input);check(count($result['points'])===2);check($result['coverage']==='WORLD');check($result['points'][0][1]==='');check($result['points'][0][4]==='パン屋');check(!str_contains(json_encode($result),'09:00'));
$id=$result['points'][0][0];check(strlen($id)===12);check($result['kinds'][$id]==='bakery');
$detailInput=['schema'=>1,'world'=>true,'action'=>'detail','id'=>$id,'sourceRef'=>'node/123'];check(str_contains(world_shop_query($detailInput),'node(123)'));
$detail=world_shop_result(['elements'=>[$elements[0]]],$detailInput);check($detail['detail']['openingHours']==='Mo-Fr 09:00-17:00');
try{world_shop_query([...$detailInput,'id'=>'wrong0000000']);throw new LogicException('accepted invalid');}catch(InvalidArgumentException $e){$checks++;}
$directory=sys_get_temp_dir().'/sharon-world-'.bin2hex(random_bytes(5));$calls=0;
try{$download=function($query)use(&$calls,$elements){$calls++;return json_encode(['elements'=>$elements]);};world_shop_fetch($input,$directory,$download);world_shop_fetch($input,$directory,$download);check($calls===1);}finally{foreach(glob($directory.'/*')?:[] as $path)unlink($path);@rmdir($directory);}
// A failed first provider must reach the second; later queries start with the
// successful provider. Exercise a non-Dutch area and preserve its source IDs.
$directory=sys_get_temp_dir().'/sharon-world-retry-'.bin2hex(random_bytes(5));$calls=[];
try{
    $download=function($query,$endpoint)use(&$calls,$elements){$calls[]=$endpoint;if(str_contains($endpoint,'private.coffee'))throw new RuntimeException('Transport blocked');return json_encode(['elements'=>$elements]);};
    $result=world_shop_fetch($input,$directory,$download);check(count($result['points'])===2);check(count($calls)===2);check($result['coverage']==='WORLD');
    $result=world_shop_fetch($detailInput,$directory,$download);check(count($calls)===3);check(str_contains($calls[2],'overpass-api.de'));check($result['detail']['sourceRef']==='node/123');
}finally{foreach(glob($directory.'/*')?:[] as $path)unlink($path);@rmdir($directory);}
$directory=sys_get_temp_dir().'/sharon-world-fail-'.bin2hex(random_bytes(5));$calls=0;
try{
    try{world_shop_fetch($input,$directory,function()use(&$calls){$calls++;return '{broken';});throw new LogicException('accepted corrupt source');}
    catch(RuntimeException $e){check($e->getMessage()==='Source unavailable');check($calls===2);check($e instanceof WorldShopSourceFailure);check(count($e->diagnostics)===2);check($e->diagnostics[0]['reason']==='invalid_response');}
    check(count(glob($directory.'/*.json'))===1); // budget only, no empty successful result cached
}finally{foreach(glob($directory.'/*')?:[] as $path)unlink($path);@rmdir($directory);}
foreach(['Query run out of memory'=>'source_memory','Query timed out'=>'timeout'] as $remark=>$expected){try{world_shop_result(['elements'=>[],'remark'=>$remark],$input);throw new LogicException('accepted partial response');}catch(RuntimeException $e){check($e->getMessage()===$expected);}}
echo json_encode(['checks'=>$checks]);
