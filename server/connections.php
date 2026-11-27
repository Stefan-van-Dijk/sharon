<?php
declare(strict_types=1);

// Shared extension of Log's existing connections endpoint. One locked JSON
// document records identity, access grants and chats; no database is required.
final class LogNetworkError extends RuntimeException {
    public function __construct(public readonly string $reason, public readonly int $status = 400) {
        parent::__construct($reason);
    }
}
final class LogNetwork {
    private array $state;
    public function __construct(private string $path, private ?int $clock = null) {}
    public static function token(int $bytes = 32): string {
        return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
    }
    public static function id(): string { return self::token(9); }
    private function now(): int { return $this->clock ?? time(); }
    private static function validId(mixed $id): string {
        if (!is_string($id) || !preg_match('/\A[A-Za-z0-9_-]{12}\z/', $id)) throw new LogNetworkError('invalid_id');
        return $id;
    }
    private static function hashToken(mixed $token): string {
        if (!is_string($token) || !preg_match('/\A[A-Za-z0-9_-]{43}\z/', $token)) throw new LogNetworkError('invalid_token');
        return hash('sha256', $token);
    }
    private static function emptyState(): array {
        return ['schema'=>'sharon-network-v1','id'=>self::id(),'ownerId'=>null,'bootstrap'=>null,
            'people'=>[],'relations'=>[],'invitations'=>[],'messages'=>[],'nextSeq'=>0,'rates'=>[]];
    }
    private function transaction(callable $change): mixed {
        $directory = dirname($this->path);
        if (!is_dir($directory) && !mkdir($directory,0700,true) && !is_dir($directory)) throw new RuntimeException('Storage unavailable');
        if (is_link($this->path) || is_link($this->path.'.lock')) throw new RuntimeException('Invalid storage');
        $lock = fopen($this->path.'.lock','c');
        if (!$lock) throw new RuntimeException('Lock unavailable');
        @chmod($this->path.'.lock',0600);
        try {
            if (!flock($lock,LOCK_EX)) throw new RuntimeException('Lock unavailable');
            // A sidecar lock stays valid when write_json atomically renames the
            // data file. Never lock only the inode that is about to be replaced.
            $exists = is_file($this->path);
            if ($exists) {
                $raw = file_get_contents($this->path);
                $this->state = json_decode($raw, true, 128, JSON_THROW_ON_ERROR);
                if (($this->state['schema'] ?? '') !== 'sharon-network-v1' ||
                    !is_array($this->state['people'] ?? null) || !is_array($this->state['relations'] ?? null) ||
                    !is_array($this->state['invitations'] ?? null) || !is_array($this->state['messages'] ?? null))
                    throw new RuntimeException('Invalid network document');
            } else $this->state = self::emptyState();
            $before = $this->state;
            $result = $change();
            if (!$exists || $before !== $this->state) {
                $stored=$this->state;
                foreach (['people','relations','invitations','messages','rates'] as $map) $stored[$map]=(object)$stored[$map];
                if (!write_json($this->path,$stored)) throw new RuntimeException('Commit failed');
            }
            return $result;
        } finally { flock($lock,LOCK_UN); fclose($lock); }
    }
    private function grant(string $personId): ?array {
        foreach ($this->state['relations'] as $r) if ($r['type']==='grants-access' && $r['toId']===$personId) return $r;
        return null;
    }
    private function line(string $personId): ?int {
        if ($personId === $this->state['ownerId']) return 0;
        if (!$this->grant($personId)) return null;
        $seen=[]; $current=$personId; $line=0;
        while ($current !== $this->state['ownerId']) {
            if (isset($seen[$current]) || ++$line>3) throw new RuntimeException('Invalid access path');
            $seen[$current]=true; $r=$this->grant($current);
            if (!$r) throw new RuntimeException('Incomplete access path');
            $current=$r['fromId'];
        }
        return $line;
    }
    private function peopleCount(): int {
        return count(array_filter($this->state['relations'],fn($r)=>$r['type']==='grants-access'));
    }
    private function person(mixed $token): array {
        $hash=self::hashToken($token);
        foreach ($this->state['people'] as $p) {
            if (!hash_equals($p['tokenHash'],$hash)) continue;
            $grant=$this->grant($p['id']);
            if ($grant && $grant['status']!=='active') break;
            return $p;
        }
        throw new LogNetworkError('unauthorized',401);
    }
    private function member(array $p): void {
        if ($this->line($p['id'])===null) throw new LogNetworkError('invitation_required',403);
    }
    private function selfData(array $p): array {
        return ['personId'=>$p['id'],'name'=>$p['name'],'networkId'=>$this->state['id'],'line'=>$this->line($p['id'])];
    }
    private function relation(string $from, string $to, string $type): array {
        do { $id=self::id(); } while (isset($this->state['relations'][$id]));
        return ['id'=>$id,'fromId'=>$from,'toId'=>$to,'type'=>$type,'status'=>'active'];
    }
    public function start(): array {
        // Called only after verifying the existing Log publication key.
        return $this->transaction(function () {
            if ($this->state['ownerId']!==null) throw new LogNetworkError('already_activated',409);
            $token=self::token(); $until=$this->now()+900;
            $this->state['bootstrap']=['hash'=>self::hashToken($token),'until'=>$until,'claimedBy'=>null];
            return ['v'=>1,'kind'=>'bootstrap','networkId'=>$this->state['id'],'token'=>$token,'expiresAt'=>$until*1000];
        });
    }
    private function rate(string $bucket, int $limit, int $seconds): void {
        $r=$this->state['rates'][$bucket] ?? null;
        if (!$r || $r['until']<=$this->now()) $r=['count'=>0,'until'=>$this->now()+$seconds];
        if ($r['count'] >= $limit) throw new LogNetworkError('rate_limit',429);
        $r['count']++; $this->state['rates'][$bucket]=$r;
    }
    public function throttleAccount(string $ip, string $action, mixed $email = null): void {
        if (!in_array($action, ['account-register', 'account-login', 'account-verify', 'account-resend', 'account-forgot', 'account-reset'], true)) return;
        $this->transaction(function () use ($ip, $action, $email) {
            $this->rate($action . ':' . hash('sha256', $ip), 15, 900);
            if (is_string($email) && strlen($email) <= 254 && filter_var(trim($email),FILTER_VALIDATE_EMAIL)) {
                $mailAction=in_array($action,['account-register','account-resend','account-forgot'],true);
                $bucket=$mailAction ? 'account-mail' : $action;
                $this->rate($bucket . ':' . hash('sha256',strtolower(trim($email))),$mailAction ? 4 : 30,900);
            }
        });
    }
    public function throttle(string $ip, ?string $token, bool $registration): void {
        $this->transaction(function () use ($ip,$token,$registration) {
            foreach ($this->state['rates'] as $key=>$r) if ($r['until']<=$this->now()) unset($this->state['rates'][$key]);
            $this->rate('ip:'.hash('sha256',$ip),600,60);
            if ($registration) $this->rate('registration:'.hash('sha256',$ip),180,3600);
            if ($token) $this->rate('credential:'.hash('sha256',$token),120,60);
        });
    }
    private static function informationReference(mixed $item): array {
        if (!is_array($item)) throw new LogNetworkError('invalid_information');
        $source=$item['source'] ?? null; $id=$item['id'] ?? null;
        if (!is_string($source) || !preg_match('/\A[a-z][a-z0-9-]{0,39}\z/',$source) ||
            !is_string($id) || $id==='' || strlen($id)>200 || trim($id)!==$id || !preg_match('//u',$id) ||
            preg_match('/[\x00-\x1f\x7f]/',$id)) throw new LogNetworkError('invalid_information');
        if ($source==='wikipedia' && !preg_match('/\AQ[1-9][0-9]*\z/',$id)) throw new LogNetworkError('invalid_information');
        $uri=$source==='wikipedia' ? 'https://www.wikidata.org/entity/'.$id : ($item['uri'] ?? null);
        $url=is_string($uri) ? parse_url($uri) : false;
        if (!$url || strlen($uri)>2048 || ($url['scheme'] ?? '')!=='https' || empty($url['host']) ||
            isset($url['user']) || isset($url['pass']) || preg_match('/[\x00-\x20\x7f]/',$uri)) throw new LogNetworkError('invalid_information');
        return ['source'=>$source,'id'=>$id,'uri'=>$uri];
    }
    private static function informationKey(array $reference): string {
        return hash('sha256',json_encode([$reference['source'],$reference['id']],JSON_THROW_ON_ERROR));
    }
    private function informationSummary(array $reference, string $pid): array {
        $item=$this->state['information'][self::informationKey($reference)] ?? [];
        $counts=['opened'=>0,'read'=>0,'liked'=>0,'disliked'=>0];
        foreach ($item['feedback'] ?? [] as $personId=>$row) {
            $person=$this->state['people'][$personId] ?? null;
            $grant=$this->grant($personId);
            if (!$person || ($personId!==$this->state['ownerId'] && (!$grant || $grant['status']!=='active'))) continue;
            foreach ($counts as $field=>$count) if ($row['state'][$field] ?? false) $counts[$field]++;
        }
        $own=$item['feedback'][$pid] ?? [];
        return ['reference'=>$item['reference'] ?? $reference,'counts'=>$counts,
            'policy'=>$item['policy'] ?? ['baseRadius'=>10000,'maxRadius'=>10000,'weight'=>0.5],
            'context'=>$item['context'] ?? null,'revision'=>$item['revision'] ?? 0,
            'own'=>$own['state'] ?? ['opened'=>false,'read'=>false,'liked'=>false,'disliked'=>false],
            'version'=>$own['version'] ?? 0];
    }
    private function informationAction(string $action, array $in, string $pid): array {
        if ($action==='information-summary') {
            $items=$in['items'] ?? null;
            if (!is_array($items) || !array_is_list($items) || count($items)>40) throw new LogNetworkError('invalid_information');
            return ['items'=>array_map(fn($item)=>$this->informationSummary(self::informationReference($item),$pid),$items)];
        }
        $reference=self::informationReference($in['item'] ?? null);
        $key=self::informationKey($reference);
        $item=$this->state['information'][$key] ?? ['reference'=>$reference,'feedback'=>[]];
        if ($item['reference']['uri']!==$reference['uri']) throw new LogNetworkError('information_uri_conflict',409);
        if (!isset($this->state['information'][$key]) && count($this->state['information'] ?? [])>=100000)
            throw new LogNetworkError('capacity',409);
        if ($action==='information-policy') {
            if ($pid!==$this->state['ownerId']) throw new LogNetworkError('owner_required',403);
            $policy=$in['policy'] ?? null;
            if (!is_array($policy) || !is_int($policy['baseRadius'] ?? null) || !is_int($policy['maxRadius'] ?? null) ||
                $policy['baseRadius']<0 || $policy['baseRadius']>$policy['maxRadius'] || $policy['maxRadius']>100000 ||
                !is_numeric($policy['weight'] ?? null) || $policy['weight']<0 || $policy['weight']>1) throw new LogNetworkError('invalid_information_policy');
            $item['policy']=['baseRadius'=>$policy['baseRadius'],'maxRadius'=>$policy['maxRadius'],'weight'=>(float)$policy['weight']];
            if (array_key_exists('context',$in)) {
                $context=$in['context'];
                if (!is_array($context) || !is_string($context['title'] ?? null) || strlen($context['title'])>500 ||
                    !preg_match('//u',$context['title']) || preg_match('/[\x00-\x1f\x7f]/',$context['title']) ||
                    !is_array($context['categories'] ?? null) || !array_is_list($context['categories']) || count($context['categories'])>40)
                    throw new LogNetworkError('invalid_information');
                foreach ($context['categories'] as $category) if (!is_string($category) || strlen($category)>200 ||
                    !preg_match('//u',$category) || preg_match('/[\x00-\x1f\x7f]/',$category)) throw new LogNetworkError('invalid_information');
                $point=$context['location'] ?? null;
                if ($point!==null && (!is_array($point) || !is_numeric($point['lat'] ?? null) || !is_numeric($point['lng'] ?? null) ||
                    abs((float)$point['lat'])>90 || abs((float)$point['lng'])>180)) throw new LogNetworkError('invalid_information');
                $item['context']=['title'=>$context['title'],'categories'=>$context['categories'],
                    'location'=>$point===null ? null : ['lat'=>(float)$point['lat'],'lng'=>(float)$point['lng']]];
            }
            $item['revision']=($item['revision'] ?? 0)+1;
            $this->state['information'][$key]=$item;
            return ['item'=>$this->informationSummary($reference,$pid)];
        }
        $state=$in['state'] ?? null; $operation=$in['operation'] ?? null; $version=$in['version'] ?? null;
        if (!is_array($state) || !is_string($operation) || !preg_match('/\A[a-f0-9-]{36}\z/',$operation) ||
            !is_int($version) || $version<0) throw new LogNetworkError('invalid_information');
        foreach (['opened','read','liked','disliked'] as $field) if (!is_bool($state[$field] ?? null)) throw new LogNetworkError('invalid_information');
        if ($state['liked'] && $state['disliked']) throw new LogNetworkError('invalid_information');
        $state=array_intersect_key($state,array_flip(['opened','read','liked','disliked']));
        $previous=$item['feedback'][$pid] ?? ['version'=>0];
        $duplicate=($previous['operation'] ?? null)===$operation;
        if ($duplicate && ($previous['request'] ?? null)!==$state) throw new LogNetworkError('information_operation_conflict',409);
        $accepted=$duplicate || $previous['version']===$version;
        if ($accepted && !$duplicate) {
            $request=$state;
            $state['opened']=$state['opened'] || ($previous['state']['opened'] ?? false);
            $item['feedback'][$pid]=['state'=>$state,'request'=>$request,'operation'=>$operation,'version'=>$version+1];
            $item['revision']=($item['revision'] ?? 0)+1;
            $this->state['information'][$key]=$item;
        }
        $summary=$this->informationSummary($reference,$pid);
        return ['accepted'=>$accepted,'version'=>$summary['version'],'item'=>$summary];
    }

