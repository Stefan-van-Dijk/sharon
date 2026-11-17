<?php
declare(strict_types=1);
define('LOG_CONNECTION_LIBRARY_ONLY',true);
require 'server/connections.php';

$dir=sys_get_temp_dir().'/shop-library-'.bin2hex(random_bytes(8));
mkdir($dir,0700);
register_shutdown_function(function()use($dir){foreach(glob($dir.'/*') as $file) unlink($file); rmdir($dir);});
$server=new LogNetwork($dir.'/network.json',1000);
function expect(bool $value, string $label): void {
    if (!$value) throw new RuntimeException($label);
}
function denies(callable $work, string $reason): void {
    try { $work(); } catch (LogNetworkError $error) {
        expect($error->reason===$reason, 'Expected '.$reason.', got '.$error->reason);
        return;
    }
    throw new RuntimeException('Expected '.$reason);
}
function registerPerson(LogNetwork $server, string $name): array {
    $id=LogNetwork::id();$token=LogNetwork::token();
    $server->handle('register',['personId'=>$id,'deviceToken'=>$token,'name'=>$name],null);
    return [$id,$token];
}
[$ownerId,$owner]=registerPerson($server,'Owner');
$server->handle('bootstrap',$server->start(),$owner);
[$guestId,$guest]=registerPerson($server,'Guest');
$invitation=$server->handle('invite',['recipientId'=>$guestId],$owner)['invitation'];
$server->handle('accept',$invitation,$guest);

$facts=['name'=>'Aardbeien','brand'=>'Testmerk','quantity'=>'400 g','barcode'=>'00123456'];
$product=$server->handle('shoplibrary-product',$facts,$owner)['product'];
$id=$product['id'];
expect((bool)preg_match('/\A[A-Za-z0-9_-]{12}\z/',$id),'central ID12');
expect($server->handle('shoplibrary-product',$facts,$guest)['product']['id']===$id,'reuse across accounts');
denies(fn()=>$server->handle('shoplibrary-product',[...$facts,'quantity'=>'800 g'],$guest),'product_conflict');
denies(fn()=>$server->handle('shoplibrary-barcode-remove',['id'=>$id,'barcode'=>$facts['barcode']],$guest),'barcode_protected');
$source=$server->handle('shoplibrary-product',[...$facts,'barcode'=>'00876543','source'=>'openfoodfacts'],$owner)['product'];
denies(fn()=>$server->handle('shoplibrary-barcode-remove',['id'=>$source['id'],'barcode'=>'00876543'],$owner),'barcode_protected');
$edited=$server->handle('shoplibrary-product-edit',[...$facts,'id'=>$id,'name'=>'Verse aardbeien','revision'=>1],$owner)['product'];
expect($edited['id']===$id&&$edited['revision']===2,'central edit preserves ID');
$server->handle('shoplibrary-barcode-remove',['id'=>$id,'barcode'=>$facts['barcode']],$owner);
expect($server->handle('shoplibrary-lookup',['barcode'=>$facts['barcode']],$guest)['product']===null,'removed code is no longer returned by lookup');
expect($server->handle('shoplibrary-products',['ids'=>[$id]],$guest)['products'][0]['name']==='Verse aardbeien','product remains available');

