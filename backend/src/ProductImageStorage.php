<?php
declare(strict_types=1);

/** Local CLI staging only. This class never writes to MySQL. */
final class ProductImageStorage
{
    private string $root;
    private string $publicBase;
    private const TYPES = [IMAGETYPE_JPEG => ['image/jpeg', 'jpg'], IMAGETYPE_PNG => ['image/png', 'png'], IMAGETYPE_WEBP => ['image/webp', 'webp']];

    public function __construct(string $root, string $publicBase = '/manga-store/backend/public/uploads/products')
    {
        $resolved = realpath($root);
        if ($resolved === false || !is_dir($resolved) || is_link($root)) {
            throw new RuntimeException('Storage root must be an existing real directory.');
        }
        if (!preg_match('~^/[a-zA-Z0-9_/-]+$~D', $publicBase) || strpos($publicBase, '..') !== false) {
            throw new InvalidArgumentException('Invalid public image base path.');
        }
        $this->root = $resolved;
        $this->publicBase = rtrim($publicBase, '/');
    }

    public function stage(string $source, string $productId, bool $write = false): array
    {
        if (!preg_match('/^[1-9][0-9]*$/D', $productId) || filter_var($productId, FILTER_VALIDATE_INT) === false) {
            throw new InvalidArgumentException('Product ID must be a positive integer.');
        }
        $path = realpath($source);
        if ($path === false || !is_file($path) || !is_readable($path) || is_link($source)) {
            throw new InvalidArgumentException('Source must be a readable regular image.');
        }
        clearstatcache(true, $path);
        $size = filesize($path);
        if ($size === false || $size < 1 || $size > 10 * 1024 * 1024) {
            throw new InvalidArgumentException('Image must be between 1 byte and 10 MiB.');
        }
        $bytes = file_get_contents($path, false, null, 0, 10 * 1024 * 1024 + 1);
        if ($bytes === false || strlen($bytes) !== $size) {
            throw new RuntimeException('Could not read image.');
        }
        $info = @getimagesizefromstring($bytes);
        if ($info === false || !isset(self::TYPES[$info[2]])) {
            throw new InvalidArgumentException('Only JPEG, PNG and WebP raster images are supported.');
        }
        [$mime, $extension] = self::TYPES[$info[2]];
        $actualMime = (new finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        $sourceExtension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $validExtensions = $extension === 'jpg' ? ['jpg', 'jpeg'] : [$extension];
        if ($actualMime !== $mime || !in_array($sourceExtension, $validExtensions, true)
            || preg_match('/<\?(?:php|=)/i', $bytes)) {
            throw new InvalidArgumentException('Image extension/content mismatch or embedded script.');
        }
        if ($info[0] < 1 || $info[1] < 1 || $info[0] > 12000 || $info[1] > 12000 || $info[0] * $info[1] > 40000000) {
            throw new InvalidArgumentException('Image exceeds dimension/pixel limits.');
        }
        $directory = $this->root . DIRECTORY_SEPARATOR . $productId;
        if (is_link($directory)) {
            throw new RuntimeException('Symlink storage directories are not allowed.');
        }
        if (file_exists($directory) && realpath($directory) !== $directory) {
            throw new RuntimeException('Invalid product storage directory.');
        }
        $filename = bin2hex(random_bytes(16)) . '.' . $extension;
        $result = [
            'written' => false,
            'image_url' => $this->publicBase . '/' . $productId . '/' . $filename,
            'filename' => $filename,
            'mime_type' => $mime,
            'bytes' => $size,
            'width' => $info[0],
            'height' => $info[1],
        ];
        if (!$write) {
            return $result;
        }
        if (!is_dir($directory) && !mkdir($directory, 0755) && !is_dir($directory)) {
            throw new RuntimeException('Could not create product directory.');
        }
        if (is_link($directory) || realpath($directory) !== $directory) {
            throw new RuntimeException('Storage path escaped its expected directory.');
        }
        $destination = $directory . DIRECTORY_SEPARATOR . $filename;
        // Exclusive creation: existing files are never overwritten, even on random collision.
        $handle = @fopen($destination, 'xb');
        if ($handle === false) {
            throw new RuntimeException('Could not create a new image file.');
        }
        try {
            $offset = 0;
            while ($offset < strlen($bytes)) {
                $written = fwrite($handle, substr($bytes, $offset));
                if ($written === false || $written === 0) {
                    throw new RuntimeException('Incomplete image write.');
                }
                $offset += $written;
            }
        } catch (Throwable $error) {
            fclose($handle);
            unlink($destination);
            throw $error;
        }
        fclose($handle);
        $result['written'] = true;
        return $result;
    }
}
