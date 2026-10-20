<?php
declare(strict_types=1);

// One private SQLite database per Sharon network. Never put this file's data in
// the public directory. All policy changes and invite claims use a write lock.
final class ConnectionError extends RuntimeException {
    public function __construct(public readonly string $reason, public readonly int $status = 400) {
        parent::__construct($reason);
    }
}
final class Connection {
    public function __construct(private PDO $db, private ?int $clock = null) {
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $db->exec('PRAGMA busy_timeout=5000');
        $db->exec('PRAGMA foreign_keys=ON');
    }
    private function now(): int { return $this->clock ?? time(); }
    public static function id(): string { return self::token(9); }
    public static function token(int $bytes = 32): string {
        return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
    }
    private static function validId(mixed $id): string {
        if (!is_string($id) || !preg_match('/\A[A-Za-z0-9_-]{12}\z/', $id)) throw new ConnectionError('invalid_id');
        return $id;
    }
    private static function hashToken(mixed $token): string {
        if (!is_string($token) || !preg_match('/\A[A-Za-z0-9_-]{43}\z/', $token)) throw new ConnectionError('invalid_token');
        return hash('sha256', $token);
    }
    private function row(string $sql, array $args = []): array|false {
        $q = $this->db->prepare($sql); $q->execute($args); return $q->fetch();
    }
    private function write(string $sql, array $args = []): void {
        $q = $this->db->prepare($sql); $q->execute($args);
    }
    private function transaction(callable $change): mixed {
        $this->db->exec('BEGIN IMMEDIATE');
        try { $result = $change(); $this->db->exec('COMMIT'); return $result; }
        catch (Throwable $e) { $this->db->exec('ROLLBACK'); throw $e; }
    }
    public function install(): array {
        return $this->transaction(function () {
            $this->db->exec('CREATE TABLE IF NOT EXISTS network (
                id TEXT PRIMARY KEY, owner_id TEXT, bootstrap_hash TEXT NOT NULL, bootstrap_until INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS people (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
                line INTEGER, invited_by TEXT, status TEXT NOT NULL DEFAULT "active", joined_at INTEGER);
                CREATE TABLE IF NOT EXISTS invites (
                hash TEXT PRIMARY KEY, issuer TEXT NOT NULL REFERENCES people(id),
                recipient TEXT NOT NULL REFERENCES people(id), until_at INTEGER NOT NULL, claimed_at INTEGER);
                CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY, a TEXT NOT NULL REFERENCES people(id), b TEXT NOT NULL REFERENCES people(id), UNIQUE(a,b));
                CREATE TABLE IF NOT EXISTS messages (
                seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
                chat_id TEXT NOT NULL REFERENCES chats(id), sender_id TEXT NOT NULL REFERENCES people(id),
                text TEXT NOT NULL, at INTEGER NOT NULL);
                CREATE INDEX IF NOT EXISTS messages_chat_seq ON messages(chat_id,seq);
                CREATE TABLE IF NOT EXISTS rates (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, until_at INTEGER NOT NULL);');
            $network = $this->row('SELECT * FROM network');
            if ($network && $network['owner_id']) throw new ConnectionError('already_activated', 409);
            $token = self::token(); $until = $this->now() + 900;
            $id = $network ? $network['id'] : self::id();
            $this->write('DELETE FROM network');
            $this->write('INSERT INTO network VALUES(?,NULL,?,?)', [$id, self::hashToken($token), $until]);
            return ['v'=>1, 'kind'=>'bootstrap', 'networkId'=>$id, 'token'=>$token, 'expiresAt'=>$until * 1000];
        });
    }
    public function ready(): bool { return (bool)$this->row('SELECT id FROM network'); }
    public function rate(string $bucket, int $limit, int $seconds): void {
        $this->transaction(function () use ($bucket, $limit, $seconds) {
            $now = $this->now();
            $this->write('DELETE FROM rates WHERE until_at < ?', [$now]);
            $r = $this->row('SELECT * FROM rates WHERE bucket=?', [$bucket]);
            if ($r && (int)$r['count'] >= $limit) throw new ConnectionError('rate_limit', 429);
            $this->write('INSERT INTO rates VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1',
                [$bucket, $now + $seconds]);
        });
    }
    private function person(mixed $token): array {
        $p = $this->row('SELECT * FROM people WHERE token_hash=?', [self::hashToken($token)]);
        if (!$p || $p['status'] !== 'active') throw new ConnectionError('unauthorized', 401);
        return $p;
    }
    private function member(array $p): void {
        if ($p['line'] === null) throw new ConnectionError('invitation_required', 403);
    }
    private function selfData(array $p): array {
        $n = $this->row('SELECT id FROM network');
        return ['personId'=>$p['id'], 'name'=>$p['name'], 'networkId'=>$n['id'],
            'line'=>$p['line'] === null ? null : (int)$p['line']];
    }
    public function handle(string $action, array $in, ?string $auth): array {
        return $this->transaction(function () use ($action, $in, $auth) {
            if ($action === 'register') {
                $id = self::validId($in['personId'] ?? null);
                $hash = self::hashToken($in['deviceToken'] ?? null);
                $name = $in['name'] ?? '';
                if (!is_string($name) || strlen($name) > 240 || !preg_match('//u', $name) ||
                    trim($name) === '' || preg_match('/[\x00-\x1f\x7f]/', $name)) throw new ConnectionError('invalid_name');
                $old = $this->row('SELECT * FROM people WHERE id=?', [$id]);
                if ($old && !hash_equals($old['token_hash'], $hash)) throw new ConnectionError('identity_exists', 409);
                if (!$old) {
                    if ((int)$this->row('SELECT count(*) AS n FROM people')['n'] >= 10000) throw new ConnectionError('capacity', 409);
                    $this->write('INSERT INTO people(id,name,token_hash) VALUES(?,?,?)', [$id,trim($name),$hash]);
                }
                return ['self'=>$this->selfData($this->person($in['deviceToken']))];
            }
            $p = $this->person($auth);
            if ($action === 'bootstrap' || $action === 'accept') {
                $networkId = self::validId($in['networkId'] ?? null);
                $n = $this->row('SELECT * FROM network WHERE id=?', [$networkId]);
                if (!$n) throw new ConnectionError('wrong_network', 403);
                $hash = self::hashToken($in['token'] ?? null);
                if ($action === 'bootstrap') {
                    if (!hash_equals($n['bootstrap_hash'], $hash)) throw new ConnectionError('invalid_invitation', 403);
                    // A lost HTTP reply may retry the same claim with the same device credential.
                    if ($n['owner_id'] !== null && $n['owner_id'] !== $p['id']) throw new ConnectionError('invitation_used', 409);
                    if ($n['owner_id'] === null) {
                        if ((int)$n['bootstrap_until'] <= $this->now()) throw new ConnectionError('invitation_expired', 410);
                        $this->write('UPDATE network SET owner_id=? WHERE id=?', [$p['id'],$networkId]);
                        $this->write('UPDATE people SET line=0,joined_at=? WHERE id=?', [$this->now(),$p['id']]);
                    }
                } else {
                    $invite = $this->row('SELECT * FROM invites WHERE hash=?', [$hash]);
                    if (!$invite || $invite['recipient'] !== $p['id']) throw new ConnectionError('invalid_invitation', 403);
                    $issuer = $this->row('SELECT * FROM people WHERE id=?', [$invite['issuer']]);
                    if (!$issuer || $issuer['status'] !== 'active' || $issuer['line'] === null) throw new ConnectionError('invalid_invitation', 403);
                    if ($invite['claimed_at'] === null) {
                        if ((int)$invite['until_at'] <= $this->now()) throw new ConnectionError('invitation_expired', 410);
                        if ($p['line'] === null) {
                            if ((int)$issuer['line'] >= 3) throw new ConnectionError('depth_limit', 403);
                            // Revoked participants retain their place in the first 100.
                            if ((int)$this->row('SELECT count(*) AS n FROM people WHERE line>0')['n'] >= 100) throw new ConnectionError('capacity', 409);
                            $this->write('UPDATE people SET line=?,invited_by=?,joined_at=? WHERE id=?',
                                [(int)$issuer['line']+1,$issuer['id'],$this->now(),$p['id']]);
                        }
                        $this->write('UPDATE invites SET claimed_at=? WHERE hash=?', [$this->now(),$hash]);
                        $pair = [$issuer['id'],$p['id']]; sort($pair, SORT_STRING);
                        $this->write('INSERT OR IGNORE INTO chats VALUES(?,?,?)', [self::id(),...$pair]);
                    }
                }
                return ['self'=>$this->selfData($this->person($auth))];
            }
            if ($action === 'self') return ['self'=>$this->selfData($p)];
            $this->member($p);
            if ($action === 'invite') {
                $recipient = self::validId($in['recipientId'] ?? null);
                if ($recipient === $p['id'] || !$this->row('SELECT id FROM people WHERE id=? AND status="active"', [$recipient]))
                    throw new ConnectionError('recipient_unknown', 404);
                // Existing members may connect without changing their original network lineage.
                $target = $this->row('SELECT line FROM people WHERE id=?', [$recipient]);
                if ($target['line'] === null && (int)$p['line'] >= 3) throw new ConnectionError('depth_limit', 403);
                if ($target['line'] === null && (int)$this->row('SELECT count(*) AS n FROM people WHERE line>0')['n'] >= 100)
                    throw new ConnectionError('capacity', 409);
                $token = self::token(); $until = $this->now()+86400;
                $this->write('INSERT INTO invites VALUES(?,?,?,?,NULL)', [self::hashToken($token),$p['id'],$recipient,$until]);
                return ['invitation'=>['v'=>1,'kind'=>'invite','networkId'=>$this->row('SELECT id FROM network')['id'],
                    'token'=>$token,'expiresAt'=>$until*1000,'recipientId'=>$recipient]];
            }
            if ($action === 'contacts') {
                $q = $this->db->prepare('SELECT c.id AS chatId,p.id AS personId,p.name FROM chats c
                    JOIN people p ON p.id=CASE WHEN c.a=? THEN c.b ELSE c.a END
                    WHERE (c.a=? OR c.b=?) AND p.status="active" ORDER BY p.name,p.id');
                $q->execute([$p['id'],$p['id'],$p['id']]); return ['contacts'=>$q->fetchAll()];
            }
            if ($action === 'messages' || $action === 'send') {
                $chatId = self::validId($in['chatId'] ?? null);
                $chat = $this->row('SELECT * FROM chats WHERE id=? AND (a=? OR b=?)', [$chatId,$p['id'],$p['id']]);
                if (!$chat) throw new ConnectionError('chat_forbidden', 403);
                $other = $chat['a'] === $p['id'] ? $chat['b'] : $chat['a'];
                if (!$this->row('SELECT id FROM people WHERE id=? AND status="active"', [$other])) throw new ConnectionError('chat_forbidden', 403);
                if ($action === 'send') {
                    $id = self::validId($in['id'] ?? null); $text = $in['text'] ?? '';
                    if (!is_string($text) || !preg_match('//u', $text) || trim($text)==='' || strlen($text)>8000 ||
                        preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/', $text)) throw new ConnectionError('invalid_message');
                    $old = $this->row('SELECT * FROM messages WHERE id=?', [$id]);
                    if ($old && ($old['chat_id']!==$chatId || $old['sender_id']!==$p['id'] || $old['text']!==$text))
                        throw new ConnectionError('message_conflict', 409);
                    if (!$old) $this->write('INSERT INTO messages(id,chat_id,sender_id,text,at) VALUES(?,?,?,?,?)',
                        [$id,$chatId,$p['id'],$text,$this->now()*1000]);
                    return ['message'=>$this->message($this->row('SELECT * FROM messages WHERE id=?', [$id]))];
                }
                $after = $in['after'] ?? 0;
                if (!is_int($after) || $after < 0) throw new ConnectionError('invalid_cursor');
                $q = $this->db->prepare('SELECT * FROM messages WHERE chat_id=? AND seq>? ORDER BY seq LIMIT 100');
                $q->execute([$chatId,$after]);
                return ['messages'=>array_map(fn($m)=>$this->message($m),$q->fetchAll())];
            }
            throw new ConnectionError('unknown_action', 404);
        });
    }
    private function message(array $m): array {
        return ['id'=>$m['id'],'chatId'=>$m['chat_id'],'senderId'=>$m['sender_id'],'text'=>$m['text'],
            'seq'=>(int)$m['seq'],'at'=>(int)$m['at']];
    }
}

function connection_database(): PDO {
    $path = getenv('SHARON_CONNECTION_DB') ?: '';
    $parent = realpath(dirname($path));
    $root = realpath($_SERVER['DOCUMENT_ROOT'] ?? '') ?: null;
    if ($path === '' || $path[0] !== '/' || !$parent || !is_dir($parent) ||
        ($root && ($parent === $root || str_starts_with($parent, $root.DIRECTORY_SEPARATOR))) ||
        (file_exists($path) && (!is_file($path) || is_link($path)))) {
        throw new RuntimeException('Private database path required');
    }
    return new PDO('sqlite:'.$path);
}