$catalog=['categories'=>[
    ['id'=>'fruit','name'=>'Fruit','entries'=>[['type'=>'category','id'=>'berries']]],
    ['id'=>'berries','name'=>'Bessen','entries'=>[]],
    ['id'=>'private','name'=>'Privé','entries'=>[]],
], 'products'=>[
    ['id'=>'p','name'=>'Mijn alias','categoryId'=>'berries','barcodes'=>[],'centralId'=>$id],
    ['id'=>'private-p','name'=>'Privé product','categoryId'=>'private','barcodes'=>[]],
], 'recipes'=>[]];
$server->handle('shopcatalog-put',['payload'=>$catalog,'revision'=>0,'operation'=>'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],$owner);
$collection=LogNetwork::id();
$create=['id'=>$collection,'name'=>'Fruit samen','categories'=>['fruit','berries']];
$server->handle('shoplibrary-create',$create,$owner);
$server->handle('shoplibrary-create',$create,$owner);
expect($server->handle('shoplibrary-index',[],$guest)['collections']===[],'private until explicitly shared');
$share=['id'=>$collection,'personId'=>$guestId,'role'=>'read'];
$server->handle('shoplibrary-share',$share,$owner);
$read=fn()=>$server->handle('shoplibrary-index',[],$guest)['collections'][0];
expect(array_column($read()['products'],'name')===['Verse aardbeien'],'nested category includes no duplicates, aliases or unrelated products');
$item=['id'=>$collection,'key'=>$source['id'],'include'=>true];
denies(fn()=>$server->handle('shoplibrary-item',$item,$guest),'collection_forbidden');

$catalog['products'][]=['id'=>'new-fruit','name'=>'Banaan','categoryId'=>'fruit','barcodes'=>[]];
$server->handle('shopcatalog-put',['payload'=>$catalog,'revision'=>1,'operation'=>'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'],$owner);
expect(array_column($read()['products'],'name')===['Verse aardbeien','Banaan'],'new category products follow the share');
$server->handle('shoplibrary-share',[...$share,'role'=>'write'],$owner);
$server->handle('shoplibrary-item',$item,$guest);
expect(in_array($source['id'],array_column($read()['products'],'key'),true),'editor adds a central product');
$server->handle('shoplibrary-item',['id'=>$collection,'key'=>$id,'include'=>false],$guest);
expect(!in_array($id,array_column($read()['products'],'key'),true),'editor removes product from this collection');
$server->handle('shoplibrary-share',[...$share,'role'=>null],$owner);
expect($server->handle('shoplibrary-index',[],$guest)['collections']===[],'owner can revoke access');
$clear=['id'=>$id,'name'=>'','brand'=>'','quantity'=>'','revision'=>3];
denies(fn()=>$server->handle('shoplibrary-product-edit',$clear,$guest),'barcode_protected');
denies(fn()=>$server->handle('shoplibrary-product-edit',[...$clear,'id'=>$source['id'],'revision'=>1],$owner),'barcode_protected');
$cleared=$server->handle('shoplibrary-product-edit',$clear,$owner)['product'];
expect($cleared['id']===$id && $cleared['name']==='' && $cleared['brand']==='' && $cleared['quantity']==='' && $cleared['barcode']===null,'own fields can be removed without changing ID12');
$other=$server->handle('shoplibrary-products',['ids'=>[$id]],$guest)['products'][0];
expect($other['name']==='' && $other['brand']==='' && $other['quantity']==='','other users receive cleared information');
denies(fn()=>$server->handle('shoplibrary-product-edit',$clear,$owner),'product_conflict');
echo "Productbibliotheek en gedeelde categorieën gecontroleerd.\n";

// A whole-catalog grant follows newly added branches, whereas a branch grant stays scoped.
$whole=LogNetwork::id();
$server->handle('shoplibrary-create',['id'=>$whole,'name'=>'Hele catalogus','scope'=>'all','categories'=>[]],$owner);
$server->handle('shoplibrary-share',['id'=>$whole,'personId'=>$guestId,'role'=>'read'],$owner);
$catalog['categories'][]=['id'=>'later','name'=>'Later toegevoegd','entries'=>[]];
$catalog['products'][]=['id'=>'later-product','name'=>'Later product','categoryId'=>'later','barcodes'=>[]];
$server->handle('shopcatalog-put',['payload'=>$catalog,'revision'=>2,'operation'=>'cccccccc-cccc-cccc-cccc-cccccccccccc'],$owner);
$shared=$server->handle('shoplibrary-index',[],$guest)['collections'][0];
expect($shared['scope']==='all','scope is explicit');
expect(in_array('Later product',array_column($shared['products'],'name'),true),'future products in future branches are included');
expect(in_array('later',array_column($shared['categories'],'id'),true),'tree includes future categories');
expect(!isset($shared['members']),'recipient does not receive membership data');
$server->handle('shoplibrary-share',[...$share,'role'=>'read'],$owner);
$branch=$read();
expect(!in_array('Later product',array_column($branch['products'],'name'),true),'branch excludes products outside its subtree');
expect(!in_array('later',array_column($branch['categories'],'id'),true),'branch excludes unrelated category names');
$server->handle('shoplibrary-share',[...$share,'role'=>null],$owner);
denies(fn()=>$server->handle('shoplibrary-share',['id'=>$whole,'personId'=>$ownerId,'role'=>'write'],$guest),'owner_required');
$server->handle('shoplibrary-share',['id'=>$whole,'personId'=>$guestId,'role'=>null],$owner);
expect($server->handle('shoplibrary-index',[],$guest)['collections']===[],'whole catalog access can be revoked');
