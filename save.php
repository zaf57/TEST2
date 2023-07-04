<?php
// Récupérer les valeurs du formulaire
$codePneu = $_POST['code-pneu'];
$hauteurPneu = $_POST['hauteur-pneu'];

// Vérifier si les valeurs sont valides
if (!empty($codePneu) && !empty($hauteurPneu)) {
    // Ouvrir le fichier en mode ajout
    $file = fopen('valeurs.txt', 'a');

    // Écrire les valeurs dans le fichier
    fwrite($file, $codePneu . ' - ' . $hauteurPneu . PHP_EOL);

    // Fermer le fichier
    fclose($file);

    // Répondre avec succès
    echo 'Les valeurs ont été enregistrées avec succès.';
} else {
    // Répondre avec une erreur
    echo 'Veuillez entrer des valeurs valides.';
}
?>
