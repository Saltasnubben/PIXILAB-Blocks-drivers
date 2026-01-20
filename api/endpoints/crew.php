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
    // Hämta crewmedlems projektuppdrag direkt från Rentman
    $assignments = $rentman->fetchAllPages("/crew/$id/projectcrew", [], 50);

    $response->json([
        'data' => $assignments,
        'count' => count($assignments),
        'crewId' => (int)$id,
    ]);
}