    private function shopLibrary(string $action, array $input, string $personId): array {
        if ($action === 'shoplibrary-category-lists' || $action === 'shoplibrary-category-archive') {
            $categoryId = $this->shopLibraryIds([$input['id'] ?? null])[0];
            $catalog = $this->state['shopcatalogs'][$personId]['payload'] ?? [];
            $categories = array_column($catalog['categories'] ?? [], null, 'id');
            if (!isset($categories[$categoryId]) || $categories[$categoryId]['name'] === 'Home') throw new LogNetworkError('invalid_collection');
            if ($action === 'shoplibrary-category-lists') return ['lists'=>$this->shopCategoryLists($personId, $categoryId, $catalog, $categories)];
            $archived = $input['archived'] ?? null;
            if (!is_bool($archived)) throw new LogNetworkError('invalid_collection');
            if ($archived) $this->state['shopCategoryArchive'][$personId][$categoryId] = true;
            else unset($this->state['shopCategoryArchive'][$personId][$categoryId]);
            return ['ok'=>true];
        }
        $products = $this->state['shopProducts'] ?? [];
        $collections = $this->state['shopCollections'] ?? [];
        if (in_array($action, ['shoplibrary-product','shoplibrary-product-edit'], true)) {
            $fields = ['name', 'brand', 'quantity'];
            $data = [];
            foreach ($fields as $field) {
                $value = $input[$field] ?? null;
                if (!is_string($value) || ($action === 'shoplibrary-product' && trim($value) === '') || strlen($value) > 240) throw new LogNetworkError('invalid_product');
                $data[$field] = trim($value);
            }
            if ($action === 'shoplibrary-product-edit') {
                $id = self::validId($input['id'] ?? null);
                $record = $products[$id] ?? null;
                if (!$record || $record['ownerId'] !== $personId || $record['source'] !== null) throw new LogNetworkError('barcode_protected', 403);
                if (($input['revision'] ?? null) !== ($record['revision'] ?? 1)) throw new LogNetworkError('product_conflict', 409);
                $record = [...$record, ...$data, 'revision'=>($record['revision'] ?? 1)+1];
                $this->state['shopProducts'][$id] = $record;
                return ['product'=>[...$this->shopPublicProduct($record),'canRemoveBarcode'=>true]];
            }
            $barcode = $input['barcode'] ?? null;
            if (!is_string($barcode) || !preg_match('/\A[0-9]{8,14}\z/', $barcode)) throw new LogNetworkError('invalid_product');
            $source = ($input['source'] ?? null) === 'openfoodfacts' ? 'https://world.openfoodfacts.org/product/'.$barcode : null;
            foreach ($products as $product) {
                if ($product['barcode'] !== $barcode) continue;
                foreach ($fields as $field) {
                    if (strcasecmp($product[$field], $data[$field]) !== 0) throw new LogNetworkError('product_conflict', 409);
                }
                return ['product' => $this->shopPublicProduct($product)];
            }
            if (count($products) >= 20000) throw new LogNetworkError('capacity', 409);
            do {$id = self::id();} while (isset($products[$id]));
            $record = ['id'=>$id, ...$data, 'barcode'=>$barcode, 'source'=>$source, 'ownerId'=>$personId, 'revision'=>1];
            $this->state['shopProducts'][$id] = $record;
            return ['product' => $this->shopPublicProduct($record)];
        }
        if ($action === 'shoplibrary-lookup') {
            $barcode = $input['barcode'] ?? null;
            if (!is_string($barcode) || !preg_match('/\A[0-9]{8,14}\z/', $barcode)) throw new LogNetworkError('invalid_product');
            foreach ($products as $product) if ($product['barcode'] === $barcode) return ['product'=>$this->shopPublicProduct($product)];
            return ['product'=>null];
        }
        if ($action === 'shoplibrary-products') {
            $ids = $this->shopLibraryIds($input['ids'] ?? null);
            return ['products' => array_values(array_map(fn($id) => [...$this->shopPublicProduct($products[$id]),'canRemoveBarcode'=>$products[$id]['ownerId']===$personId && $products[$id]['source']===null], array_filter($ids, fn($id) => isset($products[$id]))))];
        }
        if ($action === 'shoplibrary-barcode-remove') {
            $id = self::validId($input['id'] ?? null);
            $product = $products[$id] ?? null;
            if (!$product || $product['ownerId'] !== $personId || $product['source'] !== null) throw new LogNetworkError('barcode_protected', 403);
            if ($product['barcode'] !== null && $product['barcode'] !== ($input['barcode'] ?? null)) throw new LogNetworkError('product_conflict', 409);
            if ($product['barcode'] !== null) {
                $this->state['shopProducts'][$id]['barcode'] = null;
                $this->state['shopProducts'][$id]['revision'] = ($product['revision'] ?? 1)+1;
            }
            return ['ok' => true];
        }
        if ($action === 'shoplibrary-contacts') {
            $contacts = [];
            foreach ($this->state['relations'] as $relation) {
                if ($relation['type'] !== 'chat' || $relation['status'] !== 'active' || !in_array($personId, [$relation['fromId'], $relation['toId']], true)) continue;
                $id = $relation['fromId'] === $personId ? $relation['toId'] : $relation['fromId'];
                $grant = $this->grant($id);
                if ($grant && $grant['status'] !== 'active') continue;
                $contacts[$id] = ['id'=>$id, 'name'=>$this->state['people'][$id]['name']];
            }
            return ['contacts'=>array_values($contacts)];
        }
        if ($action === 'shoplibrary-index') {
            $visible = [];
            foreach ($collections as $row) {
                $role = $row['ownerId'] === $personId ? 'owner' : ($row['members'][$personId] ?? null);
                if ($role === null) continue;
                $visible[] = [...$this->shopCollectionView($row, $role, $products), 'archived'=>isset($row['archived'][$personId])];
            }
            return ['collections'=>$visible];
        }
        $id = self::validId($input['id'] ?? null);
        $row = $collections[$id] ?? null;
        if ($action === 'shoplibrary-create') {
            $name = $input['name'] ?? null;
            $scope = $input['scope'] ?? 'branch';
            if (!in_array($scope, ['all','branch'], true)) throw new LogNetworkError('invalid_collection');
            $categoryIds = $this->shopLibraryIds($input['categories'] ?? []);
            if ($scope === 'all') $categoryIds = [];
            $available = array_column($this->state['shopcatalogs'][$personId]['payload']['categories'] ?? [], 'id');
            if (!is_string($name) || trim($name) === '' || strlen($name) > 240 || ($scope === 'branch' && !$categoryIds) || array_diff($categoryIds, $available)) throw new LogNetworkError('invalid_collection');
            if ($row) {
                if ($row['ownerId'] !== $personId || $row['name'] !== trim($name) || $row['categories'] !== $categoryIds || ($row['scope'] ?? 'branch') !== $scope) throw new LogNetworkError('collection_conflict', 409);
                return ['ok'=>true];
            }
            if (count($collections) >= 2000) throw new LogNetworkError('capacity', 409);
            $this->state['shopCollections'][$id] = ['id'=>$id, 'name'=>trim($name), 'ownerId'=>$personId, 'categories'=>$categoryIds, 'scope'=>$scope, 'members'=>[], 'additions'=>[], 'hidden'=>[]];
            return ['ok'=>true];
        }
        $role = !$row ? null : ($row['ownerId'] === $personId ? 'owner' : ($row['members'][$personId] ?? null));
        if ($role === null) throw new LogNetworkError('collection_forbidden', 403);
        if ($action === 'shoplibrary-collection-archive') {
            $archived = $input['archived'] ?? null;
            if (!is_bool($archived)) throw new LogNetworkError('invalid_collection');
            if ($archived) $row['archived'][$personId] = true;
            else unset($row['archived'][$personId]);
        } elseif ($action === 'shoplibrary-share') {
            if ($role !== 'owner') throw new LogNetworkError('owner_required', 403);
            $target = self::validId($input['personId'] ?? null);
            $permission = $input['role'] ?? null;
            if ($target === $personId || !in_array($permission, [null,'read','write'], true)) throw new LogNetworkError('invalid_collection');
            if ($permission === null) unset($row['members'][$target], $row['archived'][$target]);
            else {
                if (count($row['members']) >= 30 && !isset($row['members'][$target])) throw new LogNetworkError('capacity', 409);
                $contacts = $this->shopLibrary('shoplibrary-contacts', [], $personId)['contacts'];
                if (!in_array($target, array_column($contacts, 'id'), true)) throw new LogNetworkError('chat_forbidden', 403);
                $row['members'][$target] = $permission;
            }
        } elseif ($action === 'shoplibrary-item') {
            if (!in_array($role, ['owner','write'], true)) throw new LogNetworkError('collection_forbidden', 403);
            $key = $input['key'] ?? null;
            $include = $input['include'] ?? null;
            if (!is_string($key) || !is_bool($include)) throw new LogNetworkError('invalid_collection');
            if ($include) {
                self::validId($key);
                if (!isset($products[$key])) throw new LogNetworkError('invalid_product');
                if (count($row['additions']) >= 500 && !isset($row['additions'][$key])) throw new LogNetworkError('capacity', 409);
                $row['additions'][$key] = true;
                unset($row['hidden'][$key]);
            } else {
                $visible = array_column($this->shopCollectionView($row, $role, $products)['products'], 'key');
                if (!in_array($key, $visible, true)) return ['ok'=>true];
                if (count($row['hidden']) >= 1000) throw new LogNetworkError('capacity', 409);
                unset($row['additions'][$key]);
                $row['hidden'][$key] = true;
            }
        } else throw new LogNetworkError('unknown_action');
        $this->state['shopCollections'][$id] = $row;
        return ['ok'=>true];
    }

