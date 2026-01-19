import { Router } from 'express';
import { fetchAllPages, getRentmanClient } from '../services/rentmanClient.js';

export const crewRouter = Router();

/**
 * GET /api/crew
 * Hämtar alla crewmedlemmar
 */
crewRouter.get('/', async (req, res, next) => {
  try {
    const crew = await fetchAllPages('/crew');

    // Map to simplified format
    const simplifiedCrew = crew.map(member => ({
      id: member.id,
      name: member.displayname || `${member.firstname || ''} ${member.lastname || ''}`.trim(),
      firstName: member.firstname,
      lastName: member.lastname,
      email: member.email,
      phone: member.phone,
      function: member.function,
      color: member.color || '#3B82F6',
      active: member.active !== false
    }));

    // Sort by name
    simplifiedCrew.sort((a, b) => a.name.localeCompare(b.name, 'sv'));

    res.json({
      data: simplifiedCrew,
      count: simplifiedCrew.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/crew/:id
 * Hämtar en specifik crewmedlem
 */
crewRouter.get('/:id', async (req, res, next) => {
  try {
    const client = getRentmanClient();
    const response = await client.get(`/crew/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Crew member not found' });
    }
    next(error);
  }
});

/**
 * GET /api/crew/:id/availability
 * Hämtar tillgänglighet för en crewmedlem
 */
crewRouter.get('/:id/availability', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const client = getRentmanClient();

    const params = {};
    if (startDate) params['start[gte]'] = startDate;
    if (endDate) params['end[lte]'] = endDate;

    const response = await client.get(`/crew/${req.params.id}/crewavailability`, { params });
    res.json(response.data);
  } catch (error) {
    next(error);
  }
});
