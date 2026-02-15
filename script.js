const storage = new LocalStorageWrapper('velib');

// Wrapper pour les proxies CORS - teste plusieurs proxies en cas d'échec
const CORS_PROXIES = [
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, // works well
    (url) => `https://proxy.corsfix.com/?${url}`, // works well

    //(url) =>  `https://api.cors.lol/?url=${url}`, // does not work
    //(url) => `https://api.thebugging.com/cors-proxy?url=${url}`, // error 500

    //(url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`, // error 500
    //(url) => `https://cors-anywhere.com/${url}`, // error 500
    //(url) => `https://cors.eu.org/${url}`, // error 500
    //(url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, // pas fiable

    //(url) => url, // direct fetch as last resort,
    //(url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, // lent

];

async function fetchWithCorsProxy(targetUrl) {
    let lastError = null;

    for (const proxyFn of CORS_PROXIES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            // with header "origin: tdqr.ovh" to bypass tdqr.ovh CORS policy
            const response = await fetch(proxyFn(targetUrl), {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                return response;
            }
        } catch (e) {
            lastError = e;
            console.warn(`Proxy failed for ${targetUrl}:`, e.message);
        }
    }

    throw lastError || new Error('All CORS proxies failed');
}

document.getElementById('delete-data').addEventListener('click', () => {
    storage.clear();
    location.reload();
});

// reload page to refresh data
document.getElementById('update-station-data').addEventListener('click', () => {
    showStationForm();
});

// get setup from localStorage
let stationData;

function showStationForm() {
    const formContainer = document.createElement('div');
    formContainer.className = 'form-container';
    formContainer.innerHTML = `
        <h2>Choisissez vos stations</h2>
        <form id="stationForm">
            <div id="stationsContainer">
                <!-- Stations will be generated dynamically -->
            </div>
            <button type="button" id="addStation" class="btn-common">Ajouter une station</button>
            <button type="button" id="removeStation" class="btn-common">Supprimer la dernière station</button>
            <button type="submit" class="btn-common">Sauvegarder</button>
        </form>
    `;

    // Get existing station data for autofill
    //const existingStationData = storage.getAllItems();
    //const existingStations = existingStationData ? existingStationData.stations : [];
    const existingStations = storage.getItem('stations', []);

    // Remove existing form if any
    const existingForm = document.querySelector('.form-container');
    if (existingForm) {
        existingForm.remove();
    }

    document.body.appendChild(formContainer);

    // Initialize with existing stations or default 2 stations
    let stationCount = Math.max(existingStations.length, 2);

    // Generate initial form groups
    function generateStationInputs() {
        const container = document.getElementById('stationsContainer');
        container.innerHTML = '';

        for (let i = 0; i < stationCount; i++) {
            const newGroup = document.createElement('div');
            newGroup.className = 'form-group';
            const existingValue = existingStations[i] ? existingStations[i].number : '';
            newGroup.innerHTML = `
                <label for="stationNumber${i}">Station ${i + 1}:</label>
                <input type="number" id="stationNumber${i}" value="${existingValue}" required>
            `;
            container.appendChild(newGroup);
        }
    }

    generateStationInputs();

    document.getElementById('addStation').addEventListener('click', () => {
        const container = document.getElementById('stationsContainer');
        const newGroup = document.createElement('div');
        newGroup.className = 'form-group';
        newGroup.innerHTML = `
            <label for="stationNumber${stationCount}">Station ${stationCount + 1}:</label>
            <input type="number" id="stationNumber${stationCount}" required>
        `;
        container.appendChild(newGroup);
        stationCount++;
    });

    document.getElementById('removeStation').addEventListener('click', () => {
        if (stationCount > 2) {
            const container = document.getElementById('stationsContainer');
            container.removeChild(container.lastElementChild);
            stationCount--;
        }
    });

    document.getElementById('stationForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const stations = [];

        for (let i = 0; i < stationCount; i++) {
            const stationNumber = document.getElementById(`stationNumber${i}`).value;
            if (stationNumber) {
                stations.push(stationNumber);
            }
        }

        // Fetch station names
        fetchWithCorsProxy('https://velib-metropole-opendata.smovengo.cloud/opendata/Velib_Metropole/station_information.json')
        // fetch('https://corsproxy.io/?url=https://velib-metropole-opendata.smovengo.cloud/opendata/Velib_Metropole/station_information.json')
            .then(response => response.json())
            .then(data => {
                const stationInfos = data.data.stations;
                const validStations = [];

                for (const stationNumber of stations) {
                    const station = stationInfos.find(s => s.stationCode == stationNumber);
                    if (!station) {
                        alert(`La station ${stationNumber} n'existe pas. Veuillez réessayer.`);
                        return;
                    }
                    validStations.push({
                        number: stationNumber,
                        name: station.name
                    });
                }

                storage.setItem('stations', validStations);
                formContainer.remove();
                location.reload();
            })
            .catch(error => {
                console.error('Error fetching station information:', error);
                alert('Erreur lors de la récupération des informations de station. Veuillez réessayer.');
            });
    });
}

