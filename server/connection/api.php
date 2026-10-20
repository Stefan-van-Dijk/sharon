<?php
declare(strict_types=1);
require_once __DIR__.'/Connection.php';
ini_set('display_errors', '0');
umask(0077);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Vary: Origin');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['https://stefan-van-dijk.github.io','https://sharon.life','https://www.sharon.life'];
function reply(int $status, array $body): never {
    http_response_code($status); echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR); exit;
}
if ($origin !== '' && !in_array($origin, $allowed, true)) reply(403, ['error'=>'origin_forbidden']);
if ($origin !== '') header('Access-Control-Allow-Origin: '.$origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 600');
$secure = ($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['HTTPS'] ?? '') === '1';
$localTest = PHP_SAPI === 'cli-server' && in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1','::1'], true);
if (!$secure && !$localTest) reply(400, ['error'=>'https_required']);
$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'OPTIONS') { http_response_code(204); exit; }
if (!in_array($method, ['GET','POST'], true)) { header('Allow: GET, POST, OPTIONS'); reply(405,['error'=>'method_not_allowed']); }
try {
    $service = new Connection(connection_database());
    if (!$service->ready()) reply(503, ['error'=>'not_configured']);
    if ($method === 'GET') reply(200, ['ready'=>true]);
    if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json')
        reply(415, ['error'=>'json_required']);
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 16384) reply(413, ['error'=>'request_too_large']);
    $raw = file_get_contents('php://input', false, null, 0, 16385);
    if (strlen($raw) > 16384) reply(413, ['error'=>'request_too_large']);
    try { $in = json_decode($raw, true, 16, JSON_THROW_ON_ERROR); }
    catch (JsonException $e) { reply(400, ['error'=>'invalid_json']); }
    if (!is_array($in) || array_is_list($in)) reply(400, ['error'=>'invalid_json']);
    $action = $in['action'] ?? '';
    if (!is_string($action)) reply(400, ['error'=>'unknown_action']);
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $auth = preg_match('/\ABearer ([A-Za-z0-9_-]{43})\z/', $header, $match) ? $match[1] : null;
    // Unknown credentials cannot create unlimited rate rows: one IP bucket
    // protects unauthenticated work; one credential bucket bounds active use.
    $ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $service->rate('ip:'.$ip, 600, 60);
    if ($action === 'register') $service->rate('registration:'.$ip, 180, 3600);
    if ($auth) $service->rate('credential:'.hash('sha256', $auth), 120, 60);
    reply(200, $service->handle($action, $in, $auth));
} catch (ConnectionError $e) {
    reply($e->status, ['error'=>$e->reason]);
} catch (Throwable $e) {
    // Never expose database paths, queries, credentials or request bodies.
    reply(503, ['error'=>'service_unavailable']);
}
