<?php
/**
 * Projects Endpoint
 *
 * GET /api/projects - Lista projekt (med datumfilter)
 * GET /api/projects/{id} - Hämta ett specifikt projekt
 */

function handleProjectsEndpoint(RentmanClient $rentman, ApiResponse $response, ?string $id): void
{
    if ($id === null) {
        handleGetAllProjects($rentman, $response);
    } else {
        handleGetProject($rentman, $response, $id);
    }
}

/**
 * Hämtar alla projekt (med valfritt datumfilter)
 */
function handleGetAllProjects(RentmanClient $rentman, ApiResponse $response): void
{
    $params = [];

    // Datumfilter
    if (!empty($_GET['startDate'])) {
        $params['planperiod_end[gte]'] = $_GET['startDate'];
    }
    if (!empty($_GET['endDate'])) {
        $params['planperiod_start[lte]'] = $_GET['endDate'];
    }

    // Statusfilter
    if (!empty($_GET['status'])) {
        $params['status'] = $_GET['status'];
    }

    $projects = $rentman->fetchAllPages('/projects', $params);

    // Mappa till förenklat format
    $simplifiedProjects = array_map(function ($project) {
        return [
            'id' => $project['id'],
            'name' => $project['displayname'] ?? $project['name'] ?? 'Unnamed',
            'status' => $project['status'] ?? null,
            'start' => $project['planperiod_start'] ?? null,
            'end' => $project['planperiod_end'] ?? null,
            'location' => $project['location'] ?? null,
            'customer' => $project['account_name'] ?? null,
            'color' => $project['color'] ?? '#3B82F6',
        ];
    }, $projects);

    // Sortera efter startdatum
    usort($simplifiedProjects, function ($a, $b) {
        return strcmp($a['start'] ?? '', $b['start'] ?? '');
    });

    $response->json([
        'data' => $simplifiedProjects,
        'count' => count($simplifiedProjects),
    ]);
}

/**
 * Hämtar ett specifikt projekt med detaljer
 */
function handleGetProject(RentmanClient $rentman, ApiResponse $response, string $id): void
{
    try {
        $result = $rentman->get("/projects/$id");
        $response->json($result);
    } catch (Exception $e) {
        if ($e->getCode() === 404) {
            $response->notFound("Project not found: $id");
        }
        throw $e;
    }
}
