document.getElementById('clear-station-data').addEventListener('click', () => {
    localStorage.removeItem('stationData');
    location.reload();
});

let stationData;

if (!localStorage.getItem('stationData')) {
    /*

    stationData = {
        origin: "1002",
        originName: "Victoria - Place du Chatelet",
        destination: "1003",
        destinationName: "Saint-Denis - Rivoli"
    };
    localStorage.setItem('stationData', JSON.stringify(stationData));*/
    // add a div centered on the screen with a a form to input 
    const formContainer = document.createElement('div');
    formContainer.className = 'form-container';
    formContainer.innerHTML = `
        <h2>Choisissez vos stations</h2>
        <form id="stationForm">
                <div class="form-group">
                    <label for="originStation">Numéro de la station d'origine:</label>
                    <input type="number" id="originStationNumber" required>
                </div>
                <div class="form-group">
                    <label for="destinationStation">Numéro de la station de destination:</label>
                    <input type="number" id="destinationStationNumber" required>
                </div>
                <button type="submit">Sauvegarder</button>
            </form>
    `;
    // make the form on top of the page
    formContainer.style.position = 'fixed';
    formContainer.style.top = '0';
    formContainer.style.backgroundColor = 'white';
    formContainer.style.height = "100vh";
    formContainer.style.width = "100vw";
    document.body.appendChild(formContainer);

    document.getElementById('stationForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const originStationNumber = document.getElementById('originStationNumber').value;
        const destinationStationNumber = document.getElementById('destinationStationNumber').value;

        // Fetch station names
        fetch(`https://corsproxy.io/?url=https://velib-metropole-opendata.smovengo.cloud/opendata/Velib_Metropole/station_information.json`)
            .then(response => response.json())
            .then(data => {
                const stations = data.data.stations;
                const originStation = stations.find(station => station.stationCode == originStationNumber);
                const destinationStation = stations.find(station => station.stationCode == destinationStationNumber);

                if (!originStation || !destinationStation) {
                    alert('Une ou les deux stations n\'existent pas. Veuillez réessayer.');
                    return;
                }

                stationData = {
                    origin: originStationNumber,
                    originName: originStation.name,
                    destination: destinationStationNumber,
                    destinationName: destinationStation.name
                };

                localStorage.setItem('stationData', JSON.stringify(stationData));
                location.reload();
            })
            .catch(error => {
                console.error('Error fetching station information:', error);
                alert('Erreur lors de la récupération des informations de station. Veuillez réessayer.');
            });
    });
} 

// set up 
myStationData = JSON.parse(localStorage.getItem('stationData'));
document.getElementById('station-name-origin').textContent = myStationData.originName;
document.getElementById('station-name-destination').textContent = myStationData.destinationName;

// fill in summary data
async function fetchStationsStatus() {
    try {
        const response = await fetch(`https://corsproxy.io/?url=https://velib-metropole-opendata.smovengo.cloud/opendata/Velib_Metropole/station_status.json`);
        const statusData = await response.json();
        return statusData.data.stations;
    } catch (error) {
        console.error('Error fetching station status:', error);
        return [];
    }
}

async function updateStationSummary() {
    const stations = await fetchStationsStatus();
    originStation = stations.find(station => station.stationCode == myStationData.origin);
    destinationStation = stations.find(station => station.stationCode == myStationData.destination);
    if (!originStation || !destinationStation) {
        console.error('One or both stations not found');
        return;
    }
    document.getElementById('mechanical-count-origin').innerText = originStation.num_bikes_available_types.find(type => type.mechanical)?.mechanical || 0;
    document.getElementById('electric-count-origin').innerText = originStation.num_bikes_available_types.find(type => type.ebike)?.ebike || 0;
    document.getElementById('parking-count-origin').innerText = originStation.numDocksAvailable;

    document.getElementById('mechanical-count-destination').innerText = destinationStation.num_bikes_available_types.find(type => type.mechanical)?.mechanical || 0;
    document.getElementById('electric-count-destination').innerText = destinationStation.num_bikes_available_types.find(type => type.ebike)?.ebike || 0;
    document.getElementById('parking-count-destination').innerText = destinationStation.numDocksAvailable;
}


