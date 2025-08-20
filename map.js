window.onload = function() {
    // --- Map Initialization ---
    const map = new T.Map('map');
    map.centerAndZoom(new T.LngLat(121.5439, 29.8683), 12);

    // --- DOM Elements ---
    const districtList = document.getElementById('district-list');
    const searchBox = document.getElementById('search-box');
    const countyFilter = document.getElementById('county-filter');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    const itemsPerPageSelect = document.getElementById('items-per-page');
    const sidebar = document.getElementById('sidebar');
    const datasetSelect = document.getElementById('dataset-select');
    const hamburger = document.getElementById('hamburger');
    const backdrop = document.getElementById('backdrop');
    const boundaryModeRadio = document.getElementById('boundary-mode');
    const pointModeRadio = document.getElementById('point-mode');

    // --- State Management ---
    let allDistricts = [];
    let filteredDistricts = [];
    let polygons = new Map();
    let markers = new Map();
    let infoWindows = new Map();
    let currentPage = 1;
    let itemsPerPage = 10;
    let selectedDistrictId = null;
    let currentDisplayMode = 'boundary';
    let currentDataset = null;

    // --- Responsive Helpers ---
    const isMobile = () => window.matchMedia && window.matchMedia('(max-width: 768px)').matches;

    // --- Style Definitions ---
    const defaultStyle = { color: 'blue', weight: 3, opacity: 0.6, fillColor: '#3388ff', fillOpacity: 0.2 };
    const selectedStyle = { color: 'red', weight: 4, opacity: 0.8, fillColor: '#ff0000', fillOpacity: 0.4 };

    // --- Functions ---
    function render() {
        // Filter data based on county and search
        const selectedCounty = countyFilter.value;
        const searchQuery = searchBox.value.toLowerCase();

        let currentlyVisibleDistricts = allDistricts;

        // 1. Filter by county
        if (selectedCounty !== 'all') {
            currentlyVisibleDistricts = currentlyVisibleDistricts.filter(area => area.county === selectedCounty);
        }

        // 2. Filter by search query
        if (searchQuery) {
            currentlyVisibleDistricts = currentlyVisibleDistricts.filter(area => area.name.toLowerCase().includes(searchQuery));
        }

        filteredDistricts = currentlyVisibleDistricts;

        // Update map overlays
        updateMapOverlays();

        // Paginate data
        const totalPages = Math.ceil(filteredDistricts.length / itemsPerPage);
        currentPage = Math.max(1, Math.min(currentPage, totalPages)); // Ensure current page is valid
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const paginatedDistricts = filteredDistricts.slice(start, end);

        // Render list
        districtList.innerHTML = '';
        paginatedDistricts.forEach(area => {
            const li = document.createElement('li');
            li.textContent = `${area.name} (${area.county})`;
            li.dataset.id = area.id;
            if (area.id === selectedDistrictId) {
                li.classList.add('selected');
            }

            li.addEventListener('click', () => {
                selectDistrict(area.id);
            });
            districtList.appendChild(li);
        });

        // Update pagination controls
        pageInfo.textContent = `${currentPage}/${totalPages || 1}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    }

    // --- Event Listeners ---
    function selectDistrict(districtId, lnglat) {
        // Close any currently open info window before proceeding
        map.closeInfoWindow();

        // If the clicked district is already selected, deselect it
        if (districtId === selectedDistrictId) {
            if (currentDisplayMode === 'boundary') {
                const oldPolys = polygons.get(selectedDistrictId);
                if (oldPolys) {
                    const arr = Array.isArray(oldPolys) ? oldPolys : [oldPolys];
                    arr.forEach(poly => poly.setStyle(defaultStyle));
                }
            }

            const oldLi = districtList.querySelector(`li[data-id='${selectedDistrictId}']`);
            if (oldLi) oldLi.classList.remove('selected');

            selectedDistrictId = null;
            return; // Exit
        }

        // If a different district was selected, reset its style
        if (selectedDistrictId !== null) {
            if (currentDisplayMode === 'boundary') {
                const oldPolygon = polygons.get(selectedDistrictId);
                if (oldPolygon) oldPolygon.setStyle(defaultStyle);
            }

            const oldLi = districtList.querySelector(`li[data-id='${selectedDistrictId}']`);
            if (oldLi) oldLi.classList.remove('selected');
        }

        // Update the selected ID to the new district
        selectedDistrictId = districtId;

        // Apply new styles and open info window for the new selection
        if (currentDisplayMode === 'boundary') {
            const newPolys = polygons.get(districtId);
            if (newPolys) {
                const arr = Array.isArray(newPolys) ? newPolys : [newPolys];
                arr.forEach(poly => poly.setStyle(selectedStyle));

                // Set viewport to cover all polygons for this district
                try {
                    const allPts = arr.flatMap(p => (p.getLngLats()[0] || []));
                    if (allPts.length) map.setViewport(allPts);
                } catch (e) {}

                const infoWin = infoWindows.get(districtId);
                if (infoWin) {
                    // Use provided click coordinates or the first polygon center
                    let position = lnglat;
                    if (!position && arr.length > 0) {
                        try { position = arr[0].getBounds().getCenter(); } catch (e) {}
                    }
                    if (position) map.openInfoWindow(infoWin, position);
                }
            }
        } else {
            const marker = markers.get(districtId);
            if (marker) {
                const position = lnglat || marker.getLngLat();
                // Zoom and center the map on the marker
                map.centerAndZoom(position, 16);
                
                const infoWin = infoWindows.get(districtId);
                if (infoWin) {
                    map.openInfoWindow(infoWin, position);
                }
            }
        }

        const newLi = districtList.querySelector(`li[data-id='${districtId}']`);
        if (newLi) newLi.classList.add('selected');

        // Auto-close sidebar on mobile after selection
        if (isMobile()) {
            document.body.classList.remove('sidebar-open');
        }
    }

    function updateMapOverlays() {
        // Clear existing overlays from the map before drawing new ones
        map.clearOverLays();

        filteredDistricts.forEach(area => {
            if (currentDisplayMode === 'boundary') {
                const polyOrArr = polygons.get(area.id);
                if (polyOrArr) {
                    const arr = Array.isArray(polyOrArr) ? polyOrArr : [polyOrArr];
                    arr.forEach(poly => map.addOverLay(poly));
                }
            } else {
                const marker = markers.get(area.id);
                if (marker) {
                    map.addOverLay(marker);
                }
            }
        });
    }

    // --- Event Listeners ---
    countyFilter.addEventListener('change', () => {
        currentPage = 1;
        render();
    });

    searchBox.addEventListener('input', () => {
        currentPage = 1;
        render();
    });

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            render();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredDistricts.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            render();
        }
    });

    itemsPerPageSelect.addEventListener('change', () => {
        itemsPerPage = parseInt(itemsPerPageSelect.value, 10);
        currentPage = 1;
        render();
    });

    // --- Display Mode Toggle Event Listeners ---
    boundaryModeRadio.addEventListener('change', () => {
        if (boundaryModeRadio.checked) {
            currentDisplayMode = 'boundary';
            selectedDistrictId = null; // Reset selection when switching modes
            if (currentDataset) {
                loadDataset(currentDataset); // Reload with boundary data
            }
        }
    });

    pointModeRadio.addEventListener('change', () => {
        if (pointModeRadio.checked) {
            currentDisplayMode = 'point';
            selectedDistrictId = null; // Reset selection when switching modes
            if (currentDataset) {
                loadDataset(currentDataset); // Reload with point data
            }
        }
    });

    // --- Sidebar Toggle (Mobile) ---
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-open');
        });
    }
    if (backdrop) {
        backdrop.addEventListener('click', () => {
            document.body.classList.remove('sidebar-open');
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.body.classList.remove('sidebar-open');
        }
    });

    // --- Data Fetching Helpers ---
    function loadDataset(dataset) {
        // Reset state
        allDistricts = [];
        filteredDistricts = [];
        polygons.clear();
        markers.clear();
        infoWindows.clear();
        selectedDistrictId = null;
        currentDataset = dataset;
        districtList.innerHTML = '';
        // Reset county filter to just 'all'
        while (countyFilter.options.length > 1) countyFilter.remove(1);
        const allOption = countyFilter.querySelector('option[value="all"]');
        if (allOption) allOption.textContent = '全宁波';

        // Determine which file to load based on current display mode
        const file = currentDisplayMode === 'boundary' ? dataset.boundary_file : dataset.point_file;

        fetch(file)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(dataRaw => {
            // Support both formats: array or { dataset_name, features: [] }
            const datasetName = dataRaw && !Array.isArray(dataRaw) ? (dataRaw.dataset_name || 'Map') : 'Map';
            const data = Array.isArray(dataRaw) ? dataRaw : (dataRaw.features || []);

            // Set page title and a header in the sidebar
            try {
                document.title = datasetName;
                const existingTitleEl = document.getElementById('dataset-name');
                const filterControls = document.getElementById('filter-controls');
                if (sidebar && filterControls) {
                    if (!existingTitleEl) {
                        const h = document.createElement('h3');
                        h.id = 'dataset-name';
                        h.textContent = datasetName;
                        h.style.margin = '0 0 10px 0';
                        sidebar.insertBefore(h, filterControls);
                    } else {
                        existingTitleEl.textContent = datasetName;
                    }
                }
            } catch (e) {
                console.warn('Failed to set dataset title:', e);
            }

            allDistricts = data;

            // Update the 'All' option with the total count
            const allOption = countyFilter.querySelector('option[value="all"]');
            if (allOption) {
                allOption.textContent = `全宁波 (${data.length})`;
            }

            // Calculate counts for each county and populate filter
            // Clear existing county options except the first ('all')
            while (countyFilter.options.length > 1) countyFilter.remove(1);
            const countyCounts = data.reduce((acc, area) => {
                acc[area.county] = (acc[area.county] || 0) + 1;
                return acc;
            }, {});
            Object.keys(countyCounts).sort().forEach(county => {
                const option = document.createElement('option');
                option.value = county;
                option.textContent = `${county} (${countyCounts[county]})`;
                countyFilter.appendChild(option);
            });

            // Assign unique IDs and create polygons/markers + info windows
            polygons.clear();
            markers.clear();
            infoWindows.clear();
            data.forEach((area, index) => {
                area.id = index; // Assign a simple unique ID

                if (area.polylines && area.polylines.length > 0) {
                    // Support Polygon: polylines[0] = ring (points)
                    // Support MultiPolygon: polylines = [ [ring], [ring], ... ] or deeper [[[points]]]
                    // Normalize to an array of rings (each ring is array of [lng,lat])
                    let rings = [];
                    try {
                        if (Array.isArray(area.polylines[0][0]) && typeof area.polylines[0][0][0] === 'number') {
                            // Polygon: [ [lng,lat], ... ]
                            rings = [area.polylines[0]];
                        } else if (Array.isArray(area.polylines[0][0]) && Array.isArray(area.polylines[0][0][0])) {
                            // MultiPolygon or nested: [ [ [lng,lat], ... ] , ... ]
                            rings = area.polylines.flat(1);
                        } else {
                            // Fallback: try to flatten deeper
                            rings = area.polylines.flat(2);
                        }
                    } catch (e) {
                        rings = [];
                    }

                    // Build polygons for each ring
                    const polys = [];
                    rings.forEach(ring => {
                        if (Array.isArray(ring) && ring.length > 2 && typeof ring[0][0] === 'number') {
                            const pts = ring.map(p => new T.LngLat(p[0], p[1]));
                            const poly = new T.Polygon(pts, defaultStyle);
                            // Click event for selection
                            poly.addEventListener("click", (e) => {
                                selectDistrict(area.id, e.lnglat);
                            });
                            polys.push(poly);
                        }
                    });

                    if (polys.length > 0) {
                        // Store as array to support MultiPolygon uniformly
                        polygons.set(area.id, polys);

                        // Marker: use centroid of first ring
                        const firstPts = polys[0].getLngLats()[0] || [];
                        if (firstPts.length > 0) {
                            const centroid = calculateCentroid(firstPts);
                            const marker = new T.Marker(centroid);
                            marker.addEventListener("click", (e) => {
                                selectDistrict(area.id, e.lnglat);
                            });
                            markers.set(area.id, marker);
                        }

                        const infoWin = new T.InfoWindow();
                        infoWin.setContent(`<b>${area.name}</b><br>(${area.county})`);
                        infoWindows.set(area.id, infoWin);
                    }
                }
            });

            // Set initial map view
            const allPointsForViewport = data.flatMap(area => {
                if (!area.polylines) return [];
                // Flatten possible MultiPolygon rings
                let rings;
                try {
                    if (Array.isArray(area.polylines[0][0]) && typeof area.polylines[0][0][0] === 'number') {
                        rings = [area.polylines[0]];
                    } else if (Array.isArray(area.polylines[0][0]) && Array.isArray(area.polylines[0][0][0])) {
                        rings = area.polylines.flat(1);
                    } else {
                        rings = area.polylines.flat(2);
                    }
                } catch (e) { rings = []; }
                const firstRing = rings[0] || [];
                return firstRing.map(p => new T.LngLat(p[0], p[1]));
            });
            if (allPointsForViewport.length > 0) {
                map.setViewport(allPointsForViewport);
            }

            render(); // Initial render
        })
        .catch(error => console.error('Error loading boundary data:', error));
    }

    // Helper function to calculate centroid of polygon
    function calculateCentroid(points) {
        let totalLng = 0, totalLat = 0;
        points.forEach(point => {
            totalLng += point.lng;
            totalLat += point.lat;
        });
        return new T.LngLat(totalLng / points.length, totalLat / points.length);
    }

    // Load datasets index and initialize selector
    function initDatasets() {
        if (!datasetSelect) {
            // Fallback: directly load default dataset if selector missing
            const defaultDataset = {
                id: 'ningbo_cbd_cgcs2000',
                name: '宁波商圈（CGCS2000）',
                boundary_file: 'ningbo_cbd_boundaries_cgcs2000.json',
                point_file: 'ningbo_cbd_boundaries_cgcs2000.json'
            };
            loadDataset(defaultDataset);
            return;
        }
        fetch('datasets.json')
            .then(r => {
                if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
                return r.json();
            })
            .then(idx => {
                const list = Array.isArray(idx) ? idx : (idx.datasets || []);
                // Populate selector
                datasetSelect.innerHTML = '';
                list.forEach((d, i) => {
                    const opt = document.createElement('option');
                    opt.value = JSON.stringify(d); // Store entire dataset object
                    opt.textContent = d.name || d.id || d.boundary_file;
                    datasetSelect.appendChild(opt);
                });

                // Bind change
                datasetSelect.addEventListener('change', () => {
                    const datasetJson = datasetSelect.value;
                    const dataset = JSON.parse(datasetJson);
                    loadDataset(dataset);
                });

                // Initial load
                const first = list[0];
                if (first) {
                    datasetSelect.value = JSON.stringify(first);
                    loadDataset(first);
                } else {
                    console.warn('datasets.json is empty; loading default dataset');
                    const defaultDataset = {
                        id: 'ningbo_cbd_cgcs2000',
                        name: '宁波商圈（CGCS2000）',
                        boundary_file: 'ningbo_cbd_boundaries_cgcs2000.json',
                        point_file: 'ningbo_cbd_boundaries_cgcs2000.json'
                    };
                    loadDataset(defaultDataset);
                }
            })
            .catch(err => {
                console.warn('Failed to load datasets.json, fallback to default.', err);
                const defaultDataset = {
                    id: 'ningbo_cbd_cgcs2000',
                    name: '宁波商圈（CGCS2000）',
                    boundary_file: 'ningbo_cbd_boundaries_cgcs2000.json',
                    point_file: 'ningbo_cbd_boundaries_cgcs2000.json'
                };
                loadDataset(defaultDataset);
            });
    }

    // --- Initialize ---
    initDatasets();
};
