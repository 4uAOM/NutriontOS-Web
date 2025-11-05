<?php
header('Content-Type: application/json; charset=utf-8');

$input = file_get_contents('php://input');
if (!$input) {
  http_response_code(400);
  echo json_encode(["error" => "Brak danych"]);
  exit;
}

$data = json_decode($input, true);
if (!$data) {
  http_response_code(400);
  echo json_encode(["error" => "Niepoprawny JSON"]);
  exit;
}

$dir = __DIR__ . '/Treningi';
if (!file_exists($dir)) {
  mkdir($dir, 0777, true);
}

$filename = $dir . '/trening_' . $data['id'] . '.json';
file_put_contents($filename, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo json_encode(["status" => "ok", "file" => basename($filename)]);
?>