// get bike list
async function fetchBikeList(stationName) {
    const body = {
        "disponibility": "yes",
        "stationName": stationName
    };
    const headers = {
        "Content-Type": "application/json"
    };
    const options = {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body)
    };

    try {
        const response = await fetch(`https://www.velib-metropole.fr/api/secured/searchStation`, options);
        const data = await response.json();
        let bikes = data[0].bikes;

        // we now sort by best bike 
        // criterion 
        // 1. bikeStatus == "disponible"
        // 2. bikeRate
        // 3. bikeRate * numberOfRates
        bikes.sort((a, b) => {
            if (a.bikeStatus === "disponible" && b.bikeStatus !== "disponible") return -1; // prioritize available bikes
            if (b.bikeStatus === "disponible" && a.bikeStatus !== "disponible") return 1; // prioritize available bikes
            if (a.bikeRate !== b.bikeRate) return b.bikeRate - a.bikeRate; // sort by bikeRate descending
            // if bikeRate is the same, sort by numberOfRates descending
            return b.numberOfRates - a.numberOfRates;
        });     

        return bikes;
    } catch (error) {
        console.error('Error fetching bike list:', error);
        return [];
    }
}

function displayBikeList(bikeList, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Clear previous content
    if (bikeList.length === 0) {
        // make a p object with a message, do not use .innerHTML
        const noBikesMessage = document.createElement('p');
        noBikesMessage.textContent = 'Aucun vélo disponible';
        noBikesMessage.className = 'no-bikes-message';
        container.appendChild(noBikesMessage);
        return;
    }
    bikeList.forEach(bike => {
        console.log(bike);
        if (bike.bikeElectric === "yes") {
            bike.type = "electric";
            bike.typeTxt = "Électrique";
        } else {
            bike.type = "mechanical";
            bike.typeTxt = "Mécanique";
        }

        grayedOut = bike.bikeStatus === "disponible" ? "" : "grayed-out";

        const bikeItem = document.createElement('table');
        bikeItem.className = "bike-item "+ bike.type + " " + grayedOut;
        
        const tbody = document.createElement('tbody');
        const row1 = document.createElement('tr');
        row1.className = "container-row-space-around";
        row1.innerHTML = `
            <td><p><strong>Place</strong></p></td>
            <td><p><strong>${bike.dockPosition}</strong></p></td>
        `;
        tbody.appendChild(row1);

        const row2 = document.createElement('tr');
        row2.className = "container-row-space-around";
        row2.innerHTML = `
            <td><p><strong>Score</strong></p></td>
            <td><p>${bike.bikeRate} (${bike.numberOfRates} notes)</p></td>
        `;
        tbody.appendChild(row2);

        const row3 = document.createElement('tr');
        row3.className = "container-row-space-around";
        row3.innerHTML = `
            <td><p><strong>Type</strong></p></td>
            <td><p>${bike.typeTxt}</p></td>
        `;
        tbody.appendChild(row3);

        const row4 = document.createElement('tr');
        row4.className = "container-row-space-around";
        row4.innerHTML = `
            <td><p><strong>ID</strong></p></td>
            <td><p>${bike.bikeName}</p></td>
        `;
        tbody.appendChild(row4);

        bikeItem.appendChild(tbody);
        container.appendChild(bikeItem);
    });
}

async function updateBikeLists(bikeListOriginPromise, bikeListDestinationPromise) {
    const bikeListOrigin = await bikeListOriginPromise;
    const bikeListDestination = await bikeListDestinationPromise;
    displayBikeList(bikeListOrigin, 'bike-list-origin');
    displayBikeList(bikeListDestination, 'bike-list-destination');
}

async function updatePage(){
    
    await updateStationSummary();
    await updateBikeLists(fetchBikeList(myStationData.originName), fetchBikeList(myStationData.destinationName));

}

// Call updatePage and handle any errors
updatePage();

refreshButton = document.getElementById('refresh');
refreshButton.addEventListener('click', () => {
    updatePage();
});