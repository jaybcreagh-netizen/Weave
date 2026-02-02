# Location & Weather Intelligence: Free API Stack

## Document Overview

| Property | Value |
|----------|-------|
| **Purpose** | Add location autocomplete, venue discovery, and weather-aware suggestions using free APIs |
| **Status** | Design Complete - Ready for Review |
| **Last Updated** | January 2025 |
| **Monthly Cost** | $0 (free tier APIs) |
| **Enhances** | Oracle suggestions, interaction logging, plan wizard |

---

## Part 1: Overview & Goals

### What We're Building

A location intelligence layer that enables:
1. **Smart location input** - Autocomplete when logging/planning weaves
2. **Venue discovery** - Find real places matching friend archetypes
3. **Weather awareness** - Suggest indoor/outdoor activities based on conditions
4. **Location history** - Track and suggest favorite meeting spots

### What We're NOT Building

- Full map display (no map tiles)
- Turn-by-turn directions
- Real-time location tracking
- Location-based notifications/geofencing

### Why Free APIs?

| Provider | Google Places Cost | Our Stack Cost |
|----------|-------------------|----------------|
| Autocomplete | $2.83/1K | $0 (Photon) |
| Venue Search | $32/1K | $0 (Foursquare) |
| Place Details | $17/1K | $0 (Foursquare) |
| Weather | N/A | $0 (OpenWeatherMap) |
| **Monthly (est. 5K calls)** | **~$47** | **$0** |

---

## Part 2: API Stack

### 2.1 Photon (OpenStreetMap)

**Purpose:** Address/location autocomplete and geocoding

| Feature | Details |
|---------|---------|
| Provider | Komoot (public instance) |
| Data Source | OpenStreetMap |
| Cost | Free |
| Rate Limit | Fair use (no hard limit) |
| API Key | Not required |
| Docs | https://photon.komoot.io |

**Capabilities:**
- Forward geocoding (address → coordinates)
- Reverse geocoding (coordinates → address)
- Autocomplete with location bias
- Multi-language support

**Limitations:**
- No venue ratings or reviews
- No opening hours
- Less accurate than Google in some regions
- Public instance has fair use limits

### 2.2 Foursquare Places API

**Purpose:** Venue discovery, ratings, photos, categories

| Feature | Details |
|---------|---------|
| Provider | Foursquare |
| Cost | Free |
| Rate Limit | 50 requests/second |
| Monthly Limit | None |
| API Key | Required (free signup) |
| Docs | https://docs.foursquare.com/developer/reference/places-api-overview |

**Capabilities:**
- Venue search by name, category, or location
- Detailed venue info (ratings, hours, photos, tips)
- Category-based discovery (cafes, restaurants, bars, etc.)
- Price level indicators
- "Open now" filtering

**Why Foursquare over Google:**
- Completely free with generous limits
- Excellent venue/POI data
- Rich category taxonomy
- Good photo coverage

### 2.3 OpenWeatherMap

**Purpose:** Current weather and forecasts for activity suggestions

| Feature | Details |
|---------|---------|
| Provider | OpenWeatherMap |
| Cost | Free |
| Rate Limit | 60 calls/minute |
| Daily Limit | 1,000 calls |
| API Key | Required (free signup) |
| Docs | https://openweathermap.org/api |

**Capabilities:**
- Current weather conditions
- 5-day / 3-hour forecast
- Temperature, precipitation, wind
- Weather icons and descriptions

---

## Part 3: Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
├─────────────────────────────────────────────────────────────────┤
│  PlaceAutocomplete    VenueSuggestions    WeatherBadge          │
│  Component            Component           Component             │
└──────────┬───────────────────┬───────────────────┬──────────────┘
           │                   │                   │
           ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LOCATION INTELLIGENCE SERVICE                  │
├─────────────────────────────────────────────────────────────────┤
│  • Unified API for all location operations                      │
│  • Caching layer (reduces API calls)                            │
│  • Coordinate ↔ address conversion                              │
│  • Archetype → category mapping                                 │
└──────────┬───────────────────┬───────────────────┬──────────────┘
           │                   │                   │
           ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  PhotonService  │ │FoursquareService│ │  WeatherService │
│  (Geocoding)    │ │ (Venues)        │ │  (Weather)      │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Photon API     │ │ Foursquare API  │ │ OpenWeatherMap  │
│  (Free)         │ │ (Free)          │ │ (Free)          │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Data Flow

```
User types "Blue Bottle" in location field
    │
    ▼
LocationIntelligenceService.searchPlaces()
    │
    ├─► PhotonService.autocomplete("Blue Bottle")
    │   └─► Returns: addresses containing "Blue Bottle"
    │
    └─► FoursquareService.searchPlaces("Blue Bottle")
        └─► Returns: Blue Bottle Coffee venues with ratings
    │
    ▼
Merge & deduplicate results
    │
    ▼
Display in autocomplete dropdown
    │
    ▼
User selects "Blue Bottle Coffee - Hayes Valley"
    │
    ▼
FoursquareService.getPlaceDetails(fsq_id)
    │
    ▼
Store in interaction.location + interaction.place_id
```

---

## Part 4: Data Models

### 4.1 Core Types

```typescript
// src/modules/location/types/location.types.ts

/**
 * Unified place representation across all APIs
 */
interface Place {
  // Identity
  id: string;                    // Internal UUID
  externalId?: string;           // Foursquare fsq_id or OSM id
  source: 'foursquare' | 'photon' | 'manual';

  // Display
  name: string;
  displayAddress: string;
  shortAddress?: string;         // "Hayes Valley, SF"

  // Location
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  city?: string;
  country?: string;

  // Venue data (Foursquare only)
  venue?: {
    rating?: number;             // 1-5 scale
    ratingCount?: number;
    priceLevel?: 1 | 2 | 3 | 4;  // $ to $$$$
    categories: string[];        // ['Coffee Shop', 'Cafe']
    primaryCategory?: string;
    hours?: string;              // "Open until 6 PM"
    isOpenNow?: boolean;
    photoUrl?: string;
    website?: string;
    phone?: string;
  };

  // Weave-specific (local data)
  weaveData?: {
    timesVisited: number;
    lastVisited: Date;
    averageVibeScore?: number;
    friendsMetHere: string[];
    nickname?: string;           // "Our spot"
    isFavorite: boolean;
  };
}

/**
 * Weather context for activity suggestions
 */
interface WeatherContext {
  // Location
  city: string;
  fetchedAt: Date;

  // Current conditions
  current: {
    temperature: number;         // Celsius
    feelsLike: number;
    humidity: number;
    description: string;         // "Partly cloudy"
    icon: WeatherIcon;
    windSpeed: number;           // m/s
    isOutdoorFriendly: boolean;
  };

  // Next 24 hours
  forecast: {
    willRain: boolean;
    willSnow: boolean;
    highTemp: number;
    lowTemp: number;
    rainProbability: number;     // 0-1
    bestOutdoorWindow?: {
      start: Date;
      end: Date;
      description: string;       // "Clear skies 2-5 PM"
    };
  };

  // Activity recommendation
  activityType: 'indoor' | 'outdoor' | 'either';
  activityReason: string;        // "Rain expected this afternoon"
}

type WeatherIcon =
  | 'clear-day' | 'clear-night'
  | 'partly-cloudy-day' | 'partly-cloudy-night'
  | 'cloudy' | 'rain' | 'snow' | 'thunderstorm' | 'fog';

/**
 * Search/autocomplete result
 */
interface PlaceSearchResult {
  id: string;
  name: string;
  secondaryText: string;         // Address or category
  source: 'foursquare' | 'photon';
  venueCategory?: string;        // "Coffee Shop"
  distance?: number;             // meters, if location provided
  rating?: number;
}

/**
 * User's location preferences
 */
interface LocationPreferences {
  // Privacy
  sharePreciseLocation: boolean; // Default: false

  // Defaults
  defaultCity?: string;          // Fallback when no GPS
  homeLocation?: Place;
  workLocation?: Place;

  // Features
  weatherEnabled: boolean;       // Default: true
  venuePhotosEnabled: boolean;   // Default: true

  // Search
  defaultSearchRadiusKm: number; // Default: 10
  preferredCategories?: string[];
}
```

### 4.2 Database Schema

```typescript
// Add to src/db/schema.ts

/**
 * Saved/favorite places
 */
tableSchema({
  name: 'saved_places',
  columns: [
    // Identity
    { name: 'external_id', type: 'string', isOptional: true, isIndexed: true },
    { name: 'source', type: 'string' },  // 'foursquare' | 'photon' | 'manual'

    // Display
    { name: 'name', type: 'string' },
    { name: 'display_address', type: 'string' },
    { name: 'short_address', type: 'string', isOptional: true },

    // Location
    { name: 'latitude', type: 'number', isOptional: true },
    { name: 'longitude', type: 'number', isOptional: true },
    { name: 'city', type: 'string', isOptional: true },
    { name: 'country', type: 'string', isOptional: true },

    // Venue data (JSON)
    { name: 'venue_data_json', type: 'string', isOptional: true },

    // Weave data
    { name: 'times_visited', type: 'number' },
    { name: 'last_visited_at', type: 'number', isOptional: true, isIndexed: true },
    { name: 'average_vibe_score', type: 'number', isOptional: true },
    { name: 'friends_met_here_json', type: 'string', isOptional: true },
    { name: 'nickname', type: 'string', isOptional: true },
    { name: 'is_favorite', type: 'boolean', isIndexed: true },

    // Metadata
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ]
})

/**
 * Weather cache
 */
tableSchema({
  name: 'weather_cache',
  columns: [
    { name: 'city', type: 'string', isIndexed: true },
    { name: 'weather_data_json', type: 'string' },
    { name: 'fetched_at', type: 'number', isIndexed: true },
    { name: 'expires_at', type: 'number', isIndexed: true },
  ]
})

// Update interactions table - add place reference
// In existing 'interactions' table, add:
{ name: 'place_id', type: 'string', isOptional: true, isIndexed: true }

// Add location preferences to user_profile
// In existing 'user_profiles' table, add:
{ name: 'location_preferences_json', type: 'string', isOptional: true }
```

