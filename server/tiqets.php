<?php
declare(strict_types=1);

// Deploy on the PHP host, never inside the public static Pages artifact.
// Secrets are supplied by the hosting environment, not by browser requests.
function tiqets_point(mixed $value): bool {
    return is_array($value) && isset($value['lat'], $value['lng'])
        && is_numeric($value['lat']) && is_numeric($value['lng'])
        && is_finite((float)$value['lat']) && is_finite((float)$value['lng'])
        && abs((float)$value['lat']) <= 90 && abs((float)$value['lng']) <= 180;
}
function tiqets_text(mixed $value): string {
    return is_string($value) ? substr(html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8'), 0, 8000) : '';
}
function tiqets_link(mixed $value, string $partner): string {
    if (!is_string($value)) return '';
    $url = parse_url($value);
    if (!$url || ($url['scheme'] ?? '') !== 'https' ||
        !preg_match('/^(?:[a-z0-9-]+\\.)*tiqets\\.com$/i', $url['host'] ?? '') ||
        isset($url['user']) || isset($url['pass']) || isset($url['port'])) return '';
    parse_str($url['query'] ?? '', $query);
    return is_string($query['partner'] ?? null) && hash_equals($partner, $query['partner']) ? $value : '';
}
function tiqets_image(mixed $value): string {
    if (!is_string($value)) return '';
    $url = parse_url($value);
    return $url && ($url['scheme'] ?? '') === 'https' &&
        ($url['host'] ?? '') === 'cdn.tiqets.com' &&
        !isset($url['user']) && !isset($url['pass']) && !isset($url['port']) ? $value : '';
}
function tiqets_products(array $products, string $partner, bool $imagesEnabled): array {
    $result = [];
    foreach (array_slice($products, 0, 100) as $product) {
        if (!is_array($product) || !preg_match('/^\\d+$/', (string)($product['id'] ?? '')) ||
            !tiqets_point($product['geolocation'] ?? null) ||
            ($product['sale_status'] ?? '') !== 'available') continue;
        $url = tiqets_link($product['product_url'] ?? '', $partner);
        $title = tiqets_text($product['title'] ?? '');
        if (!$url || !$title) continue;
        // Conservative first integration: do not promote products with ad
        // content/keyword/geotargeting restrictions until reviewed for Sharon.
        $restricted = false;
        foreach (($product['marketing_restrictions_detailed'] ?? []) as $restriction) {
            if (!in_array($restriction['type'] ?? '', ['THINGS_TO_DO_ADS','THINGS_TO_DO_BOOKING_MODULE'], true)) $restricted = true;
        }
        if ($restricted) continue;
        $images = [];
        if ($imagesEnabled) foreach (($product['images'] ?? []) as $image) {
            if (!is_array($image)) continue;
            $src = tiqets_image($image['large'] ?? $image['medium'] ?? $image['small'] ?? '');
            if ($src) $images[] = ['large'=>$src, 'credit'=>tiqets_text($image['credit'] ?? ''), 'alt_text'=>tiqets_text($image['alt_text'] ?? '')];
            if (count($images) >= 6) break;
        }
        $venue = is_array($product['venue'] ?? null) ? $product['venue'] : [];
        $result[] = [
            'id'=>(string)$product['id'], 'title'=>$title, 'product_url'=>$url,
            'geolocation'=>['lat'=>(float)$product['geolocation']['lat'], 'lng'=>(float)$product['geolocation']['lng']],
            'sale_status'=>'available', 'summary'=>tiqets_text($product['summary'] ?? ''),
            'tagline'=>tiqets_text($product['tagline'] ?? ''),
            'whats_included'=>tiqets_text($product['whats_included'] ?? ''),
            'city_name'=>tiqets_text($product['city_name'] ?? ''), 'images'=>$images,
            'venue'=>['id'=>tiqets_text($venue['id'] ?? ''), 'name'=>tiqets_text($venue['name'] ?? ''), 'address'=>tiqets_text($venue['address'] ?? '')]
        ];
    }
    return $result;
}
function tiqets_query(array $input, string $token, string $partner, bool $images, callable $get): array {
    if (!tiqets_point($input)) throw new InvalidArgumentException('Ongeldige kaartpositie.');
    $lang = is_string($input['lang'] ?? null) && preg_match('/^[a-z]{2}$/', $input['lang']) ? $input['lang'] : 'nl';
    $query = http_build_query([
        'lat'=>(float)$input['lat'], 'lng'=>(float)$input['lng'], 'max_distance'=>5,
        'require_venue'=>'true', 'sort'=>'distance asc', 'page_size'=>50, 'page'=>1,
        'currency'=>'EUR', 'lang'=>$lang
    ], '', '&', PHP_QUERY_RFC3986);
    $data = $get('https://api.tiqets.com/v2/products?' . $query, [
        'Accept: application/json', 'User-Agent: Sharon', 'Authorization: Token ' . $token
    ]);
    if (!is_array($data) || ($data['success'] ?? false) !== true || !is_array($data['products'] ?? null)) {
        throw new RuntimeException('Ongeldig bronantwoord.');
    }
    return ['source'=>'tiqets', 'products'=>tiqets_products($data['products'], $partner, $images)];
}
function tiqets_http_get(string $url, array $headers): array {
    if (!function_exists('curl_init')) throw new RuntimeException('Verbinding niet beschikbaar.');
    $curl = curl_init($url);
    $body = '';
    curl_setopt_array($curl, [
        CURLOPT_HTTPHEADER=>$headers, CURLOPT_FOLLOWLOCATION=>false,
        CURLOPT_CONNECTTIMEOUT=>3, CURLOPT_TIMEOUT=>12,
        CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,
        CURLOPT_WRITEFUNCTION=>static function ($handle, string $chunk) use (&$body): int {
            if (strlen($body) + strlen($chunk) > 2097152) return 0;
            $body .= $chunk;
            return strlen($chunk);
        }
    ]);
    $ok = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    if ($ok === false || $status !== 200) throw new RuntimeException('Bron niet beschikbaar.');
    return json_decode($body, true, 64, JSON_THROW_ON_ERROR);
}
function tiqets_respond(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

// Including this file for tests only defines the pure adapter functions above.
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') !== __FILE__) return;
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Vary: Origin');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && !in_array($origin, [
    'https://stefan-van-dijk.github.io', 'https://sharon.life', 'https://www.sharon.life'
], true)) tiqets_respond(403, ['error'=>'Origin niet toegestaan.']);
if ($origin !== '') header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') { http_response_code(204); exit; }
$token = trim(getenv('SHARON_TIQETS_TOKEN') ?: '');
$partner = trim(getenv('SHARON_TIQETS_PARTNER') ?: '');
$configured = getenv('SHARON_TIQETS_ENABLED') === '1' && $token !== '' &&
    !preg_match('/[\\r\\n]/', $token) && preg_match('/^[A-Za-z0-9_-]+$/', $partner);
