<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__.'/Connection.php';
umask(0077);
try {
    $service = new Connection(connection_database());
    $invite = $service->install();
    $payload = rtrim(strtr(base64_encode(json_encode($invite, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
    // The terminal is the only place the single-use bootstrap token is shown.
    fwrite(STDOUT, "Eenmalige startlink; 15 minuten geldig. Open op je eigen toestel:\n".
        'https://stefan-van-dijk.github.io/sharon/#connect='.$payload."\n");
} catch (Throwable $e) {
    fwrite(STDERR, "Instellen mislukt. Controleer het private databasepad en of de eigenaar al geactiveerd is.\n");
    exit(1);
}
