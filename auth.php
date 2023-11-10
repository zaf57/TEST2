<?php
    include 'db.php';

    $username = $_POST['username'];
    $password = $_POST['password'];

    $sql = "SELECT * FROM users WHERE username='$username' and password='$password'";
    $result = $conn->query($sql);

    if ($result->num_rows > 0) {
        // Authentification réussie, démarrez la session ici
        session_start();
        $_SESSION['username'] = $username;
        header('Location: dashboard.php'); // Redirection vers la page de tableau de bord
    } else {
        echo 'Identifiants incorrects.';
    }
?>
