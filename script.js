const storage = new LocalStorageWrapper('velib');
const STORAGE_STATIONS_KEY = 'stations';
const STATION_INFO_URL = 'https://velib-metropole-opendata.smovengo.cloud/opendata/Velib_Metropole/station_information.json';
const STATION_STATUS_URL = 'https://velib-metropole-opendata.smovengo.cloud/opendata/Velib_Metropole/station_status.json';
const SEARCH_STATION_URL = 'https://www.velib-metropole.fr/api/secured/searchStation';
const TDQR_STATION_DETAILS_URL = (stationID) => `https://tdqr.ovh/api/stations/station_${stationID}/details`;

const FETCH_TIMEOUT_MS = 500;
const MIN_STATIONS = 2;
const BIKE_FILTER_TYPES = Object.freeze({
    MECHANICAL: 'mechanical',
    ELECTRIC: 'electric'
});

const stationFiltersByIndex = {};
const bikeResultsByStationIndex = {};

const CORS_PROXIES = [
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, // works well
    (url) => `https://proxy.corsfix.com/?${url}`, // works well
    // (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,

    //(url) =>  `https://api.cors.lol/?url=${url}`, // does not work
    //(url) => `https://api.thebugging.com/cors-proxy?url=${url}`, // error 500

    //(url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`, // error 500
    //(url) => `https://cors-anywhere.com/${url}`, // error 500
    //(url) => `https://cors.eu.org/${url}`, // error 500
    //(url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, // pas fiable

    //(url) => url, // direct fetch as last resort,
    //(url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, // lent
];

const STAR_ICON_HTML = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-star h-3 w-3" aria-hidden="true"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path></svg>';

const MECHANICAL_ICON_HTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon mechanical" aria-hidden="true"><circle cx="18.5" cy="17.5" r="3.5"></circle><circle cx="5.5" cy="17.5" r="3.5"></circle><circle cx="15" cy="5" r="1"></circle><path d="M12 17.5V14l-3-3 4-3 2 3h2"></path></svg>';
const ELECTRIC_ICON_HTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon electric" aria-hidden="true"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path></svg>';
const PARKING_ICON_HTML = '<svg class="icon parking" width="24" height="24" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><path d="M 23.520836,11.511719 L 68.450523,11.511719 C 81.809827,11.511824 92.052004,14.488383 99.177086,20.441406 C 106.34886,26.347746 109.9348,34.785238 109.9349,45.753906 C 109.9348,56.769591 106.34886,65.253957 99.177086,71.207031 C 92.052004,77.113321 81.809827,80.066443 68.450523,80.066406 L 50.591148,80.066406 L 50.591148,116.48828 L 23.520836,116.48828 L 23.520836,11.511719 M 50.591148,31.128906 L 50.591148,60.449219 L 65.567711,60.449219 C 70.81765,60.449275 74.872334,59.183651 77.731773,56.652344 C 80.591078,54.074281 82.020764,50.441472 82.020836,45.753906 C 82.020764,41.066482 80.591078,37.45711 77.731773,34.925781 C 74.872334,32.394615 70.81765,31.128992 65.567711,31.128906 L 50.591148,31.128906" /></svg>';

function getStoredStations() {
    return storage.getItem(STORAGE_STATIONS_KEY, []);
}

function getStationData() {
    return { stations: getStoredStations() };
}

function hasConfiguredStations(stationData) {
    return Array.isArray(stationData?.stations) && stationData.stations.length > 0;
}

function getStationFilterState(index) {
    if (!stationFiltersByIndex[index]) {
        stationFiltersByIndex[index] = {
            [BIKE_FILTER_TYPES.MECHANICAL]: true,
            [BIKE_FILTER_TYPES.ELECTRIC]: true
        };
    }

    return stationFiltersByIndex[index];
}

function isElectricBike(bike) {
    return bike.bikeElectric === 'yes';
}

