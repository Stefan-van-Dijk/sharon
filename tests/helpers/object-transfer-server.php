<?php
declare(strict_types=1);
define('LOG_CONNECTION_LIBRARY_ONLY',true);require 'server/connections.php';
$dir=sys_get_temp_dir().'/object-transfer-'.bin2hex(random_bytes(6));mkdir($dir,0700);
register_shutdown_function(function()use($dir){$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $f){$f->isDir()?rmdir($f->getPathname()):unlink($f->getPathname());}rmdir($dir);});
$s=new LogNetwork($dir.'/network.json',1000000);$start=$s->start();
$owner=['personId'=>LogNetwork::id(),'deviceToken'=>LogNetwork::token(),'name'=>'Owner'];$s->handle('register',$owner,null);$s->handle('bootstrap',$start,$owner['deviceToken']);
$checks=0;function check(bool $v):void{global $checks;$checks++;if(!$v)throw new RuntimeException('Check '.$checks.' failed');}
function fails(callable $f,string $reason):void{try{$f();}catch(LogNetworkError $e){check($e->reason===$reason);return;}throw new RuntimeException('Expected '.$reason);}
$id=LogNetwork::id();$input=['id'=>$id,'access'=>LogNetwork::token(),'payload'=>['iv'=>LogNetwork::token(12),'data'=>LogNetwork::token(100)]];
fails(fn()=>$s->handle('share-publish',$input,null),'invalid_token');
$s->handle('share-publish',$input,$owner['deviceToken']);check(is_file($dir.'/shares/'.hash('sha256',$id).'.json'));check($s->handle('share-check',['id'=>$id],null)['valid']);check(!$s->handle('share-check',['id'=>LogNetwork::id()],null)['valid']);
fails(fn()=>$s->handle('share-publish',$input,$owner['deviceToken']),'identity_exists');
$wrong=[...$input,'access'=>LogNetwork::token()];fails(fn()=>$s->handle('share-read',$wrong,null),'unauthorized');fails(fn()=>$s->handle('share-ack',$wrong,null),'unauthorized');
check($s->handle('share-read',$input,null)['payload']===$input['payload']);check($s->handle('share-read',$input,null)['payload']===$input['payload']);
$s->handle('share-ack',$input,null);check(!is_file($dir.'/shares/'.hash('sha256',$id).'.json'));check($s->handle('share-check',['id'=>$id],null)['valid']);check($s->handle('share-ack',$input,null)['ok']);fails(fn()=>$s->handle('share-read',$input,null),'share_unavailable');
$input['id']=LogNetwork::id();$s->handle('share-publish',$input,$owner['deviceToken']);$future=new LogNetwork($dir.'/network.json',1000000+8*86400);fails(fn()=>$future->handle('share-read',$input,null),'share_unavailable');check(!is_file($dir.'/shares/'.hash('sha256',$input['id']).'.json'));
echo json_encode(['checks'=>$checks]);