    private function shopLibraryIds(mixed $ids): array {
        if (!is_array($ids) || !array_is_list($ids) || count($ids) > 500) throw new LogNetworkError('invalid_collection');
        foreach ($ids as $id) {
            if (!is_string($id) || !preg_match('/\A[a-zA-Z0-9_-]{1,160}\z/', $id)) throw new LogNetworkError('invalid_collection');
        }
        return array_values(array_unique($ids));
    }

    private function shopPublicProduct(array $product): array {
        return array_intersect_key($product, array_flip(['id','name','brand','quantity','barcode','source','revision']));
    }

    private function shopCategoryBranch(array $categories, array $todo): array {
        $seen = [];
        $entries = [];
        while ($todo) {
            $id = array_pop($todo);
            if (isset($seen[$id]) || !isset($categories[$id])) continue;
            $seen[$id] = true;
            foreach ($categories[$id]['entries'] as $entry) {
                if ($entry['type'] === 'category') $todo[] = $entry['id'];
                if ($entry['type'] === 'product') $entries[$entry['id']] = true;
            }
        }
        return [$seen, $entries];
    }

    private function shopCategoryLists(string $personId, string $categoryId, array $catalog, array $categories): array {
        [$branch, $entries] = $this->shopCategoryBranch($categories, [$categoryId]);
        $ownProducts = array_column($catalog['products'] ?? [], null, 'id');
        $byCentral = [];
        foreach ($ownProducts as $product) {
            $centralId = $product['centralId'] ?? null;
            if (is_string($centralId)) $byCentral[$centralId][] = $product;
        }
        $matches = [];
        foreach ($this->state['shoplists'] ?? [] as $row) {
            if (isset($row['archived'][$personId]) && $row['archived'][$personId]) continue;
            if ($row['ownerId'] !== $personId && !isset($row['members'][$personId])) continue;
            $payload = $this->shoplistAction('shoplist-read', ['id'=>$row['id']], $personId)['list']['payload'];
            $products = [];
            foreach ($payload['products'] as $product) {
                $sourceId = $product['catalogSourceId'] ?? null;
                $centralId = $product['centralId'] ?? null;
                $aliases = is_string($centralId) ? ($byCentral[$centralId] ?? []) : [];
                $own = $ownProducts[$product['id']] ?? (is_string($sourceId) ? ($ownProducts[$sourceId] ?? null) : null)
                    ?? (count($aliases) === 1 ? $aliases[0] : null);
                $category = $own['categoryId'] ?? $product['categoryId'];
                if (isset($branch[$category]) || ($own && isset($entries[$own['id']]))) $products[$product['id']] = $own['name'] ?? $product['name'];
            }
            $items = [];
            foreach ($payload['list']['items'] as $item) {
                if (isset($products[$item['productId']])) $items[] = ['name'=>$products[$item['productId']], 'quantity'=>$item['quantity'], 'done'=>$item['done']];
            }
            if ($items) $matches[] = ['id'=>$row['id'], 'name'=>$payload['list']['name'], 'items'=>$items];
        }
        return $matches;
    }

    private function shopCollectionView(array $row, string $role, array $products): array {
        $catalog = $this->state['shopcatalogs'][$row['ownerId']]['payload'] ?? [];
        $categories = array_column($catalog['categories'] ?? [], null, 'id');
        $whole = ($row['scope'] ?? 'branch') === 'all';
        [$seen, $entries] = $this->shopCategoryBranch($categories, $whole ? array_keys($categories) : $row['categories']);
        $visible = [];
        foreach ($catalog['products'] ?? [] as $product) {
            if (!$whole && !isset($seen[$product['categoryId']]) && !isset($entries[$product['id']])) continue;
            $central = $product['centralId'] ?? null;
            if (is_string($central) && isset($products[$central])) {
                $visible[$central] = ['key'=>$central, 'central'=>true, ...$this->shopPublicProduct($products[$central])];
            } else {
                $key = 'local-'.$product['id'];
                $visible[$key] = ['key'=>$key, 'name'=>$product['name'], 'central'=>false];
            }
        }
        foreach ($row['additions'] as $id => $_) $visible[$id] = ['key'=>$id, 'central'=>true, ...$this->shopPublicProduct($products[$id])];
        $tree = [];
        foreach ($categories as $categoryId => $category) {
            if (!isset($seen[$categoryId])) continue;
            $children = [];
            foreach ($category['entries'] as $entry) if ($entry['type'] === 'category' && isset($seen[$entry['id']])) $children[] = $entry['id'];
            $tree[] = ['id'=>$categoryId, 'name'=>$category['name'], 'children'=>array_values(array_unique($children))];
        }
        $result = ['id'=>$row['id'], 'name'=>$row['name'], 'role'=>$role, 'ownerName'=>$this->state['people'][$row['ownerId']]['name'] ?? 'Eigenaar', 'scope'=>$whole ? 'all' : 'branch', 'categories'=>$tree, 'roots'=>$whole ? [] : $row['categories'], 'products'=>array_values(array_diff_key($visible, $row['hidden']))];
        if ($role === 'owner') $result['members'] = (object)$row['members'];
        return $result;
    }

    private function shopcatalogAction(string $action,array $in,string $pid):array {
        $row=$this->state['shopcatalogs'][$pid]??['revision'=>0,'payload'=>['categories'=>[],'products'=>[],'recipes'=>[]]];
        if($action==='shopcatalog-read')return ['catalog'=>$row,'archivedCategoryIds'=>array_map('strval',array_keys($this->state['shopCategoryArchive'][$pid]??[]))];
        if($action!=='shopcatalog-put')throw new LogNetworkError('unknown_action');
        $payload=$in['payload']??null;$operation=$in['operation']??null;
        if(!is_array($payload)||strlen(json_encode($payload))>500000||!is_string($operation)||!preg_match('/\A[a-f0-9-]{36}\z/',$operation))throw new LogNetworkError('invalid_catalog');
        $ids=[];
        foreach(['categories','products','recipes'] as $group){
            if(!is_array($payload[$group]??null)||!array_is_list($payload[$group])||count($payload[$group])>5000)throw new LogNetworkError('invalid_catalog');
            foreach($payload[$group] as $item){
                if(!is_array($item)||!is_string($item['id']??null)||!preg_match('/\A[a-zA-Z0-9_-]{1,160}\z/',$item['id'])||isset($ids[$item['id']])||!is_string($item['name']??null)||strlen($item['name'])>500)throw new LogNetworkError('invalid_catalog');
                $ids[$item['id']]=$group;
            }
        }
        foreach($payload['categories'] as $c){
            if(!is_array($c['entries']??null)||!array_is_list($c['entries']))throw new LogNetworkError('invalid_catalog');
            foreach($c['entries'] as $e){if(!is_array($e)||!is_string($e['type']??null)||!is_string($e['id']??null))throw new LogNetworkError('invalid_catalog');$group=['category'=>'categories','product'=>'products','recipe'=>'recipes'][$e['type']??'']??null;if(!$group||($ids[$e['id']??'']??null)!==$group)throw new LogNetworkError('invalid_catalog');}
        }
        foreach($payload['products'] as $p){
            if (isset($p['centralId'])) {
                $central = self::validId($p['centralId']);
                if (!isset($this->state['shopProducts'][$central])) throw new LogNetworkError('invalid_catalog');
            }
            if(!is_string($p['categoryId']??null)||($ids[$p['categoryId']]??null)!=='categories'||!is_array($p['barcodes']??null)||!array_is_list($p['barcodes']))throw new LogNetworkError('invalid_catalog');
            foreach($p['barcodes'] as $b)if(!is_string($b))throw new LogNetworkError('invalid_catalog');
        }
        foreach($payload['recipes'] as $r){
            if(!is_string($r['categoryId']??null)||($ids[$r['categoryId']]??null)!=='categories'||!in_array($r['kind']??'recipe',['recipe','activity'],true)||!is_array($r['ingredients']??null)||!array_is_list($r['ingredients']))throw new LogNetworkError('invalid_catalog');
            foreach($r['ingredients'] as $i)if(!is_array($i)||!is_string($i['productId']??null)||($ids[$i['productId']]??null)!=='products'||(!is_int($i['quantity']??null)&&!is_float($i['quantity']??null))||$i['quantity']<=0||!is_string($i['note']??null))throw new LogNetworkError('invalid_catalog');
        }
        $payload=array_intersect_key($payload,array_flip(['categories','products','recipes']));
        $hash=hash('sha256',json_encode($payload));
        if(($row['operation']??null)===$operation){if(($row['hash']??null)!==$hash)throw new LogNetworkError('catalog_conflict',409);return ['catalog'=>$row];}
        if(($in['revision']??null)!==$row['revision'])throw new LogNetworkError('catalog_conflict',409);
        $row=['payload'=>$payload,'revision'=>$row['revision']+1,'operation'=>$operation,'hash'=>$hash];
        $this->state['shopcatalogs'][$pid]=$row;
        if (isset($this->state['shopCategoryArchive'][$pid])) {
            $this->state['shopCategoryArchive'][$pid] = array_intersect_key($this->state['shopCategoryArchive'][$pid], array_fill_keys(array_column($payload['categories'], 'id'), true));
        }
        return ['catalog'=>$row];
    }

