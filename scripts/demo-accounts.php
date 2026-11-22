<?php
declare(strict_types=1);

// Local fixtures only. Run after npm run build. Optionally pass a demo password.
require_once __DIR__ . '/../dist/account-store.php';

$hosting = ($argv[1] ?? '') === '--hosting';
if ($hosting && (empty($argv[2]) || is_file($argv[2] . '/accounts.sqlite'))) {
    fwrite(STDERR, "Hosting seed requires a new destination without accounts.sqlite.\n");
    exit(1);
}
$db = accountDatabase($hosting ? $argv[2] : null);
$password = $hosting ? null : ($argv[1] ?? bin2hex(random_bytes(8)));
$accounts = [
    'siswa' => ['Siswa Demo A', 'student', 1],
    'siswa-b' => ['Siswa Demo B', 'student', 1],
    'orangtua' => ['Orang Tua Demo', 'parent', 0],
    'guru' => ['Guru Demo', 'teacher', 0],
    'gpk' => ['GPK Demo', 'gpk', 0],
    'terapis' => ['Terapis Demo', 'therapist', 0],
    'kurator' => ['Kurator Demo', 'curator', 0],
    'admin' => ['Admin Demo', 'admin', 0],
];
$db->beginTransaction();
$insert = $db->prepare('INSERT INTO accounts (username,password,name,role,sync_allowed) VALUES (?,?,?,?,?) ON CONFLICT(username) DO UPDATE SET password=excluded.password WHERE accounts.name=excluded.name AND accounts.role=excluded.role');
$credentials = [];
foreach ($accounts as $username => [$name, $role, $sync]) {
    $credential = $password ?? bin2hex(random_bytes(9));
    $credentials[$username] = $credential;
    $insert->execute([$username, password_hash($credential, PASSWORD_DEFAULT), $name, $role, $sync]);
    if (!$insert->rowCount()) throw new RuntimeException("Username already in use: $username");
}
$db->exec("INSERT OR IGNORE INTO classes (name) VALUES ('Kelas Demo A'), ('Kelas Demo B')");
$membership = $db->prepare('INSERT OR IGNORE INTO class_members SELECT c.id,a.id FROM classes c,accounts a WHERE c.name=? AND a.username=?');
foreach ([['Kelas Demo A','siswa'], ['Kelas Demo A','guru'], ['Kelas Demo B','siswa-b']] as [$class, $member]) {
    $membership->execute([$class, $member]);
}
$link = $db->prepare('INSERT OR IGNORE INTO student_links SELECT a.id,s.id FROM accounts a,accounts s WHERE a.username=? AND s.username=?');
foreach (['orangtua','gpk','terapis'] as $companion) {
    $link->execute([$companion, 'siswa']);
}
$link->execute(['gpk', 'siswa-b']);
$db->commit();

if ($hosting) {
    echo "Akun awal ISYARA untuk Rumahweb\n";
    foreach ($credentials as $username => $credential) echo "$username: $credential\n";
} else {
    echo "Tujuh peran demo ISYARA lokal\n";
    echo "Nama pengguna: " . implode(', ', array_keys($accounts)) . "\n";
    echo "Kata sandi demo: $password\n";
}
