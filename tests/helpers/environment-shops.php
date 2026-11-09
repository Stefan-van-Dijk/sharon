<?php
define('SHARON_ENV_LIBRARY_ONLY',true);require __DIR__.'/../../server/environment.php';
function check($value){if(!$value)throw new RuntimeException('Check failed');}
$directory=sys_get_temp_dir().'/env-shops-'.bin2hex(random_bytes(6));mkdir($directory);
$b=[4.4,51.22,4.42,51.24];$now=strtotime('2026-01-01 UTC');
try{
 check(environment_shop_snapshot($directory,$b,$now)===null);
 $data=['points'=>[['shop00000001','',4405000,51225000,'Bakker','node/1']],'kinds'=>['shop00000001'=>'bakery'],'truncated'=>false];
 environment_shop_save($directory,$b,$data,$now);
 $id=environment_shop_id(4.405,51.225);check(strlen($id)===4);check(is_file($directory.'/'.$id.'.json'));
 $s=environment_shop_snapshot($directory,$b,$now+10);check(!$s['stale']);check(count($s['points'])===1);
 check(environment_shop_snapshot($directory,$b,strtotime('2026-03-02 UTC'))['stale']);
 $before=file_get_contents($directory.'/'.$id.'.json');
 $data['truncated']=true;environment_shop_save($directory,$b,$data,$now+100);
 $row=json_decode(file_get_contents($directory.'/'.$id.'.json'),true);check($row['lastCheckedAt']===$now);
 $data=['points'=>[],'kinds'=>[],'truncated'=>false];environment_shop_save($directory,$b,$data,$now+200);
 check(count(environment_shop_snapshot($directory,$b,$now+201)['points'])===1);
 $empty=[5,52,5.01,52.01];environment_shop_save($directory,$empty,$data,$now);
 check(environment_shop_snapshot($directory,$empty,$now)['points']===[]);check(!environment_shop_snapshot($directory,$empty,$now)['stale']);
 $larger=[4.39,51.21,4.43,51.25];check(environment_shop_snapshot($directory,$larger,$now)['stale']);
 foreach([[-181,0,0,1],[0,0,180,90],['bad',1,2,3]] as $bad){try{environment_shop_parts($bad);throw new LogicException('Accepted invalid');}catch(InvalidArgumentException $e){}}
 echo 'Shop area storage checks passed';
}finally{foreach(glob($directory.'/*') as $p)unlink($p);rmdir($directory);}
