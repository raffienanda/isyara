<?php
declare(strict_types=1);
require_once __DIR__ . '/account-store.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function accountResponse(array $body, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') accountResponse([], 405);
if (!str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) accountResponse([], 415);
$input = json_decode(file_get_contents('php://input', false, null, 0, 8192), true);
if (!is_array($input)) accountResponse([], 400);

try {
    $db = accountDatabase();
    startAccountSession();
    $action = $input['action'] ?? '';
    if ($action === 'login') {
        $username = $input['username'] ?? null;
        $password = $input['password'] ?? null;
        if (!is_string($username) || !is_string($password) || strlen($username) > 80 || strlen($password) > 256 || $password === '') {
            accountResponse(['error' => 'Isi nama pengguna dan kata sandi.'], 400);
        }
        $ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'local');
        $now = time();
        $db->beginTransaction();
        $db->prepare('DELETE FROM login_attempts WHERE expires<=?')->execute([$now]);
        $db->prepare('INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(address) DO UPDATE SET attempts=attempts+1')->execute([$ip, $now + 600]);
        $limit = $db->prepare('SELECT attempts FROM login_attempts WHERE address=?');
        $limit->execute([$ip]);
        $attempts = $limit->fetchColumn();
        $db->commit();
        if ($attempts > 12) accountResponse(['error' => 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.'], 429);
        $query = $db->prepare('SELECT id,password,role FROM accounts WHERE username=?');
        $query->execute([strtolower(trim($username))]);
        $credential = $query->fetch();
        $hash = $credential['password'] ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
        if (!password_verify($password, $hash) || !$credential || !activeAccountRole($credential['role'])) {
            accountResponse(['error' => 'Nama pengguna atau kata sandi tidak cocok.'], 401);
        }
        $db->prepare('DELETE FROM login_attempts WHERE address=?')->execute([$ip]);
        session_regenerate_id(true);
        $_SESSION['account_id'] = $credential['id'];
        accountResponse(['account' => signedInAccount($db)]);
    }
    if ($action === 'logout') {
        $_SESSION = [];
        session_regenerate_id(true);
        accountResponse(['account' => null]);
    }
    $account = signedInAccount($db);
    session_write_close();
    if ($action === 'session') accountResponse(['account' => $account]);
    if (!$account) accountResponse(['error' => 'Masuk untuk melanjutkan.'], 401);
    if (isset($input['accountId']) && (int)$input['accountId'] !== (int)$account['id']) {
        accountResponse(['error' => 'Sesi sudah berubah. Muat ulang halaman ini.'], 409);
    }

    if ($action === 'sync_activity') {
        if ($account['role'] !== 'student' || !$account['sync_allowed']) accountResponse([], 403);
        $units = ['pecahan','air','cahaya'];
        $words = ['apa','belajar','hari','maaf','makan','saya','siapa','teman','terima kasih','tuli'];
        $family = [];
        for ($chapter = 0; $chapter < 6; $chapter++) {
            foreach (['Mimik','Satu tangan','Dua tangan','Percakapan'] as $mode) $family[] = "$chapter-$mode";
        }
        $activity = $input['activity'] ?? null;
        if (!is_array($activity)) accountResponse([], 400);
        $statement = $db->prepare('INSERT OR IGNORE INTO learning_activity VALUES (?,?,?)');
        $db->beginTransaction();
        foreach (['done' => $units, 'practiceWords' => $words, 'familyDone' => $family] as $kind => $allowed) {
            $values = $activity[$kind] ?? [];
            if (!is_array($values) || count($values) > count($allowed)) accountResponse([], 400);
            foreach ($values as $value) {
                if (!in_array($value, $allowed, true)) accountResponse([], 400);
                $statement->execute([$account['id'], $kind, $value]);
            }
        }
        $db->commit();
        accountResponse(['saved' => true]);
    }

    if ($action === 'school') {
        if ($account['role'] !== 'teacher') accountResponse([], 403);
        $rows = $db->query("SELECT c.name AS classroom,a.name AS student FROM class_members m JOIN classes c ON c.id=m.class_id JOIN accounts a ON a.id=m.account_id WHERE a.role='student' ORDER BY c.name,a.name");
        accountResponse(['roster' => $rows->fetchAll()]);
    }
    if (!in_array($action, ['students','student_detail','save_note'], true)) accountResponse([], 400);
    $students = accessibleStudents($db, $account);
    if ($action === 'students') accountResponse(['students' => $students]);
    $student = filter_var($input['student'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if (!$student || !in_array($student, array_map('intval', array_column($students, 'id')), true)) {
        accountResponse(['error' => 'Akun ini tidak memiliki akses ke siswa tersebut.'], 403);
    }
    if ($action === 'save_note') {
        if (!in_array($account['role'], ['parent','teacher'], true)) accountResponse([], 403);
        $note = $input['text'] ?? null;
        if (!is_string($note) || trim($note) === '' || strlen($note) > 6000) accountResponse([], 400);
        $db->prepare('INSERT INTO companion_notes (student_id,author_id,text) VALUES (?,?,?)')->execute([$student,$account['id'],trim($note)]);
    }
    $activity = $db->prepare('SELECT kind,value FROM learning_activity WHERE student_id=? ORDER BY kind,value');
    $activity->execute([$student]);
    $notes = $db->prepare('SELECT n.id,n.text,n.created_at,a.name,a.role FROM companion_notes n JOIN accounts a ON a.id=n.author_id WHERE n.student_id=? ORDER BY n.id DESC LIMIT 100');
    $notes->execute([$student]);
    accountResponse(['activity' => $activity->fetchAll(), 'notes' => $notes->fetchAll()]);
} catch (Throwable $error) {
    error_log('ISYARA accounts: ' . $error->getMessage());
    accountResponse(['error' => 'Layanan akun belum bisa diakses.'], 503);
}