function filterBikesForStation(index, bikes) {
    const filterState = getStationFilterState(index);
    const mechanicalActive = filterState[BIKE_FILTER_TYPES.MECHANICAL];
    const electricActive = filterState[BIKE_FILTER_TYPES.ELECTRIC];

    if (!mechanicalActive && !electricActive) {
        return [];
    }

    return bikes.filter((bike) => {
        const bikeIsElectric = isElectricBike(bike);

        return (mechanicalActive && !bikeIsElectric) || (electricActive && bikeIsElectric);
    });
}

function updateFilterUiState(index) {
    const filterState = getStationFilterState(index);
    const mechanicalItem = document.getElementById(`mechanical-summary-${index}`);
    const electricItem = document.getElementById(`electric-summary-${index}`);

    if (mechanicalItem) {
        mechanicalItem.classList.toggle('active', filterState[BIKE_FILTER_TYPES.MECHANICAL]);
        mechanicalItem.setAttribute('aria-pressed', String(filterState[BIKE_FILTER_TYPES.MECHANICAL]));
    }

    if (electricItem) {
        electricItem.classList.toggle('active', filterState[BIKE_FILTER_TYPES.ELECTRIC]);
        electricItem.setAttribute('aria-pressed', String(filterState[BIKE_FILTER_TYPES.ELECTRIC]));
    }
}

function renderStationBikeList(index) {
    const stationResult = bikeResultsByStationIndex[index];
    if (!stationResult) {
        return;
    }

    if (stationResult.error) {
        displayBikeList([], `bike-list-${index}`, stationResult.error);
        return;
    }

    const filteredBikes = filterBikesForStation(index, stationResult.bikes || []);
    displayBikeList(filteredBikes, `bike-list-${index}`);
}

function toggleFilterAndRender(index, filterType) {
    const filterState = getStationFilterState(index);
    filterState[filterType] = !filterState[filterType];
    updateFilterUiState(index);
    renderStationBikeList(index);
}

async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

async function fetchJsonWithCorsProxy(targetUrl) {
    let lastError = null;

    for (const proxyFn of CORS_PROXIES) {
        try {
            const response = await fetchWithTimeout(proxyFn(targetUrl));
            if (response.ok) {
                return response.json();
            }

            lastError = new Error(`HTTP ${response.status}`);
            console.warn(`Proxy failed for ${targetUrl}: HTTP ${response.status}`);
        } catch (error) {
            lastError = error;
            console.warn(`Proxy failed for ${targetUrl}:`, error.message);
        }
    }

    throw lastError || new Error('All CORS proxies failed');
}

function findStationByCode(stations, stationCode) {
    return stations.find((station) => String(station.stationCode) === String(stationCode));
}

function collectStationNumbers(stationCount) {
    const stations = [];

    for (let i = 0; i < stationCount; i++) {
        const stationNumber = document.getElementById(`stationNumber${i}`)?.value;
        if (stationNumber) {
            stations.push(stationNumber);
        }
    }

    return stations;
}

function createStationInputGroup(index, existingValue = '') {
    const group = document.createElement('div');
    group.className = 'form-group';
    group.innerHTML = `
        <label for="stationNumber${index}">Station ${index + 1}:</label>
        <input type="number" id="stationNumber${index}" value="${existingValue}" required>
    `;
    return group;
}

function renderStationInputs(container, stationCount, existingStations) {
    container.innerHTML = '';

    for (let i = 0; i < stationCount; i++) {
        const existingValue = existingStations[i]?.number || '';
        container.appendChild(createStationInputGroup(i, existingValue));
    }
}