### 4.3 WatermelonDB Models

```typescript
// src/db/models/SavedPlace.ts

import { Model } from '@nozbe/watermelondb';
import { field, json, date, readonly } from '@nozbe/watermelondb/decorators';

export class SavedPlace extends Model {
  static table = 'saved_places';

  @field('external_id') externalId?: string;
  @field('source') source!: 'foursquare' | 'photon' | 'manual';

  @field('name') name!: string;
  @field('display_address') displayAddress!: string;
  @field('short_address') shortAddress?: string;

  @field('latitude') latitude?: number;
  @field('longitude') longitude?: number;
  @field('city') city?: string;
  @field('country') country?: string;

  @json('venue_data_json', (json) => json || {}) venueData!: Place['venue'];

  @field('times_visited') timesVisited!: number;
  @date('last_visited_at') lastVisitedAt?: Date;
  @field('average_vibe_score') averageVibeScore?: number;
  @json('friends_met_here_json', (json) => json || []) friendsMetHere!: string[];
  @field('nickname') nickname?: string;
  @field('is_favorite') isFavorite!: boolean;

  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  /**
   * Convert to Place interface
   */
  toPlace(): Place {
    return {
      id: this.id,
      externalId: this.externalId,
      source: this.source,
      name: this.name,
      displayAddress: this.displayAddress,
      shortAddress: this.shortAddress,
      coordinates: this.latitude && this.longitude ? {
        latitude: this.latitude,
        longitude: this.longitude,
      } : undefined,
      city: this.city,
      country: this.country,
      venue: this.venueData,
      weaveData: {
        timesVisited: this.timesVisited,
        lastVisited: this.lastVisitedAt,
        averageVibeScore: this.averageVibeScore,
        friendsMetHere: this.friendsMetHere,
        nickname: this.nickname,
        isFavorite: this.isFavorite,
      },
    };
  }
}
```

---

## Part 5: Services

### 5.1 PhotonService (Geocoding)

```typescript
// src/modules/location/services/photon.service.ts

/**
 * Photon geocoding service (OpenStreetMap data)
 * FREE - No API key required
 *
 * Docs: https://photon.komoot.io
 */
export class PhotonService {
  private readonly baseUrl = 'https://photon.komoot.io';
  private readonly timeout = 5000;

  /**
   * Search for locations with autocomplete
   */
  async autocomplete(
    query: string,
    options?: {
      lat?: number;
      lon?: number;
      limit?: number;
      lang?: string;
      locationBias?: number;  // How strongly to prefer nearby results
    }
  ): Promise<PhotonResult[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const params = new URLSearchParams({
      q: query,
      limit: String(options?.limit || 5),
      lang: options?.lang || 'en',
    });

    // Bias results toward user's location
    if (options?.lat && options?.lon) {
      params.set('lat', String(options.lat));
      params.set('lon', String(options.lon));
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/?${params}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Photon API error: ${response.status}`);
      }

      const data = await response.json();
      return this.mapResults(data.features);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Photon request timed out');
        return [];
      }
      throw error;
    }
  }

  /**
   * Reverse geocode: coordinates to address
   */
  async reverseGeocode(
    latitude: number,
    longitude: number
  ): Promise<PhotonResult | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/reverse?lat=${latitude}&lon=${longitude}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (!data.features?.length) {
        return null;
      }

      return this.mapResult(data.features[0]);
    } catch (error) {
      console.error('Reverse geocode failed:', error);
      return null;
    }
  }

  private mapResults(features: any[]): PhotonResult[] {
    return features.map((f) => this.mapResult(f));
  }

  private mapResult(feature: any): PhotonResult {
    const props = feature.properties;
    const coords = feature.geometry.coordinates;

    return {
      id: `photon_${props.osm_id || Math.random().toString(36).slice(2)}`,
      source: 'photon' as const,
      name: props.name || props.street || props.city || 'Unknown',
      displayAddress: this.formatAddress(props),
      shortAddress: this.formatShortAddress(props),
      coordinates: {
        latitude: coords[1],
        longitude: coords[0],
      },
      city: props.city || props.town || props.village,
      country: props.country,
      type: props.osm_value,
    };
  }

  private formatAddress(props: any): string {
    const parts = [
      props.name,
      props.housenumber && props.street
        ? `${props.housenumber} ${props.street}`
        : props.street,
      props.city || props.town || props.village,
      props.state,
      props.country,
    ].filter(Boolean);

    return parts.join(', ');
  }

  private formatShortAddress(props: any): string {
    const parts = [
      props.city || props.town || props.village,
      props.state || props.country,
    ].filter(Boolean);

    return parts.join(', ');
  }
}

interface PhotonResult {
  id: string;
  source: 'photon';
  name: string;
  displayAddress: string;
  shortAddress: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  city?: string;
  country?: string;
  type?: string;
}
```

### 5.2 FoursquareService (Venues)

```typescript
// src/modules/location/services/foursquare.service.ts

import { FOURSQUARE_API_KEY } from '@/config/api-keys';

/**
 * Foursquare Places API service
 * FREE - 50 requests/second, no monthly limit
 *
 * Docs: https://docs.foursquare.com/developer/reference/places-api-overview
 */
export class FoursquareService {
  private readonly baseUrl = 'https://api.foursquare.com/v3';
  private readonly timeout = 8000;

  private get headers() {
    return {
      'Authorization': FOURSQUARE_API_KEY,
      'Accept': 'application/json',
    };
  }

