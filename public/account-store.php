<?php
declare(strict_types=1);

function accountDatabase(?string $directory = null): PDO
{
    if ($directory === null) {
        $application = str_replace('\\', '/', __DIR__);
        if (preg_match('~^(.+?)/public_html(?:/(.*))?$~', $application, $hosting)) {
            // cPanel's account home sits outside the public document root.
            $subdirectory = $hosting[2] ?? '';
            $suffix = $subdirectory === '' ? '' : '-' . substr(hash('sha256', $subdirectory), 0, 12);
            $directory = $hosting[1] . '/isyara-private' . $suffix;
        } else {
            $directory = sys_get_temp_dir() . '/isyara-accounts-' . substr(hash('sha256', __DIR__), 0, 20);
        }
    }
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Account storage unavailable');
    }
    $db = new PDO('sqlite:' . $directory . '/accounts.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $db->exec('PRAGMA busy_timeout=3000; PRAGMA foreign_keys=ON;');
    $db->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('student','parent','teacher','gpk','therapist','curator','admin')),
            sync_allowed INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS classes (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
        CREATE TABLE IF NOT EXISTS class_members (
            class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
            account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            PRIMARY KEY (class_id,account_id)
        );
        CREATE TABLE IF NOT EXISTS student_links (
            companion_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            student_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            PRIMARY KEY (companion_id,student_id)
        );
        CREATE TABLE IF NOT EXISTS learning_activity (
            student_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            value TEXT NOT NULL,
            PRIMARY KEY (student_id,kind,value)
        );
        CREATE TABLE IF NOT EXISTS companion_notes (
            id INTEGER PRIMARY KEY,
            student_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            author_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS login_attempts (
            address TEXT PRIMARY KEY,
            attempts INTEGER NOT NULL,
            expires INTEGER NOT NULL
        );
        SQL);
    return $db;
}

function startAccountSession(): void
{
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('isyara_account');
    session_set_cookie_params([
        'path' => rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function signedInAccount(PDO $db): ?array
{
    if (!isset($_SESSION['account_id'])) return null;
    $query = $db->prepare('SELECT id, name, role, sync_allowed FROM accounts WHERE id=?');
    $query->execute([$_SESSION['account_id']]);
    return $query->fetch() ?: null;
}

function accessibleStudents(PDO $db, array $account): array
{
    $scope = match ($account['role']) {
        'student' => 's.id=?',
        'teacher' => 'EXISTS (SELECT 1 FROM class_members sc JOIN class_members tc ON tc.class_id=sc.class_id WHERE sc.account_id=s.id AND tc.account_id=?)',
        'parent', 'gpk', 'therapist' => 'EXISTS (SELECT 1 FROM student_links l WHERE l.student_id=s.id AND l.companion_id=?)',
        default => null,
    };
    if ($scope === null) return [];
    $query = $db->prepare("SELECT s.id,s.name FROM accounts s WHERE s.role='student' AND ($scope) ORDER BY s.name");
    $query->execute([$account['id']]);
    return $query->fetchAll();
}
