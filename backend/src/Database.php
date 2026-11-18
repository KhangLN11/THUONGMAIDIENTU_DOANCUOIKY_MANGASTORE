<?php
declare(strict_types=1);

final class Database
{
    public static function connect(): PDO
    {
        $path = __DIR__ . '/../config/database.local.php';
        $local = is_file($path) ? require $path : [];
        if (!is_array($local)) {
            throw new RuntimeException('Invalid database configuration.');
        }
        $read = static function (string $name, string $key) use ($local): string {
            $value = getenv($name);
            if ($value !== false) {
                return $value;
            }
            if (!array_key_exists($key, $local)) {
                throw new RuntimeException('Missing database configuration.');
            }
            return (string) $local[$key];
        };
        $host = $read('DB_HOST', 'host');
        $port = $read('DB_PORT', 'port');
        $database = $read('DB_NAME', 'database');
        $username = $read('DB_USER', 'username');
        $password = $read('DB_PASSWORD', 'password');
        if (!preg_match('/^[a-zA-Z0-9_.:-]+$/D', $host)
            || !preg_match('/^[a-zA-Z0-9_]+$/D', $database)
            || !ctype_digit($port) || (int) $port < 1 || (int) $port > 65535) {
            throw new RuntimeException('Invalid database configuration.');
        }
        return new PDO(
            "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4",
            $username,
            $password,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_TIMEOUT => 5,
            ]
        );
    }
}
