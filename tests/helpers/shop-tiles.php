<?php
define('SHARON_CHAINS_LIBRARY_ONLY',true);require __DIR__.'/../../server/chains.php';
$dir=$argv[1];$m=shop_manifest($dir);$map=shop_tile_query($m,['schema'=>1,'action'=>'map','bounds'=>[4.99,51.99,5.01,52.01]],$dir);
$id=$map['points'][0][0];$detail=shop_tile_query($m,['schema'=>1,'action'=>'detail','id'=>$id],$dir)['detail'];
$identity=fn($ref)=>shop_identity($ref,$dir,$m);
$el=['type'=>'node','id'=>1,'lat'=>52,'lon'=>5,'tags'=>['shop'=>'bakery','name'=>'Bäckerei']];
$world=world_shop_result(['elements'=>[$el]],['action'=>'map'],$identity);
$legacyId=substr(hash('sha256','osm:node/1'),0,12);
$legacy=world_shop_result(['elements'=>[$el]],['action'=>'detail','id'=>$legacyId,'sourceRef'=>'node/1'],$identity);
world_shop_query(['schema'=>1,'world'=>true,'action'=>'detail','id'=>$id,'sourceRef'=>'node/1'],$identity);
$rejected=false;try{world_shop_query(['schema'=>1,'world'=>true,'action'=>'detail','id'=>$id,'sourceRef'=>'node/2'],$identity);}catch(InvalidArgumentException $e){$rejected=true;}
$name=reset($m['tiles']);file_put_contents($dir.'/'.$name,'[]');$tamperRejected=false;
try{shop_tile_read($dir,$name);}catch(RuntimeException $e){$tamperRejected=true;}
$ledger=new ShopIdentityLedger($dir.'/ledger');$entry=$ledger->get('node/99',true);$ledger->commit();$again=(new ShopIdentityLedger($dir.'/ledger'))->get('node/99');if($again!==$entry||$entry['id']===substr(hash('sha256','osm:node/99'),0,12))throw new RuntimeException('Unstable identity');
echo json_encode([...$map,'detail'=>$detail,'world'=>$world,'legacy'=>$legacy,'rejected'=>$rejected,'tamperRejected'=>$tamperRejected]);