    private function shoplistAction(string $action,array $in,string $pid):array {
        $rows=$this->state['shoplists']??[];
        $role=fn($row)=>$row['ownerId']===$pid?'owner':($row['members'][$pid]??null);
        if($action==='shoplist-index')return ['lists'=>array_values(array_map(fn($r)=>['id'=>$r['id'],'name'=>$r['payload']['list']['name'],'revision'=>$r['revision'],'role'=>$role($r),'archived'=>(bool)($r['archived'][$pid]??false)],array_filter($rows,fn($r)=>$role($r)!==null)))];
        $id=$in['id']??null;
        if(!is_string($id)||!preg_match('/\A[a-zA-Z0-9_-]{1,80}\z/',$id))throw new LogNetworkError('invalid_list');
        $row=$rows[$id]??null;
        if($action==='shoplist-create'){
            if($row)throw new LogNetworkError('list_exists',409);
            if(count($rows)>=10000)throw new LogNetworkError('capacity',409);
            $row=['id'=>$id,'ownerId'=>$pid,'members'=>[],'revision'=>0,'payload'=>null];
        }elseif(!$row||!$role($row))throw new LogNetworkError('list_forbidden',403);
        if($action==='shoplist-archive'){
            if(!is_bool($in['archived']??null))throw new LogNetworkError('invalid_list');
            $row['archived'][$pid]=$in['archived'];$this->state['shoplists'][$id]=$row;return ['ok'=>true];
        }
        if($action==='shoplist-leave'){
            unset($row['members'][$pid],$row['archived'][$pid],$row['memberCategories'][$pid]);
            if($row['ownerId']===$pid){
                $row['ownerId']=null;
                foreach($row['members'] as $member=>$permission)if($permission==='write'){$row['ownerId']=$member;unset($row['members'][$member]);break;}
            }
            if($row['ownerId']===null&&!count($row['members']))unset($this->state['shoplists'][$id]);
            else $this->state['shoplists'][$id]=$row;
            return ['ok'=>true];
        }
        if($action==='shoplist-read'){
            $scope=$row['memberCategories'][$pid]??null;
            if($scope!==null&&$role($row)!=='owner'){
                $payload=$row['payload'];$allowed=array_fill_keys($scope,true);
                $products=array_values(array_map(fn($p)=>array_intersect_key($p,array_flip(['id','name','categoryId','barcodes','input','centralId','centralBarcode','centralName'])),array_filter($payload['products'],fn($p)=>isset($allowed[$p['categoryId']]))));
                $productIds=array_fill_keys(array_column($products,'id'),true);
                $items=array_values(array_map(fn($i)=>array_intersect_key($i,array_flip(['id','productId','quantity','done','note'])),array_filter($payload['list']['items'],fn($i)=>isset($productIds[$i['productId']]))));
                $categories=array_values(array_map(fn($c)=>['id'=>$c['id'],'name'=>$c['name'],'entries'=>[]],array_filter($payload['categories'],fn($c)=>isset($allowed[$c['id']]))));
                // Only list content in the granted categories crosses this boundary.
                $row['payload']=['list'=>['id'=>$id,'name'=>$payload['list']['name'],'items'=>$items],'products'=>$products,'categories'=>$categories];
                unset($row['hash'],$row['operation'],$row['actor'],$row['memberCategories']);
                $row['members']=[$pid=>'read'];$row['archived']=[$pid=>(bool)($row['archived'][$pid]??false)];$row['categoryScope']=$scope;
            }
            return ['list'=>$row,'role'=>$role($row),'categorySharing'=>true];
        }
        if($action==='shoplist-share'){
            if($role($row)!=='owner')throw new LogNetworkError('owner_required',403);
            $target=self::validId($in['personId']??null);$permission=$in['role']??null;
            if($target===$pid||!in_array($permission,['read','write',null],true))throw new LogNetworkError('invalid_list');
            $scope=$in['categories']??null;
            if($scope!==null){
                if($permission!=='read'||!is_array($scope)||!array_is_list($scope)||!count($scope)||count($scope)>500)throw new LogNetworkError('invalid_list');
                $available=array_fill_keys(array_column($row['payload']['categories'],'id'),true);
                foreach($scope as $category)if(!is_string($category)||!isset($available[$category]))throw new LogNetworkError('invalid_list');
                $scope=array_values(array_unique($scope));
            }
            if($permission===null)unset($row['members'][$target],$row['memberCategories'][$target]);
            else{
                $connected=false;
                foreach($this->state['relations'] as $r)if($r['type']==='chat'&&$r['status']==='active'&&in_array($pid,[$r['fromId'],$r['toId']],true)&&in_array($target,[$r['fromId'],$r['toId']],true))$connected=true;
                $grant=$this->grant($target);
                if(!$connected||($grant&&$grant['status']!=='active'))throw new LogNetworkError('chat_forbidden',403);
                $row['members'][$target]=$permission;
                if($scope===null)unset($row['memberCategories'][$target]);else $row['memberCategories'][$target]=$scope;
            }
            $this->state['shoplists'][$id]=$row;return ['ok'=>true];
        }
        if(!in_array($action,['shoplist-create','shoplist-put'],true))throw new LogNetworkError('unknown_action');
        if(!in_array($role($row),['owner','write'],true)||($role($row)!=='owner'&&isset($row['memberCategories'][$pid])))throw new LogNetworkError('list_read_only',403);
        $payload=$in['payload']??null;$operation=$in['operation']??null;
        if(!is_array($payload)||!is_array($payload['list']??null)||($payload['list']['id']??null)!==$id||!is_string($payload['list']['name']??null)||strlen($payload['list']['name'])>240||!is_array($payload['list']['items']??null)||!array_is_list($payload['list']['items'])||count($payload['list']['items'])>500||!is_array($payload['products']??null)||!array_is_list($payload['products'])||!is_array($payload['categories']??null)||!array_is_list($payload['categories'])||strlen(json_encode($payload))>180000||!is_string($operation)||!preg_match('/\A[a-f0-9-]{36}\z/',$operation))throw new LogNetworkError('invalid_list');
        $categories=[];$products=[];$items=[];
        foreach($payload['categories'] as $c){if(!is_array($c)||!is_string($c['id']??null)||!is_string($c['name']??null)||isset($categories[$c['id']]))throw new LogNetworkError('invalid_list');$categories[$c['id']]=true;}
        foreach($payload['products'] as $product){if(!is_array($product)||!is_string($product['id']??null)||!is_string($product['name']??null)||!is_string($product['categoryId']??null)||!isset($categories[$product['categoryId']])||!is_array($product['barcodes']??null)||isset($products[$product['id']]))throw new LogNetworkError('invalid_list');foreach($product['barcodes'] as $code)if(!is_string($code))throw new LogNetworkError('invalid_list');$products[$product['id']]=true;}
        foreach($payload['list']['items'] as $item){if(!is_array($item)||!is_string($item['id']??null)||isset($items[$item['id']])||!is_string($item['productId']??null)||!isset($products[$item['productId']])||(!is_int($item['quantity']??null)&&!is_float($item['quantity']??null))||$item['quantity']<=0||!is_bool($item['done']??null)||!is_string($item['note']??null))throw new LogNetworkError('invalid_list');$items[$item['id']]=true;}
        $hash=hash('sha256',json_encode($payload));
        if(($row['operation']??null)===$operation){if(($row['actor']??null)!==$pid||$row['hash']!==$hash)throw new LogNetworkError('list_conflict',409);return ['list'=>$row,'role'=>$role($row)];}
        if(($in['revision']??null)!==$row['revision'])throw new LogNetworkError('list_conflict',409);
        $row['payload']=$payload;$row['revision']++;$row['operation']=$operation;$row['actor']=$pid;$row['hash']=$hash;
        $this->state['shoplists'][$id]=$row;
        return ['list'=>$row,'role'=>$role($row)];
    }

