<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function reject(int $code): never { http_response_code($code); echo '{"error":"Request unavailable"}'; exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') reject(405);
if (!str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) reject(415);
$input = json_decode(file_get_contents('php://input', false, null, 0, 8192), true);
if (!is_array($input)) reject(400);
try {
    require_once __DIR__ . '/account-store.php';
    startAccountSession();
    $account = signedInAccount(accountDatabase());
    session_write_close();
    if (!$account) reject(401);
    $root = sys_get_temp_dir() . '/isyara-' . substr(hash('sha256', __DIR__), 0, 20);
    if (!is_dir($root) && !mkdir($root, 0700, true) && !is_dir($root)) reject(503);
    $db = new PDO('sqlite:' . $root . '/class.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->exec('PRAGMA busy_timeout=3000; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON');
    $db->exec('CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, room TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, text TEXT NOT NULL)');
    $db->prepare('DELETE FROM rooms WHERE expires<=?')->execute([time()]);
    $action=$input['action'] ?? '';
    if ($action === 'create') {
        $room=bin2hex(random_bytes(16));
        $db->prepare('INSERT INTO rooms VALUES (?,?)')->execute([hash('sha256',$room), time()+86400]);
        echo json_encode(['room'=>$room]);exit;
    }
    $room=$input['room'] ?? '';
    if (!is_string($room) || !preg_match('/^[a-f0-9]{32}$/D',$room)) reject(400);
    $id=hash('sha256',$room); $check=$db->prepare('SELECT expires FROM rooms WHERE id=?'); $check->execute([$id]);
    if (!$check->fetchColumn()) reject(404);
    if (in_array($action, ['candidates','propose','review'], true)) {
        if ($account['role'] !== 'teacher') reject(403);
        $db->exec('CREATE TABLE IF NOT EXISTS candidates (id INTEGER PRIMARY KEY, room TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, term TEXT NOT NULL, dialect TEXT NOT NULL, source TEXT NOT NULL, status TEXT NOT NULL DEFAULT "Menunggu tinjauan", revision INTEGER NOT NULL DEFAULT 0, UNIQUE(room,term,dialect,source))');
        if ($action === 'propose') {
            $values = [];
            foreach (['name'=>320,'dialect'=>320,'desc'=>4000] as $field=>$limit) {
                $v = $input[$field] ?? null;
                if (!is_string($v) || trim($v) === '' || strlen($v)>$limit) reject(400);
                $values[]=trim($v);
            }
            $db->prepare('INSERT OR IGNORE INTO candidates(room,term,dialect,source) VALUES (?,?,?,?)')->execute([$id,...$values]);
        }
        if ($action === 'review') {
            $status = $input['status'] ?? null;
            if (!in_array($status,['Menunggu tinjauan','Perlu revisi','Ditinjau bersama pengajar'],true)) reject(400);
            $q=$db->prepare('UPDATE candidates SET status=?,revision=revision+1 WHERE room=? AND id=? AND revision=?');
            $q->execute([$status,$id,$input['id'] ?? 0,$input['revision'] ?? -1]);
            if (!$q->rowCount()) reject(409);
        }
        $q=$db->prepare('SELECT id,term AS name,dialect,source AS description,status,revision FROM candidates WHERE room=? ORDER BY id DESC LIMIT 100');
        $q->execute([$id]);
        echo json_encode(['rows'=>$q->fetchAll(PDO::FETCH_ASSOC)]);
        exit;
    }
    if ($action === 'practice' || $action === 'progress') {
        $db->exec('CREATE TABLE IF NOT EXISTS practice (room TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, word TEXT NOT NULL, PRIMARY KEY(room,word))');
        if ($action === 'practice') {
            $word = $input['word'] ?? '';
            if (!in_array($word, ['apa','belajar','hari','maaf','makan','saya','siapa','teman','terima kasih','tuli'], true)) reject(400);
            $db->prepare('INSERT OR IGNORE INTO practice(room,word) VALUES (?,?)')->execute([$id,$word]);
        }
        $q = $db->prepare('SELECT word AS id,word FROM practice WHERE room=? ORDER BY word');
        $q->execute([$id]);
        echo json_encode(['rows'=>$q->fetchAll(PDO::FETCH_ASSOC)]);
        exit;
    }
    if ($action==='send') {
        $text=$input['text'] ?? ''; if (!is_string($text)||trim($text)===''||strlen($text)>4000) reject(400);
        $db->prepare('INSERT INTO messages (room,text) VALUES (?,?)')->execute([$id,trim($text)]);
    } elseif ($action!=='read') reject(400);
    $q=$db->prepare('SELECT id,text FROM messages WHERE room=? ORDER BY id DESC LIMIT 100');$q->execute([$id]);
    echo json_encode(['rows'=>array_reverse($q->fetchAll(PDO::FETCH_ASSOC))], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {reject(503);}