if (storage.isEmpty()) {
    showStationForm();
}

function getStationData() {
    //const data = storage.__getAllItems();
    //if (!data || !Array.isArray(data.stations)) return null;
    //return data;
    return { stations: storage.getItem('stations')};
}

// Create dynamic station panes
function createStationPanes(stations) {
    const container = document.getElementById('half-pane-container');
    container.innerHTML = ''; // Clear existing content

    // Create left column
    const leftColumn = document.createElement('div');
    leftColumn.className = 'station-column';

    // Create right column
    const rightColumn = document.createElement('div');
    rightColumn.className = 'station-column';

    stations.forEach((station, index) => {
        const pane = createStationPane(station, index);
        if (index % 2 === 0) {
            leftColumn.appendChild(pane);
        } else {
            rightColumn.appendChild(pane);
        }
    });

    container.appendChild(leftColumn);
    container.appendChild(rightColumn);
}

function createStationPane(station, index) {
    const pane = document.createElement('div');
    pane.className = 'pane station-pane';
    pane.innerHTML = `
        <div class="container-row-space-around">
            <h2 class="station-name" id="station-name-${index}">${station.name}</h2>
        </div>
        <div class="container-row-space-around">
            <div class="mechanical summary-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                    class="icon mechanical" aria-hidden="true">
                    <circle cx="18.5" cy="17.5" r="3.5"></circle>
                    <circle cx="5.5" cy="17.5" r="3.5"></circle>
                    <circle cx="15" cy="5" r="1"></circle>
                    <path d="M12 17.5V14l-3-3 4-3 2 3h2"></path>
                </svg>
                <p class="info-text">Mécanique</p>
                <p class="count" id="mechanical-count-${index}">--</p>
            </div>
            <div class="electric summary-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                    class="icon electric" aria-hidden="true">
                    <path
                        d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z">
                    </path>
                </svg>
                <p class="info-text">Électrique</p>
                <p class="count" id="electric-count-${index}">--</p>
            </div>
            <div class="parking summary-item">
                <svg class="icon parking" width="24" height="24" viewBox="0 0 128 128"
                    xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M 23.520836,11.511719 L 68.450523,11.511719 C 81.809827,11.511824 92.052004,14.488383 99.177086,20.441406 C 106.34886,26.347746 109.9348,34.785238 109.9349,45.753906 C 109.9348,56.769591 106.34886,65.253957 99.177086,71.207031 C 92.052004,77.113321 81.809827,80.066443 68.450523,80.066406 L 50.591148,80.066406 L 50.591148,116.48828 L 23.520836,116.48828 L 23.520836,11.511719 M 50.591148,31.128906 L 50.591148,60.449219 L 65.567711,60.449219 C 70.81765,60.449275 74.872334,59.183651 77.731773,56.652344 C 80.591078,54.074281 82.020764,50.441472 82.020836,45.753906 C 82.020764,41.066482 80.591078,37.45711 77.731773,34.925781 C 74.872334,32.394615 70.81765,31.128992 65.567711,31.128906 L 50.591148,31.128906" />
                </svg>
                <p class="info-text">Parking</p>
                <p class="count" id="parking-count-${index}">--</p>
            </div>
        </div>
        <div id="bike-list-${index}" class="container-col-space-between">
            téléchargement des données ...
        </div>
    `;
    return pane;
}

