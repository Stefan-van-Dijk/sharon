<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('LOG_CONNECTION_LIBRARY_ONLY', true);
require __DIR__ . '/connections.php';
$from = log_account_mail_from();
if (!filter_var($from, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Configureer eerst het afzenderadres voor Sharon-accountmail.\n");
    exit(1);
}
$service = new LogNetwork(dirname(__DIR__) . '/private/connections/network-v1.json');
$result = $service->deliverAccountMail(static fn(array $item): bool => log_account_send_mail($item, $from));
echo json_encode($result, JSON_THROW_ON_ERROR) . "\n";
