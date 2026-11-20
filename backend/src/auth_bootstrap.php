<?php
declare(strict_types=1);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/AuthRepository.php';
require_once __DIR__ . '/AuthRateLimiter.php';

function auth_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
function auth_error(string $code, int $status): void
{
    // Stable codes are localized by the client; never include SQL or credentials.
    auth_json(['success' => false, 'error' => ['code' => $code, 'message' => 'Authentication request could not be completed.'],
        'meta' => ['csrf_token' => $_SESSION['csrf'] ?? null]], $status);
}
set_exception_handler(static function (Throwable $error): void {
    error_log('Manga Store auth: request failed (' . get_class($error) . ').');
    auth_error('INTERNAL_ERROR', 500);
});

final class Auth
{
    public static function start(): void
    {
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_trans_sid', '0');
        ini_set('session.gc_maxlifetime', '1800');
        session_name('MANGA_STORE_SESSION');
        $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https || getenv('AUTH_COOKIE_SECURE') === 'true', 'httponly' => true, 'samesite' => 'Lax']);
        if (!session_start()) throw new RuntimeException('Session unavailable.');
        $now = time();
        if (isset($_SESSION['user_id']) && ($now - ($_SESSION['last_seen'] ?? 0) > 1800 || $now - ($_SESSION['authenticated_at'] ?? 0) > 28800)) {
            $_SESSION = [];
            session_regenerate_id(true);
        }
        $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
    }
    public static function method(string $expected): void
    {
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== $expected) {
            header('Allow: ' . $expected);
            auth_error('METHOD_NOT_ALLOWED', 405);
        }
    }
    public static function csrf(): void
    {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!is_string($token) || !hash_equals($_SESSION['csrf'], $token)) auth_error('CSRF_INVALID', 403);
    }
    public static function input(): array
    {
        if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') auth_error('UNSUPPORTED_MEDIA_TYPE', 415);
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 8192) auth_error('INVALID_INPUT', 400);
        $body = file_get_contents('php://input', false, null, 0, 8193);
        if ($body === false || strlen($body) > 8192) auth_error('INVALID_INPUT', 400);
        try { $data = json_decode($body, false, 8, JSON_THROW_ON_ERROR); }
        catch (JsonException $error) { auth_error('INVALID_INPUT', 400); }
        if (!$data instanceof stdClass) auth_error('INVALID_INPUT', 400);
        $data = (array) $data;
        if (array_key_exists('role', $data) || array_key_exists('status', $data) || array_key_exists('id', $data)) auth_error('ROLE_FORBIDDEN', 400);
        return $data;
    }
    public static function credentials(array $input, bool $register): array
    {
        $email = $input['email'] ?? null;
        $password = $input['password'] ?? null;
        if (!is_string($email) || strlen($email) > 190 || !filter_var(trim($email), FILTER_VALIDATE_EMAIL)) auth_error('INVALID_EMAIL', 422);
        if (!is_string($password) || strlen($password) < ($register ? 12 : 1) || strlen($password) > 72 || str_contains($password, "\0")) auth_error('INVALID_PASSWORD', 422);
        $name = $input['full_name'] ?? null;
        if ($register && (!is_string($name) || !preg_match('/\A[^\p{C}]{2,150}\z/u', trim($name)))) auth_error('INVALID_NAME', 422);
        return [strtolower(trim($email)), $password, is_string($name) ? trim($name) : ''];
    }
    public static function repository(): AuthRepository { return new AuthRepository(Database::connect()); }
    public static function requireUser(): array
    {
        if (!isset($_SESSION['user_id'])) auth_error('UNAUTHENTICATED', 401);
        $user = self::repository()->byId((int) $_SESSION['user_id']);
        if (!$user || $user['status'] !== 'active') {
            $_SESSION = ['csrf' => bin2hex(random_bytes(32))];
            session_regenerate_id(true);
            auth_error('UNAUTHENTICATED', 401);
        }
        $_SESSION['last_seen'] = time();
        return $user;
    }
    public static function requireAdmin(): array
    {
        $user = self::requireUser();
        if ($user['role'] !== 'admin') auth_error('FORBIDDEN', 403);
        return $user;
    }
    public static function signedIn(array $user): void
    {
        $_SESSION = [];
        if (!session_regenerate_id(true)) throw new RuntimeException('Session unavailable.');
        $_SESSION = ['user_id' => (int) $user['id'], 'authenticated_at' => time(), 'last_seen' => time(), 'csrf' => bin2hex(random_bytes(32))];
    }
    public static function result(?array $user, int $status = 200): void
    {
        auth_json(['success' => true, 'data' => $user ? AuthRepository::publicUser($user) : null,
            'meta' => ['csrf_token' => $_SESSION['csrf'] ?? null]], $status);
    }
    public static function ip(): string { return $_SERVER['REMOTE_ADDR'] ?? 'unknown'; }
}
Auth::start();