// Initialize the dynamic panes
const initialStationData = getStationData();
if (initialStationData) {
    createStationPanes(initialStationData.stations);
}

// fill in summary data
async function fetchStationsStatus() {
    try {
        const response = await fetchWithCorsProxy('https://velib-metropole-opendata.smovengo.cloud/opendata/Velib_Metropole/station_status.json');
        //const response = await fetch('https://corsproxy.io/?url=https://velib-metropole-opendata.smovengo.cloud/opendata/Velib_Metropole/station_status.json');
        const statusData = await response.json();
        return statusData.data.stations;
    } catch (error) {
        console.error('Error fetching station status:', error);
        return [];
    }
}

async function updateStationSummary(stationData) {
    const stations = await fetchStationsStatus();

    stationData.stations.forEach((stationEntry, index) => {
        const station = stations.find(s => s.stationCode == stationEntry.number);
        if (!station) {
            console.error(`Station ${stationEntry.number} not found`);
            return;
        }

        document.getElementById(`mechanical-count-${index}`).innerText = station.num_bikes_available_types.find(type => type.mechanical)?.mechanical || 0;
        document.getElementById(`electric-count-${index}`).innerText = station.num_bikes_available_types.find(type => type.ebike)?.ebike || 0;
        document.getElementById(`parking-count-${index}`).innerText = station.numDocksAvailable;
    });
}

// get precise bike list for a station
// Returns { bikes: [], error: null } on success, { bikes: [], error: 'message' } on error
async function fetchBikeList(stationName, stationID) {
    let bikes = [];
    try {
        const body = {
            "disponibility": "yes",
            "stationName": stationName
        };
        const options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        };
        const response = await fetch(`https://www.velib-metropole.fr/api/secured/searchStation`, options);
        if (!response.ok) {
            console.error('Error fetching bike list: HTTP', response.status);
            return { bikes: [], error: `Erreur HTTP ${response.status}` };
        }
        const data = await response.json();
        if (!data || !data[0] || !data[0].bikes) {
            console.error('Error fetching bike list: invalid response format');
            return { bikes: [], error: 'Réponse API invalide' };
        }
        bikes = data[0].bikes;

    } catch (error) {
        console.error('Error fetching bike list:', error);
        return { bikes: [], error: error.name === 'AbortError' ? 'Timeout' : 'Erreur réseau' };
    }

    try {
        const targetUrl = `https://tdqr.ovh/api/stations/station_${stationID}/details`;
        const response = await fetchWithCorsProxy(targetUrl);
        const data = await response.json();
        tdqrBikes = data.data.bikes;
        bikes.forEach(bike => {
            const tdqrBike = tdqrBikes.find(tdqrBike => tdqrBike.id === `bike_${bike.bikeName}`);
            if (tdqrBike) {
                bike.score = tdqrBike.score || 0;
                bike.lastRideTime = tdqrBike.lastRideTime || "?";
                bike.battery_level = tdqrBike.battery_level || "?";
            } else {
                bike.score = 0;
                bike.lastRideTime = "?";
                bike.battery_level = "?";
            }
        });
    } catch (error) {
        // console.error('Error fetching tdqr.ovh bike list:', error);
        // now we display the http code 
        console.error('Error fetching tdqr.ovh bike list', error);
        return { bikes: [], error: 'Erreur lors de la récupération des scores Velibest' };
    }

    // sort by best bike 
    // criterion 
    // 1. bikeStatus == "disponible"
    // 2. score (from tdqr.ovh)
    // 3. bikeRate
    // 4. bikeRate * numberOfRates
    bikes.sort((a, b) => {
        if (a.bikeStatus === "disponible" && b.bikeStatus !== "disponible") return -1; // prioritize available bikes
        if (b.bikeStatus === "disponible" && a.bikeStatus !== "disponible") return 1; // prioritize available bikes
        if (a.score !== b.score) return b.score - a.score; // sort by score descending
        if (a.bikeRate !== b.bikeRate) return b.bikeRate - a.bikeRate; // sort by bikeRate descending
        // if bikeRate is the same, sort by numberOfRates descending
        return b.numberOfRates - a.numberOfRates;
    });

    return { bikes, error: null };
}