  /**
   * Search for venues by name/query
   */
  async searchPlaces(
    query: string,
    options?: {
      near?: string;           // City name
      ll?: string;             // "lat,lng"
      radius?: number;         // meters (max 100000)
      categories?: string[];   // Foursquare category IDs
      openNow?: boolean;
      minPrice?: number;
      maxPrice?: number;
      limit?: number;
    }
  ): Promise<FoursquarePlace[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const params = new URLSearchParams({
      query,
      limit: String(options?.limit || 8),
    });

    // Location (required - either ll or near)
    if (options?.ll) {
      params.set('ll', options.ll);
      if (options?.radius) {
        params.set('radius', String(Math.min(options.radius, 100000)));
      }
    } else if (options?.near) {
      params.set('near', options.near);
    } else {
      // Default to a major city if no location provided
      params.set('near', 'San Francisco, CA');
    }

    if (options?.categories?.length) {
      params.set('categories', options.categories.join(','));
    }

    if (options?.openNow) {
      params.set('open_now', 'true');
    }

    if (options?.minPrice) {
      params.set('min_price', String(options.minPrice));
    }

    if (options?.maxPrice) {
      params.set('max_price', String(options.maxPrice));
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/places/search?${params}`,
        { headers: this.headers }
      );

      if (!response.ok) {
        throw new Error(`Foursquare API error: ${response.status}`);
      }

      const data = await response.json();
      return data.results.map((r: any) => this.mapPlace(r));
    } catch (error) {
      console.error('Foursquare search failed:', error);
      return [];
    }
  }

  /**
   * Search by category (for archetype matching)
   */
  async searchByCategory(
    categoryIds: string[],
    location: { ll?: string; near?: string },
    options?: {
      openNow?: boolean;
      sort?: 'RELEVANCE' | 'RATING' | 'DISTANCE';
      limit?: number;
    }
  ): Promise<FoursquarePlace[]> {
    const params = new URLSearchParams({
      categories: categoryIds.join(','),
      limit: String(options?.limit || 10),
      sort: options?.sort || 'RATING',
    });

    if (location.ll) {
      params.set('ll', location.ll);
      params.set('radius', '8000');  // 8km
    } else if (location.near) {
      params.set('near', location.near);
    }

    if (options?.openNow) {
      params.set('open_now', 'true');
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/places/search?${params}`,
        { headers: this.headers }
      );

      if (!response.ok) {
        throw new Error(`Foursquare API error: ${response.status}`);
      }

      const data = await response.json();
      return data.results.map((r: any) => this.mapPlace(r));
    } catch (error) {
      console.error('Foursquare category search failed:', error);
      return [];
    }
  }

  /**
   * Get detailed place information
   */
  async getPlaceDetails(fsqId: string): Promise<FoursquarePlace | null> {
    const fields = [
      'fsq_id', 'name', 'location', 'categories', 'rating', 'price',
      'hours', 'photos', 'tips', 'website', 'tel', 'verified',
      'stats', 'popularity', 'description'
    ].join(',');

    try {
      const response = await fetch(
        `${this.baseUrl}/places/${fsqId}?fields=${fields}`,
        { headers: this.headers }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return this.mapPlace(data, true);
    } catch (error) {
      console.error('Foursquare place details failed:', error);
      return null;
    }
  }

  /**
   * Get place photos
   */
  async getPlacePhotos(
    fsqId: string,
    limit: number = 3
  ): Promise<string[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/places/${fsqId}/photos?limit=${limit}`,
        { headers: this.headers }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.map((p: any) => `${p.prefix}300x200${p.suffix}`);
    } catch (error) {
      return [];
    }
  }

  private mapPlace(raw: any, detailed: boolean = false): FoursquarePlace {
    const location = raw.location || {};
    const categories = raw.categories || [];
    const primaryCategory = categories[0];

    let photoUrl: string | undefined;
    if (raw.photos?.length) {
      const photo = raw.photos[0];
      photoUrl = `${photo.prefix}300x200${photo.suffix}`;
    }

    return {
      id: raw.fsq_id,
      source: 'foursquare' as const,
      name: raw.name,
      displayAddress: location.formatted_address || location.address || '',
      shortAddress: [location.locality, location.region]
        .filter(Boolean)
        .join(', '),
      coordinates: raw.geocodes?.main ? {
        latitude: raw.geocodes.main.latitude,
        longitude: raw.geocodes.main.longitude,
      } : undefined,
      city: location.locality || location.region,
      country: location.country,
      venue: {
        rating: raw.rating ? raw.rating / 2 : undefined,  // Convert 10→5 scale
        ratingCount: raw.stats?.total_ratings,
        priceLevel: raw.price as 1 | 2 | 3 | 4 | undefined,
        categories: categories.map((c: any) => c.name),
        primaryCategory: primaryCategory?.name,
        hours: raw.hours?.display,
        isOpenNow: raw.hours?.open_now,
        photoUrl,
        website: raw.website,
        phone: raw.tel,
      },
      distance: raw.distance,
    };
  }
}

interface FoursquarePlace {
  id: string;
  source: 'foursquare';
  name: string;
  displayAddress: string;
  shortAddress: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  city?: string;
  country?: string;
  venue: {
    rating?: number;
    ratingCount?: number;
    priceLevel?: 1 | 2 | 3 | 4;
    categories: string[];
    primaryCategory?: string;
    hours?: string;
    isOpenNow?: boolean;
    photoUrl?: string;
    website?: string;
    phone?: string;
  };
  distance?: number;
}

/**
 * Foursquare category IDs for archetype matching
 *
 * Full list: https://docs.foursquare.com/data-products/docs/categories
 */
export const ARCHETYPE_CATEGORY_MAP: Record<string, string[]> = {
  // The Hermit: Quiet, intimate spaces
  hermit: [
    '13032',  // Coffee Shop
    '13035',  // Tea Room
    '13009',  // Bookstore
    '12099',  // Park
    '10043',  // Library
  ],

  // The Sun: Lively, social venues
  sun: [
    '13065',  // Restaurant
    '13003',  // Bar
    '10032',  // Night Club
    '13060',  // Brunch
    '13025',  // Brewery
  ],

  // The Empress: Nurturing, comfortable spaces
  empress: [
    '13032',  // Coffee Shop
    '11104',  // Spa
    '13040',  // Bakery
    '17069',  // Farmers Market
    '13002',  // Home (private)
  ],

  // The Emperor: Upscale, structured venues
  emperor: [
    '13065',  // Restaurant
    '13338',  // Fine Dining
    '18021',  // Golf Course
    '18075',  // Tennis Court
    '13346',  // Steakhouse
  ],

  // The Fool: Fun, adventurous spots
  fool: [
    '10001',  // Arts & Entertainment
    '10056',  // Bowling Alley
    '10024',  // Arcade
    '10039',  // Movie Theater
    '10047',  // Theme Park
    '16032',  // Escape Room
  ],

  // The Magician: Creative, inspiring spaces
  magician: [
    '10004',  // Art Gallery
    '10027',  // Museum
    '13032',  // Coffee Shop (co-working vibe)
    '12009',  // Co-working Space
    '10062',  // Theater
  ],

  // The High Priestess: Intimate, meaningful venues
  high_priestess: [
    '13065',  // Restaurant
    '13028',  // Wine Bar
    '13032',  // Coffee Shop
    '13003',  // Bar (quiet)
    '12099',  // Park (for walks)
  ],

  // The Lovers: Romantic, special occasion spots
  lovers: [
    '13338',  // Fine Dining
    '13028',  // Wine Bar
    '13003',  // Cocktail Bar
    '10039',  // Movie Theater
    '10062',  // Theater
  ],
};
```

### 5.3 WeatherService

```typescript
// src/modules/location/services/weather.service.ts

import { OPENWEATHER_API_KEY } from '@/config/api-keys';

/**
 * OpenWeatherMap service
 * FREE - 1000 calls/day, 60 calls/minute
 *
 * Docs: https://openweathermap.org/api
 */
export class WeatherService {
  private readonly baseUrl = 'https://api.openweathermap.org/data/2.5';
  private readonly timeout = 5000;

  // In-memory cache (also persisted to DB for offline)
  private cache = new Map<string, { data: WeatherContext; expiry: number }>();
  private readonly CACHE_TTL = 30 * 60 * 1000;  // 30 minutes

  /**
   * Get weather for a location
   */
  async getWeather(
    location: { lat: number; lon: number } | string
  ): Promise<WeatherContext> {
    const cacheKey = typeof location === 'string'
      ? location.toLowerCase()
      : `${location.lat.toFixed(2)},${location.lon.toFixed(2)}`;

    // Check memory cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // Build params
    const params = new URLSearchParams({
      appid: OPENWEATHER_API_KEY,
      units: 'metric',
    });

    if (typeof location === 'string') {
      params.set('q', location);
    } else {
      params.set('lat', String(location.lat));
      params.set('lon', String(location.lon));
    }

    try {
      // Fetch current weather and forecast in parallel
      const [currentRes, forecastRes] = await Promise.all([
        fetch(`${this.baseUrl}/weather?${params}`),
        fetch(`${this.baseUrl}/forecast?${params}`),
      ]);

      if (!currentRes.ok || !forecastRes.ok) {
        throw new Error('Weather API error');
      }

      const [current, forecast] = await Promise.all([
        currentRes.json(),
        forecastRes.json(),
      ]);

      const weatherContext = this.processWeatherData(current, forecast);

      // Cache result
      this.cache.set(cacheKey, {
        data: weatherContext,
        expiry: Date.now() + this.CACHE_TTL,
      });

      return weatherContext;
    } catch (error) {
      console.error('Weather fetch failed:', error);

      // Return a default "unknown" weather if fetch fails
      return this.getDefaultWeather(
        typeof location === 'string' ? location : 'Unknown'
      );
    }
  }

  private processWeatherData(current: any, forecast: any): WeatherContext {
    const isOutdoorFriendly = this.isOutdoorFriendly(current);

    // Analyze next 24 hours (8 x 3-hour intervals)
    const next24h = forecast.list.slice(0, 8);

    const willRain = next24h.some((f: any) =>
      ['Rain', 'Drizzle', 'Thunderstorm'].includes(f.weather[0].main)
    );

    const willSnow = next24h.some((f: any) =>
      f.weather[0].main === 'Snow'
    );

    const rainProbability = Math.max(
      ...next24h.map((f: any) => f.pop || 0)
    );

    const temps = next24h.map((f: any) => f.main.temp);
    const highTemp = Math.round(Math.max(...temps));
    const lowTemp = Math.round(Math.min(...temps));

    const bestWindow = this.findBestOutdoorWindow(next24h);

    const { activityType, activityReason } = this.getActivityRecommendation(
      current,
      willRain,
      willSnow,
      isOutdoorFriendly
    );

    return {
      city: current.name,
      fetchedAt: new Date(),
      current: {
        temperature: Math.round(current.main.temp),
        feelsLike: Math.round(current.main.feels_like),
        humidity: current.main.humidity,
        description: this.capitalizeFirst(current.weather[0].description),
        icon: this.mapWeatherIcon(current.weather[0].icon),
        windSpeed: current.wind.speed,
        isOutdoorFriendly,
      },
      forecast: {
        willRain,
        willSnow,
        highTemp,
        lowTemp,
        rainProbability,
        bestOutdoorWindow: bestWindow,
      },
      activityType,
      activityReason,
    };
  }

  private isOutdoorFriendly(weather: any): boolean {
    const temp = weather.main.temp;
    const conditions = weather.weather[0].main;
    const wind = weather.wind.speed;

    const badConditions = ['Rain', 'Thunderstorm', 'Snow', 'Extreme', 'Tornado'];
    const isBadWeather = badConditions.includes(conditions);
    const isTooHot = temp > 35;
    const isTooCold = temp < 5;
    const isTooWindy = wind > 15;  // m/s

    return !isBadWeather && !isTooHot && !isTooCold && !isTooWindy;
  }

  private getActivityRecommendation(
    current: any,
    willRain: boolean,
    willSnow: boolean,
    isCurrentlyGood: boolean
  ): { activityType: WeatherContext['activityType']; activityReason: string } {
    const conditions = current.weather[0].main;
    const temp = current.main.temp;

    // Currently bad weather
    if (!isCurrentlyGood) {
      if (conditions === 'Rain' || conditions === 'Thunderstorm') {
        return { activityType: 'indoor', activityReason: 'Rainy right now' };
      }
      if (conditions === 'Snow') {
        return { activityType: 'indoor', activityReason: 'Snowing outside' };
      }
      if (temp > 35) {
        return { activityType: 'indoor', activityReason: 'Too hot outside' };
      }
      if (temp < 5) {
        return { activityType: 'indoor', activityReason: 'Too cold outside' };
      }
      return { activityType: 'indoor', activityReason: 'Weather not ideal' };
    }

    // Currently good but rain/snow coming
    if (willRain) {
      return { activityType: 'either', activityReason: 'Rain expected later' };
    }
    if (willSnow) {
      return { activityType: 'either', activityReason: 'Snow expected later' };
    }

    // All clear
    if (temp >= 18 && temp <= 26) {
      return { activityType: 'outdoor', activityReason: 'Perfect weather outside' };
    }

    return { activityType: 'either', activityReason: 'Weather looks decent' };
  }

  private findBestOutdoorWindow(
    forecast: any[]
  ): WeatherContext['forecast']['bestOutdoorWindow'] {
    let bestStart: Date | null = null;
    let bestEnd: Date | null = null;
    let currentStart: Date | null = null;
    let maxDuration = 0;

    for (let i = 0; i < forecast.length; i++) {
      const f = forecast[i];
      const isGood = this.isOutdoorFriendly(f) && (f.pop || 0) < 0.3;

      if (isGood) {
        if (!currentStart) {
          currentStart = new Date(f.dt * 1000);
        }
      } else {
        if (currentStart) {
          const endTime = new Date(f.dt * 1000);
          const duration = endTime.getTime() - currentStart.getTime();
          if (duration > maxDuration) {
            maxDuration = duration;
            bestStart = currentStart;
            bestEnd = endTime;
          }
          currentStart = null;
        }
      }
    }

    // Check if good weather extends to end of forecast
    if (currentStart) {
      const lastForecast = forecast[forecast.length - 1];
      const endTime = new Date(lastForecast.dt * 1000);
      const duration = endTime.getTime() - currentStart.getTime();
      if (duration > maxDuration) {
        bestStart = currentStart;
        bestEnd = endTime;
      }
    }

    if (bestStart && bestEnd) {
      const startHour = bestStart.getHours();
      const endHour = bestEnd.getHours();
      return {
        start: bestStart,
        end: bestEnd,
        description: `Clear ${startHour}:00 - ${endHour}:00`,
      };
    }

    return undefined;
  }

  private mapWeatherIcon(iconCode: string): WeatherIcon {
    const mapping: Record<string, WeatherIcon> = {
      '01d': 'clear-day',
      '01n': 'clear-night',
      '02d': 'partly-cloudy-day',
      '02n': 'partly-cloudy-night',
      '03d': 'cloudy',
      '03n': 'cloudy',
      '04d': 'cloudy',
      '04n': 'cloudy',
      '09d': 'rain',
      '09n': 'rain',
      '10d': 'rain',
      '10n': 'rain',
      '11d': 'thunderstorm',
      '11n': 'thunderstorm',
      '13d': 'snow',
      '13n': 'snow',
      '50d': 'fog',
      '50n': 'fog',
    };
    return mapping[iconCode] || 'cloudy';
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private getDefaultWeather(city: string): WeatherContext {
    return {
      city,
      fetchedAt: new Date(),
      current: {
        temperature: 20,
        feelsLike: 20,
        humidity: 50,
        description: 'Weather unavailable',
        icon: 'cloudy',
        windSpeed: 0,
        isOutdoorFriendly: true,
      },
      forecast: {
        willRain: false,
        willSnow: false,
        highTemp: 22,
        lowTemp: 15,
        rainProbability: 0,
      },
      activityType: 'either',
      activityReason: 'Weather data unavailable',
    };
  }
}

type WeatherIcon =
  | 'clear-day' | 'clear-night'
  | 'partly-cloudy-day' | 'partly-cloudy-night'
  | 'cloudy' | 'rain' | 'snow' | 'thunderstorm' | 'fog';
```

### 5.4 LocationIntelligenceService (Unified API)

```typescript
// src/modules/location/services/location-intelligence.service.ts

import { PhotonService } from './photon.service';
import { FoursquareService, ARCHETYPE_CATEGORY_MAP } from './foursquare.service';
import { WeatherService } from './weather.service';
import { database } from '@/db';

/**
 * Unified location intelligence service
 * Combines Photon (geocoding), Foursquare (venues), and OpenWeatherMap (weather)
 */
export class LocationIntelligenceService {
  private photon: PhotonService;
  private foursquare: FoursquareService;
  private weather: WeatherService;

  constructor() {
    this.photon = new PhotonService();
    this.foursquare = new FoursquareService();
    this.weather = new WeatherService();
  }

  /**
   * Search for places (combines address and venue search)
   */
  async searchPlaces(
    query: string,
    options?: {
      city?: string;
      coordinates?: { latitude: number; longitude: number };
      includeVenues?: boolean;  // Default: true
      limit?: number;
    }
  ): Promise<PlaceSearchResult[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const includeVenues = options?.includeVenues !== false;
    const limit = options?.limit || 8;

    // Build location context
    const ll = options?.coordinates
      ? `${options.coordinates.latitude},${options.coordinates.longitude}`
      : undefined;

    // Run searches in parallel
    const searches: Promise<PlaceSearchResult[]>[] = [];

    // Always search Photon for addresses
    searches.push(
      this.photon.autocomplete(query, {
        lat: options?.coordinates?.latitude,
        lon: options?.coordinates?.longitude,
        limit: includeVenues ? Math.ceil(limit / 2) : limit,
      }).then(results => results.map(r => ({
        id: r.id,
        name: r.name,
        secondaryText: r.displayAddress,
        source: 'photon' as const,
        coordinates: r.coordinates,
      })))
    );

    // Search Foursquare for venues if enabled
    if (includeVenues) {
      searches.push(
        this.foursquare.searchPlaces(query, {
          ll,
          near: options?.city,
          limit: Math.ceil(limit / 2),
        }).then(results => results.map(r => ({
          id: r.id,
          name: r.name,
          secondaryText: r.venue.primaryCategory || r.shortAddress,
          source: 'foursquare' as const,
          venueCategory: r.venue.primaryCategory,
          rating: r.venue.rating,
          distance: r.distance,
          coordinates: r.coordinates,
        })))
      );
    }

    const results = await Promise.all(searches);
    const merged = results.flat();

    // Sort: venues first (more relevant for weaves), then by distance if available
    merged.sort((a, b) => {
      // Foursquare results first
      if (a.source === 'foursquare' && b.source !== 'foursquare') return -1;
      if (a.source !== 'foursquare' && b.source === 'foursquare') return 1;

      // Then by distance
      if (a.distance && b.distance) return a.distance - b.distance;

      return 0;
    });

    return merged.slice(0, limit);
  }

  /**
   * Get full details for a place
   */
  async getPlaceDetails(
    placeId: string,
    source: 'foursquare' | 'photon'
  ): Promise<Place | null> {
    if (source === 'foursquare') {
      const result = await this.foursquare.getPlaceDetails(placeId);
      if (!result) return null;

      return {
        id: result.id,
        externalId: result.id,
        source: 'foursquare',
        name: result.name,
        displayAddress: result.displayAddress,
        shortAddress: result.shortAddress,
        coordinates: result.coordinates,
        city: result.city,
        country: result.country,
        venue: result.venue,
      };
    }

    // Photon doesn't have a details endpoint, return what we have
    return null;
  }

  /**
   * Find venues matching a friend's archetype
   */
  async findVenuesForArchetype(
    archetype: string,
    location: {
      city?: string;
      coordinates?: { latitude: number; longitude: number };
    },
    options?: {
      openNow?: boolean;
      limit?: number;
    }
  ): Promise<Place[]> {
    const archetypeKey = archetype.toLowerCase().replace('the_', '');
    const categories = ARCHETYPE_CATEGORY_MAP[archetypeKey] || ARCHETYPE_CATEGORY_MAP.hermit;

    const ll = location.coordinates
      ? `${location.coordinates.latitude},${location.coordinates.longitude}`
      : undefined;

    const results = await this.foursquare.searchByCategory(categories, {
      ll,
      near: location.city,
    }, {
      openNow: options?.openNow,
      limit: options?.limit || 5,
      sort: 'RATING',
    });

    return results.map(r => ({
      id: r.id,
      externalId: r.id,
      source: 'foursquare' as const,
      name: r.name,
      displayAddress: r.displayAddress,
      shortAddress: r.shortAddress,
      coordinates: r.coordinates,
      city: r.city,
      country: r.country,
      venue: r.venue,
    }));
  }

  /**
   * Get weather-aware activity suggestions
   */
  async getWeatherContext(
    location: { city?: string; coordinates?: { latitude: number; longitude: number } }
  ): Promise<WeatherContext> {
    if (location.coordinates) {
      return this.weather.getWeather({
        lat: location.coordinates.latitude,
        lon: location.coordinates.longitude,
      });
    }

    if (location.city) {
      return this.weather.getWeather(location.city);
    }

    throw new Error('Either city or coordinates required');
  }

  /**
   * Get weather-appropriate venues for an archetype
   */
  async getWeatherAwareVenues(
    archetype: string,
    location: { city?: string; coordinates?: { latitude: number; longitude: number } }
  ): Promise<{
    weather: WeatherContext;
    venues: Place[];
    recommendation: string;
  }> {
    const [weather, allVenues] = await Promise.all([
      this.getWeatherContext(location),
      this.findVenuesForArchetype(archetype, location, { limit: 10 }),
    ]);

    // Filter venues based on weather
    let venues = allVenues;
    let recommendation = '';

    if (weather.activityType === 'indoor') {
      // Prefer indoor venues
      venues = allVenues.filter(v => {
        const categories = v.venue?.categories || [];
        const outdoorCategories = ['Park', 'Beach', 'Trail', 'Garden'];
        return !categories.some(c => outdoorCategories.includes(c));
      });
      recommendation = `${weather.activityReason}. Here are some cozy indoor spots:`;
    } else if (weather.activityType === 'outdoor') {
      recommendation = `${weather.activityReason}. Great day for these spots:`;
    } else {
      recommendation = `${weather.activityReason}. These could work:`;
    }

    return {
      weather,
      venues: venues.slice(0, 5),
      recommendation,
    };
  }

  /**
   * Save a place to favorites
   */
  async savePlace(
    place: Place,
    options?: { nickname?: string; isFavorite?: boolean }
  ): Promise<SavedPlace> {
    return database.write(async () => {
      return database.get<SavedPlace>('saved_places').create(record => {
        record.externalId = place.externalId;
        record.source = place.source;
        record.name = place.name;
        record.displayAddress = place.displayAddress;
        record.shortAddress = place.shortAddress;
        record.latitude = place.coordinates?.latitude;
        record.longitude = place.coordinates?.longitude;
        record.city = place.city;
        record.country = place.country;
        record.venueDataJson = JSON.stringify(place.venue || {});
        record.timesVisited = 1;
        record.lastVisitedAt = new Date();
        record.nickname = options?.nickname;
        record.isFavorite = options?.isFavorite || false;
        record.createdAt = new Date();
        record.updatedAt = new Date();
      });
    });
  }

  /**
   * Get recently used places
   */
  async getRecentPlaces(limit: number = 5): Promise<Place[]> {
    const places = await database
      .get<SavedPlace>('saved_places')
      .query(
        Q.sortBy('last_visited_at', Q.desc),
        Q.take(limit)
      )
      .fetch();

    return places.map(p => p.toPlace());
  }

  /**
   * Get favorite places
   */
  async getFavoritePlaces(): Promise<Place[]> {
    const places = await database
      .get<SavedPlace>('saved_places')
      .query(
        Q.where('is_favorite', true),
        Q.sortBy('last_visited_at', Q.desc)
      )
      .fetch();

    return places.map(p => p.toPlace());
  }

  /**
   * Update place stats after a weave
   */
  async recordPlaceVisit(
    placeId: string,
    friendId: string,
    vibeScore?: number
  ): Promise<void> {
    const place = await database
      .get<SavedPlace>('saved_places')
      .find(placeId);

    if (!place) return;

    await database.write(async () => {
      await place.update(record => {
        record.timesVisited += 1;
        record.lastVisitedAt = new Date();
        record.updatedAt = new Date();

        // Update friends list
        const friends = record.friendsMetHere || [];
        if (!friends.includes(friendId)) {
          record.friendsMetHereJson = JSON.stringify([...friends, friendId]);
        }

        // Update average vibe
        if (vibeScore !== undefined) {
          const currentAvg = record.averageVibeScore || vibeScore;
          const visits = record.timesVisited;
          record.averageVibeScore =
            (currentAvg * (visits - 1) + vibeScore) / visits;
        }
      });
    });
  }
}
```

---

## Part 6: Oracle Integration

### 6.1 Context Builder Extension

```typescript
// Add to src/modules/oracle/services/context-builder.ts

interface LocationEnhancedContext {
  // ... existing context fields ...

  // Location intelligence
  location?: {
    userCity?: string;
    weather?: WeatherContext;

    // Venue suggestions
    venuesForArchetype?: {
      archetype: string;
      venues: Array<{
        name: string;
        category: string;
        rating?: number;
        priceLevel?: number;
        address: string;
      }>;
    };

    // Shared history
    favoriteVenues?: Array<{
      name: string;
      nickname?: string;
      timesVisited: number;
      friendsMetHere: string[];
    }>;

    recentVenuesWithFriend?: Array<{
      name: string;
      lastVisited: Date;
    }>;
  };
}

// In OracleContextBuilder class:

async buildLocationContext(
  friendIds: string[],
  userPrefs: LocationPreferences
): Promise<LocationEnhancedContext['location']> {
  const locationService = new LocationIntelligenceService();

  // Get user's city
  const city = userPrefs.defaultCity;
  if (!city) {
    return undefined;  // Location features disabled
  }

  try {
    // Get weather
    const weather = await locationService.getWeatherContext({ city });

    // Get venues for primary friend's archetype
    const primaryFriend = await this.getFriend(friendIds[0]);
    const archetype = primaryFriend.archetype || 'hermit';

    const venues = await locationService.findVenuesForArchetype(
      archetype,
      { city },
      { openNow: true, limit: 5 }
    );

    // Get favorites and recent places
    const favorites = await locationService.getFavoritePlaces();
    const recentWithFriend = await this.getRecentVenuesWithFriend(friendIds[0]);

    return {
      userCity: city,
      weather,
      venuesForArchetype: {
        archetype,
        venues: venues.map(v => ({
          name: v.name,
          category: v.venue?.primaryCategory || 'Venue',
          rating: v.venue?.rating,
          priceLevel: v.venue?.priceLevel,
          address: v.shortAddress || v.displayAddress,
        })),
      },
      favoriteVenues: favorites.slice(0, 3).map(f => ({
        name: f.name,
        nickname: f.weaveData?.nickname,
        timesVisited: f.weaveData?.timesVisited || 0,
        friendsMetHere: f.weaveData?.friendsMetHere || [],
      })),
      recentVenuesWithFriend: recentWithFriend.map(v => ({
        name: v.name,
        lastVisited: v.lastVisited,
      })),
    };
  } catch (error) {
    console.warn('Failed to build location context:', error);
    return undefined;
  }
}

private async getRecentVenuesWithFriend(friendId: string): Promise<Array<{
  name: string;
  lastVisited: Date;
}>> {
  // Query interactions with this friend that have place_id
  const interactions = await database
    .get<Interaction>('interactions')
    .query(
      Q.on('interaction_friends', 'friend_id', friendId),
      Q.where('place_id', Q.notEq(null)),
      Q.sortBy('date', Q.desc),
      Q.take(5)
    )
    .fetch();

  const results: Array<{ name: string; lastVisited: Date }> = [];

  for (const interaction of interactions) {
    if (interaction.placeId) {
      const place = await database
        .get<SavedPlace>('saved_places')
        .find(interaction.placeId)
        .catch(() => null);

      if (place) {
        results.push({
          name: place.nickname || place.name,
          lastVisited: interaction.date,
        });
      }
    }
  }

  return results;
}
```

### 6.2 Oracle Prompts

```typescript
// Add to src/shared/services/llm/prompt-registry.ts

/**
 * Weather and location-aware venue suggestions
 */
registerPrompt({
  id: 'location_venue_suggestion',
  version: '1.0.0',

  systemPrompt: `You are suggesting where to meet a friend, using real venue data and weather context.

You have access to:
1. Current weather conditions and forecast
2. Real nearby venues with ratings (from Foursquare)
3. The friend's archetype (personality type that affects venue preferences)
4. Places you've been together before

Guidelines:
- Suggest 2-3 specific venues by name
- Give a brief reason why each fits this friend
- Consider weather (suggest indoor if rainy, outdoor if nice)
- If there's a shared favorite, mention it warmly
- Keep each suggestion to 1-2 sentences
- Be conversational, not listy

Archetype preferences:
- Hermit: Quiet, intimate spaces (coffee shops, bookstores)
- Sun: Lively, social venues (restaurants, bars, events)
- Empress: Nurturing spaces (cafes, markets, home cooking)
- Emperor: Upscale, structured venues (fine dining, clubs)
- Fool: Fun, adventurous spots (activities, games, new experiences)
- Magician: Creative spaces (galleries, museums, workshops)
- High Priestess: Meaningful venues (quiet restaurants, walks)
- Lovers: Romantic spots (special dinners, experiences)`,

  userPromptTemplate: `Friend: {{friendName}}
Archetype: {{archetype}}

Weather in {{city}}:
- Currently: {{weather.current.description}}, {{weather.current.temperature}}°C
- Feels like: {{weather.current.feelsLike}}°C
- Outdoor-friendly: {{weather.current.isOutdoorFriendly}}
- Forecast: {{#if weather.forecast.willRain}}Rain expected{{else}}No rain expected{{/if}}
- Recommendation: {{weather.activityReason}}

Venues matching their vibe ({{archetype}}):
{{#each venuesForArchetype.venues}}
- {{this.name}} ({{this.category}}{{#if this.rating}}, {{this.rating}}★{{/if}}) - {{this.address}}
{{/each}}

{{#if favoriteVenues.length}}
Your favorite spots:
{{#each favoriteVenues}}
- {{this.name}}{{#if this.nickname}} ("{{this.nickname}}"){{/if}} - visited {{this.timesVisited}} times
{{/each}}
{{/if}}

{{#if recentVenuesWithFriend.length}}
Recent places with {{friendName}}:
{{#each recentVenuesWithFriend}}
- {{this.name}}
{{/each}}
{{/if}}

Suggest where to meet:`,

  responseSchema: {
    type: 'object',
    properties: {
      weatherContext: {
        type: 'string',
        maxLength: 60,
        description: 'Brief weather note, e.g., "Perfect patio weather" or "Cozy indoor day"'
      },
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            venueName: { type: 'string' },
            reason: { type: 'string', maxLength: 100 },
            isSharedFavorite: { type: 'boolean' },
          },
          required: ['venueName', 'reason'],
        },
        minItems: 2,
        maxItems: 3,
      },
    },
    required: ['suggestions'],
  },
});

/**
 * Activity suggestions based on weather
 */
registerPrompt({
  id: 'weather_activity_suggestion',
  version: '1.0.0',

  systemPrompt: `Suggest activities for meeting a friend based on current weather.

Keep suggestions:
- Specific to the weather conditions
- Matched to the friend's archetype/personality
- Practical and actionable
- 2-3 options with brief explanations`,

  userPromptTemplate: `Friend: {{friendName}} ({{archetype}})

Weather:
- {{weather.current.description}}, {{weather.current.temperature}}°C
- {{weather.activityReason}}
{{#if weather.forecast.bestOutdoorWindow}}
- Best outdoor time: {{weather.forecast.bestOutdoorWindow.description}}
{{/if}}

Suggest 2-3 activities:`,

  responseSchema: {
    type: 'object',
    properties: {
      activities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            activity: { type: 'string' },
            reason: { type: 'string', maxLength: 80 },
            isOutdoor: { type: 'boolean' },
          },
          required: ['activity', 'reason'],
        },
        minItems: 2,
        maxItems: 3,
      },
    },
    required: ['activities'],
  },
});
```

### 6.3 Oracle Service Methods

```typescript
// Add to src/modules/oracle/services/oracle-service.ts

/**
 * Get venue suggestions for a friend
 */
async suggestVenues(
  friendId: string,
  options?: { includeWeather?: boolean }
): Promise<VenueSuggestionResponse> {
  const friend = await this.getFriend(friendId);
  const userPrefs = await this.getLocationPreferences();

  if (!userPrefs.defaultCity) {
    throw new Error('Please set your city in location settings');
  }

  const locationContext = await this.contextBuilder.buildLocationContext(
    [friendId],
    userPrefs
  );

  if (!locationContext?.venuesForArchetype?.venues.length) {
    throw new Error('Could not find venues in your area');
  }

  const response = await this.llmService.completeStructured({
    promptId: 'location_venue_suggestion',
    variables: {
      friendName: friend.name,
      archetype: friend.archetype || 'Hermit',
      city: locationContext.userCity,
      weather: locationContext.weather,
      venuesForArchetype: locationContext.venuesForArchetype,
      favoriteVenues: locationContext.favoriteVenues || [],
      recentVenuesWithFriend: locationContext.recentVenuesWithFriend || [],
    },
    contextTier: ContextTier.ESSENTIAL,
  });

  return {
    weatherContext: response.weatherContext,
    suggestions: response.suggestions,
    rawVenues: locationContext.venuesForArchetype.venues,
  };
}

/**
 * Get weather-aware activity suggestions
 */
async suggestActivities(
  friendId: string
): Promise<ActivitySuggestionResponse> {
  const friend = await this.getFriend(friendId);
  const userPrefs = await this.getLocationPreferences();

  if (!userPrefs.defaultCity || !userPrefs.weatherEnabled) {
    // Return generic suggestions without weather
    return this.getGenericActivitySuggestions(friend.archetype);
  }

  const locationService = new LocationIntelligenceService();
  const weather = await locationService.getWeatherContext({
    city: userPrefs.defaultCity,
  });

  const response = await this.llmService.completeStructured({
    promptId: 'weather_activity_suggestion',
    variables: {
      friendName: friend.name,
      archetype: friend.archetype || 'Hermit',
      weather,
    },
    contextTier: ContextTier.ESSENTIAL,
  });

  return {
    weather,
    activities: response.activities,
  };
}
```

---

## Part 7: UI Components

### 7.1 PlaceAutocompleteInput

```typescript
// src/modules/location/components/PlaceAutocompleteInput.tsx

import React, { useState, useMemo, useCallback } from 'react';
import { View, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';
import { Text, Input, Icon, Card } from '@/shared/ui';
import { LocationIntelligenceService } from '../services/location-intelligence.service';
import type { Place, PlaceSearchResult } from '../types/location.types';

interface PlaceAutocompleteInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectPlace: (place: Place) => void;
  placeholder?: string;
  city?: string;
  recentPlaces?: Place[];
  showVenueRatings?: boolean;
}

export function PlaceAutocompleteInput({
  value,
  onChangeText,
  onSelectPlace,
  placeholder = 'Search for a place...',
  city,
  recentPlaces = [],
  showVenueRatings = true,
}: PlaceAutocompleteInputProps) {
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const locationService = useMemo(
    () => new LocationIntelligenceService(),
    []
  );

  const debouncedSearch = useDebouncedCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const places = await locationService.searchPlaces(query, {
        city,
        limit: 6,
      });
      setResults(places);
    } catch (error) {
      console.error('Place search failed:', error);
      setResults([]);
    }
    setIsSearching(false);
  }, 300);

  const handleSelect = useCallback(async (result: PlaceSearchResult) => {
    // Get full details if it's a Foursquare venue
    let place: Place;

    if (result.source === 'foursquare') {
      const details = await locationService.getPlaceDetails(
        result.id,
        'foursquare'
      );
      place = details || {
        id: result.id,
        externalId: result.id,
        source: 'foursquare',
        name: result.name,
        displayAddress: result.secondaryText,
        coordinates: result.coordinates,
      };
    } else {
      place = {
        id: result.id,
        source: 'photon',
        name: result.name,
        displayAddress: result.secondaryText,
        coordinates: result.coordinates,
      };
    }

    onSelectPlace(place);
    onChangeText(place.name);
    setResults([]);
    setIsFocused(false);
  }, [locationService, onSelectPlace, onChangeText]);

  const handleRecentSelect = useCallback((place: Place) => {
    onSelectPlace(place);
    onChangeText(place.weaveData?.nickname || place.name);
    setIsFocused(false);
  }, [onSelectPlace, onChangeText]);

  const showRecent = isFocused && value.length === 0 && recentPlaces.length > 0;
  const showResults = results.length > 0;

  return (
    <View>
      <Input
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          debouncedSearch(text);
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          // Delay to allow tap on results
          setTimeout(() => setIsFocused(false), 200);
        }}
        placeholder={placeholder}
        leftIcon={<Icon name="MapPin" size={18} className="text-muted-foreground" />}
        rightIcon={
          isSearching ? (
            <ActivityIndicator size="small" />
          ) : value.length > 0 ? (
            <Pressable onPress={() => onChangeText('')}>
              <Icon name="X" size={16} className="text-muted-foreground" />
            </Pressable>
          ) : undefined
        }
      />

      {/* Recent places */}
      {showRecent && (
        <View className="mt-2">
          <Text variant="caption" className="text-muted-foreground mb-2">
            Recent places
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {recentPlaces.slice(0, 4).map((place) => (
              <Pressable
                key={place.id}
                onPress={() => handleRecentSelect(place)}
                className="px-3 py-1.5 bg-muted rounded-full flex-row items-center"
              >
                <Icon name="Clock" size={12} className="text-muted-foreground mr-1.5" />
                <Text variant="caption">
                  {place.weaveData?.nickname || place.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Search results */}
      {showResults && (
        <Card className="mt-2 overflow-hidden">
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                className={`p-3 flex-row items-center ${
                  index > 0 ? 'border-t border-border' : ''
                }`}
              >
                <Icon
                  name={item.source === 'foursquare' ? 'Store' : 'MapPin'}
                  size={16}
                  className="text-muted-foreground mr-3"
                />
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text variant="body" className="flex-1" numberOfLines={1}>
                      {item.name}
                    </Text>
                    {showVenueRatings && item.rating && (
                      <View className="flex-row items-center ml-2">
                        <Icon name="Star" size={12} className="text-yellow-500 mr-0.5" />
                        <Text variant="caption">{item.rating.toFixed(1)}</Text>
                      </View>
                    )}
                  </View>
                  <Text variant="caption" className="text-muted-foreground" numberOfLines={1}>
                    {item.venueCategory
                      ? `${item.venueCategory} · ${item.secondaryText}`
                      : item.secondaryText}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </Card>
      )}
    </View>
  );
}
```

### 7.2 WeatherBadge

```typescript
// src/modules/location/components/WeatherBadge.tsx

import React from 'react';
import { View } from 'react-native';
import { Text, Icon } from '@/shared/ui';
import type { WeatherContext, WeatherIcon } from '../types/location.types';

interface WeatherBadgeProps {
  weather: WeatherContext;
  variant?: 'compact' | 'full';
  showForecast?: boolean;
}

const WEATHER_ICONS: Record<WeatherIcon, string> = {
  'clear-day': 'Sun',
  'clear-night': 'Moon',
  'partly-cloudy-day': 'CloudSun',
  'partly-cloudy-night': 'CloudMoon',
  'cloudy': 'Cloud',
  'rain': 'CloudRain',
  'snow': 'Snowflake',
  'thunderstorm': 'CloudLightning',
  'fog': 'CloudFog',
};

export function WeatherBadge({
  weather,
  variant = 'compact',
  showForecast = false,
}: WeatherBadgeProps) {
  const iconName = WEATHER_ICONS[weather.current.icon] || 'Cloud';

  if (variant === 'compact') {
    return (
      <View className="flex-row items-center gap-1.5 px-2 py-1 bg-muted rounded-full">
        <Icon name={iconName} size={14} />
        <Text variant="caption">{weather.current.temperature}°</Text>
      </View>
    );
  }

  return (
    <View className="p-3 bg-muted rounded-lg">
      <View className="flex-row items-center">
        <Icon name={iconName} size={24} className="mr-3" />
        <View className="flex-1">
          <View className="flex-row items-baseline">
            <Text variant="h4">{weather.current.temperature}°</Text>
            <Text variant="caption" className="text-muted-foreground ml-1">
              feels like {weather.current.feelsLike}°
            </Text>
          </View>
          <Text variant="body">{weather.current.description}</Text>
        </View>
      </View>

      {showForecast && (
        <View className="mt-3 pt-3 border-t border-border">
          <View className="flex-row justify-between">
            <View className="flex-row items-center">
              {weather.forecast.willRain && (
                <>
                  <Icon name="Umbrella" size={14} className="text-blue-500 mr-1" />
                  <Text variant="caption" className="text-blue-500">
                    Rain later ({Math.round(weather.forecast.rainProbability * 100)}%)
                  </Text>
                </>
              )}
              {!weather.forecast.willRain && (
                <Text variant="caption" className="text-muted-foreground">
                  No rain expected
                </Text>
              )}
            </View>
            <Text variant="caption" className="text-muted-foreground">
              H: {weather.forecast.highTemp}° L: {weather.forecast.lowTemp}°
            </Text>
          </View>

          {weather.forecast.bestOutdoorWindow && (
            <View className="flex-row items-center mt-2">
              <Icon name="Sun" size={14} className="text-green-500 mr-1" />
              <Text variant="caption" className="text-green-600">
                {weather.forecast.bestOutdoorWindow.description}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Activity recommendation */}
      <View className="mt-2 pt-2 border-t border-border">
        <Text variant="caption" className="text-muted-foreground">
          {weather.activityReason}
        </Text>
      </View>
    </View>
  );
}
```

### 7.3 VenueSuggestionCard

```typescript
// src/modules/location/components/VenueSuggestionCard.tsx

import React from 'react';
import { View, Pressable, Linking } from 'react-native';
import { Text, Icon, Card, Button } from '@/shared/ui';
import type { Place } from '../types/location.types';

interface VenueSuggestionCardProps {
  venue: Place;
  reason?: string;
  isSharedFavorite?: boolean;
  onSelect?: () => void;
}

export function VenueSuggestionCard({
  venue,
  reason,
  isSharedFavorite,
  onSelect,
}: VenueSuggestionCardProps) {
  const openInMaps = () => {
    if (venue.coordinates) {
      const url = `https://maps.apple.com/?q=${encodeURIComponent(venue.name)}&ll=${venue.coordinates.latitude},${venue.coordinates.longitude}`;
      Linking.openURL(url);
    } else {
      const url = `https://maps.apple.com/?q=${encodeURIComponent(venue.name + ' ' + venue.displayAddress)}`;
      Linking.openURL(url);
    }
  };

  return (
    <Card className="p-4">
      <View className="flex-row items-start">
        <View className="flex-1">
          {/* Header */}
          <View className="flex-row items-center mb-1">
            {isSharedFavorite && (
              <Icon name="Heart" size={14} className="text-red-500 mr-1.5" />
            )}
            <Text variant="body" className="font-medium flex-1">
              {venue.name}
            </Text>
            {venue.venue?.rating && (
              <View className="flex-row items-center ml-2">
                <Icon name="Star" size={12} className="text-yellow-500 mr-0.5" />
                <Text variant="caption">{venue.venue.rating.toFixed(1)}</Text>
              </View>
            )}
          </View>

          {/* Category & Price */}
          <View className="flex-row items-center mb-2">
            {venue.venue?.primaryCategory && (
              <Text variant="caption" className="text-muted-foreground">
                {venue.venue.primaryCategory}
              </Text>
            )}
            {venue.venue?.priceLevel && (
              <Text variant="caption" className="text-muted-foreground ml-2">
                {'$'.repeat(venue.venue.priceLevel)}
              </Text>
            )}
            {venue.venue?.isOpenNow !== undefined && (
              <Text
                variant="caption"
                className={`ml-2 ${venue.venue.isOpenNow ? 'text-green-600' : 'text-red-500'}`}
              >
                {venue.venue.isOpenNow ? 'Open' : 'Closed'}
              </Text>
            )}
          </View>

          {/* Reason */}
          {reason && (
            <Text variant="caption" className="text-muted-foreground mb-2">
              {reason}
            </Text>
          )}

          {/* Address */}
          <Pressable onPress={openInMaps} className="flex-row items-center">
            <Icon name="MapPin" size={12} className="text-primary mr-1" />
            <Text variant="caption" className="text-primary" numberOfLines={1}>
              {venue.shortAddress || venue.displayAddress}
            </Text>
          </Pressable>
        </View>

        {/* Select button */}
        {onSelect && (
          <Pressable
            onPress={onSelect}
            className="ml-3 p-2 bg-primary/10 rounded-lg"
          >
            <Icon name="Plus" size={20} className="text-primary" />
          </Pressable>
        )}
      </View>
    </Card>
  );
}
```

### 7.4 LocationSettingsScreen

```typescript
// src/modules/location/screens/LocationSettingsScreen.tsx

import React from 'react';
import { View, ScrollView, Switch } from 'react-native';
import { Text, Card, Button } from '@/shared/ui';
import { PlaceAutocompleteInput } from '../components/PlaceAutocompleteInput';
import { useLocationPreferences } from '../hooks/useLocationPreferences';

export function LocationSettingsScreen() {
  const { preferences, updatePreferences, isLoading } = useLocationPreferences();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-4 space-y-6">
        {/* Header */}
        <View>
          <Text variant="h3">Location & Weather</Text>
          <Text variant="body" className="text-muted-foreground mt-1">
            Enable location features for better venue suggestions
          </Text>
        </View>

        {/* Default City */}
        <Card className="p-4">
          <Text variant="body" className="font-medium mb-2">
            Your City
          </Text>
          <Text variant="caption" className="text-muted-foreground mb-3">
            Used for weather and venue suggestions
          </Text>
          <PlaceAutocompleteInput
            value={preferences.defaultCity || ''}
            onChangeText={() => {}}
            onSelectPlace={(place) => {
              updatePreferences({
                defaultCity: place.city || place.name,
              });
            }}
            placeholder="e.g., San Francisco"
            showVenueRatings={false}
          />
        </Card>

        {/* Weather Toggle */}
        <Card className="p-4">
          <View className="flex-row justify-between items-center">
            <View className="flex-1 mr-4">
              <Text variant="body" className="font-medium">
                Weather-aware suggestions
              </Text>
              <Text variant="caption" className="text-muted-foreground mt-1">
                Get indoor/outdoor recommendations based on weather
              </Text>
            </View>
            <Switch
              value={preferences.weatherEnabled}
              onValueChange={(value) => {
                updatePreferences({ weatherEnabled: value });
              }}
            />
          </View>
        </Card>

        {/* Venue Photos Toggle */}
        <Card className="p-4">
          <View className="flex-row justify-between items-center">
            <View className="flex-1 mr-4">
              <Text variant="body" className="font-medium">
                Show venue photos
              </Text>
              <Text variant="caption" className="text-muted-foreground mt-1">
                Display photos in venue suggestions
              </Text>
            </View>
            <Switch
              value={preferences.venuePhotosEnabled}
              onValueChange={(value) => {
                updatePreferences({ venuePhotosEnabled: value });
              }}
            />
          </View>
        </Card>

        {/* Privacy Note */}
        <View className="px-2">
          <Text variant="caption" className="text-muted-foreground text-center">
            Location data is only used to improve suggestions.
            We never track or store your precise location.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
```

---

## Part 8: Configuration

### 8.1 API Keys Setup

```typescript
// src/config/api-keys.ts

import Constants from 'expo-constants';

/**
 * API keys for location services
 *
 * Setup:
 * 1. Get Foursquare API key: https://foursquare.com/developers/signup
 * 2. Get OpenWeatherMap key: https://openweathermap.org/api
 * 3. Add to .env or app.config.js
 */

export const FOURSQUARE_API_KEY =
  Constants.expoConfig?.extra?.foursquareApiKey ||
  process.env.FOURSQUARE_API_KEY ||
  '';

export const OPENWEATHER_API_KEY =
  Constants.expoConfig?.extra?.openWeatherApiKey ||
  process.env.OPENWEATHER_API_KEY ||
  '';

// Validation
if (!FOURSQUARE_API_KEY) {
  console.warn('FOURSQUARE_API_KEY not configured - venue search disabled');
}

if (!OPENWEATHER_API_KEY) {
  console.warn('OPENWEATHER_API_KEY not configured - weather features disabled');
}
```

### 8.2 Environment Variables

```bash
# .env

# Foursquare Places API (Free)
# Get key at: https://foursquare.com/developers/signup
FOURSQUARE_API_KEY=fsq3xxxxxxxxxxxxxxxxxxxxx

# OpenWeatherMap API (Free - 1000 calls/day)
# Get key at: https://openweathermap.org/api
OPENWEATHER_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 8.3 App Config

```javascript
// app.config.js

export default {
  expo: {
    // ... existing config

    extra: {
      foursquareApiKey: process.env.FOURSQUARE_API_KEY,
      openWeatherApiKey: process.env.OPENWEATHER_API_KEY,
    },
  },
};
```

---

## Part 9: Implementation Plan

### Phase 1: Foundation (Week 1)

| Task | Effort | Priority |
|------|--------|----------|
| Add database schemas (saved_places, weather_cache) | Small | P0 |
| Create SavedPlace model | Small | P0 |
| Implement PhotonService | Medium | P0 |
| Implement FoursquareService | Medium | P0 |
| Implement WeatherService | Medium | P0 |
| Create LocationIntelligenceService | Medium | P0 |
| Set up API key configuration | Small | P0 |

### Phase 2: UI Components (Week 2)

| Task | Effort | Priority |
|------|--------|----------|
| Build PlaceAutocompleteInput | Medium | P0 |
| Build WeatherBadge | Small | P1 |
| Build VenueSuggestionCard | Small | P1 |
| Integrate into WeaveLoggerScreen | Medium | P0 |
| Integrate into PlanWizardStep3 | Medium | P0 |
| Build LocationSettingsScreen | Medium | P1 |

### Phase 3: Oracle Integration (Week 3)

| Task | Effort | Priority |
|------|--------|----------|
| Extend context builder with location | Medium | P1 |
| Add location_venue_suggestion prompt | Small | P1 |
| Add weather_activity_suggestion prompt | Small | P1 |
| Add Oracle.suggestVenues() method | Medium | P1 |
| Add Oracle.suggestActivities() method | Small | P1 |

### Phase 4: Polish (Week 4)

| Task | Effort | Priority |
|------|--------|----------|
| Favorite places management | Medium | P2 |
| Place visit analytics | Medium | P2 |
| Offline caching improvements | Medium | P2 |
| Error handling & fallbacks | Small | P1 |
| Testing & bug fixes | Medium | P0 |

---

## Part 10: Files to Create

### New Files

| File | Purpose |
|------|---------|
| `src/modules/location/` | New module directory |
| `src/modules/location/types/location.types.ts` | Type definitions |
| `src/modules/location/services/photon.service.ts` | Photon geocoding |
| `src/modules/location/services/foursquare.service.ts` | Foursquare venues |
| `src/modules/location/services/weather.service.ts` | OpenWeatherMap |
| `src/modules/location/services/location-intelligence.service.ts` | Unified API |
| `src/modules/location/components/PlaceAutocompleteInput.tsx` | Autocomplete |
| `src/modules/location/components/WeatherBadge.tsx` | Weather display |
| `src/modules/location/components/VenueSuggestionCard.tsx` | Venue card |
| `src/modules/location/screens/LocationSettingsScreen.tsx` | Settings |
| `src/modules/location/hooks/useLocationPreferences.ts` | Preferences hook |
| `src/modules/location/hooks/useWeather.ts` | Weather hook |
| `src/modules/location/index.ts` | Public exports |
| `src/db/models/SavedPlace.ts` | Database model |
| `src/config/api-keys.ts` | API key management |

### Modified Files

| File | Changes |
|------|---------|
| `src/db/schema.ts` | Add saved_places, weather_cache tables |
| `src/db/migrations.ts` | Migration for new tables |
| `src/db/models/Interaction.ts` | Add place_id field |
| `src/modules/oracle/services/context-builder.ts` | Add location context |
| `src/shared/services/llm/prompt-registry.ts` | Add location prompts |
| `src/modules/oracle/services/oracle-service.ts` | Add venue/activity methods |
| `src/modules/interactions/screens/WeaveLoggerScreen.tsx` | Integrate autocomplete |
| `src/modules/interactions/components/plan-wizard/PlanWizardStep3.tsx` | Integrate autocomplete |
| `src/modules/settings/screens/SettingsScreen.tsx` | Add location settings link |
| `app.config.js` | Add API key config |

---

## Part 11: Cost & Limits Summary

### API Limits (Free Tiers)

| Service | Limit | Notes |
|---------|-------|-------|
| Photon | Fair use | No hard limit, be reasonable |
| Foursquare | 50 req/sec | No monthly limit |
| OpenWeatherMap | 1000/day | ~42/hour |

### Estimated Usage

| Feature | Calls/Day | API |
|---------|-----------|-----|
| Location autocomplete | ~50 | Photon + Foursquare |
| Venue suggestions | ~20 | Foursquare |
| Weather checks | ~10 | OpenWeatherMap |
| **Total** | **~80** | **Well under limits** |

### Monthly Cost

**$0** (all free tier)

### Upgrade Path (If Needed)

| Scenario | Solution | Cost |
|----------|----------|------|
| Need more weather calls | OpenWeatherMap paid | $40/mo for 1M calls |
| Need map tiles | Mapbox | $0.75/1K tiles |
| Need better venue data | Foursquare Premium | Contact sales |
| Self-host geocoding | Run Photon on server | Server costs |

---

## Part 12: Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Autocomplete usage | 30% of weaves include location | Database query |
| Venue suggestion engagement | 20% tap rate | Analytics |
| Weather context views | 50% of plan screens | Analytics |
| Favorite places saved | Avg 3 per user | Database |
| API error rate | <1% | Error logging |
| Search latency | <500ms P95 | Performance monitoring |

---

## Part 13: Privacy & Security

### Data Handling

| Data Type | Storage | Shared With |
|-----------|---------|-------------|
| Search queries | Not stored | Photon, Foursquare |
| Selected places | Local DB only | None |
| Coordinates | Local DB (optional) | Weather API only |
| Weather data | Cached 30min | None |

### Privacy Controls

- Location features are opt-in (default city required)
- No GPS/precise location used
- No location tracking or history sent to servers
- All venue/weather data cached locally
- Users can clear location history anytime

### API Key Security

- Keys stored in environment variables
- Not committed to repository
- Expo SecureStore for production builds
- Rate limiting on all API calls

---

## Appendix A: Foursquare Category Reference

Common categories for archetype matching:

```typescript
// Full list: https://docs.foursquare.com/data-products/docs/categories

const CATEGORIES = {
  // Food & Drink
  '13065': 'Restaurant',
  '13032': 'Coffee Shop',
  '13003': 'Bar',
  '13028': 'Wine Bar',
  '13025': 'Brewery',
  '13040': 'Bakery',
  '13060': 'Brunch',
  '13338': 'Fine Dining',
  '13346': 'Steakhouse',

  // Arts & Entertainment
  '10001': 'Arts & Entertainment',
  '10004': 'Art Gallery',
  '10027': 'Museum',
  '10039': 'Movie Theater',
  '10062': 'Theater',
  '10024': 'Arcade',
  '10056': 'Bowling Alley',
  '16032': 'Escape Room',

  // Outdoors
  '12099': 'Park',
  '16019': 'Beach',
  '16025': 'Garden',
  '16032': 'Trail',

  // Services
  '11104': 'Spa',
  '12009': 'Co-working Space',
  '10043': 'Library',
  '13009': 'Bookstore',

  // Sports
  '18021': 'Golf Course',
  '18075': 'Tennis Court',
  '18000': 'Gym',
};
```

---

## Appendix B: Weather Icon Mapping

```typescript
// OpenWeatherMap icon codes to Lucide icons

const ICON_MAP: Record<string, string> = {
  // Day
  '01d': 'Sun',           // Clear
  '02d': 'CloudSun',      // Few clouds
  '03d': 'Cloud',         // Scattered clouds
  '04d': 'Cloud',         // Broken clouds
  '09d': 'CloudRain',     // Shower rain
  '10d': 'CloudSunRain',  // Rain
  '11d': 'CloudLightning',// Thunderstorm
  '13d': 'Snowflake',     // Snow
  '50d': 'CloudFog',      // Mist

  // Night
  '01n': 'Moon',
  '02n': 'CloudMoon',
  '03n': 'Cloud',
  '04n': 'Cloud',
  '09n': 'CloudRain',
  '10n': 'CloudMoonRain',
  '11n': 'CloudLightning',
  '13n': 'Snowflake',
  '50n': 'CloudFog',
};
```
