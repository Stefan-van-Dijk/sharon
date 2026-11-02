<?php
declare(strict_types=1);
/**
 * Sharon Omgeving - read-only tile bundle endpoint.
 * Upload alongside the EXISTING tiles.php to /environment/api/bundle.php.
 * Does not create .lock files, write tiles, or generate missing areas.
 * GET ?ids=AA,AAAb,... (max 9). Existing tiles.php remains responsible for generation.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300, stale-while-revalidate=3600');
header('Access-Control-Allow-Origin: *');
header('X-Content-Type-Options: nosniff');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}
$raw = (string)($_GET['ids'] ?? '');
$ids = array_values(array_unique(array_filter(explode(',', $raw), 'strlen')));
if (!$ids || count($ids) > 9) {
    http_response_code(400);
    echo json_encode(['error' => 'Expected 1 to 9 identifiers']);
    exit;
}
foreach ($ids as $id) {
    if (!preg_match('/^(?:[A-Za-z0-9_-]{2}){1,4}$/D', $id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid identifier']);
        exit;
    }
}
if (!function_exists('curl_multi_init')) {
    http_response_code(503);
    echo json_encode(['error' => 'PHP cURL extension unavailable']);
    exit;
}
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = (string)($_SERVER['HTTP_HOST'] ?? '');
if (!preg_match('/^[a-z0-9.-]+(?::[0-9]{1,5})?$/iD', $host)) {
    http_response_code(500);
    echo json_encode(['error' => 'Invalid server hostname']);
    exit;
}
$path = rtrim(dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/environment/api/bundle.php')), '/');
$multi = curl_multi_init();
$handles = [];
foreach ($ids as $id) {
    $url = $scheme . '://' . $host . $path . '/tiles.php?id=' . rawurlencode($id) . '&resolve=1';
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_USERAGENT => 'SharonEnvironmentBundle/1.0',
    ]);
    curl_multi_add_handle($multi, $handle);
    $handles[$id] = $handle;
}
do {
    $status = curl_multi_exec($multi, $running);
    if ($running) curl_multi_select($multi, 1.0);
} while ($running && $status === CURLM_OK);
$tiles = [];
$missing = [];
foreach ($handles as $id => $handle) {
    $body = curl_multi_getcontent($handle);
    $status = (int)curl_getinfo($handle, CURLINFO_HTTP_CODE);
    if ($status === 200 && is_string($body) && strlen($body) <= 8 * 1024 * 1024) {
        $tile = json_decode($body, true);
        if (is_array($tile) && ($tile['id'] ?? '') === $id &&
            ($tile['schema'] ?? '') === 'https://sharon.life/environment/tile/v2') {
            $tiles[] = $tile;
        } else {
            $missing[] = $id;
        }
    } else {
        $missing[] = $id;
    }
    curl_multi_remove_handle($multi, $handle);
    curl_close($handle);
}
curl_multi_close($multi);
echo json_encode([
    'schema' => 'https://sharon.life/environment/bundle/v1',
    'tiles' => $tiles,
    'missing' => $missing
], JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
