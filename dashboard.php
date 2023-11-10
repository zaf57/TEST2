<?php
    session_start();
    if (!isset($_SESSION['username'])) {
        header('Location: index.php');
        exit();
    }
?>
<!DOCTYPE html>
<html>
<head>
    <title>Tableau de bord</title>
</head>
<body>
    <h1>Bienvenue <?php echo $_SESSION['username']; ?> sur le tableau de bord !</h1>
    <!-- Ajoutez le contenu du tableau de bord ici -->
</body>
</html>