function getTimeTextFromNow(lastRideTime) {
    if (lastRideTime === "?") return "?";

    const lastRideDate = new Date(lastRideTime);
    const diffMs = new Date().getTime() - lastRideDate.getTime();

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    let timeText = '';

    if (diffMinutes < 1) {
        timeText = 'moins d\'une minute';
    } else if (diffMinutes < 60) {
        // il y a X minutes
        timeText = `il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
    } else if (diffHours < 24) {
        // il y a X heures
        timeText = `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
    } else if (diffDays < 30) {
        // il y a X jours
        timeText = `il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    }
    // si trop long, afficher directement la date au format "dd/mm/yyyy"
    return timeText || lastRideDate.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function displayBikeList(bikeList, containerId, error = null) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Clear previous content
    
    // Cas d'erreur API (timeout, 500, etc.)
    if (error) {
        const errorMessage = document.createElement('p');
        errorMessage.textContent = `⚠️ ${error}`;
        container.appendChild(errorMessage);
        return;
    }
    
    // Cas où il n'y a vraiment aucun vélo sur la station
    if (bikeList.length === 0) {
        const noBikesMessage = document.createElement('p');
        noBikesMessage.textContent = 'Aucun vélo disponible';
        container.appendChild(noBikesMessage);
        return;
    }
    bikeList.forEach(bike => {
        if (bike.bikeElectric === "yes") {
            bike.type = "electric";
            bike.typeTxt = "Électrique";
        } else {
            bike.type = "mechanical";
            bike.typeTxt = "Mécanique";
        }

        grayedOut = bike.bikeStatus === "disponible" ? "" : "grayed-out";

        const bikeItem = document.createElement('table');
        bikeItem.className = "bike-item " + bike.type + " " + grayedOut;

        const tbody = document.createElement('tbody');
        const dockPositionRow = document.createElement('tr');
        dockPositionRow.className = "container-row-space-around";
        dockPositionRow.innerHTML = `
            <td><p><strong>Place</strong></p></td>
            <td><p><strong>${bike.dockPosition}</strong></p></td>
        `;
        tbody.appendChild(dockPositionRow);

        const velibestRow = document.createElement('tr');
        velibestRow.className = "container-row-space-around";
        velibestRow.innerHTML = `
            <td><p><strong>Velibest</strong></p></td>
            <td>
                <p>${bike.score}&nbsp;<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-star h-3 w-3" aria-hidden="true"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path></svg>
                </p>
            </td>
        `;
        tbody.appendChild(velibestRow);

        if (bike.bikeElectric === "yes") {
            const batteryRow = document.createElement('tr');
            batteryRow.className = "container-row-space-around";
            batteryRow.innerHTML = `
                <td><p><strong>Batterie</strong></p></td>
                <td><p>${bike.battery_level}&nbsp;%</p></td>
            `;
            tbody.appendChild(batteryRow);
        }

        const lastRideRow = document.createElement('tr');
        lastRideRow.className = "container-row-space-around";
        lastRideRow.innerHTML = `
            <td><p><strong>Dernier trajet</strong></p></td>
            <td><p>${getTimeTextFromNow(bike.lastRideTime)}</p></td>
        `;
        tbody.appendChild(lastRideRow);

        bikeItem.appendChild(tbody);
        container.appendChild(bikeItem);
    });
}

async function updateBikeLists(stationData) {
    const bikeListPromises = stationData.stations.map((station, index) =>
        fetchBikeList(station.name, station.number).then(result => ({ index, ...result }))
    );

    const results = await Promise.all(bikeListPromises);
    results.forEach(({ index, bikes, error }) => {
        displayBikeList(bikes, `bike-list-${index}`, error);
    });
}

async function updatePage() {
    const stationData = getStationData();
    if (!stationData) return;
    await updateStationSummary(stationData);
    await updateBikeLists(stationData);
}

// Call updatePage and handle any errors
updatePage();

refreshButton = document.getElementById('refresh');
refreshButton.addEventListener('click', () => {
    // make the button spin
    refreshButton.classList.add('spin');
    setTimeout(() => {
        refreshButton.classList.remove('spin');
    }, 1000);
    updatePage();
});

// Register service worker for PWA (minimal)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('ServiceWorker registered:', reg))
            .catch(err => console.error('ServiceWorker registration failed:', err));
    });
}
