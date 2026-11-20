<?php
declare(strict_types=1);

/** Server-wide, atomic fixed-window buckets; independent of browser sessions. */
final class AuthRateLimiter
{
    public static function consume(string $key, int $limit, int $window = 900): void
    {
        $directory = sys_get_temp_dir() . '/manga-store-auth-' . substr(hash('sha256', __DIR__), 0, 16);
        if (is_link($directory)) throw new RuntimeException('Invalid throttle storage.');
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('Throttle unavailable.');
        }
        $path = $directory . '/' . hash('sha256', $key) . '.json';
        if (is_link($path)) throw new RuntimeException('Invalid throttle storage.');
        $file = fopen($path, 'c+');
        if ($file === false) throw new RuntimeException('Throttle unavailable.');
        try {
            if (!flock($file, LOCK_EX)) throw new RuntimeException('Throttle unavailable.');
            $raw = stream_get_contents($file);
            $bucket = $raw ? json_decode($raw, true, 8, JSON_THROW_ON_ERROR) : null;
            $now = time();
            if (!is_array($bucket) || ($bucket['reset'] ?? 0) <= $now) $bucket = ['count' => 0, 'reset' => $now + $window];
            if ($bucket['count'] >= $limit) {
                header('Retry-After: ' . max(1, $bucket['reset'] - $now));
                auth_error('RATE_LIMITED', 429);
            }
            ++$bucket['count'];
            rewind($file);
            if (!ftruncate($file, 0) || fwrite($file, json_encode($bucket, JSON_THROW_ON_ERROR)) === false || !fflush($file)) {
                throw new RuntimeException('Throttle unavailable.');
            }
        } finally { flock($file, LOCK_UN); fclose($file); }
    }
}
