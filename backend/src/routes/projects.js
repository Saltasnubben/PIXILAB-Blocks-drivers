import { Router } from 'express';
import { fetchAllPages, getRentmanClient } from '../services/rentmanClient.js';

export const projectsRouter = Router();

/**
 * GET /api/projects
 * Hämtar projekt, med möjlighet att filtrera på datum
 */
projectsRouter.get('/', async (req, res, next) => {
  try {
    const { startDate, endDate, status } = req.query;
    const params = {};

    // Date filters for planning period
    if (startDate) {
      params['planperiod_end[gte]'] = startDate;
    }
    if (endDate) {
      params['planperiod_start[lte]'] = endDate;
    }

    // Status filter
    if (status) {
      params.status = status;
    }

    const projects = await fetchAllPages('/projects', params);

    // Map to simplified format
    const simplifiedProjects = projects.map(project => ({
      id: project.id,
      name: project.displayname || project.name,
      status: project.status,
      location: project.location,
      planningStart: project.planperiod_start,
      planningEnd: project.planperiod_end,
      usageStart: project.usageperiod_start,
      usageEnd: project.usageperiod_end,
      color: project.color,
      customer: project.account_name,
      reference: project.reference
    }));

    res.json({
      data: simplifiedProjects,
      count: simplifiedProjects.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:id
 * Hämtar ett specifikt projekt med detaljer
 */
projectsRouter.get('/:id', async (req, res, next) => {
  try {
    const client = getRentmanClient();
    const response = await client.get(`/projects/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Project not found' });
    }
    next(error);
  }
});

/**
 * GET /api/projects/:id/crew
 * Hämtar crew-tilldelningar för ett projekt
 */
projectsRouter.get('/:id/crew', async (req, res, next) => {
  try {
    const crew = await fetchAllPages(`/projects/${req.params.id}/projectcrew`);
    res.json({
      data: crew,
      count: crew.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:id/functions
 * Hämtar projektfunktioner (roller/jobb)
 */
projectsRouter.get('/:id/functions', async (req, res, next) => {
  try {
    const functions = await fetchAllPages(`/projects/${req.params.id}/projectfunctiongroups`);
    res.json({
      data: functions,
      count: functions.length
    });
  } catch (error) {
    next(error);
  }
});