async function saveStationsFromForm(stations, formContainer) {
    try {
        const data = await fetchJsonWithCorsProxy(STATION_INFO_URL);
        const stationInfos = data?.data?.stations || [];
        const validStations = [];

        for (const stationNumber of stations) {
            const station = findStationByCode(stationInfos, stationNumber);
            if (!station) {
                alert(`La station ${stationNumber} n'existe pas. Veuillez réessayer.`);
                return;
            }

            validStations.push({
                number: stationNumber,
                name: station.name
            });
        }

        storage.setItem(STORAGE_STATIONS_KEY, validStations);
        formContainer.remove();
        location.reload();
    } catch (error) {
        console.error('Error fetching station information:', error);
        alert('Erreur lors de la récupération des informations de station. Veuillez réessayer.');
    }
}

function showStationForm() {
    const existingStations = getStoredStations();
    let stationCount = Math.max(existingStations.length, MIN_STATIONS);

    const existingForm = document.querySelector('.form-container');
    if (existingForm) {
        existingForm.remove();
    }

    const formContainer = document.createElement('div');
    formContainer.className = 'form-container';
    formContainer.innerHTML = `
        <h2>Choisissez vos stations</h2>
        <form id="stationForm">
            <div id="stationsContainer"></div>
            <button type="button" id="addStation" class="btn-common">Ajouter une station</button>
            <button type="button" id="removeStation" class="btn-common">Supprimer la dernière station</button>
            <button type="submit" class="btn-common">Sauvegarder</button>
        </form>
    `;

    document.body.appendChild(formContainer);

    const stationForm = document.getElementById('stationForm');
    const stationsContainer = document.getElementById('stationsContainer');
    const addStationButton = document.getElementById('addStation');
    const removeStationButton = document.getElementById('removeStation');

    renderStationInputs(stationsContainer, stationCount, existingStations);

    addStationButton.addEventListener('click', () => {
        stationsContainer.appendChild(createStationInputGroup(stationCount));
        stationCount += 1;
    });

    removeStationButton.addEventListener('click', () => {
        if (stationCount <= MIN_STATIONS) {
            return;
        }

        stationsContainer.removeChild(stationsContainer.lastElementChild);
        stationCount -= 1;
    });

    stationForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const stations = collectStationNumbers(stationCount);
        await saveStationsFromForm(stations, formContainer);
    });
}

function createStationPane(station, index) {
    const pane = document.createElement('div');
    pane.className = 'pane station-pane';
    pane.innerHTML = `
        <div class="container-row-space-around">
            <h2 class="station-name" id="station-name-${index}">${station.name}</h2>
        </div>
        <div class="container-row-space-around">
            <div class="mechanical summary-item filter-toggle active" id="mechanical-summary-${index}" role="button" tabindex="0" aria-label="Filtrer les vélos mécaniques" aria-pressed="true">
                ${MECHANICAL_ICON_HTML}
                <p class="info-text">Mécanique</p>
                <p class="count" id="mechanical-count-${index}">--</p>
            </div>
            <div class="electric summary-item filter-toggle active" id="electric-summary-${index}" role="button" tabindex="0" aria-label="Filtrer les vélos électriques" aria-pressed="true">
                ${ELECTRIC_ICON_HTML}
                <p class="info-text">Électrique</p>
                <p class="count" id="electric-count-${index}">--</p>
            </div>
            <div class="parking summary-item">
                ${PARKING_ICON_HTML}
                <p class="info-text">Parking</p>
                <p class="count" id="parking-count-${index}">--</p>
            </div>
        </div>
        <div id="bike-list-${index}" class="container-col-space-between">
            téléchargement des données ...
        </div>
    `;

    const mechanicalSummaryItem = pane.querySelector(`#mechanical-summary-${index}`);
    const electricSummaryItem = pane.querySelector(`#electric-summary-${index}`);

    const handleToggle = (filterType) => {
        toggleFilterAndRender(index, filterType);
    };

    mechanicalSummaryItem?.addEventListener('click', () => handleToggle(BIKE_FILTER_TYPES.MECHANICAL));
    electricSummaryItem?.addEventListener('click', () => handleToggle(BIKE_FILTER_TYPES.ELECTRIC));

    mechanicalSummaryItem?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleToggle(BIKE_FILTER_TYPES.MECHANICAL);
        }
    });

    electricSummaryItem?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleToggle(BIKE_FILTER_TYPES.ELECTRIC);
        }
    });

    updateFilterUiState(index);

    return pane;
}

