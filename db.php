<?php
    $host = 'localhost'; // Hôte de la base de données
    $username = 'nom_utilisateur'; // Nom d'utilisateur de la base de données
    $password = 'mot_de_passe'; // Mot de passe de la base de données
    $database = 'nom_base_de_donnees'; // Nom de la base de données

    $conn = new mysqli($host, $username, $password, $database);
    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    }
?>
