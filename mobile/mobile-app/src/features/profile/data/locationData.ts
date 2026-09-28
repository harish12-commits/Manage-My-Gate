export interface CityData {
  name: string;
}

export interface StateData {
  name: string;
  cities: string[];
}

export interface CountryData {
  code: string;
  name: string;
  flag: string;
  states: StateData[];
}

export const POPULAR_LOCATIONS = [
  'Bengaluru, Karnataka, India',
  'Dubai, United Arab Emirates',
  'Mumbai, Maharashtra, India',
  'Riyadh, Saudi Arabia',
  'New Delhi, Delhi NCR, India',
  'Abu Dhabi, United Arab Emirates',
  'Hyderabad, Telangana, India',
  'Chennai, Tamil Nadu, India',
  'London, England, United Kingdom',
  'New York, New York, United States',
  'San Francisco, California, United States',
  'Singapore, Singapore',
  'Toronto, Ontario, Canada',
  'Doha, Qatar',
];

export const COUNTRIES_DATA: CountryData[] = [
  {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    states: [
      {
        name: 'Karnataka',
        cities: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi', 'Udupi', 'Shivamogga', 'Tumakuru'],
      },
      {
        name: 'Maharashtra',
        cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad', 'Navi Mumbai', 'Solapur'],
      },
      {
        name: 'Tamil Nadu',
        cities: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode', 'Vellore'],
      },
      {
        name: 'Delhi NCR',
        cities: ['New Delhi', 'South Delhi', 'Noida', 'Gurugram', 'Ghaziabad', 'Faridabad', 'Dwarka'],
      },
      {
        name: 'Telangana',
        cities: ['Hyderabad', 'Secunderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'],
      },
      {
        name: 'Kerala',
        cities: ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Alappuzha'],
      },
      {
        name: 'Gujarat',
        cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar'],
      },
      {
        name: 'West Bengal',
        cities: ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Kharagpur'],
      },
      {
        name: 'Rajasthan',
        cities: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner', 'Bhilwara'],
      },
      {
        name: 'Uttar Pradesh',
        cities: ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Prayagraj', 'Meerut', 'Bareilly'],
      },
      {
        name: 'Punjab',
        cities: ['Chandigarh', 'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda'],
      },
      {
        name: 'Haryana',
        cities: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal', 'Rohtak'],
      },
      {
        name: 'Andhra Pradesh',
        cities: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati', 'Kakinada'],
      },
      {
        name: 'Madhya Pradesh',
        cities: ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain'],
      },
      {
        name: 'Goa',
        cities: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'],
      },
    ],
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    flag: '🇦🇪',
    states: [
      {
        name: 'Dubai',
        cities: ['Downtown Dubai', 'Dubai Marina', 'Business Bay', 'Palm Jumeirah', 'Jumeirah', 'JLT', 'Deira', 'Bur Dubai', 'Dubai Hills'],
      },
      {
        name: 'Abu Dhabi',
        cities: ['Abu Dhabi City', 'Corniche', 'Al Reem Island', 'Yas Island', 'Saadiyat Island', 'Al Khalidiya', 'Al Ain'],
      },
      {
        name: 'Sharjah',
        cities: ['Al Majaz', 'Al Nahda', 'Al Taawun', 'Muwailih', 'Sharjah City'],
      },
      {
        name: 'Ajman',
        cities: ['Al Nuaimiya', 'Al Rashidiya', 'Ajman Downtown', 'Corniche Ajman'],
      },
      {
        name: 'Ras Al Khaimah',
        cities: ['Al Hamra Village', 'Mina Al Arab', 'RAK City'],
      },
      {
        name: 'Fujairah',
        cities: ['Fujairah City', 'Dibba Al-Fujairah'],
      },
      {
        name: 'Umm Al Quwain',
        cities: ['Umm Al Quwain City'],
      },
    ],
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    flag: '🇸🇦',
    states: [
      {
        name: 'Riyadh Region',
        cities: ['Riyadh', 'Al Kharj', 'Diriyah', 'Al Majmaah'],
      },
      {
        name: 'Makkah Region',
        cities: ['Jeddah', 'Mecca', 'Taif', 'Rabigh'],
      },
      {
        name: 'Eastern Province',
        cities: ['Dammam', 'Khobar', 'Dhahran', 'Al Jubail', 'Al Ahsa', 'Qatif'],
      },
      {
        name: 'Madinah Region',
        cities: ['Medina', 'Yanbu', 'Al Ula'],
      },
      {
        name: 'Asir Region',
        cities: ['Abha', 'Khamis Mushait'],
      },
      {
        name: 'Tabuk Region',
        cities: ['Tabuk', 'NEOM'],
      },
    ],
  },
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    states: [
      {
        name: 'California',
        cities: ['San Francisco', 'Los Angeles', 'San Diego', 'San Jose', 'Palo Alto', 'Oakland', 'Sacramento'],
      },
      {
        name: 'Texas',
        cities: ['Austin', 'Dallas', 'Houston', 'San Antonio', 'Fort Worth', 'Plano'],
      },
      {
        name: 'New York',
        cities: ['New York City', 'Brooklyn', 'Queens', 'Manhattan', 'Buffalo', 'Albany'],
      },
      {
        name: 'Washington',
        cities: ['Seattle', 'Bellevue', 'Redmond', 'Tacoma', 'Spokane'],
      },
      {
        name: 'Florida',
        cities: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale'],
      },
      {
        name: 'Illinois',
        cities: ['Chicago', 'Naperville', 'Aurora', 'Evanston'],
      },
      {
        name: 'Massachusetts',
        cities: ['Boston', 'Cambridge', 'Worcester'],
      },
      {
        name: 'Georgia',
        cities: ['Atlanta', 'Alpharetta', 'Savannah'],
      },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    states: [
      {
        name: 'England',
        cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool', 'Bristol', 'Cambridge', 'Oxford'],
      },
      {
        name: 'Scotland',
        cities: ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee'],
      },
      {
        name: 'Wales',
        cities: ['Cardiff', 'Swansea', 'Newport'],
      },
      {
        name: 'Northern Ireland',
        cities: ['Belfast', 'Derry'],
      },
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    states: [
      {
        name: 'Ontario',
        cities: ['Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Waterloo', 'Markham'],
      },
      {
        name: 'British Columbia',
        cities: ['Vancouver', 'Victoria', 'Surrey', 'Burnaby', 'Richmond'],
      },
      {
        name: 'Alberta',
        cities: ['Calgary', 'Edmonton', 'Banff'],
      },
      {
        name: 'Quebec',
        cities: ['Montreal', 'Quebec City', 'Laval'],
      },
    ],
  },
  {
    code: 'SG',
    name: 'Singapore',
    flag: '🇸🇬',
    states: [
      {
        name: 'Singapore',
        cities: ['Downtown Core', 'Jurong', 'Tampines', 'Woodlands', 'Orchard', 'Sentosa', 'Bedok'],
      },
    ],
  },
  {
    code: 'AU',
    name: 'Australia',
    flag: '🇦🇺',
    states: [
      {
        name: 'New South Wales',
        cities: ['Sydney', 'Newcastle', 'Wollongong', 'Parramatta'],
      },
      {
        name: 'Victoria',
        cities: ['Melbourne', 'Geelong', 'Ballarat'],
      },
      {
        name: 'Queensland',
        cities: ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Cairns'],
      },
      {
        name: 'Western Australia',
        cities: ['Perth', 'Fremantle'],
      },
    ],
  },
  {
    code: 'QA',
    name: 'Qatar',
    flag: '🇶🇦',
    states: [
      {
        name: 'Doha',
        cities: ['Doha', 'West Bay', 'The Pearl-Qatar', 'Lusail', 'Al Sadd'],
      },
      {
        name: 'Al Rayyan',
        cities: ['Al Rayyan', 'Education City'],
      },
      {
        name: 'Al Wakrah',
        cities: ['Al Wakrah City', 'Mesaieed'],
      },
    ],
  },
  {
    code: 'KW',
    name: 'Kuwait',
    flag: '🇰🇼',
    states: [
      {
        name: 'Kuwait',
        cities: ['Kuwait City', 'Salmiya', 'Hawalli', 'Farwaniya', 'Al Ahmadi'],
      },
    ],
  },
  {
    code: 'BH',
    name: 'Bahrain',
    flag: '🇧🇭',
    states: [
      {
        name: 'Bahrain',
        cities: ['Manama', 'Riffa', 'Muharraq', 'Juffair', 'Seef'],
      },
    ],
  },
  {
    code: 'OM',
    name: 'Oman',
    flag: '🇴🇲',
    states: [
      {
        name: 'Oman',
        cities: ['Muscat', 'Salalah', 'Sohar', 'Muttrah', 'Seeb', 'Nizwa'],
      },
    ],
  },
  {
    code: 'DE',
    name: 'Germany',
    flag: '🇩🇪',
    states: [
      {
        name: 'Berlin',
        cities: ['Berlin'],
      },
      {
        name: 'Bavaria',
        cities: ['Munich', 'Nuremberg', 'Augsburg'],
      },
      {
        name: 'Hesse',
        cities: ['Frankfurt', 'Wiesbaden', 'Darmstadt'],
      },
      {
        name: 'Hamburg',
        cities: ['Hamburg'],
      },
      {
        name: 'Baden-Württemberg',
        cities: ['Stuttgart', 'Karlsruhe', 'Heidelberg'],
      },
    ],
  },
];

/**
 * Reverse geocode latitude/longitude into human-readable city, state, country
 */
export async function reverseGeocodeCoords(latitude: number, longitude: number): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const city = data.city || data.locality || data.principalSubdivisionCode || '';
      const state = data.principalSubdivision || '';
      const country = data.countryName || '';

      const parts = [city, state, country].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
  } catch (err) {
    console.warn('[Location] Reverse geocoding primary service failed, falling back:', err);
  }

  // Secondary fallback using OpenStreetMap Nominatim
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
      {
        headers: { 'User-Agent': 'ManageMyGate-App/1.0' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || '';
      const state = addr.state || '';
      const country = addr.country || '';

      const parts = [city, state, country].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
  } catch (err) {
    console.warn('[Location] Reverse geocoding secondary service failed:', err);
  }

  return `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
}