    private function shareAction(string $action,array $in,?string $owner=null):array {
        $id=self::validId($in['id']??null);$access=$in['access']??'';
        if(!is_string($access)||!preg_match('/\A[A-Za-z0-9_-]{43}\z/',$access))throw new LogNetworkError('invalid_token');
        $dir=dirname($this->path).'/shares';
        if(is_link($dir))throw new RuntimeException('Invalid storage');
        if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))throw new RuntimeException('Storage unavailable');
        // New files retain only the hash, not the bearer identifier used as the key.
        $path=$dir.'/'.hash('sha256',$id).'.json';
        $legacy=$dir.'/'.$id.'.json';
        if(is_link($path)||is_link($legacy))throw new RuntimeException('Invalid storage');
        if(!is_file($path)&&is_file($legacy))$path=$legacy;
        $old=is_file($path)?json_decode(file_get_contents($path),true,16,JSON_THROW_ON_ERROR):null;
        if($action==='share-publish'){
            $payload=$in['payload']??null;
            if(!is_array($payload)||!is_string($payload['iv']??null)||!preg_match('/\A[A-Za-z0-9_-]{16}\z/',$payload['iv'])||!is_string($payload['data']??null)||!preg_match('/\A[A-Za-z0-9_-]{22,12000}\z/',$payload['data']))throw new LogNetworkError('invalid_payload');
            if($old)throw new LogNetworkError('identity_exists',409);
            $files=glob($dir.'/*.json')?:[];$count=0;
            foreach($files as $file){if(is_link($file))continue;$row=json_decode(file_get_contents($file),true);if(($row['until']??0)<=$this->now()){@unlink($file);continue;}$count++;}
            if($count>=1000)throw new LogNetworkError('capacity',409);
            if(!write_json($path,['owner'=>$owner,'accessHash'=>hash('sha256',$access),'until'=>$this->now()+7*86400,'payload'=>['iv'=>$payload['iv'],'data'=>$payload['data']]]))throw new RuntimeException('Commit failed');
            @chmod($path,0600);
            foreach($this->state['shareCodes']??[] as $code=>$until)if($until<$this->now()-86400)unset($this->state['shareCodes'][$code]);
            $this->state['shareCodes'][hash('sha256',$id)]=$this->now()+7*86400;return ['ok'=>true];
        }
        if(!$old){if($action==='share-ack')return ['ok'=>true];throw new LogNetworkError('share_unavailable',410);}
        if(!hash_equals($old['accessHash'],hash('sha256',$access)))throw new LogNetworkError('unauthorized',403);
        if($old['until']<=$this->now()){if(!unlink($path))throw new RuntimeException('Delete failed');throw new LogNetworkError('share_unavailable',410);}
        if($action==='share-ack'){if(!unlink($path))throw new RuntimeException('Delete failed');return ['ok'=>true];}
        return ['payload'=>$old['payload']];
    }

    // Pairing secrets are one-use capabilities; permanent Shop credentials are
    // generated and durably saved by Shop before the claim, never copied from Sharon.
    private function shopPairAction(string $action,array $in,?array $person=null):array {
        $now=$this->now();
        $this->state['shopDevices']??=[];
        foreach($this->state['shopDevices'] as $id=>$r)
            if($r['status']!=='active' && $r['until']<=$now)unset($this->state['shopDevices'][$id]);
        $this->state['shopPairCodes']??=[];
        foreach($this->state['shopPairCodes'] as $hash=>$invite)if($invite['until']<=$now||!isset($this->state['shopDevices'][$invite['id']]))unset($this->state['shopPairCodes'][$hash]);
        if(in_array($action,['shop-pair-probe','shop-pair-redeem'],true)){
            $code=self::validId($in['code']??null);$entry=$this->state['shopPairCodes'][hash('sha256',$code)]??null;
            if($action==='shop-pair-probe')return ['valid'=>$entry!==null];
            if(!$entry)throw new LogNetworkError('pair_expired',410);
            $id=$entry['id'];$r=$this->state['shopDevices'][$id];
            $p=$this->state['people'][$r['personId']]??null;$grant=$p?$this->grant($p['id']):null;
            if(!$p||($grant&&$grant['status']!=='active'))throw new LogNetworkError('unauthorized',401);
            if (!$this->personAccount($p['id'])) throw new LogNetworkError('account_required',401);
            $hash=self::hashToken($in['deviceToken']??null);
            foreach($this->state['people'] as $person)if($person['tokenHash']===$hash)throw new LogNetworkError('invalid_token');
            foreach($this->state['shopDevices'] as $other)if($other['id']!==$id&&$other['tokenHash']===$hash)throw new LogNetworkError('invalid_token');
            if($r['tokenHash']!==null&&$r['tokenHash']!==$hash)throw new LogNetworkError('pair_used',409);
            $r['tokenHash']=$hash;$r['status']='ready';$this->state['shopDevices'][$id]=$r;
            return ['id'=>$id,'self'=>['personId'=>$p['id'],'name'=>$p['name']]];
        }
        if($action==='shop-pair-create'){
            $pid=$person['id'];$this->rate('shop-pair:'.$pid,10,600);
            if(count(array_filter($this->state['shopDevices'],fn($r)=>$r['personId']===$pid))>=20)throw new LogNetworkError('pair_capacity',409);
            if(($in['format']??'')==='compact'){
                $id=self::id();do{$code=self::id();$hash=hash('sha256',$code);}while(isset($this->state['shopPairCodes'][$hash])||isset($this->state['shareCodes'][$hash])||isset($this->state['invitationCodes'][$hash]));
                $until=$now+7*86400;
                $this->state['shopDevices'][$id]=['id'=>$id,'personId'=>$pid,'tokenHash'=>null,'status'=>'pending','compact'=>true,'until'=>$until,'createdAt'=>$now];
                $this->state['shopPairCodes'][$hash]=['id'=>$id,'until'=>$until];
                return ['id'=>$id,'code'=>$code,'expiresAt'=>$until*1000];
            }
            $id=self::id();$code=self::token();
            $this->state['shopDevices'][$id]=['id'=>$id,'personId'=>$pid,'codeHash'=>self::hashToken($code),'tokenHash'=>null,'status'=>'pending','until'=>$now+300,'createdAt'=>$now];
            return ['id'=>$id,'code'=>'SP1.' . $id . '.' . $code,'expiresAt'=>($now+300)*1000];
        }
        if($action==='shop-pair-list')return ['devices'=>array_values(array_map(fn($r)=>['id'=>$r['id'],'status'=>$r['status'],'compact'=>$r['compact']??false,'connectedAt'=>isset($r['connectedAt'])?$r['connectedAt']*1000:null,'fingerprint'=>$r['tokenHash']?strtoupper(substr($r['tokenHash'],0,8)):null,'expiresAt'=>$r['until']*1000,'createdAt'=>$r['createdAt']*1000],array_filter($this->state['shopDevices'],fn($r)=>$r['personId']===$person['id'])))];
        $id=self::validId($in['id']??null);$r=$this->state['shopDevices'][$id]??null;
        if(!$r)throw new LogNetworkError('pair_expired',410);
        if($action==='shop-pair-claim'){
            if(($r['compact']??false)||$r['until']<=$now||!hash_equals($r['codeHash'],self::hashToken($in['code']??null)))throw new LogNetworkError('pair_expired',410);
            $hash=self::hashToken($in['deviceToken']??null);
            foreach($this->state['people'] as $p)if(hash_equals($p['tokenHash'],$hash))throw new LogNetworkError('invalid_token');
            foreach($this->state['shopDevices'] as $other)if($other['id']!==$id&&$other['tokenHash']===$hash)throw new LogNetworkError('invalid_token');
            if($r['tokenHash']!==null&&!hash_equals($r['tokenHash'],$hash))throw new LogNetworkError('pair_used',409);
            // Retry by the same device is safe after a lost response.
            if($r['status']==='pending'){$r['tokenHash']=$hash;$r['status']='claimed';$this->state['shopDevices'][$id]=$r;}
            return ['status'=>$r['status'],'fingerprint'=>strtoupper(substr($hash,0,8))];
        }
        if($r['personId']!==$person['id'])throw new LogNetworkError('unauthorized',403);
        if($action==='shop-pair-revoke'){foreach($this->state['shopPairCodes'] as $h=>$c)if($c['id']===$id)unset($this->state['shopPairCodes'][$h]);unset($this->state['shopDevices'][$id]);return ['ok'=>true];}
        if($action==='shop-pair-confirm'){
            if(!in_array($r['status'],['claimed','active'],true))throw new LogNetworkError('pair_pending',409);
            if(($in['fingerprint']??'')!==strtoupper(substr($r['tokenHash'],0,8)))throw new LogNetworkError('pair_pending',409);
            $this->state['shopDevices'][$id]['status']='active';return ['ok'=>true];
        }
        throw new LogNetworkError('unknown_action');
    }
    private function shopDevice(string $action,array $in,?string $auth):?array {
        if(!$auth)return null;
        $hash=self::hashToken($auth);
        foreach($this->state['shopDevices']??[] as $r){
            if($r['tokenHash']!==$hash)continue;
            if(($r['compact']??false)&&$r['status']==='ready'&&$r['until']<=$this->now())throw new LogNetworkError('pair_expired',410);
            if($r['status']!=='active'&&!($r['status']==='ready'&&in_array($action,['shop-device-self','shop-device-ack','shop-device-revoke'],true)))throw new LogNetworkError('pair_pending',403);
            $p=$this->state['people'][$r['personId']]??null;$grant=$p?$this->grant($p['id']):null;
            if(!$p||($grant&&$grant['status']!=='active'))throw new LogNetworkError('unauthorized',401);
            if (!$this->personAccount($p['id'])) throw new LogNetworkError('account_required',401);
            if($action==='shop-device-ack'){
                if(!($r['compact']??false))throw new LogNetworkError('shop_scope',403);
                if($r['status']!=='active'){$this->state['shopDevices'][$r['id']]['status']='active';$this->state['shopDevices'][$r['id']]['connectedAt']=$this->now();}
                foreach($this->state['shopPairCodes']??[] as $h=>$c)if($c['id']===$r['id'])unset($this->state['shopPairCodes'][$h]);
                return ['ok'=>true];
            }
            if($action==='shop-device-revoke'){foreach($this->state['shopPairCodes']??[] as $h=>$c)if($c['id']===$r['id'])unset($this->state['shopPairCodes'][$h]);unset($this->state['shopDevices'][$r['id']]);return ['ok'=>true];}
            if($action==='shop-device-self')return ['self'=>['personId'=>$p['id'],'name'=>$p['name']],'needsAck'=>$r['status']==='ready'];
            if(str_starts_with($action,'shoplibrary-'))return $this->shopLibrary($action,$in,$p['id']);
            if(str_starts_with($action,'shopcatalog-'))return $this->shopcatalogAction($action,$in,$p['id']);
            if(!in_array($action,['shoplist-index','shoplist-read','shoplist-create','shoplist-put','shoplist-archive','shoplist-leave'],true))throw new LogNetworkError('shop_scope',403);
            return $this->shoplistAction($action,$in,$p['id']);
        }
        return null;
    }
    private static function accountEmail(array $input): string {
        $email = $input['email'] ?? null;
        if (!is_string($email) || strlen($email) > 254 || !filter_var(trim($email), FILTER_VALIDATE_EMAIL)) {
            throw new LogNetworkError('account_email');
        }
        return strtolower(trim($email));
    }
    private static function accountPassword(array $input): string {
        $password = $input['password'] ?? null;
        if (!is_string($password) || strlen($password) < 12 || strlen($password) > 72 || str_contains($password, "\0")) {
            throw new LogNetworkError('account_password');
        }
        return $password;
    }
    private function publicAccount(array $account): array {
        return ['id'=>$account['id'], 'email'=>$account['email'], 'personId'=>$account['personId'] ?? null];
    }
    private function sessionAccount(?string $token): ?array {
        if ($token === null || !preg_match('/\A[A-Za-z0-9_-]{43}\z/', $token)) return null;
        $hash = self::hashToken($token);
        $session = $this->state['accountSessions'][$hash] ?? null;
        if (!$session || $session['until'] <= $this->now()) {
            unset($this->state['accountSessions'][$hash]);
            return null;
        }
        $account = $this->state['accounts'][$session['account']] ?? null;
        return $account && !isset($account['verification']) ? $account : null;
    }
    private function personAccount(string $personId): ?array {
        foreach ($this->state['accounts'] ?? [] as $account) {
            if (($account['personId'] ?? null) === $personId && !isset($account['verification'])) return $account;
        }
        return null;
    }
    private function requireAccount(array $person, ?string $sessionToken): array {
        $account = $this->sessionAccount($sessionToken);
        if (!$account) throw new LogNetworkError('account_required',401);
        if (($account['personId'] ?? null) !== $person['id']) throw new LogNetworkError('account_identity_conflict',409);
        return $account;
    }
    private function bindAccountPerson(array &$account, array $input): void {
        $id = self::validId($input['personId'] ?? null);
        $hash = self::hashToken($input['deviceToken'] ?? null);
        if (isset($account['personId']) && $account['personId'] !== $id) throw new LogNetworkError('account_identity_conflict',409);
        foreach ($this->state['accounts'] ?? [] as $other) {
            if (($other['personId'] ?? null) === $id && $other['id'] !== $account['id']) throw new LogNetworkError('account_identity_conflict',409);
        }
        $existing = $this->state['people'][$id] ?? null;
        if ($existing) {
            if (!hash_equals($existing['tokenHash'], $hash)) throw new LogNetworkError('account_identity_conflict',409);
            $this->person($input['deviceToken']);
        } else {
            $name = $input['name'] ?? '';
            if (!is_string($name) || trim($name)==='' || strlen($name)>240 || !preg_match('//u',$name) || preg_match('/[\x00-\x1f\x7f]/',$name)) throw new LogNetworkError('invalid_name');
            foreach ($this->state['people'] as $person) if (hash_equals($person['tokenHash'],$hash)) throw new LogNetworkError('account_identity_conflict',409);
            if (count($this->state['people']) >= 10000) throw new LogNetworkError('capacity',409);
            $this->state['people'][$id] = ['id'=>$id,'name'=>trim($name),'tokenHash'=>$hash];
        }
        $account['personId'] = $id;
    }
    private function queueAccountMail(string $accountKey, string $kind): void {
        $account = &$this->state['accounts'][$accountKey];
        $code = self::token();
        $expires = $this->now() + 3600;
        $field = $kind === 'verify' ? 'verification' : 'reset';
        $account[$field] = ['hash'=>self::hashToken($code),'until'=>$expires];
        foreach ($this->state['accountMail'] ?? [] as $id=>$item) {
            if ($item['account'] === $accountKey && $item['kind'] === $kind) unset($this->state['accountMail'][$id]);
        }
        $this->state['accountMail'][self::id()] = [
            'account'=>$accountKey,'kind'=>$kind,'email'=>$account['email'],'code'=>$code,
            'until'=>$expires,'attempt'=>0,'retryAt'=>$this->now(),
        ];
    }
    public function deliverAccountMail(callable $sender): array {
        return $this->transaction(function () use ($sender) {
            $sent=0; $attempted=0;
            foreach ($this->state['accountMail'] ?? [] as $id=>$item) {
                if ($item['until'] <= $this->now()) { unset($this->state['accountMail'][$id]); continue; }
                if ($item['retryAt'] > $this->now()) continue;
                if ($attempted >= 5) break;
                $attempted++;
                try { $delivered = $sender($item); } catch (Throwable $error) { $delivered=false; }
                if ($delivered) { unset($this->state['accountMail'][$id]); $sent++; continue; }
                $attempt=$item['attempt']+1;
                $this->state['accountMail'][$id]['attempt']=$attempt;
                $this->state['accountMail'][$id]['retryAt']=$this->now()+min(900,30*(2**min($attempt,5)));
            }
            return ['sent'=>$sent,'pending'=>count($this->state['accountMail'] ?? [])];
        });
    }
    private function clearAccountSessions(string $key): void {
        foreach ($this->state['accountSessions'] ?? [] as $hash=>$session) {
            if ($session['account'] === $key || $session['until'] <= $this->now()) unset($this->state['accountSessions'][$hash]);
        }
    }
    public function redeemAccountAppCode(string $app, string $code): array {
        return $this->transaction(function () use ($app,$code) {
            if ($app !== 'eventline' || !preg_match('/\A[A-Za-z0-9_-]{43}\z/',$code)) throw new LogNetworkError('account_verification',403);
            $hash = self::hashToken($code);
            $ticket = $this->state['accountAppCodes'][$hash] ?? null;
            if (!$ticket || $ticket['app'] !== $app || $ticket['until'] <= $this->now()) throw new LogNetworkError('account_verification',403);
            $session = $this->state['accountSessions'][$ticket['session']] ?? null;
            $account = $this->state['accounts'][$ticket['account']] ?? null;
            if (!$session || $session['until'] <= $this->now() || $session['account'] !== $ticket['account'] || !$account || isset($account['verification'])) throw new LogNetworkError('account_required',401);
            unset($this->state['accountAppCodes'][$hash]);
            $person = $this->state['people'][$account['personId']] ?? null;
            if (!$person) throw new LogNetworkError('account_identity_conflict',409);
            return ['account' => $this->publicAccount($account) + ['name'=>$person['name']]];
        });
    }
    private function accountAction(string $action, array $input, ?string $sessionToken): array {
        if ($action === 'account-app-code') {
            $account = $this->sessionAccount($sessionToken);
            if (!$account || !isset($account['personId'])) throw new LogNetworkError('account_required',401);
            if (($input['app'] ?? null) !== 'eventline') throw new LogNetworkError('unknown_action',404);
            foreach ($this->state['accountAppCodes'] ?? [] as $hash=>$ticket) if ($ticket['until'] <= $this->now()) unset($this->state['accountAppCodes'][$hash]);
            if (count($this->state['accountAppCodes'] ?? []) >= 10000) throw new LogNetworkError('capacity',409);
            $code = self::token();
            $this->state['accountAppCodes'][self::hashToken($code)] = ['app'=>'eventline','account'=>hash('sha256',$account['email']),
                'session'=>self::hashToken($sessionToken),'until'=>$this->now()+60];
            return ['code'=>$code];
        }
        if ($action === 'account-status') return ['account'=>($account=$this->sessionAccount($sessionToken)) ? $this->publicAccount($account) : null];
        if ($action === 'account-logout') {
            if ($sessionToken !== null && preg_match('/\A[A-Za-z0-9_-]{43}\z/',$sessionToken)) unset($this->state['accountSessions'][self::hashToken($sessionToken)]);
            return ['account'=>null];
        }
        if (!in_array($action,['account-register','account-login','account-verify','account-resend','account-forgot','account-reset'],true)) throw new LogNetworkError('unknown_action',404);
        $email=self::accountEmail($input); $key=hash('sha256',$email);
        $account=$this->state['accounts'][$key] ?? null;
        if ($action === 'account-register') {
            $password=self::accountPassword($input);
            if ($account) return ['ok'=>true];
            if (count($this->state['accounts'] ?? []) >= 10000) throw new LogNetworkError('capacity',409);
            $this->state['accounts'][$key]=['id'=>self::id(),'email'=>$email,'password'=>password_hash($password,PASSWORD_DEFAULT)];
            $this->queueAccountMail($key,'verify');
            return ['ok'=>true];
        }
        if ($action === 'account-resend' || $action === 'account-forgot') {
            if ($account) {
                $kind=$action === 'account-forgot' ? 'reset' : 'verify';
                if ($action === 'account-forgot' || isset($account['verification'])) $this->queueAccountMail($key,$kind);
            }
            return ['ok'=>true];
        }
        if ($action === 'account-verify' || $action === 'account-reset') {
            $field=$action === 'account-verify' ? 'verification' : 'reset';
            $code=$input['code'] ?? null; $entry=$account[$field] ?? null;
            if (!$entry || $entry['until'] <= $this->now() || !is_string($code) || !preg_match('/\A[A-Za-z0-9_-]{43}\z/',$code) || !hash_equals($entry['hash'],self::hashToken($code))) throw new LogNetworkError('account_verification',403);
            $this->state['accounts'][$key]['password']=password_hash(self::accountPassword($input),PASSWORD_DEFAULT);
            $this->clearAccountSessions($key);
            unset($this->state['accounts'][$key][$field]);
            if ($field === 'reset') unset($this->state['accounts'][$key]['verification']);
            foreach ($this->state['accountMail'] ?? [] as $id=>$item) if ($item['account'] === $key && ($field === 'reset' || $item['kind'] === 'verify')) unset($this->state['accountMail'][$id]);
            return ['ok'=>true];
        }
        $password=self::accountPassword($input);
        $dummy='$2y$10$w/2f1WSqy3D8lR2WRjEth.Nhphm91cM3FrEzg1YKItZq/ekKOQZfK';
        if (!password_verify($password,$account['password'] ?? $dummy) || !$account) throw new LogNetworkError('account_credentials',401);
        if (isset($account['verification'])) throw new LogNetworkError('account_unverified',403);
        $this->bindAccountPerson($account,$input);
        $this->state['accounts'][$key]=$account;
        foreach ($this->state['accountSessions'] ?? [] as $hash=>$session) if ($session['until'] <= $this->now()) unset($this->state['accountSessions'][$hash]);
        if ($sessionToken !== null && preg_match('/\A[A-Za-z0-9_-]{43}\z/',$sessionToken)) unset($this->state['accountSessions'][self::hashToken($sessionToken)]);
        $token=self::token();
        $this->state['accountSessions'][self::hashToken($token)]=['account'=>$key,'until'=>$this->now()+7200];
        return ['account'=>$this->publicAccount($account),'sessionToken'=>$token];
    }
    public function handle(string $action, array $in, ?string $auth, ?string $accountToken = null): array {
        return $this->transaction(function () use ($action,$in,$auth,$accountToken) {
            if (str_starts_with($action, 'account-')) return $this->accountAction($action, $in, $accountToken);
            if(in_array($action,['shop-pair-claim','shop-pair-probe','shop-pair-redeem'],true))return $this->shopPairAction($action,$in);
            $delegated=$this->shopDevice($action,$in,$auth);if($delegated!==null)return $delegated;
            if($action==='share-check'){$id=self::validId($in['id']??null);return ['valid'=>isset($this->state['shareCodes'][hash('sha256',$id)])];}
            if(in_array($action,['share-read','share-ack'],true))return $this->shareAction($action,$in);
            if ($action==='invite-code-check') {
                $id=self::validId($in['id'] ?? null);
                // Reveal only whether this is a contact code, never the invitation.
                return ['valid'=>isset($this->state['invitationCodes'][hash('sha256',$id)])];
            }
            if ($action==='invitation-resolve') {
                $id=self::validId($in['id'] ?? null);
                $link=$this->state['invitationLinks'][$id] ?? null;
                if (!$link || $link['until']<=$this->now()) throw new LogNetworkError('invalid_reference',410);
                return ['payload'=>$link['payload']];
            }
            if ($action==='register') {
                $id=self::validId($in['personId'] ?? null); $hash=self::hashToken($in['deviceToken'] ?? null);
                $name=$in['name'] ?? '';
                if (!is_string($name) || strlen($name)>240 || !preg_match('//u',$name) || trim($name)==='' ||
                    preg_match('/[\x00-\x1f\x7f]/',$name)) throw new LogNetworkError('invalid_name');
                $old=$this->state['people'][$id] ?? null;
                if ($old && !hash_equals($old['tokenHash'],$hash)) throw new LogNetworkError('identity_exists',409);
                if (!$old) {
                    if (count($this->state['people'])>=10000) throw new LogNetworkError('capacity',409);
                    foreach ($this->state['people'] as $p) if (hash_equals($p['tokenHash'],$hash)) throw new LogNetworkError('identity_exists',409);
                    $this->state['people'][$id]=['id'=>$id,'name'=>trim($name),'tokenHash'=>$hash];
                }
                return ['self'=>$this->selfData($this->person($in['deviceToken']))];
            }
            $p=$this->person($auth); $pid=$p['id'];
            if ($action==='bootstrap' || $action==='accept' || $action==='accept-code') {
                if ($action==='accept-code') {
                    $code=$this->state['invitationCodes'][hash('sha256',self::validId($in['id'] ?? null))] ?? null;
                    if (!$code) throw new LogNetworkError('invalid_invitation',403);
                    if ($code['until']<=$this->now()) throw new LogNetworkError('invitation_expired',410);
                    $hash=$code['invitationHash'];
                } else {
                    if (self::validId($in['networkId'] ?? null)!==$this->state['id']) throw new LogNetworkError('wrong_network',403);
                    $hash=self::hashToken($in['token'] ?? null);
                }
                if ($action==='bootstrap') {
                    $start=$this->state['bootstrap'];
                    if (!$start || !hash_equals($start['hash'],$hash)) throw new LogNetworkError('invalid_invitation',403);
                    if ($this->state['ownerId']!==null && $this->state['ownerId']!==$pid) throw new LogNetworkError('invitation_used',409);
                    if ($this->state['ownerId']===null) {
                        if ($start['until']<=$this->now()) throw new LogNetworkError('invitation_expired',410);
                        $this->state['ownerId']=$pid; $this->state['bootstrap']['claimedBy']=$pid;
                    }
                } else {
                    $invite=$this->state['invitations'][$hash] ?? null;
                    if (!$invite || ($invite['recipientId']!==null && $invite['recipientId']!==$pid) || $invite['issuerId']===$pid) throw new LogNetworkError('invalid_invitation',403);
                    $issuer=$this->state['people'][$invite['issuerId']] ?? null;
                    $grant=$issuer ? $this->grant($issuer['id']) : null;
                    if (!$issuer || ($grant && $grant['status']!=='active') || $this->line($issuer['id'])===null)
                        throw new LogNetworkError('invalid_invitation',403);
                    if ($invite['claimedAt']===null) {
                        if ($invite['until']<=$this->now()) throw new LogNetworkError('invitation_expired',410);
                        if ($this->line($pid)===null) {
                            if ($this->line($issuer['id'])>=3) throw new LogNetworkError('depth_limit',403);
                            if ($this->peopleCount()>=100) throw new LogNetworkError('capacity',409);
                            $r=$this->relation($issuer['id'],$pid,'grants-access');
                            $this->state['relations'][$r['id']]=$r;
                        }
                        $pair=[$issuer['id'],$pid]; sort($pair,SORT_STRING); $exists=false;
                        foreach ($this->state['relations'] as $r) if ($r['type']==='chat' && [$r['fromId'],$r['toId']]===$pair) $exists=true;
                        if (!$exists) { $r=$this->relation($pair[0],$pair[1],'chat'); $this->state['relations'][$r['id']]=$r; }
                        $this->state['invitations'][$hash]['recipientId']=$pid;
                        $this->state['invitations'][$hash]['claimedAt']=$this->now();
                    }
                }
                $contact=null;
                if ($action!=='bootstrap') foreach ($this->state['relations'] as $r) {
                    if ($r['type']==='chat' && in_array($pid,[$r['fromId'],$r['toId']],true) &&
                        in_array($issuer['id'],[$r['fromId'],$r['toId']],true))
                        $contact=['chatId'=>$r['id'],'personId'=>$issuer['id'],'name'=>$issuer['name']];
                }
                return ['self'=>$this->selfData($this->person($auth)),'contact'=>$contact];
            }
            if ($action==='self') return ['self'=>$this->selfData($p)];
            if (str_starts_with($action,'shop')) $this->requireAccount($p,$accountToken);
            else $this->member($p);
            if(str_starts_with($action,'shop-pair-'))return $this->shopPairAction($action,$in,$p);
            if(str_starts_with($action,'shoplibrary-'))return $this->shopLibrary($action,$in,$pid);
            if(str_starts_with($action,'shopcatalog-'))return $this->shopcatalogAction($action,$in,$pid);
            if(str_starts_with($action,'shoplist-'))return $this->shoplistAction($action,$in,$pid);
            if($action==='share-publish')return $this->shareAction($action,$in,$pid);
            if (in_array($action,['information-summary','information-feedback','information-policy'],true))
                return $this->informationAction($action,$in,$pid);
            if ($action==='set-access') {
                if ($pid!==$this->state['ownerId']) throw new LogNetworkError('owner_required',403);
                $target=self::validId($in['personId'] ?? null); $status=$in['status'] ?? null;
                if (!in_array($status,['active','revoked'],true)) throw new LogNetworkError('invalid_status');
                $r=$this->grant($target); if (!$r) throw new LogNetworkError('recipient_unknown',404);
                $this->state['relations'][$r['id']]['status']=$status;
                return ['ok'=>true];
            }
            if ($action==='invite') {
                $recipient=isset($in['recipientId']) ? self::validId($in['recipientId']) : null;
                $grant=$recipient ? $this->grant($recipient) : null;
                if ($recipient!==null && ($recipient===$pid || !isset($this->state['people'][$recipient]) || ($grant && $grant['status']!=='active')))
                    throw new LogNetworkError('recipient_unknown',404);
                if ($recipient!==null && $this->line($recipient)===null) {
                    if ($this->line($pid)>=3) throw new LogNetworkError('depth_limit',403);
                    if ($this->peopleCount()>=100) throw new LogNetworkError('capacity',409);
                }
                $token=self::token(); $until=$this->now()+86400;
                $this->state['invitations'][self::hashToken($token)]=['issuerId'=>$pid,'recipientId'=>$recipient,'until'=>$until,'claimedAt'=>null];
                return ['invitation'=>['v'=>1,'kind'=>'invite','networkId'=>$this->state['id'],
                    'token'=>$token,'expiresAt'=>$until*1000,...($recipient ? ['recipientId'=>$recipient] : [])]];
            }
            if ($action==='invite-code') {
                $hash=self::hashToken($in['token'] ?? null);
                $invite=$this->state['invitations'][$hash] ?? null;
                if (!$invite || $invite['issuerId']!==$pid || $invite['until']<=$this->now() || $invite['claimedAt']!==null) throw new LogNetworkError('invalid_invitation',403);
                foreach ($this->state['invitationCodes'] ?? [] as $key=>$code) if ($code['until']<=$this->now()) unset($this->state['invitationCodes'][$key]);
                if (count($this->state['invitationCodes'] ?? [])>=10000) throw new LogNetworkError('capacity',409);
                do { $id=self::id(); $codeHash=hash('sha256',$id); } while (isset($this->state['invitationCodes'][$codeHash]));
                $this->state['invitationCodes'][$codeHash]=['invitationHash'=>$hash,'until'=>$invite['until']];
                return ['id'=>$id];
            }
            if ($action==='invitation-publish') {
                $id=self::validId($in['id'] ?? null);
                $invite=$this->state['invitations'][self::hashToken($in['token'] ?? null)] ?? null;
                if (!$invite || $invite['issuerId']!==$pid || $invite['until']<=$this->now() || $invite['claimedAt']!==null) throw new LogNetworkError('invalid_invitation',403);
                $payload=$in['payload'] ?? null;
                if (!is_array($payload) || ($payload['v'] ?? null)!==1 ||
                    !is_string($payload['iv'] ?? null) || !preg_match('/\A[A-Za-z0-9_-]{16}\z/',$payload['iv']) ||
                    !is_string($payload['data'] ?? null) || strlen($payload['data'])>3000 || !preg_match('/\A[A-Za-z0-9_-]{24,}\z/',$payload['data'])) throw new LogNetworkError('invalid_reference');
                foreach ($this->state['invitationLinks'] ?? [] as $key=>$link) if ($link['until']<=$this->now()) unset($this->state['invitationLinks'][$key]);
                if (isset($this->state['invitationLinks'][$id])) throw new LogNetworkError('identity_exists',409);
                if (count($this->state['invitationLinks'] ?? [])>=10000) throw new LogNetworkError('capacity',409);
                $this->state['invitationLinks'][$id]=['until'=>$invite['until'],'payload'=>['v'=>1,'iv'=>$payload['iv'],'data'=>$payload['data']]];
                return ['ok'=>true];
            }
            if ($action==='invite-status') {
                $invite=$this->state['invitations'][self::hashToken($in['token'] ?? null)] ?? null;
                if (!$invite || $invite['issuerId']!==$pid) throw new LogNetworkError('invalid_invitation',403);
                if ($invite['claimedAt']===null) return ['claimed'=>false,'expired'=>$invite['until']<=$this->now()];
                $other=$invite['recipientId']; $grant=$this->grant($other);
                if ($grant && $grant['status']!=='active') throw new LogNetworkError('unauthorized',403);
                foreach ($this->state['relations'] as $r) {
                    if ($r['type']==='chat' && $r['status']==='active' &&
                        in_array($pid,[$r['fromId'],$r['toId']],true) && in_array($other,[$r['fromId'],$r['toId']],true))
                        return ['claimed'=>true,'contact'=>['chatId'=>$r['id'],'personId'=>$other,'name'=>$this->state['people'][$other]['name']]];
                }
                throw new LogNetworkError('chat_forbidden',403);
            }
            if ($action==='contacts') {
                $contacts=[];
                foreach ($this->state['relations'] as $r) {
                    if ($r['type']!=='chat' || $r['status']!=='active' || !in_array($pid,[$r['fromId'],$r['toId']],true)) continue;
                    $other=$r['fromId']===$pid ? $r['toId'] : $r['fromId']; $grant=$this->grant($other);
                    if ($grant && $grant['status']!=='active') continue;
                    $contacts[]=['chatId'=>$r['id'],'personId'=>$other,'name'=>$this->state['people'][$other]['name']];
                }
                usort($contacts,fn($a,$b)=>[$a['name'],$a['personId']]<=>[$b['name'],$b['personId']]);
                return ['contacts'=>$contacts];
            }
            if ($action==='messages' || $action==='send') {
                $chatId=self::validId($in['chatId'] ?? null); $chat=$this->state['relations'][$chatId] ?? null;
                if (!$chat || $chat['type']!=='chat' || $chat['status']!=='active' || !in_array($pid,[$chat['fromId'],$chat['toId']],true))
                    throw new LogNetworkError('chat_forbidden',403);
                $other=$chat['fromId']===$pid ? $chat['toId'] : $chat['fromId']; $grant=$this->grant($other);
                if ($grant && $grant['status']!=='active') throw new LogNetworkError('chat_forbidden',403);
                if ($action==='send') {
                    $id=self::validId($in['id'] ?? null); $text=$in['text'] ?? '';
                    if (!is_string($text) || !preg_match('//u',$text) || trim($text)==='' || strlen($text)>8000 ||
                        preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/',$text)) throw new LogNetworkError('invalid_message');
                    $old=$this->state['messages'][$id] ?? null;
                    if ($old && ($old['chatId']!==$chatId || $old['senderId']!==$pid || $old['text']!==$text))
                        throw new LogNetworkError('message_conflict',409);
                    if (!$old) $this->state['messages'][$id]=['id'=>$id,'chatId'=>$chatId,'senderId'=>$pid,
                        'text'=>$text,'seq'=>++$this->state['nextSeq'],'at'=>$this->now()*1000];
                    return ['message'=>$this->state['messages'][$id]];
                }
                $after=$in['after'] ?? 0;
                if (!is_int($after) || $after<0) throw new LogNetworkError('invalid_cursor');
                $messages=array_values(array_filter($this->state['messages'],fn($m)=>$m['chatId']===$chatId && $m['seq']>$after));
                usort($messages,fn($a,$b)=>$a['seq']<=>$b['seq']);
                return ['messages'=>array_slice($messages,0,100)];
            }
            throw new LogNetworkError('unknown_action',404);
        });
    }
}

