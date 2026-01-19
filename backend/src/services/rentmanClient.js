import axios from 'axios';

const RENTMAN_API_BASE = 'https://api.rentman.net';

/**
 * Creates an authenticated Rentman API client
 */
function createRentmanClient() {
  const token = process.env.RENTMAN_API_TOKEN;

  if (!token) {
    throw new Error('RENTMAN_API_TOKEN environment variable is not set');
  }

  const client = axios.create({
    baseURL: RENTMAN_API_BASE,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    timeout: 30000
  });

  // Response interceptor for error handling
  client.interceptors.response.use(
    response => response,
    error => {
      if (error.response) {
        const { status, data } = error.response;
        console.error(`Rentman API Error [${status}]:`, data);

        if (status === 401) {
          throw new Error('Invalid Rentman API token');
        }
        if (status === 403) {
          throw new Error('Access denied to Rentman resource');
        }
        if (status === 429) {
          throw new Error('Rate limit exceeded - please try again later');
        }
      }
      throw error;
    }
  );

  return client;
}

// Lazy initialization
let clientInstance = null;

export function getRentmanClient() {
  if (!clientInstance) {
    clientInstance = createRentmanClient();
  }
  return clientInstance;
}

/**
 * Fetches all pages of a paginated Rentman API response
 */
export async function fetchAllPages(endpoint, params = {}) {
  const client = getRentmanClient();
  const allData = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await client.get(endpoint, {
      params: { ...params, limit, offset }
    });

    const { data, itemCount } = response.data;

    if (!data || data.length === 0) break;

    allData.push(...data);

    // Check if we've fetched all items
    if (allData.length >= itemCount || data.length < limit) {
      break;
    }

    offset += limit;
  }

  return allData;
}

export default getRentmanClient;
