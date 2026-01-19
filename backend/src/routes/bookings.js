import { Router } from 'express';
import { fetchAllPages, getRentmanClient } from '../services/rentmanClient.js';

export const bookingsRouter = Router();

/**
 * GET /api/bookings
 * Hämtar bokningar för valda crewmedlemmar under en specifik period
 *
 * Query params:
 * - crewIds: Kommaseparerade crew-ID:n
 * - startDate: Startdatum (ISO format)
 * - endDate: Slutdatum (ISO format)
 */
bookingsRouter.get('/', async (req, res, next) => {
  try {
    const { crewIds, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDate and endDate are required'
      });
    }

    // Parse crew IDs
    const selectedCrewIds = crewIds
      ? crewIds.split(',').map(id => parseInt(id.trim(), 10)).filter(Boolean)
      : [];

    // Fetch projects within the date range
    const projectParams = {
      'planperiod_end[gte]': startDate,
      'planperiod_start[lte]': endDate
    };

    const projects = await fetchAllPages('/projects', projectParams);

    if (projects.length === 0) {
      return res.json({ data: [], count: 0 });
    }

    // Fetch crew assignments for each project in parallel
    const client = getRentmanClient();
    const crewAssignmentPromises = projects.map(async project => {
      try {
        const crewAssignments = await fetchAllPages(`/projects/${project.id}/projectcrew`);
        return { project, crewAssignments };
      } catch (error) {
        console.warn(`Failed to fetch crew for project ${project.id}:`, error.message);
        return { project, crewAssignments: [] };
      }
    });

    const projectsWithCrew = await Promise.all(crewAssignmentPromises);

    // Also fetch project functions for more detailed booking info
    const functionPromises = projects.map(async project => {
      try {
        const functions = await fetchAllPages(`/projects/${project.id}/projectfunctions`);
        return { projectId: project.id, functions };
      } catch (error) {
        return { projectId: project.id, functions: [] };
      }
    });

    const projectFunctions = await Promise.all(functionPromises);
    const functionsByProject = Object.fromEntries(
      projectFunctions.map(pf => [pf.projectId, pf.functions])
    );

    // Build bookings list
    const bookings = [];

    for (const { project, crewAssignments } of projectsWithCrew) {
      for (const assignment of crewAssignments) {
        // Extract crew ID from the assignment
        const crewId = extractCrewId(assignment.crew);

        // Filter by selected crew if specified
        if (selectedCrewIds.length > 0 && !selectedCrewIds.includes(crewId)) {
          continue;
        }

        // Find associated function for timing details
        const projectFunction = findFunction(
          functionsByProject[project.id],
          assignment.projectfunction
        );

        const booking = {
          id: `${project.id}-${assignment.id}`,
          projectId: project.id,
          projectName: project.displayname || project.name,
          projectColor: project.color || '#3B82F6',
          projectStatus: project.status,
          crewId: crewId,
          crewAssignmentId: assignment.id,
          role: assignment.function_name || projectFunction?.name || 'Crew',
          // Use function times if available, otherwise project planning period
          start: projectFunction?.planperiod_start || project.planperiod_start,
          end: projectFunction?.planperiod_end || project.planperiod_end,
          location: project.location,
          customer: project.account_name,
          notes: assignment.remark
        };

        bookings.push(booking);
      }
    }

    // Sort by start date
    bookings.sort((a, b) => new Date(a.start) - new Date(b.start));

    res.json({
      data: bookings,
      count: bookings.length,
      period: { startDate, endDate },
      projectCount: projects.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bookings/by-crew/:crewId
 * Hämtar alla bokningar för en specifik crewmedlem
 */
bookingsRouter.get('/by-crew/:crewId', async (req, res, next) => {
  try {
    const { crewId } = req.params;
    const { startDate, endDate } = req.query;

    // Redirect to main endpoint with crew filter
    req.query.crewIds = crewId;
    return bookingsRouter.handle(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * Extracts crew ID from a reference string like "/crew/123"
 */
function extractCrewId(crewRef) {
  if (!crewRef) return null;
  if (typeof crewRef === 'number') return crewRef;

  const match = String(crewRef).match(/\/crew\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Finds a function by reference
 */
function findFunction(functions, functionRef) {
  if (!functions || !functionRef) return null;

  const match = String(functionRef).match(/\/projectfunctions\/(\d+)/);
  if (!match) return null;

  const functionId = parseInt(match[1], 10);
  return functions.find(f => f.id === functionId);
}
