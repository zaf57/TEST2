<!DOCTYPE html>
<html>
<head>
    <title>Ma première page HTML</title>
    <style>
        style.css
    </style>
    <script>
        var correspondances = {}; // Variable pour stocker les correspondances de codes de pneus et de hauteurs

        function afficherHauteur() {
            var codePneu = document.getElementById("code-pneu").value;
            var hauteurPneu = document.getElementById("hauteur-pneu");

            if (correspondances.hasOwnProperty(codePneu)) {
                hauteurPneu.value = correspondances[codePneu];
            } else {
                hauteurPneu.value = "";
            }
        }

        function chargerCorrespondances(event) {
            var fichier = event.target.files[0];
            var lecteur = new FileReader();

            lecteur.onload = function(e) {
                var contenu = new Uint8Array(e.target.result);
                var classeur = XLSX.read(contenu, { type: 'array' });

                var feuille = classeur.Sheets[classeur.SheetNames[0]];
                var donnees = XLSX.utils.sheet_to_json(feuille);

                correspondances = {}; // Réinitialiser les correspondances

                donnees.forEach(function(d) {
                    correspondances[d.code_pneu] = d.hauteur;
                });

                console.log(correspondances);
            };

            lecteur.readAsArrayBuffer(fichier);
        }
    </script>
</head>
<body>
    <h1>Titre de ma page</h1>

    <input type="file" id="fichier-correspondances" accept=".xlsx" onchange="chargerCorrespondances(event)">

    <br><br>

    <label for="code-pneu">Code pneu:</label>
    <input type="text" id="code-pneu" placeholder="Entrez le code du pneu" onkeyup="afficherHauteur()">

    <br><br>

    <label for="hauteur-pneu">Hauteur du pneu:</label>
    <input type="text" id="hauteur-pneu" readonly>
</body>
</html>
