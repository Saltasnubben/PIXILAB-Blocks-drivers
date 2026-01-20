<?php
/**
 * Crew Endpoint
 *
 * GET /api/crew - Lista alla crewmedlemmar
 * GET /api/crew/{id} - Hämta en specifik crewmedlem
 * GET /api/crew/{id}/availability - Hämta tillgänglighet
 */

function handleCrewEndpoint(RentmanClient $rentman, ApiResponse $response, ?string $id, ?string $subEndpoint): void
{
    if ($id === null) {
        // GET /api/crew - Lista alla
        handleGetAllCrew($rentman, $response);
    } elseif ($subEndpoint === 'availability') {
        // GET /api/crew/{id}/availability
        handleGetCrewAvailability($rentman, $response, $id);
    } elseif ($subEndpoint === 'bookings' || $subEndpoint === 'projectcrew') {
        // GET /api/crew/{id}/bookings - Hämta crewmedlems bokningar
        handleGetCrewBookings($rentman, $response, $id);
    } else {
        // GET /api/crew/{id}
        handleGetCrewMember($rentman, $response, $id);
    }
}

/**
 * Hämtar alla crewmedlemmar
 */
function handleGetAllCrew(RentmanClient $rentman, ApiResponse $response): void
{
    $crew = $rentman->fetchAllPages('/crew');

    // Mappa till förenklat format
    $simplifiedCrew = array_map(function ($member) {
        $firstName = $member['firstname'] ?? '';
        $lastName = $member['lastname'] ?? '';
        $displayName = $member['displayname'] ?? trim("$firstName $lastName");

        return [
            'id' => $member['id'],
            'name' => $displayName ?: 'Unnamed',
            'firstName' => $firstName,
            'lastName' => $lastName,
            'email' => $member['email'] ?? null,
            'phone' => $member['phone'] ?? null,
            'function' => $member['function'] ?? null,
            'color' => $member['color'] ?? '#3B82F6',
            'active' => ($member['active'] ?? true) !== false,
        ];
    }, $crew);

    // Sortera efter namn (svensk sortering)
    usort($simplifiedCrew, function ($a, $b) {
        return strcoll($a['name'], $b['name']);
    });

    // Filtrera endast aktiva om ?active=true
    if (isset($_GET['active']) && $_GET['active'] === 'true') {
        $simplifiedCrew = array_filter($simplifiedCrew, fn($c) => $c['active']);
        $simplifiedCrew = array_values($simplifiedCrew);
    }

    $response->json([
        'data' => $simplifiedCrew,
        'count' => count($simplifiedCrew),
    ]);
}

/**
 * Hämtar en specifik crewmedlem
 */
function handleGetCrewMember(RentmanClient $rentman, ApiResponse $response, string $id): void
{
    try {
        $result = $rentman->get("/crew/$id");
        $response->json($result);
    } catch (Exception $e) {
        if ($e->getCode() === 404) {
            $response->notFound("Crew member not found: $id");
        }
        throw $e;
    }
}

/**
 * Hämtar tillgänglighet för en crewmedlem
 */
function handleGetCrewAvailability(RentmanClient $rentman, ApiResponse $response, string $id): void
{
    $params = [];

    if (!empty($_GET['startDate'])) {
        $params['start[gte]'] = $_GET['startDate'];
    }
    if (!empty($_GET['endDate'])) {
        $params['end[lte]'] = $_GET['endDate'];
    }

    $result = $rentman->get("/crew/$id/crewavailability", $params);
    $response->json($result);
}

/**
 * Hämtar bokningar/projektuppdrag för en crewmedlem
 */
function handleGetCrewBookings(RentmanClient $rentman, ApiResponse $response, string $id): void
{
    $startDate = $_GET['startDate'] ?? date('Y-m-d');
    $endDate = $_GET['endDate'] ?? date('Y-m-d', strtotime('+7 days'));

    // Hämta projektuppdrag via globala /projectcrew med crewmember-filter
    // Rentman använder referens-format för relationer
    $params = ['crewmember' => "/crew/$id"];
    $assignments = $rentman->fetchAllPages("/projectcrew", $params, 25);

    // Debug-läge: visa all info
    if (isset($_GET['debug'])) {
        // Visa första 3 råa assignments för att se vilka fält som finns
        $sampleAssignments = array_slice($assignments, 0, 3);

        $response->json([
            'debug' => true,
            'assignments_count' => count($assignments),
            'sample_raw_data' => $sampleAssignments,
            'available_fields' => !empty($assignments) ? array_keys($assignments[0]) : [],
            'filter_used' => $params,
            'crew_id_searched' => $id,
        ]);
        return;
    }

    // För varje assignment, hämta projektinfo för att få datum
    $bookings = [];
    foreach ($assignments as $assignment) {
        // Extrahera projekt-ID från referens
        $projectRef = $assignment['project'] ?? null;
        if (!$projectRef) continue;

        preg_match('/\/projects\/(\d+)/', $projectRef, $matches);
        if (empty($matches[1])) continue;

        $projectId = $matches[1];

        // Hämta projektdata (cacheas av RentmanClient)
        try {
            $projectData = $rentman->get("/projects/$projectId");
            $project = $projectData['data'] ?? $projectData;

            $projectStart = $project['planperiod_start'] ?? null;
            $projectEnd = $project['planperiod_end'] ?? null;

            // Filtrera på datum
            if ($projectStart && $projectEnd) {
                // Projekt slutar innan vårt startdatum - skippa
                if ($projectEnd < $startDate) continue;
                // Projekt startar efter vårt slutdatum - skippa
                if ($projectStart > $endDate) continue;
            }

            $bookings[] = [
                'id' => $assignment['id'],
                'projectId' => (int)$projectId,
                'projectName' => $project['displayname'] ?? $project['name'] ?? 'Unnamed',
                'projectColor' => $project['color'] ?? '#3B82F6',
                'projectStatus' => $project['status'] ?? null,
                'start' => $projectStart,
                'end' => $projectEnd,
                'location' => $project['location'] ?? null,
                'customer' => $project['account_name'] ?? null,
                'role' => $assignment['crewfunction'] ?? 'Crew',
                'remark' => $assignment['remark'] ?? null,
            ];
        } catch (Exception $e) {
            // Skippa om projekt inte kan hämtas
            error_log("Could not fetch project $projectId: " . $e->getMessage());
            continue;
        }
    }

    // Sortera efter startdatum
    usort($bookings, fn($a, $b) => strcmp($a['start'] ?? '', $b['start'] ?? ''));

    $response->json([
        'data' => $bookings,
        'count' => count($bookings),
        'crewId' => (int)$id,
        'period' => ['startDate' => $startDate, 'endDate' => $endDate],
    ]);
}
