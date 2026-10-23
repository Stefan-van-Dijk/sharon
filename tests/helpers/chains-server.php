<?php
declare(strict_types=1);
define('SHARON_CHAINS_LIBRARY_ONLY',true);require 'server/chains.php';
$checks=0;
function check(bool $ok):void{global $checks;$checks++;if(!$ok)throw new RuntimeException('Check '.$checks.' failed');}
function fails(callable $fn):void{try{$fn();}catch(InvalidArgumentException $e){check(true);return;}throw new RuntimeException('Expected invalid request');}
$old='v1-'.str_repeat('a',24);$new='v1-'.str_repeat('b',24);
$row=['branch000001','node/1','AAAAAA',52000000,5000000,'Winkel','Adres','active',1,'2026-10-23T00:00:00Z',''];
$changed=$row;$changed[5]='Gewijzigd';
$register=['schema'=>1,'coverage'=>'NL','chains'=>['Q1653985'=>['version'=>$new,'rows'=>[$changed],'history'=>[['version'=>$old,'rows'=>[$row]]]],'Q2262314'=>['version'=>$old,'rows'=>[$row],'history'=>[]]]];
$input=['schema'=>1,'chains'=>[['id'=>'Q1653985','version'=>'']]];
$full=chain_bundle($register,$input);check($full['chains'][0]['mode']==='full');check($full['chains'][0]['rows'][0]===$changed);check(count($full['chains'])===1);
$input['chains'][0]['version']=$new;$same=chain_bundle($register,$input);check($same['chains'][0]['mode']==='unchanged');check(!isset($same['chains'][0]['rows']));
$input['chains'][0]['version']=$old;$delta=chain_bundle($register,$input);check($delta['chains'][0]['mode']==='delta');check(count($delta['chains'][0]['rows'])===1);check($delta['chains'][0]['from']===$old);
$input['chains'][]=['id'=>'Q2262314','version'=>$old];check(count(chain_bundle($register,$input)['chains'])===2);
fails(fn()=>chain_bundle($register,[...$input,'gps'=>[52,5]]));
fails(fn()=>chain_bundle($register,['schema'=>1,'chains'=>[['id'=>'Q1653985','version'=>'bad']]]));
fails(fn()=>chain_bundle($register,['schema'=>1,'chains'=>[['id'=>'Q9999','version'=>'']]]));
fails(fn()=>chain_bundle($register,['schema'=>1,'chains'=>array_fill(0,21,['id'=>'Q1653985'])]));
fails(fn()=>chain_bundle($register,['schema'=>1,'chains'=>[['id'=>'Q1653985'],['id'=>'Q1653985']]]));
$directory=sys_get_temp_dir().'/chain-register-'.bin2hex(random_bytes(6));mkdir($directory,0700);
register_shutdown_function(function()use($directory){foreach(scandir($directory) as $name)if($name!=='.'&&$name!=='..')unlink($directory.'/'.$name);rmdir($directory);});
$path=$directory.'/register.json';$calls=0;$clock=2000000000;
$download=function()use(&$calls,$register){$calls++;return json_encode($register);};
$loaded=chain_register($path,$download,$clock);check($loaded===$register);check($calls===1);
chain_register($path,$download,$clock+86400);check($calls===1);
$failing=function()use(&$calls){$calls++;throw new RuntimeException('Offline');};
check(chain_register($path,$failing,$clock+31*86400)===$register);check($calls===2);
chain_register($path,$failing,$clock+31*86400+10);check($calls===2);
$before=file_get_contents($path);
$invalid=function()use(&$calls){$calls++;return json_encode(['schema'=>1,'coverage'=>'NL','chains'=>['Q1'=>['version'=>'invalid','rows'=>[],'history'=>[]]]]);};
check(chain_register($path,$invalid,$clock+31*86400+4000)===$register);check(file_get_contents($path)===$before);
echo json_encode(['ok'=>true,'checks'=>$checks]);