function log_account_mail_from(): string {
    $from = getenv('SHARON_ACCOUNT_MAIL_FROM');
    if ($from !== false && trim($from) !== '') return trim($from);
    $path = dirname(__DIR__) . '/private/account-config.php';
    if (is_file($path)) {
        $config = require $path;
        if (is_array($config) && is_string($config['mailFrom'] ?? null) && trim($config['mailFrom']) !== '') {
            return trim($config['mailFrom']);
        }
    }
    $from = getenv('EVENTLIJN_MAIL_FROM');
    if ($from !== false && trim($from) !== '') return trim($from);
    $path = dirname(__DIR__, 2) . '/eventline/server/config.local.php';
    if (!is_file($path)) return '';
    $config = require $path;
    return is_array($config) && is_string($config['MAIL_FROM'] ?? null) ? trim($config['MAIL_FROM']) : '';
}

function log_account_eventline_key(): string {
    $key = getenv('SHARON_EVENTLINE_KEY');
    if ($key !== false && $key !== '') return $key;
    $path = dirname(__DIR__) . '/private/account-config.php';
    if (!is_file($path)) return '';
    $config = require $path;
    return is_array($config) && is_string($config['eventlineKey'] ?? null) ? $config['eventlineKey'] : '';
}

function log_account_send_mail(array $item, string $from): bool {
    if (!filter_var($from,FILTER_VALIDATE_EMAIL)) return false;
    $reset = $item['kind'] === 'reset';
    $subject = $reset ? 'Herstel je Sharon-wachtwoord' : 'Bevestig je Sharon-account';
    $body = ($reset ? 'Kies Wachtwoord vergeten in Sharon en gebruik deze code.' : 'Kies E-mailadres bevestigen in Sharon en gebruik deze code.')
        . "\nDe code is een uur geldig.\n\n" . $item['code'];
    return mail($item['email'],'=?UTF-8?B?'.base64_encode($subject).'?=',$body,[
        'From'=>$from,'MIME-Version'=>'1.0','Content-Type'=>'text/plain; charset=UTF-8',
    ]);
}

