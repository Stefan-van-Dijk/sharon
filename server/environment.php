<?php
declare(strict_types=1);

const SHARON_ENV_SCHEMA = 'https://sharon.life/environment/tile/v1';
const SHARON_ENV_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const SHARON_ENV_ALLOWED_ORIGINS = [
    'https://stefan-van-dijk.github.io',
    'https://sharon.life',
    'https://www.sharon.life',
];
const SHARON_ENV_OVERPASS = [
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass-api.de/api/interpreter',
];

const SHARON_ENV_SCALES = [
    'near' => ['spanM' => 70, 'idLength' => 6, 'mode' => 'fine'],
    'detail' => ['spanM' => 220, 'idLength' => 6, 'mode' => 'fine'],
    'street' => ['spanM' => 700, 'idLength' => 6, 'mode' => 'fine'],
    'district' => ['spanM' => 3000, 'idLength' => 6, 'mode' => 'district'],
    'place' => ['spanM' => 15000, 'idLength' => 4, 'mode' => 'place'],
    'region' => ['spanM' => 70000, 'idLength' => 4, 'mode' => 'region'],
];

function json_response(int $status, array $body, array $headers = []): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    foreach ($headers as $header) header($header);
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function environment_id_valid(string $id): bool {
    $length = strlen($id);
    if (!in_array($length, [2, 4, 6, 8], true)) return false;
    return preg_match('/^[A-Za-z0-9_-]+$/', $id) === 1;
}

function environment_bounds(string $id): array {
    if (!environment_id_valid($id)) {
        throw new RuntimeException('Ongeldige gebiedsidentifier.');
    }

    $west = -180.0;
    $east = 180.0;
    $south = -90.0;
    $north = 90.0;

    for ($offset = 0; $offset < strlen($id); $offset += 2) {
        $x = strpos(SHARON_ENV_ALPHABET, $id[$offset]);
        $y = strpos(SHARON_ENV_ALPHABET, $id[$offset + 1]);

        if ($x === false || $y === false) {
            throw new RuntimeException('Ongeldige gebiedsidentifier.');
        }

        $width = ($east - $west) / 64.0;
        $height = ($north - $south) / 64.0;

        $nextWest = $west + ((int)$x * $width);
        $nextSouth = $south + ((int)$y * $height);

        $west = $nextWest;
        $east = $nextWest + $width;
        $south = $nextSouth;
        $north = $nextSouth + $height;
    }

    return [
        'west' => $west,
        'east' => $east,
        'south' => $south,
        'north' => $north,
        'center' => [
            'lat' => ($south + $north) / 2.0,
            'lng' => ($west + $east) / 2.0,
        ],
    ];
}

function wrap_longitude(float $value): float {
    while ($value < -180.0) $value += 360.0;
    while ($value > 180.0) $value -= 360.0;
    return $value;
}

function request_bboxes(array $center, float $halfSpanM): array {
    $lat = (float)$center['lat'];
    $lng = (float)$center['lng'];

    $latDelta = $halfSpanM / 111320.0;
    $south = max(-89.9999, $lat - $latDelta);
    $north = min(89.9999, $lat + $latDelta);

    $lngScale = max(0.0001, 111320.0 * cos(deg2rad($lat)));
    $lngDelta = $halfSpanM / $lngScale;

    if ($lngDelta >= 180.0) {
        return [[$south, -180.0, $north, 180.0]];
    }

    $rawWest = $lng - $lngDelta;
    $rawEast = $lng + $lngDelta;

    if ($rawWest < -180.0) {
        return [
            [$south, wrap_longitude($rawWest), $north, 180.0],
            [$south, -180.0, $north, $rawEast],
        ];
    }

    if ($rawEast > 180.0) {
        return [
            [$south, $rawWest, $north, 180.0],
            [$south, -180.0, $north, wrap_longitude($rawEast)],
        ];
    }

    return [[$south, $rawWest, $north, $rawEast]];
}

function selectors_for_mode(string $mode): array {
    if ($mode === 'fine') {
        return [
            'way["highway"]',
            'way["railway"]',
            'way["waterway"]',
            'way["building"]',
        ];
    }

    if ($mode === 'district') {
        return [
            'way["highway"]',
            'way["railway"]',
            'way["waterway"]',
        ];
    }

    if ($mode === 'place') {
        return [
            'way["highway"~"motorway|trunk|primary|secondary|tertiary"]',
            'way["railway"~"rail|light_rail"]',
            'way["waterway"~"river|canal"]',
            'way["boundary"="administrative"]',
        ];
    }

    return [
        'way["highway"~"motorway|trunk|primary"]',
        'way["railway"="rail"]',
        'way["waterway"="river"]',
        'way["boundary"="administrative"]',
    ];
}