function createStationPanes(stations) {
    const container = document.getElementById('half-pane-container');
    container.innerHTML = '';

    const leftColumn = document.createElement('div');
    leftColumn.className = 'station-column';

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

function getBikeCountByType(station, bikeTypeKey) {
    return station.num_bikes_available_types?.find((type) => type[bikeTypeKey])?.[bikeTypeKey] || 0;
}

function setTextContent(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.innerText = value;
    }
}

async function fetchStationsStatus() {
    try {
        const data = await fetchJsonWithCorsProxy(STATION_STATUS_URL);
        return data?.data?.stations || [];
    } catch (error) {
        console.error('Error fetching station status:', error);
        return [];
    }
}

async function updateStationSummary(stationData) {
    const stations = await fetchStationsStatus();

    stationData.stations.forEach((stationEntry, index) => {
        const station = findStationByCode(stations, stationEntry.number);
        if (!station) {
            console.error(`Station ${stationEntry.number} not found`);
            return;
        }

        setTextContent(`mechanical-count-${index}`, getBikeCountByType(station, 'mechanical'));
        setTextContent(`electric-count-${index}`, getBikeCountByType(station, 'ebike'));
        setTextContent(`parking-count-${index}`, station.numDocksAvailable || 0);
    });
}



function mergeTdqrDataIntoBikes(bikes, tdqrBikes) {
    bikes.forEach((bike) => {
        const tdqrBike = tdqrBikes.find((item) => item.id === `bike_${bike.bikeName}`);
        bike.score = tdqrBike?.score || 0;
        bike.lastRideTime = tdqrBike?.lastRideTime || '?';
        bike.battery_level = tdqrBike?.battery_level || '?';
    });
}

function sortBikesByPriority(a, b) {
    const isAvailableA = a.bikeStatus === 'disponible';
    const isAvailableB = b.bikeStatus === 'disponible';

    if (isAvailableA && !isAvailableB) return -1;
    if (isAvailableB && !isAvailableA) return 1;
    if (a.score !== b.score) return b.score - a.score;
    if (a.bikeRate !== b.bikeRate) return b.bikeRate - a.bikeRate;
    return b.numberOfRates - a.numberOfRates;
}

async function fetchBikeList(stationName, stationID) {
    let bikes = [];

    try {
        const response = await fetchWithTimeout(SEARCH_STATION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                disponibility: 'yes',
                stationName
            })
        });

        if (!response.ok) {
            console.error('Error fetching bike list: HTTP', response.status);
            return { bikes: [], error: `Erreur HTTP ${response.status}` };
        }

        const data = await response.json();
        bikes = data?.[0]?.bikes;

        if (!Array.isArray(bikes)) {
            console.error('Error fetching bike list: invalid response format');
            return { bikes: [], error: 'Réponse API invalide' };
        }
    } catch (error) {
        console.error('Error fetching bike list:', error);
        return { bikes: [], error: error.name === 'AbortError' ? 'Timeout' : 'Erreur réseau' };
    }

    try {
        const tdqrData = await fetchJsonWithCorsProxy(TDQR_STATION_DETAILS_URL(stationID));
        const tdqrBikes = tdqrData?.data?.bikes || [];
        mergeTdqrDataIntoBikes(bikes, tdqrBikes);
    } catch (error) {
        console.error('Error fetching tdqr.ovh bike list', error);
        return { bikes: [], error: 'Erreur lors de la récupération des scores Velibest' };
    }

    bikes.sort(sortBikesByPriority);

    return { bikes, error: null };
}