function log_network_request(array $body, string $root, string $raw): never {
    ini_set('display_errors','0');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    $secure=in_array($_SERVER['HTTPS'] ?? '',['on','1'],true);
    $local=PHP_SAPI==='cli-server' && in_array($_SERVER['REMOTE_ADDR'] ?? '',['127.0.0.1','::1'],true);
    if (!$secure && !$local) out(400,['error'=>'https_required']);
    if (strlen($raw)>16384) out(413,['error'=>'request_too_large']);
    if (strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE'] ?? '')[0]))!=='application/json') out(415,['error'=>'json_required']);
    if (!is_string($body['action'] ?? null)) out(400,['error'=>'unknown_action']);
    try {
        // The existing private directory must not be served by the webserver.
        // Strato uses Apache; add the deny rule without replacing existing rules.
        $deny=$root.'/.htaccess';
        if (!is_file($deny) && file_put_contents($deny,"Require all denied\n",LOCK_EX)===false) throw new RuntimeException('Private storage unavailable');
        $service=new LogNetwork($root.'/network-v1.json');
        $token=header_value('X-Log-Access-Token') ?: null;
        $service->throttle($_SERVER['REMOTE_ADDR'] ?? 'unknown',$token,$body['action']==='register');
        if ($body['action']==='start') {
            $secret=dirname(__DIR__).'/private/publish-secret.php';
            if (!is_file($secret)) out(503,['error'=>'not_configured']);
            require_once $secret;
            $key=header_value('X-Log-Publish-Key');
            if (!defined('LOG_PUBLISH_KEY') || !is_string(LOG_PUBLISH_KEY) || strlen(LOG_PUBLISH_KEY)<16) out(503,['error'=>'not_configured']);
            if ($key==='' || !hash_equals(LOG_PUBLISH_KEY,$key)) out(401,['error'=>'invalid_publish_key']);
            out(200,['invitation'=>$service->start()]);
        }
        $action = $body['action'];
        $service->throttleAccount($_SERVER['REMOTE_ADDR'] ?? 'unknown', $action, $body['email'] ?? null);
        $from = log_account_mail_from();
        $mailActions=['account-register','account-resend','account-forgot'];
        if (in_array($action,$mailActions,true) && !filter_var($from,FILTER_VALIDATE_EMAIL)) out(503,['error'=>'account_mail_unavailable']);
        if ($action === 'account-app-redeem') {
            $key = log_account_eventline_key();
            if (strlen($key) < 32 || !hash_equals($key,header_value('X-Sharon-App-Key'))) out(403,['error'=>'account_required']);
            if (!is_string($body['app'] ?? null) || !is_string($body['code'] ?? null)) out(400,['error'=>'account_verification']);
            out(200,$service->redeemAccountAppCode($body['app'],$body['code']));
        }
        $result=$service->handle($action,$body,$token,header_value('X-Sharon-Account-Token') ?: null);
        if (filter_var($from,FILTER_VALIDATE_EMAIL) && str_starts_with($action,'account-')) {
            $service->deliverAccountMail(static fn(array $item): bool => log_account_send_mail($item,$from));
        }
        out(200,$result);
    } catch (LogNetworkError $e) { out($e->status,['error'=>$e->reason]); }
    catch (Throwable $e) { out(503,['error'=>'service_unavailable']); }
}


const LOG_CONNECTION_MAX_BYTES = 262144;
const LOG_CONNECTION_ALLOWED_ORIGINS = [
    'https://stefan-van-dijk.github.io',
    'https://sharon.life',
    'https://www.sharon.life',
];

function out(int $status, array $body): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
function valid_id(string $value): bool {
    return preg_match('/^[A-Za-z0-9_-]{12}$/', $value) === 1;
}
function header_value(string $name): string {
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return trim((string)($_SERVER[$key] ?? ''));
}
function token_hash(string $token): string {
    return hash('sha256', $token);
}
function read_json(string $path): ?array {
    if (!is_file($path)) return null;
    $raw = file_get_contents($path);
    if (!is_string($raw) || $raw === '') return null;
    $value = json_decode($raw, true);
    return is_array($value) ? $value : null;
}
function write_json(string $path, array $value): bool {
    $raw = json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($raw)) return false;
    $tmp = $path . '.' . bin2hex(random_bytes(6)) . '.tmp';
    if (file_put_contents($tmp, $raw . PHP_EOL, LOCK_EX) === false) return false;
    @chmod($tmp, 0600);
    if (!rename($tmp, $path)) { @unlink($tmp); return false; }
    @chmod($path, 0600);
    return true;
}
function auth(array $state, string $token): array {
    if (strlen($token) < 32) return ['ok' => false, 'role' => null, 'personId' => null];
    $hash = token_hash($token);
    if (!empty($state['ownerTokenHash']) && hash_equals((string)$state['ownerTokenHash'], $hash)) {
        return ['ok' => true, 'role' => 'owner', 'personId' => $state['ownerPersonId'] ?? null];
    }
    if (!empty($state['memberTokenHash']) && hash_equals((string)$state['memberTokenHash'], $hash)) {
        return ['ok' => true, 'role' => 'member', 'personId' => $state['memberPersonId'] ?? null];
    }
    return ['ok' => false, 'role' => null, 'personId' => null];
}
function public_state(string $id, array $state, array $authorization): array {
    $result = [
        'ok' => true,
        'connectionId' => $id,
        'revision' => max(0, (int)($state['revision'] ?? 0)),
        'status' => (string)($state['status'] ?? 'pending'),
        'revoked' => (bool)($state['revoked'] ?? false),
        'createdAt' => $state['createdAt'] ?? null,
        'updatedAt' => $state['updatedAt'] ?? null,
    ];
    if ($authorization['ok']) {
        $result['role'] = $authorization['role'];
        $result['ownerPersonId'] = $state['ownerPersonId'] ?? null;
        $result['memberPersonId'] = $state['memberPersonId'] ?? null;
        $result['openInvite'] = empty($state['memberPersonId']);
        if (!(bool)($state['revoked'] ?? false) && is_array($state['payload'] ?? null)) $result['payload'] = $state['payload'];
    }
    return $result;
}

