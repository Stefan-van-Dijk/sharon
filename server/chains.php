<?php
declare(strict_types=1);
// Read-only public OSM bundles. Never query OSM or collect user positions here.
function chain_bundle(array $register,array $input):array {
    if(($register['schema']??null)!==1||($register['coverage']??'')!=='NL'||!is_array($register['chains']??null))throw new RuntimeException('Register unavailable');
    $requested=$input['chains']??null;
    if(($input['schema']??null)!==1||!is_array($requested)||!array_is_list($requested)||count($requested)>20||!count($requested))throw new InvalidArgumentException('invalid_request');
    if(array_diff(array_keys($input),['schema','chains']))throw new InvalidArgumentException('unexpected_fields');
    $result=[];$seen=[];
    foreach($requested as $query){
        if(!is_array($query)||array_diff(array_keys($query),['id','version']))throw new InvalidArgumentException('invalid_chain');
        $id=$query['id']??null;$version=$query['version']??'';
        if(!is_string($id)||!preg_match('/\AQ[1-9][0-9]*\z/',$id)||isset($seen[$id])||!is_string($version)||($version!==''&&!preg_match('/\Av1-[a-f0-9]{24}\z/',$version)))throw new InvalidArgumentException('invalid_chain');
        $seen[$id]=true;$chain=$register['chains'][$id]??null;
        if(!$chain)throw new InvalidArgumentException('chain_unavailable');
        $base=['id'=>$id,'version'=>$chain['version'],'from'=>$version];
        if($version===$chain['version']){$result[]=[...$base,'mode'=>'unchanged'];continue;}
        $previous=null;foreach($chain['history']??[] as $old)if($old['version']===$version)$previous=$old;
        if(!$previous){$result[]=[...$base,'mode'=>'full','rows'=>$chain['rows'],'removed'=>[]];continue;}
        $before=[];foreach($previous['rows'] as $row)$before[$row[0]]=$row;
        $now=[];$changed=[];foreach($chain['rows'] as $row){$now[$row[0]]=true;if(($before[$row[0]]??null)!==$row)$changed[]=$row;}
        $result[]=[...$base,'mode'=>'delta','rows'=>$changed,'removed'=>array_values(array_diff(array_keys($before),array_keys($now)))];
    }
    return ['schema'=>1,'coverage'=>'NL','attribution'=>'© OpenStreetMap contributors','license'=>'https://opendatacommons.org/licenses/odbl/1-0/','chains'=>$result];
}
function chain_validate_register(array $register):void {
    if(($register['schema']??null)!==1||($register['coverage']??'')!=='NL'||!is_array($register['chains']??null)||!count($register['chains'])||count($register['chains'])>20)throw new RuntimeException('Invalid register');
    foreach($register['chains'] as $id=>$chain){
        if(!preg_match('/\AQ[1-9][0-9]*\z/',(string)$id)||!is_array($chain)||!preg_match('/\Av1-[a-f0-9]{24}\z/',$chain['version']??'')||!is_array($chain['rows']??null)||!array_is_list($chain['rows'])||count($chain['rows'])>50000||!is_array($chain['history']??null)||count($chain['history'])>3)throw new RuntimeException('Invalid chain');
        foreach([$chain,...$chain['history']] as $snapshot){
            if(!is_array($snapshot)||!preg_match('/\Av1-[a-f0-9]{24}\z/',$snapshot['version']??'')||!is_array($snapshot['rows']??null)||!array_is_list($snapshot['rows'])||count($snapshot['rows'])>50000)throw new RuntimeException('Invalid snapshot');
            $seen=[];
            foreach($snapshot['rows'] as $row){
                if(!is_array($row)||!array_is_list($row)||count($row)!==11||!is_string($row[0])||!preg_match('/\A[A-Za-z0-9_-]{12}\z/',$row[0])||isset($seen[$row[0]])||!is_string($row[1])||!preg_match('/\A(node|way|relation)\/[1-9][0-9]*\z/',$row[1])||!is_string($row[2])||!preg_match('/\A[A-Za-z0-9_-]{6}\z/',$row[2])||!in_array($row[7],['active','possibly-closed'],true)||!is_int($row[8])||$row[8]<1)throw new RuntimeException('Invalid branch');
                if(($row[3]!==null||$row[4]!==null)&&(!is_int($row[3])||!is_int($row[4])||abs($row[3])>90000000||abs($row[4])>180000000))throw new RuntimeException('Invalid coordinates');
                foreach([5,6,9,10] as $field)if(!is_string($row[$field])||strlen($row[$field])>2000)throw new RuntimeException('Invalid branch text');
                $seen[$row[0]]=true;
            }
        }
    }
}
function chain_register(string $path, ?callable $download=null, ?int $clock=null):array {
    $now=$clock??time();$directory=dirname($path);clearstatcache(true,$path);clearstatcache(true,$path.'.checked');
    if(!is_dir($directory)&&!mkdir($directory,0700,true)&&!is_dir($directory))throw new RuntimeException('Storage unavailable');
    if(is_link($path)||is_link($path.'.lock')||is_link($path.'.checked'))throw new RuntimeException('Invalid storage');
    if(!is_file($directory.'/.htaccess')&&file_put_contents($directory.'/.htaccess',"Require all denied\n",LOCK_EX)===false)throw new RuntimeException('Private storage unavailable');
    $lock=fopen($path.'.lock','c');if(!$lock)throw new RuntimeException('Lock unavailable');
    try{
        if(!flock($lock,LOCK_EX))throw new RuntimeException('Lock unavailable');
        $cached=is_file($path)?json_decode(file_get_contents($path),true,128,JSON_THROW_ON_ERROR):null;
        $due=!is_file($path)||$now-(filemtime($path)?:0)>=30*86400;
        $retry=!is_file($path.'.checked')||$now-(filemtime($path.'.checked')?:0)>=3600;
        if($due&&$retry){
            touch($path.'.checked',$now);
            try{
                $raw=$download?$download():file_get_contents('https://raw.githubusercontent.com/Stefan-van-Dijk/sharon/data/osm-chains-nl/register-v1.json',false,
                    stream_context_create(['http'=>['timeout'=>12,'follow_location'=>0,'header'=>"User-Agent: Sharon-chain-register/1.0\r\n"]]),0,8000001);
                if(!is_string($raw)||strlen($raw)>8000000)throw new RuntimeException('Register download failed');
                $fresh=json_decode($raw,true,128,JSON_THROW_ON_ERROR);
                if(!is_array($fresh))throw new RuntimeException('Invalid register');
                chain_validate_register($fresh);
                $temporary=$path.'.'.bin2hex(random_bytes(6)).'.tmp';
                if(file_put_contents($temporary,$raw,LOCK_EX)===false)throw new RuntimeException('Commit failed');
                @chmod($temporary,0600);
                if(!rename($temporary,$path)){@unlink($temporary);throw new RuntimeException('Commit failed');}
                touch($path,$now);$cached=$fresh;
            }catch(Throwable $e){if(!$cached)throw $e;}
        }
        if(!$cached)throw new RuntimeException('Register unavailable');
        return $cached;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
if(defined('SHARON_CHAINS_LIBRARY_ONLY'))return;
function chain_out(int $status,array $data):never{http_response_code($status);header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');echo json_encode($data,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);exit;}
ini_set('display_errors','0');
$origin=$_SERVER['HTTP_ORIGIN']??'';
if($origin!==''&&!in_array($origin,['https://stefan-van-dijk.github.io','https://sharon.life','https://www.sharon.life'],true))chain_out(403,['error'=>'origin_forbidden']);
if($origin!==''){header('Access-Control-Allow-Origin: '.$origin);header('Vary: Origin');}
header('Access-Control-Allow-Methods: POST, OPTIONS');header('Access-Control-Allow-Headers: Content-Type');header('X-Content-Type-Options: nosniff');
if(($_SERVER['REQUEST_METHOD']??'')==='OPTIONS'){http_response_code(204);exit;}
if(($_SERVER['REQUEST_METHOD']??'')!=='POST')chain_out(405,['error'=>'post_required']);
if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')chain_out(415,['error'=>'json_required']);
$raw=file_get_contents('php://input',false,null,0,8193);
if(!is_string($raw)||strlen($raw)>8192)chain_out(413,['error'=>'request_too_large']);
try{$input=json_decode($raw,true,16,JSON_THROW_ON_ERROR);if(!is_array($input))throw new InvalidArgumentException('invalid_request');}
catch(Throwable $e){chain_out(400,['error'=>'invalid_request']);}
$path=dirname(__DIR__).'/private/chains/register-v1.json';
try{
    $register=chain_register($path);
    chain_out(200,chain_bundle($register,$input));
}catch(InvalidArgumentException $e){chain_out(400,['error'=>$e->getMessage()]);}
catch(Throwable $e){chain_out(503,['error'=>'register_unavailable']);}