if ($method === 'GET') tiqets_respond(200, ['source'=>'tiqets', 'configured'=>(bool)$configured]);
if ($method !== 'POST') tiqets_respond(405, ['error'=>'Methode niet toegestaan.']);
if (!$configured) tiqets_respond(503, ['error'=>'Tiqets is nog niet beschikbaar.']);
$body = file_get_contents('php://input', false, null, 0, 1025);
if ($body === false || strlen($body) > 1024) tiqets_respond(400, ['error'=>'Ongeldige aanvraag.']);
try {
    $input = json_decode($body, true, 8, JSON_THROW_ON_ERROR);
    if (!is_array($input) || !tiqets_point($input)) throw new InvalidArgumentException();
} catch (Throwable $error) { tiqets_respond(400, ['error'=>'Ongeldige kaartpositie.']); }
// One aggregate rate limit, no IP addresses, user IDs or location history.
$lock = fopen(sys_get_temp_dir() . '/sharon-tiqets-rate.lock', 'c+');
if (!$lock || !flock($lock, LOCK_EX)) tiqets_respond(503, ['error'=>'Tiqets is tijdelijk niet bereikbaar.']);
$state = json_decode(stream_get_contents($lock) ?: '{}', true) ?: [];
$now = time();
$count = ($state['minute'] ?? 0) === intdiv($now, 60) ? (int)($state['count'] ?? 0) : 0;
if ($count >= 60) { flock($lock, LOCK_UN); fclose($lock); header('Retry-After: 60'); tiqets_respond(429, ['error'=>'Probeer later opnieuw.']); }
ftruncate($lock, 0); rewind($lock); fwrite($lock, json_encode(['minute'=>intdiv($now,60),'count'=>$count+1]));
flock($lock, LOCK_UN); fclose($lock);
try {
    tiqets_respond(200, tiqets_query($input, $token, $partner, getenv('SHARON_TIQETS_IMAGES') === '1', 'tiqets_http_get'));
} catch (Throwable $error) {
    // Never forward upstream error bodies, credentials or request coordinates.
    tiqets_respond(502, ['error'=>'Tiqets is tijdelijk niet bereikbaar.']);
}