if (defined('LOG_CONNECTION_LIBRARY_ONLY')) return;

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, LOG_CONNECTION_ALLOWED_ORIGINS, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Log-Access-Token, X-Log-Publish-Key, X-Sharon-Account-Token');
    header('Access-Control-Max-Age: 600');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    if ($origin !== '' && !in_array($origin, LOG_CONNECTION_ALLOWED_ORIGINS, true)) out(403, ['error' => 'Origin niet toegestaan.']);
    http_response_code(204);
    exit;
}
if ($origin !== '' && !in_array($origin, LOG_CONNECTION_ALLOWED_ORIGINS, true)) out(403, ['error' => 'Origin niet toegestaan.']);

$root = dirname(__DIR__) . '/private/connections';
if (!is_dir($root) && !mkdir($root, 0700, true)) out(500, ['error' => 'Verbindingsmap kon niet worden aangemaakt.']);

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'GET') {
    $id = trim((string)($_GET['id'] ?? ''));
    if (!valid_id($id)) out(422, ['error' => 'ConnectionId moet exact 12 tekens bevatten.']);
    $state = read_json($root . '/' . $id . '.json');
    if ($state === null) out(404, ['error' => 'Verbindingsverzoek niet gevonden.']);
    $authorization = auth($state, header_value('X-Log-Access-Token'));
    if (!$authorization['ok']) out(403, ['error' => 'Geen toegang tot deze verbinding.']);
    out(200, public_state($id, $state, $authorization));
}
if ($method !== 'POST') out(405, ['error' => 'Alleen GET, POST en OPTIONS zijn toegestaan.']);

$length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($length > LOG_CONNECTION_MAX_BYTES) out(413, ['error' => 'Verbindingspayload is te groot.']);
$raw = file_get_contents('php://input');
if (!is_string($raw) || $raw === '' || strlen($raw) > LOG_CONNECTION_MAX_BYTES) out(400, ['error' => 'Geen geldige verbindingspayload ontvangen.']);
try { $body = json_decode($raw, true, 64, JSON_THROW_ON_ERROR); }
catch (Throwable $e) { out(400, ['error' => 'JSON is ongeldig.']); }
if (!is_array($body)) out(400, ['error' => 'Verbindingspayload moet een object zijn.']);

if (($body['protocol'] ?? '') === 'sharon-network-v1') log_network_request($body,$root,$raw);

$action = strtolower(trim((string)($body['action'] ?? '')));
$id = trim((string)($body['id'] ?? ''));
if (!valid_id($id)) out(422, ['error' => 'ConnectionId moet exact 12 tekens bevatten.']);
if (!in_array($action, ['create','claim','put','revoke'], true)) out(400, ['error' => 'Onbekende verbindingsactie.']);
$path = $root . '/' . $id . '.json';
$state = read_json($path);
$token = header_value('X-Log-Access-Token');
$now = gmdate('c');

if ($action === 'create') {
    if ($state !== null) out(409, ['error' => 'Deze ConnectionId bestaat al.']);
    $ownerPersonId = trim((string)($body['ownerPersonId'] ?? ''));
    $memberPersonId = trim((string)($body['memberPersonId'] ?? ''));
    $memberToken = trim((string)($body['memberToken'] ?? ''));
    $payload = $body['payload'] ?? null;
    if (strlen($token) < 32 || strlen($memberToken) < 32) out(401, ['error' => 'Sterke toegangssleutels zijn vereist.']);
    if (!valid_id($ownerPersonId)) out(422, ['error' => 'Een geldige PersonId van de afzender is vereist.']);
    if ($memberPersonId !== '' && (!valid_id($memberPersonId) || $ownerPersonId === $memberPersonId)) out(422, ['error' => 'De PersonId van de ontvanger is ongeldig.']);
    if (!is_array($payload) || (int)($payload['v'] ?? 0) < 1 || !is_string($payload['data'] ?? null)) out(422, ['error' => 'Versleutelde verbindingsinhoud ontbreekt.']);
    $state = [
        'ownerPersonId' => $ownerPersonId,
        'memberPersonId' => $memberPersonId !== '' ? $memberPersonId : null,
        'ownerTokenHash' => token_hash($token),
        'memberTokenHash' => token_hash($memberToken),
        'revision' => 1,
        'status' => 'pending',
        'revoked' => false,
        'payload' => $payload,
        'createdAt' => $now,
        'updatedAt' => $now,
    ];
    if (!write_json($path, $state)) out(500, ['error' => 'Verbindingsverzoek kon niet worden opgeslagen.']);
    out(200, public_state($id, $state, auth($state, $token)));
}

if ($state === null) out(404, ['error' => 'Verbindingsverzoek niet gevonden.']);
$authorization = auth($state, $token);
if (!$authorization['ok']) out(403, ['error' => 'Geen toegang tot deze verbinding.']);

if ($action === 'claim') {
    if ((bool)($state['revoked'] ?? false)) out(410, ['error' => 'Deze verbinding is verbroken.']);
    if ($authorization['role'] !== 'member') out(403, ['error' => 'Alleen de ontvanger kan deze uitnodiging bevestigen.']);
    $memberPersonId = trim((string)($body['memberPersonId'] ?? ''));
    if (!valid_id($memberPersonId) || $memberPersonId === (string)($state['ownerPersonId'] ?? '')) out(422, ['error' => 'Een andere geldige PersonId van de ontvanger is vereist.']);
    $currentMember = trim((string)($state['memberPersonId'] ?? ''));
    if ($currentMember !== '' && $currentMember !== $memberPersonId) out(409, ['error' => 'Deze uitnodiging is al door een andere Log-identiteit bevestigd.']);
    if ($currentMember === '') {
        $state['memberPersonId'] = $memberPersonId;
        $state['revision'] = max(0, (int)($state['revision'] ?? 0)) + 1;
        $state['updatedAt'] = $now;
        if (!write_json($path, $state)) out(500, ['error' => 'Ontvanger kon niet aan de verbinding worden gekoppeld.']);
    }
    out(200, public_state($id, $state, auth($state, $token)));
}

if ($action === 'put') {
    if ((bool)($state['revoked'] ?? false)) out(410, ['error' => 'Deze verbinding is verbroken.']);
    $baseRevision = max(0, (int)($body['baseRevision'] ?? 0));
    $currentRevision = max(0, (int)($state['revision'] ?? 0));
    if ($baseRevision !== $currentRevision) out(409, ['error' => 'Er staat inmiddels een nieuwere verbindingsstatus online.', 'revision' => $currentRevision]);
    $payload = $body['payload'] ?? null;
    $status = strtolower(trim((string)($body['status'] ?? '')));
    if (!is_array($payload) || (int)($payload['v'] ?? 0) < 1 || !is_string($payload['data'] ?? null)) out(422, ['error' => 'Versleutelde verbindingsinhoud ontbreekt.']);
    if (!in_array($status, ['pending','connected','rejected'], true)) out(422, ['error' => 'Ongeldige verbindingsstatus.']);
    if ($authorization['role'] === 'owner' && $status === 'connected' && ($state['status'] ?? '') !== 'connected') out(403, ['error' => 'De ontvanger moet de verbinding bevestigen.']);
    if ($authorization['role'] === 'member' && $status === 'connected' && empty($state['memberPersonId'])) out(409, ['error' => 'Bevestig eerst welke Log-identiteit deze uitnodiging accepteert.']);
    $state['payload'] = $payload;
    $state['status'] = $status;
    $state['revision'] = $currentRevision + 1;
    $state['updatedAt'] = $now;
    if (!write_json($path, $state)) out(500, ['error' => 'Verbindingsstatus kon niet worden opgeslagen.']);
    out(200, public_state($id, $state, $authorization));
}

if ($action === 'revoke') {
    $state['revoked'] = true;
    $state['status'] = 'revoked';
    $state['payload'] = null;
    $state['revision'] = max(0, (int)($state['revision'] ?? 0)) + 1;
    $state['revokedByPersonId'] = $authorization['personId'];
    $state['revokedAt'] = $now;
    $state['updatedAt'] = $now;
    if (!write_json($path, $state)) out(500, ['error' => 'Verbinding kon niet worden verbroken.']);
    out(200, public_state($id, $state, $authorization));
}

out(500, ['error' => 'Onverwachte verbindingsstatus.']);

