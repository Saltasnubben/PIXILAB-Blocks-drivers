import axios from 'axios';
import { format } from 'date-fns';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Fetch all crew members
 */
export async function fetchCrew() {
  const response = await api.get('/crew');
  return response.data;
}

/**
 * Fetch a single crew member
 */
export async function fetchCrewMember(id) {
  const response = await api.get(`/crew/${id}`);
  return response.data;
}

/**
 * Fetch bookings for selected crew members within a date range
 */
export async function fetchBookings({ crewIds, startDate, endDate }) {
  const params = {
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd')
  };

  if (crewIds && crewIds.length > 0) {
    params.crewIds = crewIds.join(',');
  }

  const response = await api.get('/bookings', { params });
  return response.data;
}

/**
 * Fetch projects within a date range
 */
export async function fetchProjects({ startDate, endDate }) {
  const params = {};

  if (startDate) {
    params.startDate = format(startDate, 'yyyy-MM-dd');
  }
  if (endDate) {
    params.endDate = format(endDate, 'yyyy-MM-dd');
  }

  const response = await api.get('/projects', { params });
  return response.data;
}

/**
 * Check API health
 */
export async function checkHealth() {
  const response = await api.get('/health');
  return response.data;
}

export default api;