function getTimeTextFromNow(lastRideTime) {
    if (lastRideTime === '?') {
        return '?';
    }

    const lastRideDate = new Date(lastRideTime);
    const diffMs = Date.now() - lastRideDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {return 'moins d\'une minute';}

    if (diffMinutes < 60) {return `il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;}
    if (diffHours < 24) {return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;}
    if (diffDays < 30) {return `il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;}

    return lastRideDate.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function createBikeTableRow(label, valueHtml) {
    const row = document.createElement('tr');
    row.className = 'container-row-space-around';
    row.innerHTML = `
        <td><p><strong>${label}</strong></p></td>
        <td><p>${valueHtml}</p></td>
    `;
    return row;
}

function createBikeItemElement(bike) {
    const isElectric = bike.bikeElectric === 'yes';
    const decoratedBike = {
        ...bike,
        type: isElectric ? 'electric' : 'mechanical',
        typeTxt: isElectric ? 'Électrique' : 'Mécanique'
    }
    const grayedOut = decoratedBike.bikeStatus === 'disponible' ? '' : 'grayed-out';

    const bikeItem = document.createElement('table');
    bikeItem.className = `bike-item ${decoratedBike.type} ${grayedOut}`;

    const tbody = document.createElement('tbody');
    tbody.appendChild(createBikeTableRow('Place', `<strong>${decoratedBike.dockPosition}</strong>`));
    tbody.appendChild(createBikeTableRow('Velibest', `${decoratedBike.score}&nbsp;${STAR_ICON_HTML}`));

    if (decoratedBike.bikeElectric === 'yes') {
        tbody.appendChild(createBikeTableRow('Batterie', `${decoratedBike.battery_level}&nbsp;%`));
    }

    tbody.appendChild(createBikeTableRow('Dernier trajet', getTimeTextFromNow(decoratedBike.lastRideTime)));
    bikeItem.appendChild(tbody);

    return bikeItem;
}

function displayBikeList(bikeList, containerId, error = null) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    container.innerHTML = '';

    if (error) {
        const errorMessage = document.createElement('p');
        errorMessage.textContent = `⚠️ ${error}`;
        container.appendChild(errorMessage);
        return;
    }

    if (bikeList.length === 0) {
        const noBikesMessage = document.createElement('p');
        noBikesMessage.textContent = 'Aucun vélo disponible';
        container.appendChild(noBikesMessage);
        return;
    }

    bikeList.forEach((bike) => {
        container.appendChild(createBikeItemElement(bike));
    });
}

async function updateBikeLists(stationData) {
    const results = await Promise.all(
        stationData.stations.map(async (station, index) => {
            const result = await fetchBikeList(station.name, station.number);
            return { index, ...result };
        })
    );

    results.forEach(({ index, bikes, error }) => {
        bikeResultsByStationIndex[index] = { bikes, error };
        renderStationBikeList(index);
    });
}

async function updatePage() {
    const stationData = getStationData();
    if (!hasConfiguredStations(stationData)) {
        return;
    }

    await updateStationSummary(stationData);
    await updateBikeLists(stationData);
}

function setupActions() {
    const deleteButton = document.getElementById('delete-data');
    const updateStationsButton = document.getElementById('update-station-data');
    const refreshButton = document.getElementById('refresh');

    deleteButton.addEventListener('click', () => {
        storage.clear();
        location.reload();
    });

    updateStationsButton.addEventListener('click', () => {
        showStationForm();
    });

    refreshButton.addEventListener('click', () => {
        refreshButton.classList.add('spin');
        setTimeout(() => {
            refreshButton.classList.remove('spin');
        }, 1000);
        updatePage();
    });
}

function init() {
    setupActions();

    const stationData = getStationData();
    if (!hasConfiguredStations(stationData)) {
        showStationForm();
        return;
    }

    createStationPanes(stationData.stations);
    updatePage();
}

init();