function overpass_query(array $scale, array $center): string {
    $selectors = selectors_for_mode((string)$scale['mode']);
    $bboxes = request_bboxes($center, ((float)$scale['spanM']) * 0.82);
    $parts = [];

    foreach ($bboxes as $bbox) {
        $bounds = implode(',', array_map(
            static fn($value) => number_format((float)$value, 6, '.', ''),
            $bbox
        ));

        foreach ($selectors as $selector) {
            $parts[] = $selector . '(' . $bounds . ');';
        }
    }

    return "[out:json][timeout:18];\n(\n  " .
        implode("\n  ", $parts) .
        "\n);\nout geom qt;";
}

function post_form(string $url, string $body): ?string {
    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        if ($curl === false) return null;

        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 22,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/x-www-form-urlencoded',
                'Accept: application/json',
                'User-Agent: SharonEnvironment/1.0',
            ],
        ]);

        $result = curl_exec($curl);
        $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);

        if (!is_string($result) || $status < 200 || $status >= 300) {
            return null;
        }

        return $result;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'timeout' => 22,
            'header' =>
                "Content-Type: application/x-www-form-urlencoded\r\n" .
                "Accept: application/json\r\n" .
                "User-Agent: SharonEnvironment/1.0\r\n",
            'content' => $body,
            'ignore_errors' => true,
        ],
    ]);

    $result = @file_get_contents($url, false, $context);
    return is_string($result) && $result !== '' ? $result : null;
}

function fetch_overpass(string $query): array {
    $body = 'data=' . rawurlencode($query);

    foreach (SHARON_ENV_OVERPASS as $endpoint) {
        $raw = post_form($endpoint, $body);
        if ($raw === null) continue;

        $data = json_decode($raw, true);
        if (is_array($data) && isset($data['elements']) && is_array($data['elements'])) {
            return $data;
        }
    }

    throw new RuntimeException('Geen kaartbron beschikbaar.');
}

function line_type(array $tags): string {
    if (!empty($tags['building'])) return 'building';
    if (!empty($tags['waterway'])) return 'water';
    if (!empty($tags['railway'])) return 'rail';
    if (!empty($tags['boundary'])) return 'boundary';

    $highway = (string)($tags['highway'] ?? '');
    if (preg_match('/motorway|trunk|primary|secondary/', $highway)) return 'major';
    if (preg_match('/footway|path|cycleway|steps|pedestrian/', $highway)) return 'path';
    return 'road';
}

function compact_features(array $data): array {
    $features = [];

    foreach ($data['elements'] ?? [] as $element) {
        if (
            ($element['type'] ?? '') !== 'way' ||
            !isset($element['geometry']) ||
            !is_array($element['geometry'])
        ) {
            continue;
        }

        $points = [];
        foreach ($element['geometry'] as $point) {
            $lat = $point['lat'] ?? null;
            $lng = $point['lon'] ?? null;

            if (!is_numeric($lat) || !is_numeric($lng)) continue;
            $points[] = [
                round((float)$lat, 7),
                round((float)$lng, 7),
            ];
        }

        if (count($points) < 2) continue;

        $features[] = [
            't' => line_type(is_array($element['tags'] ?? null) ? $element['tags'] : []),
            'p' => $points,
        ];

        if (count($features) >= 4500) break;
    }

    return $features;
}

function tile_directory(string $root, string $id): string {
    $parts = [];
    for ($length = 2; $length <= strlen($id); $length += 2) {
        $parts[] = substr($id, 0, $length);
    }
    return rtrim($root, '/') . '/' . implode('/', $parts);
}

function tile_path(string $root, string $id, string $scale): string {
    return tile_directory($root, $id) . '/' . $scale . '.json';
}

function write_json_file(string $path, array $data): bool {
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0755, true)) return false;

    $json = json_encode(
        $data,
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
    if (!is_string($json)) return false;

    $temporary = $path . '.' . bin2hex(random_bytes(5)) . '.tmp';

    if (file_put_contents($temporary, $json, LOCK_EX) === false) {
        return false;
    }

    @chmod($temporary, 0644);

    if (!rename($temporary, $path)) {
        @unlink($temporary);
        return false;
    }

    @chmod($path, 0644);
    return true;
}

