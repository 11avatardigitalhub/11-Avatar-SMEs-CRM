/**
 * 11 AVATAR DIGITAL HUB - Maps & Location Integration Module
 * Enterprise-grade geolocation & mapping system
 * Google Maps, address autocomplete, route optimization, geo-fencing, location tracking
 * 
 * @module MapsIntegration
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { State } from '../core/state.js';
import { API } from '../core/api.js';
import { Cache } from '../core/cache.js';
import { Permissions } from '../auth/permissions.js';
import { Formatters } from '../utils/formatters.js';
import { Validators } from '../utils/validators.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';

/**
 * Maps Integration - Complete geolocation & mapping services
 * Google Maps, address management, route planning, territory management
 */
class MapsIntegration {
    constructor() {
        // Module identity
        this.moduleName = 'maps';
        this.apiEndpoint = '/api/maps';
        this.cachePrefix = 'maps_';
        this.cacheTimeout = 30 * 60 * 1000; // 30 minutes for geocoding cache
        
        // Map providers
        this.providers = {
            'google': {
                label: 'Google Maps',
                icon: 'fa-google',
                color: '#4285F4',
                apiKey: null,
                libraries: ['places', 'geometry', 'directions', 'visualization'],
                enabled: true,
                defaultCenter: { lat: 20.5937, lng: 78.9629 }, // India center
                defaultZoom: 5
            },
            'openstreetmap': {
                label: 'OpenStreetMap',
                icon: 'fa-map',
                color: '#7EBC6F',
                enabled: true,
                tileURL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                defaultCenter: { lat: 20.5937, lng: 78.9629 },
                defaultZoom: 5
            }
        };
        
        // Map types
        this.mapTypes = {
            'roadmap': { label: 'Road Map', icon: 'fa-road' },
            'satellite': { label: 'Satellite', icon: 'fa-satellite' },
            'hybrid': { label: 'Hybrid', icon: 'fa-layer-group' },
            'terrain': { label: 'Terrain', icon: 'fa-mountain' }
        };
        
        // Location types
        this.locationTypes = {
            'client_office': { label: 'Client Office', icon: 'fa-building', color: '#3B82F6' },
            'meeting_venue': { label: 'Meeting Venue', icon: 'fa-handshake', color: '#10B981' },
            'lead_location': { label: 'Lead Location', icon: 'fa-user-plus', color: '#F59E0B' },
            'branch': { label: 'Our Branch', icon: 'fa-store', color: '#8B5CF6' },
            'warehouse': { label: 'Warehouse', icon: 'fa-warehouse', color: '#EC4899' },
            'event': { label: 'Event Venue', icon: 'fa-calendar-star', color: '#DC2626' },
            'other': { label: 'Other', icon: 'fa-map-pin', color: '#6B7280' }
        };
        
        // Route status
        this.routeStatuses = {
            'planned': { label: 'Planned', color: '#3B82F6', icon: 'fa-calendar' },
            'in_progress': { label: 'In Progress', color: '#F59E0B', icon: 'fa-truck-moving' },
            'completed': { label: 'Completed', color: '#10B981', icon: 'fa-check-circle' },
            'cancelled': { label: 'Cancelled', color: '#DC2626', icon: 'fa-times-circle' }
        };
        
        // Territory types
        this.territoryTypes = {
            'sales': { label: 'Sales Territory', color: '#3B82F6' },
            'service': { label: 'Service Area', color: '#10B981' },
            'delivery': { label: 'Delivery Zone', color: '#F59E0B' },
            'exclusive': { label: 'Exclusive Region', color: '#8B5CF6' }
        };
        
        // Module state
        this.currentProvider = 'google';
        this.mapInstance = null;
        this.markers = new Map();
        this.infoWindows = new Map();
        this.directionsService = null;
        this.directionsRenderer = null;
        this.geocoder = null;
        this.autocompleteService = null;
        this.placesService = null;
        
        // Saved locations
        this.locations = new Map();
        this.selectedLocationId = null;
        
        // Routes
        this.routes = new Map();
        this.activeRouteId = null;
        this.routeWaypoints = [];
        
        // Territories
        this.territories = new Map();
        this.territoryPolygons = new Map();
        
        // Geo-fencing
        this.geofences = new Map();
        this.activeGeofenceAlerts = [];
        
        // Filters
        this.filters = {
            locationType: 'all',
            territory: 'all',
            search: '',
            radius: 50, // km
            showRoutes: true,
            showTerritories: false,
            clusterMarkers: true
        };
        
        // Performance
        this.metrics = {
            totalLocations: 0,
            totalRoutes: 0,
            totalDistance: 0,
            optimizedDistance: 0,
            lastGeocodeRequest: null
        };
        
        // DOM references
        this.elements = {
            container: null,
            mapContainer: null,
            locationList: null,
            routePanel: null,
            territoryPanel: null,
            searchBox: null,
            filterBar: null,
            locationDetail: null,
            distanceInfo: null
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize maps integration
     */
    async init() {
        try {
            const startTime = performance.now();
            
            console.log('[Maps] Initializing maps & location integration...');
            
            // Check permissions
            const canAccess = await Permissions.check('maps', 'read');
            if (!canAccess) {
                console.warn('[Maps] Limited access - permissions required');
                return;
            }
            
            // Load API keys
            await this.loadConfiguration();
            
            // Load saved locations
            await this.loadLocations();
            
            // Load routes
            await this.loadRoutes();
            
            // Load territories
            await this.loadTerritories();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Render if container exists
            if (document.getElementById('maps-container')) {
                await this.render();
            }
            
            const loadTime = performance.now() - startTime;
            console.log(`[Maps] Initialized in ${loadTime.toFixed(2)}ms`);
            
            EventBus.emit('maps:ready', {
                locations: this.locations.size,
                routes: this.routes.size,
                territories: this.territories.size
            });
            
        } catch (error) {
            console.error('[Maps] Initialization failed:', error);
        }
    }
    
    /**
     * Load configuration and API keys
     */
    async loadConfiguration() {
        try {
            const response = await API.get('/api/integrations/maps/config');
            
            if (response.success && response.data) {
                if (response.data.googleApiKey) {
                    this.providers.google.apiKey = response.data.googleApiKey;
                }
                this.currentProvider = response.data.defaultProvider || 'google';
            }
            
            console.log('[Maps] Configuration loaded');
            
        } catch (error) {
            console.error('[Maps] Config load failed:', error);
        }
    }
    
    /**
     * Load saved locations
     */
    async loadLocations() {
        try {
            const response = await API.get(`${this.apiEndpoint}/locations`);
            
            if (response.success && response.data) {
                this.locations.clear();
                response.data.forEach(location => {
                    this.locations.set(location.id, {
                        ...location,
                        formattedAddress: location.address,
                        locationTypeInfo: this.locationTypes[location.type] || this.locationTypes.other,
                        coordinates: {
                            lat: location.latitude,
                            lng: location.longitude
                        },
                        createdAt: Formatters.date(location.createdAt)
                    });
                });
                
                this.metrics.totalLocations = this.locations.size;
                console.log(`[Maps] Loaded ${this.locations.size} locations`);
            }
            
        } catch (error) {
            console.error('[Maps] Locations load failed:', error);
        }
    }
    
    /**
     * Load routes
     */
    async loadRoutes() {
        try {
            const response = await API.get(`${this.apiEndpoint}/routes`);
            
            if (response.success && response.data) {
                this.routes.clear();
                response.data.forEach(route => {
                    this.routes.set(route.id, {
                        ...route,
                        formattedDistance: this.formatDistance(route.totalDistance),
                        formattedDuration: this.formatDuration(route.totalDuration),
                        formattedDate: Formatters.date(route.createdAt),
                        statusInfo: this.routeStatuses[route.status] || this.routeStatuses.planned,
                        waypointCount: route.waypoints?.length || 0
                    });
                });
                
                this.metrics.totalRoutes = this.routes.size;
                console.log(`[Maps] Loaded ${this.routes.size} routes`);
            }
            
        } catch (error) {
            console.error('[Maps] Routes load failed:', error);
        }
    }
    
    /**
     * Load territories
     */
    async loadTerritories() {
        try {
            const response = await API.get(`${this.apiEndpoint}/territories`);
            
            if (response.success && response.data) {
                this.territories.clear();
                response.data.forEach(territory => {
                    this.territories.set(territory.id, {
                        ...territory,
                        typeInfo: this.territoryTypes[territory.type] || this.territoryTypes.sales,
                        coordinates: territory.polygon || [],
                        locationCount: territory.locations?.length || 0
                    });
                });
                
                console.log(`[Maps] Loaded ${this.territories.size} territories`);
            }
            
        } catch (error) {
            console.error('[Maps] Territories load failed:', error);
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        try {
            EventBus.on('maps:geocode', this.geocodeAddress.bind(this));
            EventBus.on('maps:reverse-geocode', this.reverseGeocode.bind(this));
            EventBus.on('maps:calculate-route', this.calculateRoute.bind(this));
            EventBus.on('maps:optimize-route', this.optimizeRoute.bind(this));
            EventBus.on('maps:add-location', this.addLocation.bind(this));
            EventBus.on('maps:update-location', this.updateLocation.bind(this));
            EventBus.on('maps:delete-location', this.deleteLocation.bind(this));
            EventBus.on('maps:create-territory', this.createTerritory.bind(this));
            
            // Auto-geocode when addresses are saved
            EventBus.on('client:created', (client) => {
                if (client.address) {
                    this.autoGeocodeClient(client);
                }
            });
            
            console.log('[Maps] Event listeners initialized');
            
        } catch (error) {
            console.error('[Maps] Event listener setup failed:', error);
        }
    }
    
    /**
     * Initialize Google Map
     */
    async initMap(container, options = {}) {
        try {
            const provider = this.providers[this.currentProvider];
            if (!provider || !provider.enabled) {
                throw new Error('Map provider not available');
            }
            
            // Check if Google Maps API is loaded
            if (this.currentProvider === 'google' && typeof google === 'undefined') {
                await this.loadGoogleMapsAPI();
            }
            
            const mapOptions = {
                center: options.center || provider.defaultCenter,
                zoom: options.zoom || provider.defaultZoom,
                mapTypeId: options.mapType || 'roadmap',
                mapTypeControl: true,
                streetViewControl: true,
                fullscreenControl: true,
                zoomControl: true,
                scaleControl: true,
                rotateControl: true
            };
            
            if (this.currentProvider === 'google') {
                this.mapInstance = new google.maps.Map(container, mapOptions);
                
                // Initialize services
                this.geocoder = new google.maps.Geocoder();
                this.directionsService = new google.maps.DirectionsService();
                this.directionsRenderer = new google.maps.DirectionsRenderer({
                    map: this.mapInstance,
                    suppressMarkers: false,
                    polylineOptions: {
                        strokeColor: '#3B82F6',
                        strokeWeight: 5,
                        strokeOpacity: 0.7
                    }
                });
                this.placesService = new google.maps.places.PlacesService(this.mapInstance);
                this.autocompleteService = new google.maps.places.AutocompleteService();
                
                // Add click listener
                this.mapInstance.addListener('click', (event) => {
                    this.handleMapClick(event.latLng);
                });
                
                // Load existing markers
                this.loadMarkers();
                
                console.log('[Maps] Google Map initialized');
            }
            
            return this.mapInstance;
            
        } catch (error) {
            console.error('[Maps] Map initialization failed:', error);
            Toast.show('Failed to load map', 'error');
            return null;
        }
    }
    
    /**
     * Load Google Maps API dynamically
     */
    async loadGoogleMapsAPI() {
        return new Promise((resolve, reject) => {
            if (typeof google !== 'undefined' && google.maps) {
                resolve();
                return;
            }
            
            const apiKey = this.providers.google.apiKey;
            if (!apiKey) {
                reject(new Error('Google Maps API key not configured'));
                return;
            }
            
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${this.providers.google.libraries.join(',')}&callback=initGoogleMaps`;
            script.async = true;
            script.defer = true;
            
            window.initGoogleMaps = () => {
                console.log('[Maps] Google Maps API loaded');
                resolve();
            };
            
            script.onerror = () => {
                reject(new Error('Failed to load Google Maps API'));
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * Load markers on map
     */
    loadMarkers() {
        if (!this.mapInstance) return;
        
        // Clear existing markers
        this.clearMarkers();
        
        // Add markers for each location
        this.locations.forEach((location) => {
            this.addMarker(location);
        });
        
        // Cluster if enabled
        if (this.filters.clusterMarkers) {
            this.clusterMarkers();
        }
    }
    
    /**
     * Add marker to map
     */
    addMarker(location) {
        if (!this.mapInstance || this.currentProvider !== 'google') return;
        
        try {
            const marker = new google.maps.Marker({
                position: location.coordinates,
                map: this.mapInstance,
                title: location.name,
                label: location.type ? location.type.charAt(0).toUpperCase() : '',
                icon: this.getMarkerIcon(location.type),
                animation: google.maps.Animation.DROP
            });
            
            // Create info window
            const infoWindow = new google.maps.InfoWindow({
                content: this.renderInfoWindowContent(location)
            });
            
            marker.addListener('click', () => {
                this.closeAllInfoWindows();
                infoWindow.open(this.mapInstance, marker);
            });
            
            this.markers.set(location.id, marker);
            this.infoWindows.set(location.id, infoWindow);
            
        } catch (error) {
            console.error('[Maps] Marker add failed:', error);
        }
    }
    
    /**
     * Get custom marker icon based on location type
     */
    getMarkerIcon(type) {
        const color = this.locationTypes[type]?.color || '#3B82F6';
        
        return {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: color,
            fillOpacity: 0.9,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            scale: 10
        };
    }
    
    /**
     * Render info window content
     */
    renderInfoWindowContent(location) {
        return `
            <div class="map-info-window">
                <h5>${this.escapeHtml(location.name)}</h5>
                <p>${this.escapeHtml(location.address)}</p>
                ${location.type ? `
                    <span class="location-type" style="color: ${location.locationTypeInfo.color}">
                        <i class="fas ${location.locationTypeInfo.icon}"></i>
                        ${location.locationTypeInfo.label}
                    </span>
                ` : ''}
                <div class="info-actions">
                    <button class="btn btn-sm btn-primary" onclick="window.Global.Maps.navigateTo('${location.id}')">
                        <i class="fas fa-directions"></i> Directions
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="window.Global.Maps.editLocation('${location.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Clear all markers from map
     */
    clearMarkers() {
        this.markers.forEach(marker => marker.setMap(null));
        this.markers.clear();
        this.infoWindows.forEach(infoWindow => infoWindow.close());
        this.infoWindows.clear();
    }
    
    /**
     * Close all info windows
     */
    closeAllInfoWindows() {
        this.infoWindows.forEach(infoWindow => infoWindow.close());
    }
    
    /**
     * Cluster markers for better performance
     */
    clusterMarkers() {
        // Marker clustering requires additional library
        console.log('[Maps] Marker clustering enabled');
    }
    
    /**
     * Geocode address to coordinates
     */
    async geocodeAddress(address) {
        try {
            // Check cache first
            const cacheKey = `geocode_${address.toLowerCase().replace(/\s+/g, '_')}`;
            const cached = await Cache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                return cached.data;
            }
            
            if (!this.geocoder) {
                throw new Error('Geocoder not initialized');
            }
            
            return new Promise((resolve, reject) => {
                this.geocoder.geocode({ address }, (results, status) => {
                    if (status === 'OK' && results.length > 0) {
                        const location = results[0].geometry.location;
                        const result = {
                            lat: location.lat(),
                            lng: location.lng(),
                            formattedAddress: results[0].formatted_address,
                            placeId: results[0].place_id,
                            components: this.parseAddressComponents(results[0].address_components)
                        };
                        
                        // Cache result
                        Cache.set(cacheKey, result, this.cacheTimeout);
                        
                        this.metrics.lastGeocodeRequest = new Date();
                        
                        resolve(result);
                    } else {
                        reject(new Error(`Geocoding failed: ${status}`));
                    }
                });
            });
            
        } catch (error) {
            console.error('[Maps] Geocoding failed:', error);
            return null;
        }
    }
    
    /**
     * Reverse geocode coordinates to address
     */
    async reverseGeocode(lat, lng) {
        try {
            if (!this.geocoder) {
                throw new Error('Geocoder not initialized');
            }
            
            return new Promise((resolve, reject) => {
                this.geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                    if (status === 'OK' && results.length > 0) {
                        resolve({
                            address: results[0].formatted_address,
                            placeId: results[0].place_id,
                            components: this.parseAddressComponents(results[0].address_components)
                        });
                    } else {
                        reject(new Error(`Reverse geocoding failed: ${status}`));
                    }
                });
            });
            
        } catch (error) {
            console.error('[Maps] Reverse geocoding failed:', error);
            return null;
        }
    }
    
    /**
     * Parse address components
     */
    parseAddressComponents(components) {
        const parsed = {
            street_number: '',
            route: '',
            locality: '',
            city: '',
            state: '',
            country: '',
            pincode: ''
        };
        
        components.forEach(component => {
            const types = component.types;
            
            if (types.includes('street_number')) parsed.street_number = component.long_name;
            if (types.includes('route')) parsed.route = component.long_name;
            if (types.includes('locality')) parsed.locality = component.long_name;
            if (types.includes('administrative_area_level_2')) parsed.city = component.long_name;
            if (types.includes('administrative_area_level_1')) parsed.state = component.long_name;
            if (types.includes('country')) parsed.country = component.long_name;
            if (types.includes('postal_code')) parsed.pincode = component.long_name;
        });
        
        return parsed;
    }
    
    /**
     * Calculate route between locations
     */
    async calculateRoute(origin, destination, waypoints = []) {
        try {
            if (!this.directionsService) {
                throw new Error('Directions service not initialized');
            }
            
            const request = {
                origin: typeof origin === 'string' ? origin : new google.maps.LatLng(origin.lat, origin.lng),
                destination: typeof destination === 'string' ? destination : new google.maps.LatLng(destination.lat, destination.lng),
                travelMode: google.maps.TravelMode.DRIVING,
                optimizeWaypoints: true,
                waypoints: waypoints.map(wp => ({
                    location: typeof wp === 'string' ? wp : new google.maps.LatLng(wp.lat, wp.lng),
                    stopover: true
                }))
            };
            
            return new Promise((resolve, reject) => {
                this.directionsService.route(request, (result, status) => {
                    if (status === 'OK') {
                        // Render route on map
                        this.directionsRenderer.setDirections(result);
                        
                        const route = result.routes[0];
                        const leg = route.legs[0];
                        
                        const routeData = {
                            distance: leg.distance.value, // meters
                            duration: leg.duration.value, // seconds
                            formattedDistance: leg.distance.text,
                            formattedDuration: leg.duration.text,
                            startAddress: leg.start_address,
                            endAddress: leg.end_address,
                            steps: leg.steps.map(step => ({
                                instruction: step.instructions.replace(/<[^>]*>/g, ''),
                                distance: step.distance.text,
                                duration: step.duration.text
                            })),
                            polyline: route.overview_polyline
                        };
                        
                        // Update metrics
                        this.metrics.totalDistance += routeData.distance;
                        
                        resolve(routeData);
                    } else {
                        reject(new Error(`Route calculation failed: ${status}`));
                    }
                });
            });
            
        } catch (error) {
            console.error('[Maps] Route calculation failed:', error);
            Toast.show('Failed to calculate route', 'error');
            return null;
        }
    }
    
    /**
     * Optimize route with multiple stops (TSP)
     */
    async optimizeRoute(waypoints, startPoint = null) {
        try {
            if (waypoints.length < 2) {
                Toast.show('Need at least 2 waypoints to optimize', 'warning');
                return null;
            }
            
            const origin = startPoint || waypoints[0];
            const destination = waypoints[waypoints.length - 1];
            const stops = waypoints.slice(1, -1);
            
            const routeData = await this.calculateRoute(origin, destination, stops);
            
            if (routeData) {
                // Calculate savings
                const originalDistance = this.estimateTotalDistance(waypoints);
                const optimizedDistance = routeData.distance;
                const savings = originalDistance - optimizedDistance;
                
                this.metrics.optimizedDistance += savings;
                
                Toast.show(`Route optimized! Saved ${this.formatDistance(savings)}`, 'success');
            }
            
            return routeData;
            
        } catch (error) {
            console.error('[Maps] Route optimization failed:', error);
            return null;
        }
    }
    
    /**
     * Estimate total distance for waypoints in order
     */
    estimateTotalDistance(waypoints) {
        // Simple estimation using Haversine formula
        let total = 0;
        
        for (let i = 0; i < waypoints.length - 1; i++) {
            const p1 = waypoints[i];
            const p2 = waypoints[i + 1];
            total += this.haversineDistance(
                p1.lat || p1.latitude,
                p1.lng || p1.longitude,
                p2.lat || p2.latitude,
                p2.lng || p2.longitude
            );
        }
        
        return total;
    }
    
    /**
     * Calculate Haversine distance between two points
     */
    haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return R * c; // Distance in meters
    }
    
    /**
     * Convert degrees to radians
     */
    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    /**
     * Auto-geocode client address
     */
    async autoGeocodeClient(client) {
        try {
            const fullAddress = [
                client.address,
                client.city,
                client.state,
                client.pincode,
                'India'
            ].filter(Boolean).join(', ');
            
            const geoResult = await this.geocodeAddress(fullAddress);
            
            if (geoResult) {
                // Save coordinates to client
                await API.put(`/api/clients/${client.id}/location`, {
                    latitude: geoResult.lat,
                    longitude: geoResult.lng,
                    formattedAddress: geoResult.formattedAddress
                });
                
                console.log(`[Maps] Auto-geocoded client: ${client.name}`);
            }
            
        } catch (error) {
            console.error('[Maps] Auto-geocode failed:', error);
        }
    }
    
    /**
     * Add a new saved location
     */
    async addLocation(locationData) {
        try {
            // Geocode if coordinates not provided
            if (!locationData.latitude && locationData.address) {
                const geoResult = await this.geocodeAddress(locationData.address);
                if (geoResult) {
                    locationData.latitude = geoResult.lat;
                    locationData.longitude = geoResult.lng;
                }
            }
            
            const response = await API.post(`${this.apiEndpoint}/locations`, locationData);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            // Add to local store
            const location = {
                ...response.data,
                formattedAddress: response.data.address,
                locationTypeInfo: this.locationTypes[response.data.type] || this.locationTypes.other,
                coordinates: {
                    lat: response.data.latitude,
                    lng: response.data.longitude
                }
            };
            
            this.locations.set(location.id, location);
            this.metrics.totalLocations++;
            
            // Add marker to map
            if (this.mapInstance) {
                this.addMarker(location);
            }
            
            Toast.show('Location added successfully', 'success');
            EventBus.emit('maps:location-added', location);
            
            return location;
            
        } catch (error) {
            console.error('[Maps] Location add failed:', error);
            Toast.show('Failed to add location', 'error');
            return null;
        }
    }
    
    /**
     * Update location
     */
    async updateLocation(locationId, updates) {
        try {
            const response = await API.put(`${this.apiEndpoint}/locations/${locationId}`, updates);
            
            if (!response.success) throw new Error(response.error);
            
            // Update local store
            const location = this.locations.get(locationId);
            if (location) {
                Object.assign(location, response.data);
                this.locations.set(locationId, location);
                
                // Update marker
                this.updateMarker(locationId, location);
            }
            
            return location;
            
        } catch (error) {
            console.error('[Maps] Location update failed:', error);
            return null;
        }
    }
    
    /**
     * Update marker on map
     */
    updateMarker(locationId, location) {
        const marker = this.markers.get(locationId);
        if (marker && location.coordinates) {
            marker.setPosition(new google.maps.LatLng(location.coordinates.lat, location.coordinates.lng));
            marker.setTitle(location.name);
        }
    }
    
    /**
     * Delete location
     */
    async deleteLocation(locationId) {
        try {
            await API.delete(`${this.apiEndpoint}/locations/${locationId}`);
            
            // Remove marker
            const marker = this.markers.get(locationId);
            if (marker) {
                marker.setMap(null);
                this.markers.delete(locationId);
            }
            
            this.locations.delete(locationId);
            this.metrics.totalLocations--;
            
        } catch (error) {
            console.error('[Maps] Location delete failed:', error);
        }
    }
    
    /**
     * Create territory
     */
    async createTerritory(territoryData) {
        try {
            const response = await API.post(`${this.apiEndpoint}/territories`, territoryData);
            
            if (!response.success) throw new Error(response.error);
            
            const territory = {
                ...response.data,
                typeInfo: this.territoryTypes[response.data.type] || this.territoryTypes.sales
            };
            
            this.territories.set(territory.id, territory);
            
            // Draw polygon on map
            if (this.mapInstance && territory.coordinates) {
                this.drawTerritoryPolygon(territory);
            }
            
            Toast.show('Territory created', 'success');
            
            return territory;
            
        } catch (error) {
            console.error('[Maps] Territory creation failed:', error);
            return null;
        }
    }
    
    /**
     * Draw territory polygon on map
     */
    drawTerritoryPolygon(territory) {
        if (!this.mapInstance || !territory.coordinates) return;
        
        // Remove existing polygon
        const existingPolygon = this.territoryPolygons.get(territory.id);
        if (existingPolygon) {
            existingPolygon.setMap(null);
        }
        
        const paths = territory.coordinates.map(coord => ({
            lat: coord.lat || coord.latitude,
            lng: coord.lng || coord.longitude
        }));
        
        const polygon = new google.maps.Polygon({
            paths: paths,
            strokeColor: territory.typeInfo.color,
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: territory.typeInfo.color,
            fillOpacity: 0.15,
            map: this.mapInstance
        });
        
        this.territoryPolygons.set(territory.id, polygon);
    }
    
    /**
     * Handle map click event
     */
    async handleMapClick(latLng) {
        try {
            const reverseResult = await this.reverseGeocode(latLng.lat(), latLng.lng());
            
            if (reverseResult) {
                EventBus.emit('modal:open', {
                    title: 'Add Location',
                    content: this.renderAddLocationForm(latLng, reverseResult),
                    size: 'medium'
                });
            }
            
        } catch (error) {
            console.error('[Maps] Map click handling failed:', error);
        }
    }
    
    /**
     * Render add location form
     */
    renderAddLocationForm(latLng, addressInfo) {
        return `
            <div class="add-location-form">
                <form id="quick-add-location-form">
                    <div class="form-group">
                        <label>Address</label>
                        <input type="text" value="${this.escapeHtml(addressInfo.address)}" readonly>
                    </div>
                    <div class="form-group">
                        <label>Location Name *</label>
                        <input type="text" name="name" required placeholder="e.g., Client Office, Meeting Venue">
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select name="type">
                            ${Object.entries(this.locationTypes).map(([key, type]) => `
                                <option value="${key}">${type.label}</option>
                            `).join('')}
                        </select>
                    </div>
                    <input type="hidden" name="latitude" value="${latLng.lat()}">
                    <input type="hidden" name="longitude" value="${latLng.lng()}">
                    <input type="hidden" name="address" value="${this.escapeHtml(addressInfo.address)}">
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Save Location</button>
                    </div>
                </form>
            </div>
        `;
    }
    
    /**
     * Format distance
     */
    formatDistance(meters) {
        if (!meters || meters === 0) return '0 m';
        if (meters < 1000) return `${Math.round(meters)} m`;
        return `${(meters / 1000).toFixed(1)} km`;
    }
    
    /**
     * Format duration in seconds
     */
    formatDuration(seconds) {
        if (!seconds || seconds === 0) return '0 min';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes} min`;
    }
    
    /**
     * Render maps UI
     */
    async render(container = null) {
        try {
            const targetContainer = container || document.getElementById('maps-container');
            if (!targetContainer) return;
            
            const html = `
                <div class="maps-container">
                    <!-- Maps Header -->
                    <div class="maps-header">
                        <h3><i class="fas fa-map-marked-alt"></i> Maps & Locations</h3>
                        <div class="header-actions">
                            <button class="btn btn-primary" onclick="window.Global.Maps.openAddLocation()">
                                <i class="fas fa-plus"></i> Add Location
                            </button>
                            <button class="btn btn-outline" onclick="window.Global.Maps.createTerritory()">
                                <i class="fas fa-draw-polygon"></i> New Territory
                            </button>
                        </div>
                    </div>
                    
                    <!-- Maps Layout -->
                    <div class="maps-layout">
                        <!-- Sidebar -->
                        <div class="maps-sidebar">
                            <div class="search-box">
                                <i class="fas fa-search"></i>
                                <input type="text" id="location-search" placeholder="Search locations..."
                                       oninput="window.Global.Maps.searchLocations(this.value)">
                            </div>
                            
                            <div class="location-filters">
                                <select onchange="window.Global.Maps.filterByType(this.value)">
                                    <option value="all">All Types</option>
                                    ${Object.entries(this.locationTypes).map(([key, type]) => `
                                        <option value="${key}">${type.label}</option>
                                    `).join('')}
                                </select>
                            </div>
                            
                            <div class="location-list" id="location-list">
                                ${this.renderLocationList()}
                            </div>
                            
                            <div class="route-panel" id="route-panel">
                                <h5><i class="fas fa-route"></i> Routes</h5>
                                ${this.renderRouteList()}
                            </div>
                        </div>
                        
                        <!-- Map Container -->
                        <div class="map-container" id="map-container">
                            <div id="google-map" style="width: 100%; height: 100%;"></div>
                        </div>
                    </div>
                </div>
            `;
            
            targetContainer.innerHTML = html;
            
            // Initialize map after render
            setTimeout(async () => {
                const mapDiv = document.getElementById('google-map');
                if (mapDiv) {
                    await this.initMap(mapDiv);
                }
            }, 200);
            
            console.log('[Maps] UI rendered');
            
        } catch (error) {
            console.error('[Maps] Render failed:', error);
        }
    }
    
    /**
     * Render location list
     */
    renderLocationList() {
        if (this.locations.size === 0) {
            return '<div class="no-locations">No saved locations</div>';
        }
        
        return Array.from(this.locations.values())
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(location => `
                <div class="location-item" onclick="window.Global.Maps.focusLocation('${location.id}')">
                    <div class="location-icon" style="background: ${location.locationTypeInfo.color}20; color: ${location.locationTypeInfo.color}">
                        <i class="fas ${location.locationTypeInfo.icon}"></i>
                    </div>
                    <div class="location-info">
                        <strong>${this.escapeHtml(location.name)}</strong>
                        <small>${this.escapeHtml(location.address?.substring(0, 60) || '')}</small>
                    </div>
                    <span class="location-type-label">${location.locationTypeInfo.label}</span>
                </div>
            `).join('');
    }
    
    /**
     * Render route list
     */
    renderRouteList() {
        if (this.routes.size === 0) {
            return '<div class="no-routes">No routes planned</div>';
        }
        
        return Array.from(this.routes.values())
            .slice(0, 5)
            .map(route => `
                <div class="route-item" onclick="window.Global.Maps.showRoute('${route.id}')">
                    <div class="route-status">
                        <span class="status-dot" style="background: ${route.statusInfo.color}"></span>
                        <span>${route.statusInfo.label}</span>
                    </div>
                    <div class="route-info">
                        <span>${route.formattedDistance}</span>
                        <span>${route.formattedDuration}</span>
                    </div>
                    <small>${route.waypointCount} stops</small>
                </div>
            `).join('');
    }
    
    /**
     * Focus map on a location
     */
    focusLocation(locationId) {
        const location = this.locations.get(locationId);
        if (!location || !this.mapInstance) return;
        
        this.mapInstance.setCenter(location.coordinates);
        this.mapInstance.setZoom(15);
        
        // Open info window
        const infoWindow = this.infoWindows.get(locationId);
        const marker = this.markers.get(locationId);
        
        if (infoWindow && marker) {
            this.closeAllInfoWindows();
            infoWindow.open(this.mapInstance, marker);
        }
    }
    
    /**
     * Search locations
     */
    searchLocations(query) {
        if (!query || query.length < 2) {
            this.renderLocationList();
            return;
        }
        
        const filtered = Array.from(this.locations.values())
            .filter(loc => 
                loc.name.toLowerCase().includes(query.toLowerCase()) ||
                loc.address?.toLowerCase().includes(query.toLowerCase())
            );
        
        // Update location list with filtered results
        const listEl = document.getElementById('location-list');
        if (listEl) {
            if (filtered.length === 0) {
                listEl.innerHTML = '<div class="no-locations">No matching locations</div>';
            } else {
                listEl.innerHTML = filtered.map(loc => `
                    <div class="location-item" onclick="window.Global.Maps.focusLocation('${loc.id}')">
                        <strong>${this.escapeHtml(loc.name)}</strong>
                        <small>${this.escapeHtml(loc.address)}</small>
                    </div>
                `).join('');
            }
        }
    }
    
    /**
     * Navigate to location
     */
    navigateTo(locationId) {
        const location = this.locations.get(locationId);
        if (!location) return;
        
        const url = `https://www.google.com/maps/dir/?api=1&destination=${location.coordinates.lat},${location.coordinates.lng}`;
        window.open(url, '_blank');
    }
    
    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Clean up
     */
    destroy() {
        // Clear map
        if (this.mapInstance) {
            this.clearMarkers();
            this.mapInstance = null;
        }
        
        // Clear territory polygons
        this.territoryPolygons.forEach(polygon => polygon.setMap(null));
        this.territoryPolygons.clear();
        
        EventBus.off('maps:geocode');
        EventBus.off('maps:reverse-geocode');
        EventBus.off('maps:calculate-route');
        EventBus.off('maps:optimize-route');
        EventBus.off('maps:add-location');
        
        console.log('[Maps] Module destroyed');
    }
}

// Singleton
const mapsIntegration = new MapsIntegration();

// Exports
export { mapsIntegration, MapsIntegration };
export default mapsIntegration;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Maps = mapsIntegration;
}


