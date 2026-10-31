<?php
declare(strict_types=1);
// Public OSM bundles and bounded worldwide discovery. No user identities or GPS history.
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
function chain_register(string $path, ?callable $download=null, ?int $clock=null, ?callable $validate=null,string $source='register-v1.json',int $maxBytes=8000000):array {
    $validate??='chain_validate_register';
    $now=$clock??time();$directory=dirname($path);clearstatcache(true,$path);clearstatcache(true,$path.'.checked');
    if(!is_dir($directory)&&!mkdir($directory,0700,true)&&!is_dir($directory))throw new RuntimeException('Storage unavailable');
    if(is_link($path)||is_link($path.'.lock')||is_link($path.'.checked'))throw new RuntimeException('Invalid storage');
    if(!is_file($directory.'/.htaccess')&&file_put_contents($directory.'/.htaccess',"Require all denied\n",LOCK_EX)===false)throw new RuntimeException('Private storage unavailable');
    $lock=fopen($path.'.lock','c');if(!$lock)throw new RuntimeException('Lock unavailable');
    try{
        if(!flock($lock,LOCK_EX))throw new RuntimeException('Lock unavailable');
        $cached=is_file($path)?json_decode(file_get_contents($path),true,128,JSON_THROW_ON_ERROR):null;
        $due=!is_file($path)||$now-(filemtime($path)?:0)>=30*86400;
        // A missing initial register should recover promptly once it is published.
        $retry=!is_file($path.'.checked')||$now-(filemtime($path.'.checked')?:0)>=($cached?3600:60);
        if($due&&$retry){
            touch($path.'.checked',$now);
            try{
                $raw=$download?$download():file_get_contents('https://raw.githubusercontent.com/Stefan-van-Dijk/sharon/data/osm-chains-nl/'.$source,false,
                    stream_context_create(['http'=>['timeout'=>12,'follow_location'=>0,'header'=>"User-Agent: Sharon-chain-register/1.0\r\n"]]),0,$maxBytes+1);
                if(!is_string($raw)||strlen($raw)>$maxBytes)throw new RuntimeException('Register download failed');
                $fresh=json_decode($raw,true,128,JSON_THROW_ON_ERROR);
                if(!is_array($fresh))throw new RuntimeException('Invalid register');
                $validate($fresh);
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
function chain_validate_browse(array $data):void {
    if(($data['schema']??null)!==1||($data['coverage']??'')!=='NL'||!preg_match('/\Av1-[a-f0-9]{24}\z/',$data['version']??'')||!is_array($data['chains']??null)||!is_array($data['points']??null)||!is_array($data['detailFiles']??null)||count($data['points'])>500000)throw new RuntimeException('Invalid browse register');
    $chains=[];foreach($data['chains'] as $chain){if(!is_array($chain)||!is_string($chain['id']??null)||!preg_match('/\A(Q[1-9][0-9]*|b-[a-f0-9]{16})\z/',$chain['id'])||!is_string($chain['name']??null)||strlen($chain['name'])>2000)throw new RuntimeException('Invalid browse chain');$chains[$chain['id']]=true;}
    foreach($data['detailFiles'] as $prefix=>$hash)if(!preg_match('/\A[A-Za-z0-9_-]\z/',(string)$prefix)||!is_string($hash)||!preg_match('/\A[a-f0-9]{64}\z/',$hash))throw new RuntimeException('Invalid detail reference');
    $seen=[];foreach($data['points'] as $row){if(!is_array($row)||count($row)!==6||!is_string($row[0])||!preg_match('/\A[A-Za-z0-9_-]{12}\z/',$row[0])||isset($seen[$row[0]])||!isset($chains[$row[1]])||!is_int($row[2])||!is_int($row[3])||abs($row[2])>180000000||abs($row[3])>90000000||!is_string($row[4])||strlen($row[4])>2000||!preg_match('/\A(node|way|relation)\/[1-9][0-9]*\z/',$row[5])||!isset($data['detailFiles'][$row[0][0]]))throw new RuntimeException('Invalid browse point');$seen[$row[0]]=true;}
}
function chain_browse_query(array $data,array $input):array {
    $action=$input['action']??'';
    $base=['schema'=>1,'coverage'=>'NL','version'=>$data['version']];
    if($action==='catalog'){
        if(array_diff(array_keys($input),['schema','action']))throw new InvalidArgumentException('unexpected_fields');
        return [...$base,'chains'=>$data['chains']];
    }
    if($action!=='map'||array_diff(array_keys($input),['schema','action','bounds','chainId']))throw new InvalidArgumentException('invalid_request');
    $bounds=$input['bounds']??null;$chain=$input['chainId']??'';
    if(!is_array($bounds)||!array_is_list($bounds)||count($bounds)!==4||!is_string($chain))throw new InvalidArgumentException('invalid_bounds');
    foreach($bounds as $v)if((!is_float($v)&&!is_int($v))||!is_finite((float)$v))throw new InvalidArgumentException('invalid_bounds');
    [$west,$south,$east,$north]=$bounds;
    if($west< -180||$east>180||$south< -90||$north>90||$west>=$east||$south>=$north||$east-$west>1||$north-$south>0.5)throw new InvalidArgumentException('zoom_required');
    $rows=[];$truncated=false;
    foreach($data['points'] as $row){if($chain!==''&&$row[1]!==$chain)continue;if($row[2]<$west*1e6||$row[2]>$east*1e6||$row[3]<$south*1e6||$row[3]>$north*1e6)continue;if(count($rows)>=2000){$truncated=true;break;}$rows[]=$row;}
    return [...$base,'points'=>$rows,'truncated'=>$truncated];
}
function chain_browse_detail(array $data,string $id,string $directory,?callable $download=null):array {
    if(!preg_match('/\A[A-Za-z0-9_-]{12}\z/',$id))throw new InvalidArgumentException('invalid_branch');
    $row=null;foreach($data['points'] as $p)if($p[0]===$id){$row=$p;break;}if(!$row)throw new InvalidArgumentException('branch_unavailable');
    $name=$id[0].'-'.$data['detailFiles'][$id[0]].'.json';$path=$directory.'/'.$name;
    if(!is_dir($directory)&&!mkdir($directory,0700,true)&&!is_dir($directory))throw new RuntimeException('Storage unavailable');
    if(is_link($directory)||is_link($path))throw new RuntimeException('Invalid storage');
    if(!is_file($path)){
        $raw=$download?$download($name):file_get_contents('https://raw.githubusercontent.com/Stefan-van-Dijk/sharon/data/osm-chains-nl/browse-details/'.$name,false,stream_context_create(['http'=>['timeout'=>12,'follow_location'=>0]]),0,2000001);
        if(!is_string($raw)||strlen($raw)>2000000||!hash_equals($data['detailFiles'][$id[0]],hash('sha256',$raw)))throw new RuntimeException('Incomplete details');
        $temp=$path.'.'.bin2hex(random_bytes(6)).'.tmp';if(file_put_contents($temp,$raw,LOCK_EX)===false)throw new RuntimeException('Commit failed');@chmod($temp,0600);if(!rename($temp,$path)){@unlink($temp);throw new RuntimeException('Commit failed');}
    }
    $details=json_decode(file_get_contents($path),true,32,JSON_THROW_ON_ERROR);$detail=$details[$id]??null;
    if(!is_array($detail)||($detail['sourceRef']??null)!==$row[5]||($detail['chainId']??null)!==$row[1])throw new RuntimeException('Invalid detail');
    return ['schema'=>1,'version'=>$data['version'],'detail'=>$detail];
}
// Worldwide discovery uses bounded Overpass queries and a shared, non-personal cache.
function world_shop_query(array $in):string {
    if(($in['schema']??null)!==1||($in['world']??null)!==true)throw new InvalidArgumentException('invalid_request');
    if(($in['action']??'')==='detail'){
        if(array_diff(array_keys($in),['schema','action','world','id','sourceRef']))throw new InvalidArgumentException('unexpected_fields');
        $ref=$in['sourceRef']??'';
        if(!is_string($ref)||!preg_match('/\A(node|way|relation)\/([1-9][0-9]{0,15})\z/',$ref,$m)||($in['id']??'')!==substr(hash('sha256','osm:'.$ref),0,12))throw new InvalidArgumentException('invalid_branch');
        return '[out:json][timeout:8];'.$m[1].'('.$m[2].');out tags center 1;';
    }
    if(($in['action']??'')!=='map'||array_diff(array_keys($in),['schema','action','world','bounds','chainId']))throw new InvalidArgumentException('invalid_request');
    $b=$in['bounds']??null;$chain=$in['chainId']??'';
    if(!is_array($b)||!array_is_list($b)||count($b)!==4||!is_string($chain)||($chain!==''&&!preg_match('/\AQ[1-9][0-9]*\z/',$chain)))throw new InvalidArgumentException('invalid_bounds');
    foreach($b as $v)if((!is_int($v)&&!is_float($v))||!is_finite((float)$v))throw new InvalidArgumentException('invalid_bounds');
    [$w,$s,$e,$n]=$b;if($w < -180||$e>180||$s < -90||$n>90||$e<=$w||$n<=$s||$e-$w>1||$n-$s>1)throw new InvalidArgumentException('invalid_bounds');
    $box=implode(',',array_map(fn($v)=>sprintf('%.6F',$v),[$s,$w,$n,$e]));$brand=$chain===''?'':'["brand:wikidata"="'.$chain.'"]';
    return '[out:json][timeout:8][maxsize:8388608];(nwr["shop"]["shop"!~"^(no|vacant)$"]'.$brand.'('.$box.');nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub|pharmacy|fuel|charging_station|bank|post_office)$"]'.$brand.'('.$box.'););out tags center 2001;';
}
function world_shop_result(array $data,array $in):array {
    if(!isset($data['elements'])||!is_array($data['elements'])||isset($data['remark']))throw new RuntimeException('Invalid source');
    $points=[];$kinds=[];$details=[];
    foreach(array_slice($data['elements'],0,2001) as $el){
        $t=$el['tags']??[];if(!is_array($t))continue;$kind=$t['shop']??$t['amenity']??'';
        if(!is_array($t)||(!isset($t['shop'])&&!in_array($kind,['restaurant','cafe','fast_food','bar','pub','pharmacy','fuel','charging_station','bank','post_office'],true))||in_array($kind,['no','vacant'],true))continue;
        if(!in_array($el['type']??'', ['node','way','relation'],true)||!is_int($el['id']??null)||$el['id']<1)continue;
        $lat=$el['lat']??$el['center']['lat']??null;$lng=$el['lon']??$el['center']['lon']??null;
        if(!is_numeric($lat)||!is_numeric($lng)||abs((float)$lat)>90||abs((float)$lng)>180)continue;
        $ref=$el['type'].'/'.$el['id'];$id=substr(hash('sha256','osm:'.$ref),0,12);
        $brand=(string)($t['brand:wikidata']??'');$chain=preg_match('/\AQ[1-9][0-9]*\z/',$brand)?$brand:'';
        if(($in['chainId']??'')!==''&&$chain!==$in['chainId'])continue;
        $name=substr((string)($t['name']??$t['brand']??$kind),0,300);
        $points[$ref]=[$id,$chain,(int)round((float)$lng*1e6),(int)round((float)$lat*1e6),$name,$ref];$kinds[$id]=substr((string)$kind,0,100);
        $website=(string)($t['website']??$t['contact:website']??'');
        $details[$id]=['id'=>$id,'chainId'=>$chain,'sourceRef'=>$ref,'name'=>$name,'kind'=>$kinds[$id],
          'address'=>substr(trim(implode(' ',array_filter([$t['addr:street']??'',$t['addr:housenumber']??'',$t['addr:postcode']??'',$t['addr:city']??'']))),0,500),
          'openingHours'=>substr((string)($t['opening_hours']??''),0,300),'website'=>str_starts_with($website,'https://')?substr($website,0,2000):''];
    }
    $base=['schema'=>1,'coverage'=>'WORLD','version'=>'v1-'.substr(hash('sha256',json_encode([$points,$details])),0,24)];
    if($in['action']==='detail'){
        $detail=$details[$in['id']]??null;if(!$detail||$detail['sourceRef']!==$in['sourceRef'])throw new RuntimeException('Place unavailable');
        return [...$base,'detail'=>$detail];
    }
    return [...$base,'points'=>array_slice(array_values($points),0,2000),'kinds'=>$kinds,'truncated'=>count($data['elements'])>2000];
}
function world_shop_fetch(array $in,string $directory,?callable $download=null):array {
    $query=world_shop_query($in);
    if(!is_dir($directory)&&!mkdir($directory,0700,true)&&!is_dir($directory))throw new RuntimeException('Cache unavailable');
    if(is_link($directory))throw new RuntimeException('Invalid cache');
    $path=$directory.'/'.hash('sha256',$query).'.json';
    $read=static function()use($path){if(is_link($path))throw new RuntimeException('Invalid cache');return is_file($path)&&filemtime($path)>time()-900?json_decode((string)file_get_contents($path),true,32,JSON_THROW_ON_ERROR):null;};
    if(($cached=$read())!==null)return $cached;
    $lock=fopen($directory.'/requests.lock','c+');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))throw new RuntimeException('Source busy');
    try{
        if(($cached=$read())!==null)return $cached;
        $budgetPath=$directory.'/budget.json';$budget=is_file($budgetPath)?json_decode((string)file_get_contents($budgetPath),true):[];
        if(($budget['day']??'')!==gmdate('Y-m-d'))$budget=['day'=>gmdate('Y-m-d'),'count'=>0,'last'=>0];
        if(($budget['count']??0)>=2000||(($in['action']??'')==='map'&&microtime(true)-($budget['last']??0)<1))throw new RuntimeException('Source busy');
        $budget['count']++;$budget['last']=microtime(true);file_put_contents($budgetPath,json_encode($budget),LOCK_EX);
        $data=null;
        foreach(['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter'] as $endpoint){
          try{
            $raw=$download?$download($query):@file_get_contents($endpoint,false,stream_context_create(['http'=>['method'=>'POST','timeout'=>10,'follow_location'=>0,'header'=>"Content-Type: application/x-www-form-urlencoded\r\nUser-Agent: Sharon/1.0 (+https://sharon.life)\r\n",'content'=>http_build_query(['data'=>$query])]]),0,5000001);
            if(!is_string($raw)||strlen($raw)>5000000)continue;$parsed=json_decode($raw,true,32,JSON_THROW_ON_ERROR);$data=world_shop_result($parsed,$in);break;
          }catch(Throwable $e){if($download)throw $e;}
        }
        if($data===null)throw new RuntimeException('Source unavailable');
        $temp=$path.'.'.bin2hex(random_bytes(4)).'.tmp';if(file_put_contents($temp,json_encode($data),LOCK_EX)===false)throw new RuntimeException('Cache unavailable');@chmod($temp,0600);if(!rename($temp,$path)){@unlink($temp);throw new RuntimeException('Cache unavailable');}
        $files=glob($directory.'/*.json')?:[];if(count($files)>512){$files=array_values(array_filter($files,fn($f)=>$f!==$budgetPath&&$f!==$path));usort($files,fn($a,$b)=>filemtime($a)<=>filemtime($b));foreach(array_slice($files,0,count($files)-510) as $file)@unlink($file);}
        return $data;
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
    if(isset($input['action'])){
        if(($input['schema']??null)!==1||!in_array($input['action'],['catalog','map','detail'],true))throw new InvalidArgumentException('invalid_request');
        if(($input['world']??false)===true)chain_out(200,world_shop_fetch($input,dirname($path).'/world-cache'));
        $directory=dirname($path);$browse=chain_register($directory.'/browse-v1.json',null,null,'chain_validate_browse','browse-v1.json',16000000);
        if($input['action']==='detail'){
            if(array_diff(array_keys($input),['schema','action','id']))throw new InvalidArgumentException('unexpected_fields');
            chain_out(200,chain_browse_detail($browse,(string)($input['id']??''),$directory.'/browse-details'));
        }
        chain_out(200,chain_browse_query($browse,$input));
    }
    $register=chain_register($path);
    chain_out(200,chain_bundle($register,$input));
}catch(InvalidArgumentException $e){chain_out(400,['error'=>$e->getMessage()]);}
catch(Throwable $e){chain_out(503,['error'=>'register_unavailable']);}