function update_coverage(string $environmentRoot, array $tile): void {
    $path = rtrim($environmentRoot, '/') . '/coverage.json';
    $handle = fopen($path, 'c+');
    if ($handle === false) return;

    try {
        if (!flock($handle, LOCK_EX)) return;

        rewind($handle);
        $raw = stream_get_contents($handle);
        $coverage = is_string($raw) && $raw !== ''
            ? json_decode($raw, true)
            : null;

        if (!is_array($coverage)) {
            $coverage = [
                'schema' => 'https://sharon.life/environment/coverage/v1',
                'updatedAt' => null,
                'areas' => [],
            ];
        }

        if (!isset($coverage['areas']) || !is_array($coverage['areas'])) {
            $coverage['areas'] = [];
        }

        $id = (string)$tile['id'];
        $scale = (string)$tile['scale'];
        $existing = is_array($coverage['areas'][$id] ?? null)
            ? $coverage['areas'][$id]
            : [
                'parent' => $tile['parent'] ?? null,
                'level' => $tile['level'] ?? intdiv(strlen($id), 2),
                'scales' => [],
            ];

        if (!isset($existing['scales']) || !is_array($existing['scales'])) {
            $existing['scales'] = [];
        }

        $existing['scales'][$scale] = [
            'generatedAt' => $tile['generatedAt'] ?? gmdate('c'),
            'sourceUpdatedAt' => $tile['sourceUpdatedAt'] ?? null,
            'featureCount' => is_array($tile['features'] ?? null)
                ? count($tile['features'])
                : 0,
        ];

        $coverage['areas'][$id] = $existing;
        $coverage['updatedAt'] = gmdate('c');

        $encoded = json_encode(
            $coverage,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );

        if (!is_string($encoded)) return;

        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, $encoded);
        fflush($handle);
        @chmod($path, 0644);
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function serve_file(string $path, string $cacheState = 'HIT'): never {
    if (!is_file($path)) {
        json_response(404, ['error' => 'Gebied is nog niet opgebouwd.']);
    }

    $raw = file_get_contents($path);
    if (!is_string($raw) || $raw === '') {
        json_response(500, ['error' => 'Gebiedsbestand kon niet worden gelezen.']);
    }

    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=604800, stale-while-revalidate=2592000');
    header('X-Sharon-Environment-Cache: ' . $cacheState);
    echo $raw;
    exit;
}

$origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
if ($origin !== '' && in_array($origin, SHARON_ENV_ALLOWED_ORIGINS, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Accept');
    header('Access-Control-Max-Age: 600');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    if ($origin !== '' && !in_array($origin, SHARON_ENV_ALLOWED_ORIGINS, true)) {
        json_response(403, ['error' => 'Origin niet toegestaan.']);
    }
    http_response_code(204);
    exit;
}

if ($origin !== '' && !in_array($origin, SHARON_ENV_ALLOWED_ORIGINS, true)) {
    json_response(403, ['error' => 'Origin niet toegestaan.']);
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$id = '';
$scaleId = '';

if ($method === 'GET') {
    $id = trim((string)($_GET['id'] ?? ''));
    $scaleId = trim((string)($_GET['scale'] ?? ''));
} elseif ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $body = is_string($raw) ? json_decode($raw, true) : null;

    if (!is_array($body)) {
        json_response(400, ['error' => 'JSON-body ontbreekt.']);
    }

    $id = trim((string)($body['id'] ?? ''));
    $scaleId = trim((string)($body['scale'] ?? ''));
} else {
    json_response(405, ['error' => 'Alleen GET, POST en OPTIONS zijn toegestaan.']);
}

if (!environment_id_valid($id)) {
    json_response(422, ['error' => 'Gebiedsidentifier moet 2, 4, 6 of 8 geldige tekens bevatten.']);
}

$scale = SHARON_ENV_SCALES[$scaleId] ?? null;
if (!is_array($scale)) {
    json_response(422, ['error' => 'Onbekend schaalniveau.']);
}

if (strlen($id) !== (int)$scale['idLength']) {
    json_response(422, ['error' => 'Gebiedsidentifier heeft niet het juiste detailniveau voor deze schaal.']);
}

$environmentRoot = dirname(__DIR__);
$tileRoot = $environmentRoot . '/tiles';
$path = tile_path($tileRoot, $id, $scaleId);

if ($method === 'GET') {
    serve_file($path);
}

if (is_file($path)) {
    serve_file($path, 'HIT');
}

try {
    $bounds = environment_bounds($id);
    $data = fetch_overpass(overpass_query($scale, $bounds['center']));
    $features = compact_features($data);

    $tile = [
        'schema' => SHARON_ENV_SCHEMA,
        'id' => $id,
        'parent' => strlen($id) > 2 ? substr($id, 0, -2) : null,
        'level' => intdiv(strlen($id), 2),
        'scale' => $scaleId,
        'spanM' => (int)$scale['spanM'],
        'generatedAt' => gmdate('c'),
        'source' => 'OpenStreetMap',
        'sourceUpdatedAt' => $data['osm3s']['timestamp_osm_base'] ?? null,
        'attribution' => '© OpenStreetMap contributors',
        'cellBounds' => [
            'west' => $bounds['west'],
            'east' => $bounds['east'],
            'south' => $bounds['south'],
            'north' => $bounds['north'],
        ],
        'features' => $features,
    ];

    if (!write_json_file($path, $tile)) {
        json_response(500, ['error' => 'Gebiedsbestand kon niet online worden opgeslagen.']);
    }

    update_coverage($environmentRoot, $tile);
    serve_file($path, 'MISS');
} catch (Throwable $error) {
    json_response(502, [
        'error' => 'Gebied kon niet worden opgebouwd.',
        'detail' => $error->getMessage(),
    ]);
}
